# Publicação — Zap Komunick num subdomínio da Komunick

Como colocar o Zap Komunick no ar num endereço como `atendimento.komunick.com`. Os arquivos ficam na raiz do
repositório (`docker-compose-komunick.yaml`, `docker-compose-komunick-proxy.yaml`) e em `deploy/`.

> **Antes de publicar:** o `zap.komunick.com` roda hoje o Ticketz 1.0.132 (com backup do Ticketz PRO em
> `Komunick/ticketz-pro`). Este guia sobe o Zap Komunick num **subdomínio novo**, ao lado do atual. Trocar o
> `zap.komunick.com` por este fork faz perder o que é exclusivo do PRO e é decisão do responsável (docs/PRD.md, seção 5).

## 1. O que é preciso

- Um servidor Linux com Docker e o plugin `docker compose` (2 vCPU e 4 GB de memória atendem uma empresa pequena;
  a montagem das imagens usa mais memória que o uso diário).
- Um subdomínio de `komunick.com` com registro **A** apontando para o IP do servidor (no painel de DNS do domínio).
- Portas 80 e 443 liberadas no firewall do servidor e, se houver, no da nuvem (Oracle, AWS etc.).
- Um número de WhatsApp para conectar depois do primeiro acesso.

## 2. Escolha do modo

| Modo | Quando usar | Como sobe |
| --- | --- | --- |
| **A. Atrás do nginx do servidor** | O servidor já tem nginx (ou Caddy) atendendo outros sites nas portas 80/443 | `docker-compose-komunick.yaml` + `deploy/nginx-host.conf.example` + certbot |
| **B. Proxy próprio com HTTPS automático** | Servidor só para o Zap Komunick | `docker-compose-komunick.yaml` + `docker-compose-komunick-proxy.yaml` |

Nos dois, a aplicação responde só em `127.0.0.1:5480` (porta em `ZK_HTTP_PORT`); banco e Redis não ficam expostos.

## 3. Passo a passo

```bash
# 1. código (na pasta escolhida, por exemplo /opt/zap-komunick)
git clone https://github.com/Komunick/zap-komunick.git /opt/zap-komunick
cd /opt/zap-komunick
git checkout <branch ou tag aprovada>

# 2. configuração
cp deploy/env.example .env
cp deploy/env-backend.example .env-backend-komunick
cp deploy/env-frontend.example .env-frontend-komunick
openssl rand -base64 32        # cole em POSTGRES_PASSWORD, no .env
openssl rand -base64 18        # cole em ADMIN_PASSWORD, no .env-backend-komunick
openssl rand -hex 16           # cole em VERIFY_TOKEN, no .env-backend-komunick
```

Edite os três arquivos:

- `.env`: `POSTGRES_PASSWORD` (obrigatório) e, se a porta 5480 estiver ocupada, `ZK_HTTP_PORT`.
- `.env-backend-komunick`: `FRONTEND_HOST` (o subdomínio), `EMAIL_ADDRESS` (login do primeiro administrador) e
  `ADMIN_PASSWORD`.
- `.env-frontend-komunick`: `FRONTEND_HOST` (o mesmo subdomínio) e, no modo B, `LETSENCRYPT_EMAIL`. Tudo o que está
  neste arquivo fica público em `/config.json`: nada de senha aqui.

```bash
# 3a. modo A: sobe a aplicação e configura o nginx do servidor
docker compose -f docker-compose-komunick.yaml up -d --build
sudo cp deploy/nginx-host.conf.example /etc/nginx/sites-available/zap-komunick
sudo nano /etc/nginx/sites-available/zap-komunick      # troque o subdomínio (e a porta, se mudou)
sudo ln -s /etc/nginx/sites-available/zap-komunick /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d atendimento.komunick.com

# 3b. modo B: sobe a aplicação com o proxy e o certificado automático
docker compose -f docker-compose-komunick.yaml -f docker-compose-komunick-proxy.yaml up -d --build
```

A primeira subida demora (monta as imagens, cria o banco e roda as migrações). Acompanhe com
`docker compose -f docker-compose-komunick.yaml logs -f backend` até aparecer `Server is listening on port: 3000`.

## 4. Primeiro acesso

1. Abra `https://<subdomínio>` e entre com `EMAIL_ADDRESS` e `ADMIN_PASSWORD`.
2. Troque a senha do administrador no perfil e apague `ADMIN_PASSWORD` do `.env-backend-komunick` (ela só vale na
   criação do banco).
3. Em **Conexões**, adicione o WhatsApp e leia o QR Code com o aparelho.
4. Cadastre filas, usuários (com horário de acesso, se for o caso), motivos de finalização e o prazo de SLA.

## 5. Atualizar

```bash
cd /opt/zap-komunick
./deploy/backup.sh
git pull                    # ou git checkout <nova tag>
docker compose -f docker-compose-komunick.yaml up -d --build      # modo B: inclua o -f do proxy
```

As migrações do banco rodam sozinhas quando o backend sobe. Para voltar atrás: `git checkout <versão anterior>`, a
mesma subida e, se uma migração tiver mudado dados, restaurar o backup.

A atualização automática pela tela (herdada do Ticketz) fica **desligada**: o backend não recebe o Docker do
servidor, porque ela trocaria este fork pelas imagens do Ticketz original.

## 6. Backup e restauração

`./deploy/backup.sh` grava em `backups/<data>/` o banco (`banco.sql.gz`) e os arquivos (`arquivos.tar.gz`: mídias,
anexos e sessões do WhatsApp) e mantém os 14 últimos. Agende no cron (exemplo no topo do script) e copie a pasta
`backups/` para fora do servidor.

Restaurar num servidor novo (com os mesmos `.env`):

```bash
docker compose -f docker-compose-komunick.yaml up -d postgres redis
gunzip -c backups/<data>/banco.sql.gz | docker compose -f docker-compose-komunick.yaml exec -T postgres \
  psql -U ticketz -d ticketz
docker compose -f docker-compose-komunick.yaml run --rm --no-deps -T --entrypoint sh \
  -v "$(pwd)/backups/<data>:/backup" backend -c "tar xzf /backup/arquivos.tar.gz -C /usr/src/app"
docker compose -f docker-compose-komunick.yaml up -d
```

## 7. Cuidados de segurança

- Senhas fortes em `POSTGRES_PASSWORD` e `ADMIN_PASSWORD`; os arquivos `.env*` preenchidos nunca vão para o Git
  (estão no `.gitignore`).
- O painel de administração do Socket.IO fica desligado (`SOCKET_ADMIN=false`).
- Os segredos que assinam o login são gerados com aleatoriedade criptográfica na primeira subida e guardados no Redis;
  não aparecem no log.
- Ligações pelo Wavoip ficam desligadas (`WAVOIP_ENABLED=false`).
- Chamadas externas que continuam (herdadas do Ticketz): lista de países em `cdn.jsdelivr.net`, fontes do Google e a
  consulta da versão do WhatsApp Web em `waversion.ticke.tz` (backend). As imagens base do Docker vêm de
  `ghcr.io/ticketz-oss`.
