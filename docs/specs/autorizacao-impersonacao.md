# Autorização da impersonação entre empresas

## Recorte aprovado

Em 04/11/2026, o usuário aprovou corrigir a autorização da troca de empresa por impersonação, preservando o fluxo
legítimo do superusuário, validar com dados fictícios, atualizar a documentação e a versão local e abrir PR, sem
merge ou deploy e com WhatsApp desconectado.

A mudança abrange a entrada, o retorno e a renovação da sessão impersonada. O defeito de entrada está na rota que
usa o middleware de administrador comum sob o nome `isSuper`; há também falta de vínculo entre bearer, cookie e
cadastros atuais nos caminhos de entrada/retorno, e a renovação não revalida a autoridade da origem.

## Comportamento

- **Entrada:** `GET /auth/impersonate/:companyId` exige bearer e cookie `jrt` normais, válidos e da mesma identidade
  e empresa. Antes de consultar o alvo, conferir usuário atual, empresa, perfil, privilégio de superusuário e
  `tokenVersion` do cookie. Somente superusuário atual pode prosseguir. O id da empresa de destino é uma única
  string decimal canônica de inteiro positivo seguro; a empresa precisa ter um administrador disponível.
- **Sessão derivada:** emitir o par do administrador de destino com `impersonated: true` e vínculo assinado à
  origem: `originalUserId`, `originalCompanyId` e `originalTokenVersion`. Esses campos vêm do cadastro autorizado,
  sem seleção pelo body ou por cabeçalhos do cliente. Uma sessão já impersonada não pode iniciar outra.
- **Retorno:** `POST /auth/impersonate/back` exige bearer e cookie impersonados do mesmo alvo, com os três campos
  de origem idênticos. Revalidar identidade/empresa atuais e versão do cookie do alvo; conferir que a origem ainda
  existe, pertence à empresa registrada, continua superusuária e mantém a versão registrada. Restaurar o cadastro
  completo atual da origem, emitindo par normal e resposta `{ token, user }` compatível com o frontend.
- **Renovação:** `POST /auth/refresh_token` revalida alvo e origem de uma sessão impersonada antes de emitir outro
  par, preservando os três campos de origem. Sessões removidas, transferidas ou revogadas não podem criar novos
  tokens por esses caminhos. O comportamento da renovação de sessões normais permanece preservado.
- **IPs e 2FA:** aplicar a lista de IPs da identidade de destino antes da emissão, com a exceção de recuperação de
  superusuário já definida no RF-016. A entrada depende do cookie normal atual da sessão completa do superusuário;
  um desafio 2FA não concede esse acesso. A impersonação administrativa não pede senha ou segundo fator do alvo.
  Mudanças de 2FA que incrementam a versão da origem ou do alvo invalidam o contexto derivado. O tratamento herdado
  de horários das sessões impersonadas permanece preservado.
- **Rotação por 2FA:** ativar ou desativar 2FA com um bearer impersonado limpa `jrt`, sem emitir cookie normal.
  A alteração mantém seu resultado e exige novo login, impedindo que esse emissor remova o vínculo à origem.
  Sessões normais continuam recebendo o cookie renovado após a alteração de 2FA.

## Recusas e compatibilidade

- Na entrada, ator sem privilégio ou contexto cadastral incompatível recebe 403 (`ERR_NO_PERMISSION`); cookie
  inválido, identidades misturadas ou versão de cookie obsoleta recebem 401. O gate `isAuth` existente continua
  respondendo 403 (`ERR_SESSION_EXPIRED`) para bearer inválido ou expirado, antes do controlador e sem limpar o
  cookie, permitindo o fluxo atual de renovação do frontend. Destino malformado ou tentativa
  válida de encadeamento recebem 400; ausência de administrador no destino recebe 404 (`ERR_NO_USER_FOUND`).
- No retorno, um par normal recebe 400 (`ERR_NOT_IMPERSONATING`). Após o gate `isAuth`, contexto impersonado
  inválido recebe 401 e limpa o cookie `jrt`, sem emitir tokens de retorno. Falhas de IP conservam 403
  (`ERR_IP_NOT_ALLOWED`); na renovação derivada, também limpam o cookie antes de recusar a emissão.
- Cookies derivados anteriores sem `originalTokenVersion` são recusados; o superusuário precisa autenticar-se
  novamente para iniciar uma sessão vinculada. Não há migração de banco nem recuperação por confiança em claims
  incompletos. Cookies já convertidos em normais pela rotação de 2FA da versão anterior não têm marcador que permita
  identificá-los retroativamente; a correção não revoga esses cookies em massa.
- Endpoints, resposta de sucesso, confirmação em Empresas e ação Sair/retorno permanecem compatíveis. Não alterar
  globalmente `isAuth` ou `isSuper`, nem permissões de outros módulos nesta correção.

**Limite explícito:** a revalidação protege entrada, retorno e renovação. Tokens de acesso já emitidos continuam
sujeitos ao TTL existente de até quinze minutos. Não há revogação imediata desses tokens nos demais endpoints,
sockets ou mídia, nem alteração desses ingressos neste recorte.

## Critérios observáveis

- Usuário e administrador comum não assumem outra empresa, mesmo com token válido; nenhuma identidade de destino
  é emitida em uma recusa.
- Superusuário com par normal atual entra no destino autorizado, renova a sessão derivada e retorna à sua conta.
  A resposta e o cookie identificam a mesma conta em cada transição.
- Cookies e bearers de contas diferentes, tokens inválidos, metadados de origem divergentes ou incompletos e
  versões obsoletas são recusados sem emissão indevida de token, cookie, evento ou auditoria de sucesso.
- Remoção, transferência ou revogação de superusuário da origem impedem entrada/retorno/renovação pertinentes;
  alterações de versão da origem e do alvo invalidam a sessão derivada nesses caminhos.
- IP de destino recusado impede a emissão e mantém o código público de erro. Login/2FA e renovação normais
  continuam com seus comportamentos atuais.
- Regressões exercitam as rotas reais, autenticação, emissão e validação dos JWTs, cookies e predicados de cadastro;
  os cenários de defeito falham na versão anterior pelo motivo esperado. Validar também pela API local isolada com
  dados fictícios, sem iniciar o bootstrap de WhatsApp.
- A documentação descreve o limite de quinze minutos e a reautenticação dos contextos derivados legados. Evidências
  de execução e CI pertencem ao PR; esta especificação não declara verificações concluídas.

Referências: [PRD RF-016](../PRD.md), [TAD](../TAD.md), [princípios](../PRINCIPLES.md) e
[workflow de entrega](../DELIVERY-WORKFLOW.md). Mídia de setores e opções de setores ficam fora deste recorte.
