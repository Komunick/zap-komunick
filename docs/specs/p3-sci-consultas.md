# P3 — painel SCI com publicações simuladas

## Pedido e recorte

Em 29/10/2026, o responsável pediu continuar as implementações e selecionou
**P3: painel SCI com mocks e dados fictícios**. A base é
`047b49aba4d91107cb442411ba7ecdccf06c485e`, depois de P0, P1/P2 simulados e visualizadores.
Entregar código, documentação, testes e PR sem merge. Este recorte não publica a
nova revisão na ARM07; os ambientes existentes e a autorização anterior de DNS
permanecem independentes desta implementação.

A consulta apresenta somente metadados de publicações fictícias. Como o produto
SCI do escritório ainda é desconhecido, o contrato é interno e não afirma
compatibilidade com Report 24h, Report Atendimento ou qualquer API real.

## Comportamento

- Provedor local determinístico; sem rede, tokens, SDK/MCP, filas, arquivos ou IA.
  Não baixa documentos, marca leitura, sincroniza ou altera o fornecedor.
- Desligado por padrão: exige `SCI_MODE=mock` no backend e `sciEnabled=enabled`
  na própria empresa, alterado apenas por administrador. Modo desconhecido,
  ausência de flag e duplicatas divergentes recusam consultas. P1/P2 são independentes.
- Painel acessível no atendimento válido/autorizado em desktop/celular, claramente
  identificado como **SCI — Simulação**. Preserva rascunho, leitura, SLA e demais dados.
- Lista somente clientes explicitamente vinculados ao contato desse atendimento.
  Um contato pode representar vários clientes; seleção manual obrigatória.
  Não presume vínculo por nome, telefone, documento ou conteúdo de mensagem.
- Administrador consulta catálogo fictício e confirma inclusão/remoção do vínculo
  local. Atendente consulta só os vinculados; não gerencia catálogo ou vínculos.
  A API permite remoção administrativa de vínculo local conhecido com consulta desligada;
  nesse estado a interface não abre catálogo/publicações.
- Reutiliza ContactExternalClientLinks com provider fixo `sci`; não compartilha
  vínculos com `acessorias`, mesmo com IDs externos iguais. Não requer migração de dados.
- Mostra cadastro fictício e publicações com id, título, categoria, competência
  rotuladas como fictícias e data ISO. Paginação de cinco itens, origem e horários
  da consulta/fonte, com estado desatualizado explícito. Não fornece URLs/downloads,
  conteúdo de documento, prazo fiscal ou estado de leitura real.
- Vazio, indisponibilidade, timeout, limite/acesso simulados e saída inválida são
  distintos. Troca/cancelamento, evento de revogação ou resposta atrasada limpam
  resultados e impedem uso no atendimento/cliente errado. Conteúdo fica em memória.
  Eventos são de melhor esforço: sem entrega, o snapshot já recebido não tem revogação
  visual instantânea; toda nova consulta revalida acesso, flag e vínculo.
- Revalida acesso atual da empresa/usuário/setor, flag, contato e versão do vínculo
  depois de awaits. A checagem final de versão e autorização das leituras e o CRUD
  compartilham a transação/conexão e o bloqueio do contato. O provedor é consultado
  fora desse bloqueio; recriar vínculo não reaproveita autorização da versão removida.
- Auditoria/eventos contêm somente ação/IDs/metadados mínimos. Erros, JSON inválido,
  logs e telemetria não incluem conteúdo de cadastro/publicações nem segredos.

## Contrato interno da simulação

Prefixo `/tickets/:ticketId/sci`, com sessão e compliance existentes:

- GET `/status`, `/clients` e `/catalog` (catálogo só administrador), sem query extra.
- GET `/clients/:externalClientId?page=1` retorna `client`, `publications`,
  `pagination` e `source`, além de `mode: mock` e `simulated: true`.
- POST `/links` aceita somente `{ externalClientId }`; DELETE `/links/:externalClientId`
  remove apenas vínculo SCI da própria empresa/contato autorizado.
- `client`: externalClientId, name, documentLabel. `publications`: id, title,
  categoryLabel, periodLabel, publishedAt. `source`: provider `sci`, label
  `Simulação local SCI`, fetchedAt, updatedAt, stale. IDs repetem propositalmente
  entre escritórios e fornecedores para demonstrar isolamento.

## Critérios observáveis

1. Disabled/desconhecido, flag ausente/divergente e acesso inválido falham fechados;
   flag de A não habilita B nem altera P1/P2. Somente administrador atual altera vínculos.
2. Duas empresas e dois fornecedores com IDs iguais mantêm catálogo, vínculos e
   publicações isolados. Usuário sem setor/fora do setor não recebe dados.
3. Seleção múltipla é explícita; CRUD é idempotente e recusa parâmetros extras.
   Remoção off funciona sem chamar provedor; nenhum vínculo Acessórias é alterado.
4. Publicações paginam 5/5/2 sem lacunas/duplicatas; página inválida, vazio, stale,
   timeout, limite, recusa e resposta malformada possuem resultados verificáveis.
5. Revogação/troca de empresa, setor, perfil, flag ou vínculo durante consulta
   impede retorno de conteúdo; cancelamento e resposta tardia preservam o contexto.
6. Interface cobre seleção, confirmação administrativa, paginação, vazio e falhas
   em claro/escuro e desktop/celular, com textos traduzidos e controles acessíveis.
7. Snapshot de leitura/SLA/rascunho/notas/mensagens e credenciais permanece igual;
   zero envio ou chamada de fornecedor. Nenhum conteúdo em storage/log/auditoria.
8. Testes usam somente fixtures rastreadas em ambiente descartável, sem tocar
   bancos/volumes/segredos das instalações ARM07; limpeza e modo final off conferidos.

## Referências e limites

[P0](p0-credenciais-isolamento.md), [P2](p2-acessorias-consultas.md), RF-017 e o
[plano da rodada 3](rodada-3-ia-integracoes.md). Operação/recuperação no TAD e DEPLOY.
Produto/módulos SCI, licença, autenticação e escopos reais continuam pendentes;
nenhuma integração real, leitura de documentos, automação, escrita externa,
publicação, merge ou reconexão WhatsApp faz parte desta entrega.
