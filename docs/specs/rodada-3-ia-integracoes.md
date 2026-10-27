# Rodada 3 — plano de IA, Acessórias e SCI

**Data:** 27/10/2026. **Estado:** proposta para definição do piloto; não implementada.
**Base examinada:** `6682e92b2303dcbcdc79427f47a3ddab789235aa`, PR #17 de segurança, sobre a pilha existente.

O pedido desta etapa é preparar o plano e identificar credenciais/acessos. Ele não autoriza chamadas com dados reais,
contratação, publicação, envio de mensagens ou operações de escrita nos fornecedores. Não há prazo, orçamento ou modelo
de IA aprovado. A edição/instalação da SCI e o plano do Acessórias ainda precisam ser confirmados.

## 1. O que já existe no projeto

Fatos verificados pelo código, sem ler valores de credenciais ou dados de clientes:

- Há SDK `openai ^4.95.1` no backend e transcrição opcional de áudio por OpenAI/Groq em
  `backend/src/helpers/transcriber.ts`, chamada por `wbotMessageListener`. Não foi verificado se está habilitada.
  Esse recurso herdado é diferente de resumir conversas ou sugerir respostas.
- O histórico de mensagens já possui filtros de empresa/setor. O serviço de IA deve conferir o acesso ao atendimento
  e limitar o contexto; não reutilizar a consulta com `markAsRead=true`, que altera o estado de leitura.
- O composer em `MessageInputCustom` já possui rascunho. A sugestão pode preencher o editor após ação humana,
  mantendo o botão de envio como ação separada. O rascunho atual usa `sessionStorage`, a considerar na política de dados.
- Há painel do cliente, Bull/Redis e auditoria reaproveitáveis. Jobs de integração devem usar fila própria,
  separada da `MessageQueue`, que envia mensagens.
- Não há vínculo estruturado entre contato local e empresa contábil externa. Telefone sozinho não identifica CNPJ,
  escritório ou empresa representada; uma pessoa pode representar vários CNPJs.

O PRD mantém IA/novas integrações fora do recorte anterior. Este documento propõe a ampliação sem registrar funções
planejadas como entregues. Os critérios abaixo só devem ser promovidos a requisitos aprovados ao confirmar o piloto.

## 2. Pré-requisitos técnicos antes de cadastrar chaves

**P0 é a primeira entrega recomendada.** Há três caminhos existentes que não devem ser reutilizados sem correção:

1. **Credenciais:** `Settings.value` é texto comum; a tela atual de AI Key recebe o valor. `AuthUserService` inclui
   `Company.settings` e `SerializeUser` devolve a empresa. Por leitura de código, uma chave salva ali pode acompanhar
   o payload de autenticação. Não foi feita exploração com segredo real. Criar armazenamento restrito ao backend,
   por empresa, com referência em cofre ou valor cifrado, chave mestra fora do banco e das respostas, rotação e exclusão.
   Login, refresh, settings, logs, auditoria e jobs não podem expor os valores. A migração da configuração de transcrição
   deve preservar o recurso existente, retornar apenas estado configurado/mascarado e não manter uma segunda cópia legível.
2. **Notas:** os caminhos herdados de `TicketNote` filtram por contato/atendimento sem validar `companyId` nesse serviço.
   Conferir empresa, setor e acesso antes de incluir notas no contexto; até lá, usar apenas mensagens autorizadas.
3. **Arquivos:** uploads usuais ficam em `public` e são servidos por `/public/*`. Documentos contábeis exigem download
   autenticado e autorização por empresa/cliente. No primeiro piloto, preferir metadados e consulta ao sistema de origem.

Além do `companyId` do escritório, cada operação deve verificar o cliente externo selecionado e os setores/perfis
permitidos. Usuário sem setor não deve ganhar acesso irrestrito porque uma lista de filtros veio vazia.

## 3. Sequência proposta

| Etapa | Resultado concreto | Condição para avançar |
| --- | --- | --- |
| P0 — Contratos e proteção de credenciais | Identificar produtos/módulos, fechar os casos do piloto, proteger as chaves e preparar fixtures de duas empresas locais. | Respostas sem segredos; autorização e vínculo de cliente demonstrados; tipos de dados e orçamento aprovados. Pode começar com mocks, sem tokens reais. |
| P1 — IA assistida | Resumo da conversa e rascunho de resposta, solicitados pelo atendente, com referências às mensagens e textos internos aprovados. | Chave de projeto e faturamento disponíveis; avaliação com casos fictícios; resposta editável; nenhum envio ou mudança de atendimento automático. |
| P2 — Acessórias | Painel de consulta de cadastro e entregas/pendências do cliente explicitamente vinculado. | Token autorizado, empresas piloto e recursos disponíveis confirmados; paginação, falhas e limites tratados. |
| P3 — SCI | Consulta de publicações/relatórios ou atendimentos conforme o módulo efetivamente contratado. | Produto/módulo identificado, dois tokens e permissões confirmados, operações sem efeitos colaterais homologadas. Não depender de acesso ao desktop para presumir a API WEB. |
| P4 — Consulta integrada e sincronização | IA pode consultar funções restritas do backend; painel mostra origem e última atualização; sincronização tem cursor e recuperação de falhas. | Conectores aprovados isoladamente; testes de autorização, dados desatualizados, indisponibilidade, duplicidade e custo. |

