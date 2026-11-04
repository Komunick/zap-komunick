# Topo SuperChat minimalista

Esta especificação registra a primeira simplificação do topo. A composição e as medidas foram substituídas pela
[opção A, Essencial](superchat-logo-essencial.md), escolhida depois pelo usuário. O conteúdo abaixo preserva essa
decisão anterior e não define os ativos atuais.

## Objetivo e aprovação

Em 04/11/2026, o usuário autorizou simplificar a arte do topo e reduzir o endosso Powered by Komunick, com
aprovação explícita para executar esse ajuste visual. SuperChat deve ter mais destaque e a assinatura oficial
Komunick Inteligência e Tecnologia deve permanecer completa, proporcional e legível.

## Escopo

- Ajustar as quatro composições padrão em `frontend/public/vector/logo{,-dark,-header,-header-dark}.svg`.
- Nas variantes verticais, reunir Powered by e a marca Komunick em uma linha discreta abaixo de SuperChat.
- No header Foco/Painel, ampliar o bloco SuperChat e reduzir o endosso à direita, mantendo a caixa de 336×56 px.
- Reduzir o `minHeight` do cabeçalho de marca da sidebar de 116 para 84 px. A altura continua automática para
  acomodar logos personalizadas, sem fixar ou cortar sua imagem.
- Preservar paths, símbolo e cores SuperChat; ícone compacto, favicon e seleção de imagens Whitelabel por `BrandLogo`.
  O arquivo oficial `komunick-completa.svg`, seu conteúdo incorporado e a geometria da marca não são redesenhados.
- Manter WhatsApp desconectado, sem merge ou deploy. A falha de isolamento de setores não pertence a este ajuste.

## Composição

| Elemento | Vertical clara/escura | Header claro/escuro |
| --- | --- | --- |
| Canvas | `600×196` | `1200×200`, mantido |
| SuperChat e símbolo | Paths e posição atuais | Grupo atual com `translate(0 -40) scale(1.4)` |
| Powered by | `translate(84 150) scale(.014 -.014)` | `translate(946.4 50) scale(.015 -.015)` |
| SVG oficial Komunick | `x=256 y=118 width=260 height=72.1387` | `x=890 y=70 width=280 height=77.6879` |

O endosso vertical anterior usava Powered by em escala `.019` e marca Komunick com largura de 480 unidades,
no canvas de 600×304. A composição nova reduz esse peso visual e conserva a proporção oficial de 173×48.

## Critérios de aceite

- SuperChat ocupa a posição principal; Powered by e Komunick formam um endosso menor, legível e sem distorção.
- Conferir temas claro e escuro, desktop e celular, incluindo login, sidebar aberta/recolhida, Sobre e header
  Foco/Painel. A composição cabe sem cortar conteúdo ou causar overflow.
- Logos e ícones personalizados continuam respeitados; a sidebar cresce quando a imagem configurada precisa de
  mais altura. O símbolo compacto e o favicon conservam os ativos existentes.
- Preservar os bytes do arquivo oficial e o conteúdo incorporado nos quatro SVGs; manter títulos acessíveis e
  renderização local, sem fonte ou serviço externo.
- Registrar validações realizadas e eventuais limites na entrega, sem tratar critérios previstos como resultados.

Referências: [RF-009](../PRD.md), [desenho visual](../TAD.md) e [documentação dos ativos](../../frontend/public/vector/README.md).
