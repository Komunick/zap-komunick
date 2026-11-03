# Identidade SuperChat

## Objetivo e aprovação

O usuário aprovou em 03/11/2026 substituir o nome visível Zap Komunick por SuperChat, criar a logo `superChat`
com o endosso `Powered by Komunick` e a marca oficial da Komunick Inteligência, validar os dois temas e o celular,
atualizar documentação e abrir PR, sem merge ou deploy. WhatsApp permanece desconectado.

## Mudança

- Nome de produto `SuperChat` em títulos, inicialização, login, navegação, Sobre, PWA e nomes de downloads gerados.
  Valores legados de nome de produto devem aparecer com a nova marca, sem operação em banco real. Preservar nomes
  personalizados que não correspondam à marca antiga e uploads de Whitelabel; não alterar conteúdo de conversas,
  contatos, históricos de auditoria, identificadores técnicos, URLs do repositório ou créditos AGPL/Ticketz.
- Logo tipográfica `superChat` nas cores e tipografia oficiais existentes. A linha inferior combina `Powered by`
  com o wordmark oficial `komunick`, sem redesenhar sua geometria. A organização é identificada de forma acessível
  como Komunick Inteligência; os ativos oficiais disponíveis não contêm o subtítulo “Inteligência”.
- Variantes para superfícies claras e escuras e símbolo compacto próprio para trilho recolhido, favicon e ícones PWA.
  Dar espaço ao endosso para que seja legível, incluindo login, menu aberto, layouts Foco/Painel e Sobre.
- Rótulo padrão de novos cadastros 2FA e metadados públicos futuros usam SuperChat. Não redefinir segredos,
  sessões ou inscrições existentes do autenticador. O nome já salvo em um autenticador externo não muda sozinho.

## Critérios de aceite e verificação prevista

- Nenhum nome antigo permanece como marca padrão visível, inclusive com configuração legada ou falha de leitura.
  Verificar resolução de nome sem escrita, preservação de nomes personalizados e as superfícies afetadas.
- Marca nova e endosso legíveis, sem cortes ou distorção, em claro/escuro, desktop e celular. Conferir o aplicativo
  real em prévia local isolada com respostas fictícias, sem iniciar backend, Docker ou sessão WhatsApp existente.
- Geometria da marca oficial Komunick preservada; SVGs locais sem dependência de fonte ou serviço externo.
- Código-fonte acessível na tela Sobre e créditos upstream mantidos. Permissões, navegação, botão e comportamento
  de toque do menu preservados. Verificações apropriadas e CI do candidato documentadas no PR.
- Atualizar PRD RF-009, TAD e CHANGELOG; abrir PR sobre a base existente, sem merge, deploy, alteração de DNS ou ARM07.

## Referências

- [PRD RF-009](../PRD.md): identidade oficial, temas e personalização por empresa.
- Logo oficial existente: `frontend/public/vector/logo.svg` na base `3057ab969a52b18adda2ff883e78df57b4e94e09`.
  Geometria idêntica aos ativos oficiais Komunick do projeto de landing page; verde `#35B62E`, preto `#020605`, Manrope.
- [Workflow de entrega](../DELIVERY-WORKFLOW.md) e [princípios](../PRINCIPLES.md).
