# Miniaturas dos anexos privados do chat

## Objetivo e recorte

As miniaturas de imagens da galeria do chat interno devem abrir com a mesma sessão autenticada da imagem principal.
Na homologação local, a imagem principal de um PNG fictício abre, mas a miniatura da mesma URL fica sem conteúdo.
A galeria usa `yet-another-react-lightbox` 3.29.1; seu plugin de miniaturas não recebe `carousel.imageProps`.

O recorte é a renderização das miniaturas privadas no frontend. Preservar imagem, vídeo, PDF, download, limpeza de
mídia ao fechar ou trocar de identidade, temas, celular e os arquivos públicos dos atendimentos. Não alterar
autorização, cookies, cabeçalhos do backend, URLs privadas ou uploads Whitelabel. WhatsApp continua desconectado,
sem merge ou deploy.

## Critérios de aceite

- A miniatura privada usa `crossOrigin="use-credentials"`, como a imagem principal, sem segredo na URL.
- A miniatura do PNG fictício carrega na galeria com o mesmo backend da reprodução inicial.
- Erros e fechamento liberam as referências nativas das miniaturas, como as demais mídias privadas.
- A galeria pública mantém o comportamento existente; vídeo, navegação e download continuam disponíveis.
- A regressão executa o plugin real, falha na versão anterior e passa com o candidato. Conferir também o navegador,
  os dois temas e o celular na cópia isolada, usando somente dados fictícios.

Referências: [PRD RF-010](../PRD.md), [TAD — anexos privados](../TAD.md),
[privacidade dos anexos](chat-anexos-privados.md). A diferença de atributo foi observada no navegador; o mecanismo
exato de bloqueio da requisição não foi atribuído a CORP ou CORS sem evidência de protocolo.
