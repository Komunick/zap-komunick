# Marcas SuperChat e Komunick

`logo.svg` é o lockup para superfícies claras; `logo-dark.svg`, para superfícies escuras. Ambos usam
`viewBox="0 0 600 196"` e apresentam superChat com mais destaque; Powered by e a logo oficial Komunick Inteligência
e Tecnologia formam uma linha discreta abaixo. A composição mantém os paths, o símbolo e as cores SuperChat do
primeiro rebranding. Na largura de 190px, o lockup tem aproximadamente 62,1px de altura, com Powered by em tamanho
nominal de 8,9px e a assinatura oficial com 82,3px de largura.

`logo-header.svg` e `logo-header-dark.svg` usam `viewBox="0 0 1200 200"`. SuperChat fica à esquerda e o endosso
completo menor à direita. O grupo SuperChat é ampliado em 40%; o endosso oficial passa de 480 para 280 unidades de
largura. Na caixa de 336×56px, a assinatura oficial ocupa 78,4px de largura e Powered by tem tamanho nominal de
8,4px. Use essas variantes nas barras Foco/Painel do desktop e mantenha o lockup vertical no login, na tela Sobre
e no menu aberto. As dimensões indicam a proporção de composição; a legibilidade precisa ser conferida no tamanho real.

## Medidas da composição minimalista

| Elemento | Vertical clara/escura | Header claro/escuro |
| --- | --- | --- |
| Canvas | `600×196` | `1200×200` |
| SuperChat e símbolo | Paths e posição preservados | Grupo original com `translate(0 -40) scale(1.4)` |
| Powered by | `translate(84 150) scale(.014 -.014)` | `translate(946.4 50) scale(.015 -.015)` |
| SVG oficial incorporado | `x=256 y=118 width=260 height=72.1387` | `x=890 y=70 width=280 height=77.6879` |

O canvas vertical anterior era de 600×304, com Powered by em escala `.019` e assinatura oficial de 480 unidades de
largura. A nova composição reduz a altura e o peso do endosso. No menu, `sidebarBrandHeader` usa `minHeight: 84`
em vez de 116; a imagem continua com altura automática e o cabeçalho pode crescer para acomodar um upload Whitelabel.
Não aplicar altura fixa ou distorção a imagens personalizadas. O símbolo compacto e o favicon não mudam neste ajuste.
Ver [especificação do topo](../../../docs/specs/superchat-topo-minimalista.md).

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
Wordmark em peso 800; endosso em peso 600. Licença SIL Open Font License 1.1 em `Manrope-OFL.txt`.
A fonte binária não é distribuída pelo aplicativo.

O símbolo compacto de conversa com S é usado no rail recolhido e nos ícones PNG/ICO. O endereço padrão do navegador e da PWA é `superchat-icon.svg`; `favicon.svg` continua como alias compatível. O fallback ICO usa uma versão na query para diferenciar o endereço antigo em cache.
Paleta SuperChat: verde #35B62E, preto #020605 e branco. Powered by usa #5C6862 em superfícies claras e #D2DDD4 nas
escuras. Os ativos não têm scripts, referência a fonte externa ou download de imagens em tempo de uso: a imagem
oficial é incorporada. Não distorcer os arquivos nem usar a variante clara sobre a sidebar preta.
