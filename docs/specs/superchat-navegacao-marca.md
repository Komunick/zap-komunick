# Navegação e marca do SuperChat

## Pedido aprovado

Em 03/11/2026 o usuário aprovou retirar Financeiro e Deploy da navegação, usar a logo oficial Komunick Inteligência
e Tecnologia, conferir título e favicon SuperChat, validar os temas e o celular e abrir PR. Esta entrega não faz
merge ou deploy e mantém o WhatsApp desconectado.

## Mudanças

- Remover Financeiro dos menus compartilhados pelo Workspace, Painel e gavetas móveis. Conferir Foco, Mais e a paleta
  de comandos, mantendo API e os demais itens. As páginas, rotas, guards e serviços financeiros existentes permanecem
  compatíveis; o pedido retira as entradas de navegação.
- A referência “Deploy” não existe como texto literal no código. A seção operacional encontrada é Containers Docker
  em Configurações, com atualizações e reinícios. A interpretação usada neste recorte é retirar essa aba, a opção do
  seletor móvel e seu painel, preservando APIs, scripts, CI e infraestrutura de publicação. A pergunta de identificação
  foi respondida pelo usuário, que confirmou a remoção de Containers Docker.
- Aplicar o arquivo oficial completo de Komunick Inteligência e Tecnologia no endosso. Preservar a marca original,
  proporções e cores; não reconstruir uma assinatura e apresentá-la como oficial. O arquivo completo foi localizado no header e no rodapé de `https://www.komunick.com/`:
  `https://www.komunick.com/assets/brand/komunick-logo-slogan-leve.svg`. Preservar o SVG oficial, que contém PNG embutido,
  e usar composições vertical e horizontal conforme o espaço disponível.
- Título padrão SuperChat desde a inicialização e após carregar configurações. Preservar os nomes Whitelabel distintos.
  Usar um endereço próprio para o símbolo SuperChat no favicon, diferenciando-o dos endereços antigos sujeitos a cache.
  Conferir HTML, React e PWA, preservando ícones personalizados e aliases antigos compatíveis.

## Critérios de aceite

- Financeiro e a seção de publicação não aparecem nos menus, abas ou seletores dos layouts e perfis pertinentes,
  incluindo superusuário com TZAUTOINSTALLER=1. A navegação não monta o painel Docker nem dispara suas chamadas.
- API, navegação comum, botão, hover e toque continuam funcionando. A pesquisa por páginas não oferece os itens
  removidos; nomes de clientes ou mensagens que contenham “Financeiro” não são alterados.
- A marca oficial completa está legível e proporcional em claro/escuro, desktop e celular. Título e favicon mostram
  SuperChat na prévia compilada, incluindo recarga, configuração legada e falha de leitura do nome.
- Verificar o código compilado em ambiente isolado com dados fictícios, sem iniciar Docker ou backend real.
  Documentar o que foi conferido e qualquer dependência pendente no PR, com revisão acessível.
- Atualizar PRD, TAD e CHANGELOG e abrir PR sobre a base existente, sem merge, deploy ou operação em dados reais.

## Referências

- [PRD RF-009](../PRD.md) e [identidade SuperChat](superchat-identidade.md).
- Base: PR31, revisão `a4a04f9cc6e3bd98e1d921660fab50d65f2adc6b`.
- [Workflow de entrega](../DELIVERY-WORKFLOW.md) e [princípios](../PRINCIPLES.md).
- Ativo completo da marca: fonte primária pública acima, com proveniência em `frontend/public/vector/README.md`.