P1 não depende de SCI/Acessórias: pode avançar com conversas fictícias e conteúdo aprovado enquanto os acessos externos
são providenciados. P2/P3 podem ser desenvolvidos em paralelo após P0. Escrita externa, envio autônomo, cálculos/pareceres
contábeis por IA, lançamentos fiscais, folha, pagamentos e etiquetas automáticas ficam para decisão separada.

### IA: desenho do piloto

Proposta inicial: OpenAI no backend, com modelo configurável e escolha após avaliação de qualidade, custo e latência.
Conferir a compatibilidade do SDK já instalado antes de atualizar dependências. Não vincular o projeto a um modelo
específico nem prometer custo/precisão antes de medir.

A Responses API suporta respostas estruturadas e chamadas de funções. O modelo pode solicitar uma consulta, mas o
backend valida parâmetros e permissões e executa apenas funções autorizadas; não recebe SQL, token de fornecedor ou
URL arbitrária do modelo. Esquema válido não comprova que o conteúdo da resposta está correto. [O1], [O2]

Enviar apenas o contexto necessário e aprovado. Preferir execução sob demanda, sem histórico remoto persistido por
padrão, usando `store:false` quando aplicável. Isso não equivale a retenção zero: a política de dados/monitoramento do
provedor e a elegibilidade para controles adicionais precisam ser verificadas para a conta. [O3]

O usuário revisa a sugestão, pode editar e decide enviar. Conteúdo recebido de mensagens/documentos é dado não
confiável: não pode alterar instruções, conceder acesso, ativar ferramentas ou escolher outra empresa.

### Acessórias: API pesquisada

A API oficial usa Bearer token gerado no menu **engrenagem → API Token** e publica limite de 100 requisições/minuto.
Há consultas de empresas e entregas. Algumas falhas chegam como HTTP 200 com a propriedade `Erro`; o adaptador deve
validar o corpo. Para entregas `ListAll`, o filtro incremental `DtLastDH` tem janela restrita ao dia atual/anterior:
reprocessamento após interrupção longa exige estratégia própria. [A1]

Começar por REST e operações explicitamente liberadas. O MCP oficial usa a credencial do usuário, herda suas permissões
e está em beta; não expor ao modelo seu catálogo completo, que também inclui escrita. Confirmar com o fornecedor
licença, usuário técnico, granularidade de leitura, ambiente de teste e mudanças do contrato. [A1], [A2]

Não foi confirmado webhook ou sandbox disponível ao cliente. Consulta periódica é uma proposta, condicionada ao
contrato e ao limite. A existência de um domínio de desenvolvimento não concede acesso a homologação.

### SCI: escolher o módulo antes do conector

As APIs SCI WEB que usam JWT pedem **Token de Parceiro** (emitido pela SCI ao integrador) e **Token de Cliente**
(gerado pelo escritório no SCI WEB). O login usa HTTP Basic com esses dois tokens, sem senha pessoal do usuário;
retorna JWT de uma hora e possui renovação. O escopo Empresa/Contabilidade influencia o acesso. [S1]

Para o piloto, verificar SCI Report/Report Atendimento e as consultas necessárias. [S2], [S3] Em Report, obter uma publicação
pela operação de visualização pode marcar o documento como visto quando o token é de Empresa; com escopo Contabilidade,
a documentação descreve obtenção sem essa marca. A lista permitida deve considerar o efeito e o escopo, não só GET/PUT.
Se não houver garantia, deixar essa operação fora do piloto. [S2]

O MCP oficial documenta consultas para os módulos correspondentes, sem escrita nessa versão, mas a credencial não
distingue atendentes do escritório. Não substitui a autorização do Zap Komunick. [S4] Integra NET/SBS usam outro contrato
de autenticação e não são pré-requisitos deste MVP; RH/folha fica fora do piloto. [S1], [S5], [S7]

