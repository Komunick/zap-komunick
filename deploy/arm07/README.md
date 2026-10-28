# SuperChat na ARM07

Este diretorio prepara uma instalacao nova de `https://superchat.komunick.com`.
O candidato inclui imagens Linux ARM64 e configuracao propria; sua preparacao nao
habilita o site, altera DNS ou reconecta WhatsApp.

## Destino conferido em 28/10/2026

ARM07: `ubuntu@170.9.14.1`, Ubuntu 24.04/aarch64, Docker/Compose e Caddy existentes.
O Caddy ja atende outros sites nas portas 80/443. O SuperChat usa somente
`127.0.0.1:5480`; nao instalar outro proxy nessas portas nem substituir o Caddyfile.
As redes propostas sao `172.29.251.0/28` e `172.29.252.0/28`; conferir novamente
se continuam livres antes de criar a stack.

O registro A observado de `superchat.komunick.com` e **144.24.36.23**, diferente do
destino ARM07. A ativacao depende de identificar/corrigir esse registro e conferir
eventual AAAA. Na primeira ativacao, usar **Somente DNS** no Cloudflare e A para
`170.9.14.1`; nao configurar um AAAA sem IPv6 confirmado. O Caddy obtem HTTPS apos
o DNS correto. A preparacao atual nao mudou nenhum registro.

## O que o candidato preserva

- Projeto, banco, Redis e volumes proprios. Nao restaurar o banco, midias,
  diretorios public/private, master P0 ou sessao do notebook.
- Backend somente na rede Docker interna, sem rota externa; WhatsApp permanece
  desconectado mesmo se alguem tentar iniciar uma conexao. IA/Acessorias disabled.
- Runtime executa a aplicacao; migracao e bootstrap sao operacoes explicitas.
  Reiniciar nao roda seeds, nao recria administrador e nao troca senhas.
- Config publico limitado as chaves do frontend. Ambiente privado nao e exportado
  para `/config.json`; o backend nao recebe socket Docker.
- Apenas o nginx interno pode encaminhar IP ao backend. O nginx confia somente
  no ingresso local previsto; o fragmento Caddy sobrescreve X-Forwarded-For vindo
  do cliente. O modo inicial Somente DNS preserva essa origem direta.
- A limitacao dos links publicos legados de anexos continua descrita no PR #21 e
  em DEPLOY/RF-023; preparar o deploy nao muda armazenamento ou entrega antigos.

## Pacote e segredos

As imagens devem ser construidas de uma exportacao Git da revisao aprovada,
com os Dockerfiles deste diretorio, em `linux/arm64`. Nao executar build do
working tree de desenvolvimento: ele contem arquivos reais ignorados pelo Git.
Transportar as imagens por arquivo com manifesto SHA-256 ou registro privado,
mantendo seus IDs/digests. Nao reconstruir entre homologacao e publicacao.

O pacote operacional extraido fica fora de checkout Git, por exemplo
`/srv/superchat/releases/REVISAO`. Carregar imagens nao inicia containers:

```bash
cd /srv/superchat/releases/REVISAO
sha256sum -c SHA256SUMS
docker load -i images-arm64.tar
```

Conferir no manifesto da entrega a revisao completa e os dois IDs. Gerar os tres
arquivos privados uma unica vez, no mesmo diretorio operacional:

```bash
bash ./prepare-env.sh "$PWD" REVISAO_COMPLETA sha256:ID_BACKEND sha256:ID_FRONTEND contato@komunick.com
bash ./preflight.sh
```

`prepare-env.sh` usa openssl/umask077, recusa Git, arquivos existentes e imagens
sem hash. `.env` contem a senha do Postgres e referencias imutaveis; `.env-backend`
contem uma master nova de 32 bytes; `.env-bootstrap` guarda email/senha forte do
primeiro administrador. Todos ficam em 600 e o diretorio em 700. Valores nao sao
impressos. Nao copiar esses arquivos para o frontend, Git, chat ou logs; nao usar
`source .env`, `docker inspect` de ambientes nem `docker compose config` sem quiet.

Guardar master e ambientes em cofre com acesso restrito, separadamente do backup
do banco. Nao regenerar a master em atualizacoes. A senha administrativa gerada
deve ser consultada por pessoa autorizada em `.env-bootstrap` e guardada no cofre;
somente o job bootstrap recebe esse arquivo. Nao reutilizar senha/chaves de dev.
Depois do primeiro acesso e de guardar a senha no cofre, retirar `.env-bootstrap`
do diretorio operacional. O arquivo e opcional para o runtime; uma nova tentativa
de bootstrap sem ele continua recusada. Os ambientes de banco/master permanecem.

