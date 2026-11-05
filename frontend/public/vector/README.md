# Marcas SuperChat e Komunick

`logo.svg` é a composição Essencial para superfícies claras; `logo-dark.svg`, para superfícies escuras.
O usuário escolheu esta opção A entre quatro propostas. Ambos usam `viewBox="0 0 200 64"` e apresentam o wordmark
`superChat` sem símbolo ao lado, com `super` mais leve e `Chat` verde em peso maior. Powered by e a assinatura
oficial Komunick Inteligência e Tecnologia formam uma linha secundária abaixo do nome.

`logo-header.svg` e `logo-header-dark.svg` adaptam a mesma opção aos cabeçalhos Foco/Painel: wordmark à esquerda e
endosso completo à direita, em canvas e caixa de 336×56px. Login, Sobre e menu aberto usam a composição completa
de 200×64. Ícone compacto, favicon, aliases e uploads Whitelabel continuam com seus ativos existentes.

## Medidas e aplicação da opção Essencial

Na composição completa de 200×64, Powered by tem tamanho nominal de 8 unidades e a assinatura oficial tem largura
de 84 unidades, com proporção de 173×48. Quando o SVG é exibido com 190px de largura, essas medidas equivalem a
7,6px e 79,8px, respectivamente; sua altura proporcional é de 60,8px. As medidas descrevem a composição e não
substituem a conferência de legibilidade no tamanho real.

| Elemento | Composição completa | Header Foco/Painel |
| --- | --- | --- |
| Canvas | `200×64` | `336×56` |
| Wordmark | Manrope 29, pesos 450/650 | Mesmos paths com `translate(-14.2 9) scale(1.1)` |
| Powered by | Manrope 8, peso 500 | Mesmo tamanho/peso, início `x=196`, baseline `y=30` |
| Assinatura oficial | Largura 84, proporção 173×48 | `x=246.928 y=16 width=84 height=23.3064` |
| Fundo claro da assinatura | Bloco preto local, proporcional ao endosso | `x=243.928 y=15 width=90 height=27 rx=4` |

O cabeçalho da sidebar usa altura mínima de 72px em vez de 84px e padding vertical de 4px. A altura proporcional
da imagem pode fazer o bloco crescer além desse mínimo. A imagem continua com altura automática, inclusive quando a
empresa fornece um upload Whitelabel mais alto. Não aplicar altura fixa ou distorção a imagens personalizadas.
Use a variante para fundo escuro na sidebar preta, inclusive no tema claro. Nas superfícies claras, o fundo preto
local atrás da assinatura preserva seu slogan branco sem recolorir o arquivo oficial.

Ver [especificação da logo Essencial](../../../docs/specs/superchat-logo-essencial.md). A composição anterior,
com canvas de 600×196 e símbolo junto ao wordmark, está registrada na
[especificação histórica do topo](../../../docs/specs/superchat-topo-minimalista.md).

## Fonte oficial da assinatura completa

O arquivo [`komunick-completa.svg`](komunick-completa.svg) é uma cópia integral, sem alteração de bytes, do
[ativo publicado pela Komunick](https://www.komunick.com/assets/brand/komunick-logo-slogan-leve.svg), consultado em
03/11/2026. A [página oficial](https://www.komunick.com/) usa esse mesmo endereço em seu cabeçalho e rodapé.
SHA256 `b5e5ec62236eb6228bc9dfa79aef652f13646294871c1e23cabf085c8ff01512`, 15050 bytes, viewBox 173×48.

O SVG oficial contém um PNG de 173×48, recortes e filtro fornecidos pela empresa. Ampliações ficam sujeitas à resolução
desse PNG. Os lockups incorporam o conteúdo integral do SVG oficial, com a proporção e as cores originais. O fundo
escuro da assinatura aparece também no tema claro.

O arquivo `komunick.svg` preserva o wordmark anterior, sem assinatura, da revisão
`3057ab969a52b18adda2ff883e78df57b4e94e09`. Ele permanece como referência histórica; o endosso dos novos lockups usa
`komunick-completa.svg`. SHA256 do antigo atributo `d`:
`f7fbdedc5573dace23c1180939473fe6c15b4bef62246df975f60ffefd747c98`.

## Tipografia e arquivos compactos

A tipografia SuperChat e Powered by usa Manrope convertida em paths, sem fonte ou serviço externo em tempo de uso.
Fonte: [Google Fonts](https://github.com/google/fonts/tree/b31870aff700ab7a1d74fa0c6887d95beb9e0037/ofl/manrope),
arquivo `Manrope[wght].ttf`, revisão `b31870aff700ab7a1d74fa0c6887d95beb9e0037`,
SHA256 `3ae11c49db0455a3cc33e37d380f20fdb8c7f8b41dc07625c177e3d87a9d6ae6`.
Na opção Essencial, `super` usa peso 450, `Chat` usa 650 e Powered by usa 500.
Licença SIL Open Font License 1.1 em `Manrope-OFL.txt`.
A fonte binária não é distribuída pelo aplicativo.

O símbolo compacto de conversa com S é usado no rail recolhido e nos ícones PNG/ICO. O endereço padrão do navegador e da PWA é `superchat-icon.svg`; `favicon.svg` continua como alias compatível. O fallback ICO usa uma versão na query para diferenciar o endereço antigo em cache.
Paleta SuperChat: verde #35B62E, preto #020605 e branco. Powered by usa #5C6862 em superfícies claras e #BBC7BE nas
escuras. Os ativos não têm scripts, referência a fonte externa ou download de imagens em tempo de uso: a imagem
oficial é incorporada. Não distorcer os arquivos nem usar a variante clara sobre a sidebar preta.
