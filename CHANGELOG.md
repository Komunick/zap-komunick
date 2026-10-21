# Changelog

Mudanças relevantes para quem usa, integra ou opera o projeto.

## Não publicado

### Segurança

- Busca de contatos (tela Contatos e `GET /contacts`, inclusive com token de API): o texto buscado agora chega ao
  banco só como valor. Antes, uma aspa simples no texto alterava a consulta SQL, falha que veio do Ticketz. A busca
  continua sem diferenciar acentos e maiúsculas, e nomes com apóstrofo (como "D'Ávila"), que davam erro, passam a ser
  encontrados.