## Ativacao posterior, depois da autorizacao

Os comandos abaixo sao o procedimento para uma ativacao autorizada; a preparacao
do candidato nao os executa no servidor produtivo.

1. Conferir revisao, hashes e homologacao das mesmas imagens. Executar
   `bash ./preflight.sh --activation`: exige ARM07/ARM64, imagens carregadas com a
   revisao correta, arquivos privados, Caddy valido, DNS A correto e porta livre.
   Conferir AAAA, redes Docker, acesso externo 80/443 e o Caddyfile existente.
2. Definir o comando Compose no diretorio da entrega:

   ```bash
   compose=(docker compose --project-directory "$PWD" --env-file "$PWD/.env" -f "$PWD/compose.yaml")
   # Infraestrutura tambem usa digests fixos; obter exatamente essas referencias.
   "${compose[@]}" pull postgres redis
   "${compose[@]}" up -d --wait --pull never postgres redis
   "${compose[@]}" --profile ops run --rm --no-deps migrate
   "${compose[@]}" --profile ops run --rm --no-deps bootstrap
   "${compose[@]}" up -d --pull never backend frontend
   ```

   Esse bootstrap e somente para a primeira instalacao em base nova. Ele recusa
   dados existentes/parciais e senha fraca; nao usar seed:all como reparo. Em falha,
   preservar os arquivos/banco para diagnostico. Nao apagar volumes nem repetir
   bootstrap cegamente. Em atualizacao, omitir bootstrap e avaliar migracoes antes
   de aplica-las, com backup e janela apropriados.
3. Conferir a resposta local de `127.0.0.1:5480` com Host
   `superchat.komunick.com`. O login HTTPS completo sera conferido pelo ingresso
   TLS, porque o cookie de renovacao e Secure. Banco e Redis nao publicam portas.
4. Fazer copia preservada do Caddyfile existente. Instalar este fragmento como
   `/etc/caddy/sites/superchat.caddy` e adicionar uma unica linha
   `import /etc/caddy/sites/superchat.caddy` **fora dos blocos** do Caddyfile atual,
   se ela ainda nao existir. Nao substituir outros sites. Conferir o conjunto com
   `sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`; somente
   apos sucesso, `sudo systemctl reload caddy`. O reload e a etapa de publicacao.
5. Conferir HTTPS/certificado, revisao ativa, login/renovacao, WebSocket, leitura
   autorizada de PDF/imagem/video, HEAD/Range e negativas de acesso. Usar somente
   arquivos/usuarios ficticios nas verificacoes e remover suas fixtures.
6. Guardar o registro da entrega (revisao, IDs/hashes, data, responsavel e resultado)
   e configurar os backups. Manter WhatsApp sem conexao e modos de fornecedores
   desligados. Liberar saida ou conectar um numero exige uma solicitacao posterior.

Os testes de candidato podem usar projeto/portas/redes diferentes em ambiente
isolado. Seus envs e dados sao ficticios; nunca promover esse banco de teste.

## Backup e recuperacao

`bash ./backup.sh /srv/superchat/backups/DATA_UNICA` gera banco SQL comprimido,
arquivos public/private e SHA256SUMS com permissoes restritas. O script nao apaga
backups anteriores nem embute ambientes/master. Conferir gzip e hashes e copiar
o backup para armazenamento externo restrito. Para consistencia entre banco e
arquivos, usar janela sem escrita ou snapshot coordenado; pg_dump sozinho fornece
snapshot consistente do banco, nao sincroniza uploads concorrentes.
Postgres e backend precisam estar em execucao: o script le os arquivos por exec
no backend existente, sem iniciar outra instancia da aplicacao.

Antes de qualquer atualizacao, validar migracoes/compatibilidade e registrar o
pacote anterior. Retornar imagens nao desfaz dados: nao executar migrate:undo,
down -v ou restaurar backup sobre dados novos por rotina. Se a versao anterior
nao for compativel com o esquema, preservar dados e preparar correcao adiante.

Uma restauracao autorizada usa volumes/base novos e as mesmas imagens/chaves
registradas: parar o runtime da instalacao de recuperacao, importar SQL pelo
Postgres, extrair public/private no backend com entrypoint substituido e recuperar
a master correta do cofre antes de iniciar. Nao executar bootstrap em base
restaurada. Validar acesso/arquivos/credenciais antes de trocar o ingresso. Sessao
WhatsApp nao deve ser restaurada neste primeiro deploy nem reconectada por esse
procedimento. Testar restauracao apenas com dados ficticios antes do uso real.
