# Candidatos de publicacao na ARM07

## Pedido e resultado

Preparar a versao integrada do Zap Komunick para a VM `arm07` (Ubuntu 24.04,
ARM64), em `https://superchat.komunick.com`. O pedido posterior acrescenta
`https://superchatdev.komunick.com` para desenvolvimento, com isolamento em relacao
ao ambiente de producao. A preparacao entrega imagens, configuracoes e procedimentos
verificaveis para os dois ambientes. A ativacao publica, alteracao de DNS e
reconexao de WhatsApp dependem de pedidos posteriores; nao fazem parte desta
preparacao. Origem da aplicacao: merge do PR #21, `476077c`.

## Escopo

- Dois perfis fechados, `production`/`superchat` e `development`/`superchatdev`, com
  dominio, porta local e redes distintos. Cada ambiente tem banco, Redis, volumes,
  projeto Compose, administrador, senha de banco e master proprios. Nao importar
  dados, arquivos, chaves ou sessao do notebook nem copiar dados de desenvolvimento
  para producao. Manter WhatsApp desconectado e IA/Acessorias disabled em ambos.
- Imagens Linux ARM64 feitas a partir de exportacao Git, identificadas por revisao
  e hash. Backend comum e frontend imutavel por perfil, com dominio e gateway
  escolhidos no build por lista fechada. Nao usar os diretorios de midias/configuracao
  locais como contexto de build. Promover a revisao da aplicacao sem reconstruir as
  imagens homologadas de cada perfil e sem promover o banco de desenvolvimento.
- Separar migracao e bootstrap inicial do runtime. Bootstrap somente em base nova,
  com administrador e segredos fortes; reiniciar nao executa seeds nem troca senhas.
- Segredos exclusivos do backend/banco. Configuracao publica por lista explicita.
- Ingresso no Caddy existente da ARM07, com app em porta de loopback, proxy/IP de
  origem delimitados e suporte a WebSocket e bytes/Range dos anexos. Cada dominio
  possui fragmento independente, para permitir ativacao separada.
- Procedimento de preparacao, backup, ativacao e recuperacao, sem modificar sites,
  containers ou dados existentes do servidor durante a preparacao.
- Correcao de compatibilidade do backup: a funcao existente de busca sem acentos
  precisa resolver explicitamente `public.unaccent`, tambem quando a restauracao
  usa `search_path` vazio. Preservar assinatura, resultados e indice de Tags.

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
7. Backup ficticio restaura integralmente em base nova, incluindo indice de Tags,
   hashes das tabelas, sequencias e arquivos. A busca com/sem acentos preserva seu
   resultado, inclusive com `search_path` vazio; nao altera dados da base de origem.
8. Os dois perfis podem coexistir sem compartilhar portas, redes, volumes, dados
   ou segredos. Configuracao publica aponta somente para o proprio dominio; troca
   de imagem frontend, host, projeto ou proxy entre perfis e recusada no preflight.
   Credenciais/tokens ficticios de um ambiente nao autenticam no outro.

## Referencias e limite

`docs/DEPLOY.md`, `docs/DELIVERY-WORKFLOW.md` e PR #21. O ingresso Caddy na ARM07
e um fato observado em preflight somente leitura. DNS de cada subdominio deve ser
conferido antes de ativacao; um registro existente nao comprova que a aplicacao
esteja instalada. Os links publicos
legados de arquivos mantem a limitacao descrita em RF-023/DEPLOY; esta preparacao
nao migra armazenamento, fornecedores, dados nem canais WhatsApp.
