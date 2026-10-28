# Candidato de publicacao na ARM07

## Pedido e resultado

Preparar a versao integrada do Zap Komunick para a VM `arm07` (Ubuntu 24.04,
ARM64), em `https://superchat.komunick.com`. A preparacao entrega imagens,
configuracao e procedimento verificaveis. A ativacao publica, alteracao de DNS e
reconexao de WhatsApp dependem de pedidos posteriores; nao fazem parte desta
preparacao. Origem da aplicacao: merge do PR #21, `476077c`.

## Escopo

- Banco, Redis, volumes e projeto Compose proprios, sem importar dados, arquivos,
  chaves ou sessao do notebook. Manter WhatsApp desconectado e IA/Acessorias disabled.
- Imagens Linux ARM64 feitas a partir de exportacao Git, identificadas por revisao
  e hash. Nao usar os diretorios de midias/configuracao locais como contexto de build.
- Separar migracao e bootstrap inicial do runtime. Bootstrap somente em base nova,
  com administrador e segredos fortes; reiniciar nao executa seeds nem troca senhas.
- Segredos exclusivos do backend/banco. Configuracao publica por lista explicita.
- Ingresso no Caddy existente da ARM07, com app em porta de loopback, proxy/IP de
  origem delimitados e suporte a WebSocket e bytes/Range dos anexos.
- Procedimento de preparacao, backup, ativacao e recuperacao, sem modificar sites,
  containers ou dados existentes do servidor durante a preparacao.

## Criterios

1. Imagens ARM64 executam Node e dependencias nativas e informam sua revisao;
   pacote tem manifesto de integridade e nao inclui dados/segredos do notebook.
2. Validacao isolada cria somente base ficticia: bootstrap forte, login/refresh e
   reinicio preservam dados/senha; bootstrap sobre base existente e recusado.
3. Configuracao publica nao contem segredo e o backend nao possui saida externa.
   Banco/Redis nao publicam portas; somente ingresso local e proxy confiavel definido.
4. Pela configuracao de ingresso, API, WebSocket e PDF/imagem/video conservam
   autorizacao, bytes e Range; nenhum envio ou fornecedor real e acionado.
5. Caddy/Compose e preflight conferem arquitetura, porta, capacidade e dominio.
   Diferenca entre DNS atual e servidor de destino e explicitada, sem mudanca de DNS.
6. Instrucoes e candidato permitem revisao antes da ativacao; configuracoes/sites
   existentes e a publicacao LAN do notebook continuam preservados.

## Referencias e limite

`docs/DEPLOY.md`, `docs/DELIVERY-WORKFLOW.md` e PR #21. O ingresso Caddy na ARM07
e um fato observado em preflight somente leitura. O DNS atual do subdominio aponta
para outro IP e nao comprova que a aplicacao esteja instalada. Os links publicos
legados de arquivos mantem a limitacao descrita em RF-023/DEPLOY; esta preparacao
nao migra armazenamento, fornecedores, dados nem canais WhatsApp.