Não foi confirmada API específica de tarefas/obrigações da SCI. Também faltam confirmação comercial de API,
homologação, quotas e webhooks para a instalação do usuário. Não prometer esses recursos por analogia com o Acessórias.

## 4. Credenciais e acessos a providenciar

| Item | O que será necessário | Como obter / limite |
| --- | --- | --- |
| Identificação da SCI | Nome do produto, módulos WEB contratados e forma de instalação; URL do portal ou identificação no contrato. | Responsável interno ou suporte do fornecedor pode identificar. Não precisa saber agora para construir mocks e P0. |
| IA — proposta OpenAI | Projeto da API, chave padrão de aplicação (preferencialmente conta de serviço do projeto), modelos liberados, faturamento/créditos e responsável pelo teto de gasto. | O responsável cria/configura o projeto. Não fornecer chave administrativa da organização nem senha de uma conta pessoal. Chave fica no servidor/cofre. [O4] |
| Acessórias | API Token de usuário com as empresas/setores e consultas aprovados; identificação da conta/escritório e plano. | Gerar em API Token; usar usuário dedicado se o contrato permitir e conferir permissões/revogação. Confirmar acesso API e ambiente de teste com o fornecedor. [A1], [A2] |
| SCI — integrador | Token de Parceiro da Komunick/Zap Komunick e aprovação do cadastro de integrador. | Solicitar pelo cadastro oficial SCI, se ainda não houver parceria. É diferente do token do escritório. [S1], [S6] |
| SCI — escritório | Token de Cliente do SCI WEB, escopo e empresas liberados; módulos Report/Atendimento necessários ao recorte. | Pessoa autorizada do escritório gera o token. Não entregar usuário/senha pessoal ao backend. [S1] |
| Dados do piloto | Empresas/contatos fictícios autorizados, IDs externos e CNPJs/identificadores de teste; vínculo entre escritório, cliente externo e contatos. | Criar ou liberar fixtures em ambiente autorizado. Se o fornecedor não oferecer sandbox, combinar um conjunto piloto explicitamente permitido antes de chamar a API. |
| Conteúdo e operação | Procedimentos/FAQ aprovados, exemplos do que uma resposta deve ou não afirmar, equipe piloto, orçamento e dados que podem sair para IA. | O responsável valida o recorte e os exemplos; não é credencial técnica. |
| Ambiente de desenvolvimento | Permissão de configurar segredos no backend, chave mestra/referências de cofre, saída HTTPS e contas separadas por ambiente. | Infraestrutura local/de teste. Acesso à produção, DNS, RDP ou banco desktop não é pré-requisito do planejamento. |

Para o futuro backend, nomes como `AI_API_KEY`, `ACESSORIAS_API_TOKEN`, `SCI_PARTNER_TOKEN` e `SCI_CLIENT_TOKEN`
são exemplos de identificadores de configuração, não variáveis já implementadas. A chave mestra deve ser gerada pela
infraestrutura; não deve ser enviada junto do banco nem copiada para o frontend.

**Provisionamento:** não enviar os valores por chat, arquivo versionado, print ou planilha. Após P0, cadastrar diretamente
no backend/cofre por pessoa autorizada. Em ambiente multiempresa, guardar credenciais separadas por escritório; jobs
carregam IDs/referências, não os valores. Testar rotação/revogação. Nenhuma chave real foi solicitada ou lida nesta etapa.

Não há necessidade, para esse primeiro recorte, de certificado digital e-CNPJ/e-CPF, credenciais do WhatsApp pessoal
ou senha administrativa da máquina da SCI. Se um módulo futuro exigir algo diferente, confirmar na documentação
específica antes de ampliar o acesso.

## 5. Regras técnicas propostas para os conectores

- Adaptadores separados por fornecedor, com lista explícita de operações e domínios permitidos. O gateway no backend
  valida empresa, usuário, setor e vínculo externo antes de cada consulta, inclusive antes de devolver resultado em cache.
- Vínculo explícito por escritório/provedor/ID externo, com CNPJ/identificador normalizado e seleção validada quando
  um contato representar mais de uma empresa. Não aceitar um CNPJ mencionado na mensagem como prova de identidade.
- Registrar origem, horário da consulta e estado de sincronização. Dado indisponível ou desatualizado não pode ser
  apresentado como confirmação de obrigação cumprida, pagamento ou prazo atual.
- Filas próprias Bull/Redis, limite por credencial, timeout, retry com backoff, tratamento de 401/403/429 e circuit breaker
  simples se necessário. Não aplicar retry automático a operação com efeito sem idempotência confirmada.
- Cursor/checkpoint por empresa e conector; paginação completa, reconciliação e recuperação de lacunas. Não supor
  webhook, assinatura de eventos ou campo incremental que o contrato não documente.
