# Logo SuperChat Essencial

## Objetivo e decisão

Após comparar quatro propostas, o usuário escolheu a opção A, Essencial, e autorizou sua aplicação no sistema:
logo tipográfica mais leve, sem símbolo junto ao nome e com Powered by Komunick menor. A assinatura oficial
Komunick Inteligência e Tecnologia permanece completa e proporcional. Esta decisão substitui a composição do
[topo minimalista anterior](superchat-topo-minimalista.md), preservada como histórico.

## Mudança

- Aplicar a composição aprovada aos ativos padrão `logo.svg` e `logo-dark.svg`: canvas de 200×64, `super` em
  Manrope 450 e `Chat` em Manrope 650, com destaque verde #35B62E. Powered by usa Manrope 500 em tamanho nominal
  de 8 unidades; a assinatura oficial tem largura de 84 unidades e mantém a proporção de 173×48.
- Manter o endosso em uma linha discreta abaixo do nome no login, Sobre e menu aberto. Nos cabeçalhos Foco/Painel,
  usar `logo-header.svg` e `logo-header-dark.svg`, com o mesmo wordmark à esquerda e o endosso completo à direita,
  na caixa existente de 336×56 px.
- Reduzir a altura mínima do cabeçalho da sidebar de 84 para 72 px, com padding vertical de 4 px. A altura da imagem
  continua automática e o cabeçalho pode crescer para acomodar logos personalizadas; não cortar nem distorcer
  uploads Whitelabel.
- Preservar os bytes de `komunick-completa.svg`, incluindo seu PNG incorporado. Nas superfícies claras, usar fundo
  preto local atrás da assinatura para que seu slogan branco continue visível, sem recolorir o arquivo oficial.
- Preservar o ícone compacto, favicon, aliases e ícones PWA existentes. A retirada do símbolo ao lado do wordmark
  completo não elimina os ativos usados no trilho recolhido ou em cabeçalhos estreitos.
- Reutilizar a seleção por `BrandLogo`, as descrições acessíveis e os arquivos locais com letras em curvas,
  mantendo uploads personalizados, créditos AGPL e links de código-fonte.

Esta entrega inclui atualização da versão local com dados fictícios e abertura de PR para revisão. Não inclui
merge, deploy, alterações na ARM07 ou reconexão do WhatsApp.

## Critérios de aceite

- A logo completa corresponde à opção A: nome sem símbolo ao lado, diferença de peso entre `super` e `Chat` e
  endosso secundário. Nenhuma das opções B, C ou D é aplicada.
- Conferir login, Sobre, menu aberto/recolhido e cabeçalhos Foco/Painel nos dois temas, em desktop e celular.
  A marca e o endosso não têm cortes ou distorções e não provocam overflow horizontal.
- A variante para superfície escura mantém contraste na sidebar preta, mesmo com o tema claro. A assinatura
  oficial permanece visível também nas superfícies claras.
- Logos e ícones Whitelabel continuam respeitados; o cabeçalho acomoda imagens proporcionais mais altas.
- Arquivo oficial Komunick, ícone compacto e favicon permanecem idênticos aos existentes. Os ativos padrão não
  dependem de download de imagem ou fonte externa durante a renderização.
- Registrar no PR as verificações pertinentes e suas limitações, atualizar a versão local sem usar dados reais e
  manter o WhatsApp desconectado, sem merge ou deploy.

Referências: [RF-009](../PRD.md), [desenho visual](../TAD.md),
[documentação dos ativos](../../frontend/public/vector/README.md) e
[workflow de entrega](../DELIVERY-WORKFLOW.md). A aprovação do usuário define a escolha visual; as pranchas
comparativas são simulações de aplicação, não evidência de execução no sistema.