- Metadados de uso/custo/resultado na auditoria, sem prompt integral, mensagens, documentos ou segredos. Limites de
  tokens/contexto e gasto devem ser aplicados pelo backend; alerta de orçamento não deve ser tratado como bloqueio garantido.
- Anexos somente após autorização de cliente, validação de domínio/tamanho/tipo e armazenamento/download privado.
  Links temporários não devem aparecer em logs ou se transformar em links públicos permanentes.

## 6. Critérios propostos de aceite e verificação

| Critério | Verificação prevista |
| --- | --- |
| Isolamento real | Duas empresas locais, clientes distintos, atendente fora do setor, usuário sem setor e vínculo ambíguo; nada da empresa B entra no contexto/cache/job da A. |
| Segredos restritos ao backend | Credencial fictícia identificável ausente de login, refresh, settings, telas, logs, auditoria e payload Redis; rotação/revogação com testes. |
| IA como auxílio | Pedir resumo/rascunho não marca mensagens como lidas, não muda atendimento/SLA, não aplica etiqueta e não chama envio WhatsApp. |
| Rascunho humano preservado | Timeout, cancelamento e troca de conversa não apagam nem inserem resposta atrasada no editor errado. |
| Resposta fundamentada | Casos fictícios com referências esperadas, informação ausente/contraditória e instrução maliciosa em documento; medir qualidade, custo e latência antes de escolher modelo. |
| Conectores corretos | Paginação, erro funcional em HTTP 200, credencial revogada, quota, indisponibilidade, dados antigos, duplicidade e lacuna incremental. |
| SCI sem efeitos inesperados | Operações e escopos homologados: consultar não marca leitura, muda status ou altera o fornecedor no recorte aprovado. |
| UI/controle de acesso | Desligado por padrão, disponibilidade por perfil/empresa, falha explicada e origem/data visíveis; segredo não volta do servidor. |

São testes planejados, não resultados executados. Nesta etapa houve inventário do código e leitura de documentação
pública; nenhuma autenticação, chamada de dados nos fornecedores, habilitação de IA ou envio de mensagens.

## 7. Próximas decisões

1. Identificar módulos/contratos com a pessoa que administra Acessórias e SCI; confirmar usuários de integração e ambiente permitido.
2. Confirmar o recorte P0 + resumo/rascunho assistido e as primeiras consultas externas desejadas.
3. Definir projeto de IA, orçamento e dados permitidos; escolher modelo apenas depois da avaliação.
4. Depois da proteção de credenciais, provisionar os tokens e executar os testes de contrato com fixtures autorizadas.
5. Antes de implementação/publicação, atualizar PRD/TAD com o recorte aprovado. Cada entrega usa branch/PR e evidências,
   sem merge pelo agente. Este plano não solicita publicação ou conexão com produção.

## Fontes oficiais consultadas em 27/10/2026

- [A1 — API Acessórias](https://api.acessorias.com/documentation).
- [A2 — Acessórias: MCP, permissões e token do usuário](https://acessorias.com/site/integrar-ia-rotina-contabil/).
- [S1 — SCI: OpenAPI de autenticação](https://portal-dev.sci.com.br/openapi/auth.json).
- [S2 — SCI Report 24h](https://portal-dev.sci.com.br/openapi/sci-report-24h.json).
- [S3 — SCI Report Atendimento](https://portal-dev.sci.com.br/openapi/sci-report-atendimento.json).
- [S4 — Manual oficial do MCP SCI](https://portal-dev.sci.com.br/assets/manual-mcp-sci-v10-09-2026.pdf).
- [S5 — SCI Integra NET](https://portal-dev.sci.com.br/openapi/integra-net.json).
- [S6 — SCI: cadastro de integrador](https://sci.com.br/sistemas-de-gestao/).
- [S7 — SCI SBS](https://portal-dev.sci.com.br/openapi/sbs.json).
- [O1 — OpenAI: function calling](https://developers.openai.com/api/docs/guides/function-calling).
- [O2 — OpenAI: respostas estruturadas](https://developers.openai.com/api/docs/guides/structured-outputs).
- [O3 — OpenAI: controles de dados](https://developers.openai.com/api/docs/guides/your-data).
- [O4 — OpenAI: autenticação e chaves no servidor](https://developers.openai.com/api/reference/overview#authentication).

O portal SCI é uma aplicação web; os OpenAPI acima são arquivos públicos do próprio fornecedor. Alguns extratores
de página não leem seu conteúdo, mas a documentação foi conferida diretamente. Disponibilidade pública de uma API
não confirma a licença, as permissões ou o ambiente contratado deste escritório.
