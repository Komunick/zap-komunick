# Publicação — Zap Komunick em superchat.komunick.com

Como colocar o Zap Komunick no ar em **`superchat.komunick.com`** (endereço escolhido em 27/10/2026). Os arquivos ficam
na raiz do repositório (`docker-compose-komunick.yaml`, `docker-compose-komunick-proxy.yaml`) e em `deploy/`; os
modelos de ambiente e do nginx já vêm com esse endereço.

> **Antes de publicar:** o `zap.komunick.com` roda hoje o Ticketz 1.0.132 (com backup do Ticketz PRO em
> `Komunick/ticketz-pro`). Este guia sobe o Zap Komunick num **subdomínio novo**, ao lado do atual. Trocar o
> `zap.komunick.com` por este fork faz perder o que é exclusivo do PRO e é decisão do responsável (docs/PRD.md, seção 5).

## 1. O que é preciso

- Um servidor Linux com Docker e o plugin `docker compose` (2 vCPU e 4 GB de memória atendem uma empresa pequena;
  a montagem das imagens usa mais memória que o uso diário).
- O registro de DNS `superchat` em `komunick.com` apontando para o IP do servidor (seção 2).
- Portas 80 e 443 liberadas no firewall do servidor e, se houver, no da nuvem (Oracle, AWS etc.).
- Um número de WhatsApp para conectar depois do primeiro acesso.

## 2. DNS no Cloudflare

O DNS de `komunick.com` fica no **Cloudflare** (servidores `jason` e `sara.ns.cloudflare.com`). Em 27/10/2026
`superchat.komunick.com` ainda não existia. No painel do Cloudflare, em `komunick.com` › DNS › Records:

| Tipo | Nome | Conteúdo | Proxy | TTL |
| --- | --- | --- | --- | --- |
| `A` | `superchat` | IP público do servidor | **Somente DNS** (nuvem cinza) na primeira subida | Auto |

- Com a nuvem cinza, o certificado do Let's Encrypt (certbot no modo A, acme-companion no modo B) sai direto do
  servidor. Depois de o site abrir com HTTPS, dá para ligar o proxy (nuvem laranja); nesse caso, em SSL/TLS deixe o
  modo **Full (strict)**, para o Cloudflare só aceitar o certificado válido do servidor. O tempo real (WebSocket) e os
  anexos de até 64 MB passam pelo proxy do Cloudflare sem ajuste.
- Se o servidor tiver IPv6, crie também o registro `AAAA` com o mesmo nome.
- Conferir antes de subir: `nslookup superchat.komunick.com` precisa devolver o IP do servidor (com a nuvem laranja,
  devolve IPs do Cloudflare, e isso também está certo).

## 3. Escolha do modo

| Modo | Quando usar | Como sobe |
| --- | --- | --- |
| **A. Atrás do nginx do servidor** | O servidor já tem nginx (ou Caddy) atendendo outros sites nas portas 80/443 | `docker-compose-komunick.yaml` + `deploy/nginx-host.conf.example` + certbot |
| **B. Proxy próprio com HTTPS automático** | Servidor só para o Zap Komunick | `docker-compose-komunick.yaml` + `docker-compose-komunick-proxy.yaml` |

Nos dois, a aplicação responde só em `127.0.0.1:5480` (porta em `ZK_HTTP_PORT`); banco e Redis não ficam expostos.

## 4. Passo a passo

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
- `.env-backend-komunick`: `FRONTEND_HOST` já vem `superchat.komunick.com`; preencher `EMAIL_ADDRESS` (login do
  primeiro administrador) e `ADMIN_PASSWORD`.
- `.env-frontend-komunick`: `FRONTEND_HOST` já vem `superchat.komunick.com`; no modo B, confira `LETSENCRYPT_EMAIL`.
  Tudo o que está neste arquivo fica público em `/config.json`: nada de senha aqui.

```bash
# 3a. modo A: sobe a aplicação e configura o nginx do servidor
docker compose -f docker-compose-komunick.yaml up -d --build
sudo cp deploy/nginx-host.conf.example /etc/nginx/sites-available/zap-komunick
sudo nano /etc/nginx/sites-available/zap-komunick      # só se a porta mudou
sudo ln -s /etc/nginx/sites-available/zap-komunick /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d superchat.komunick.com

# 3b. modo B: sobe a aplicação com o proxy e o certificado automático
docker compose -f docker-compose-komunick.yaml -f docker-compose-komunick-proxy.yaml up -d --build
```

A primeira subida demora (monta as imagens, cria o banco e roda as migrações). Acompanhe com
`docker compose -f docker-compose-komunick.yaml logs -f backend` até aparecer `Server is listening on port: 3000`.

## 5. Primeiro acesso

1. Abra `https://superchat.komunick.com` e entre com `EMAIL_ADDRESS` e `ADMIN_PASSWORD`.
2. Troque a senha do administrador no perfil e apague `ADMIN_PASSWORD` do `.env-backend-komunick` (ela só vale na
   criação do banco).
3. Em **Conexões**, adicione o WhatsApp e leia o QR Code com o aparelho.
4. Cadastre filas, usuários (com horário de acesso, se for o caso), motivos de finalização e o prazo de SLA.

## 6. Atualizar

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

## 7. Backup e restauração

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

## 8. Cuidados de segurança

- Senhas fortes em `POSTGRES_PASSWORD` e `ADMIN_PASSWORD`; os arquivos `.env*` preenchidos nunca vão para o Git
  (estão no `.gitignore`).
- O painel de administração do Socket.IO fica desligado (`SOCKET_ADMIN=false`).
- Os segredos que assinam o login são gerados com aleatoriedade criptográfica na primeira subida e guardados no Redis;
  não aparecem no log.
- Ligações pelo Wavoip ficam desligadas (`WAVOIP_ENABLED=false`).
- Chamadas externas que continuam (herdadas do Ticketz): lista de países em `cdn.jsdelivr.net`, fontes do Google e a
  consulta da versão do WhatsApp Web em `waversion.ticke.tz` (backend). As imagens base do Docker vêm de
  `ghcr.io/ticketz-oss`.

## 9. Credenciais protegidas — P0 (RF-020)

Esta configuração prepara o armazenamento; não conecta IA, Acessórias ou SCI. Aplicação em produção depende de
autorização de publicação. Na validação local, usar somente credenciais fictícias e empresas de teste.

### Configurar antes de cadastrar ou migrar

1. Gerar uma chave criptograficamente aleatória de **32 bytes, codificada em base64**, com ferramenta de segredos da
   infraestrutura. Configurar como `CREDENTIALS_MASTER_KEY` no ambiente exclusivo do backend (`.env-backend-komunick`
   ou cofre do servidor), com permissão restrita. Não copiar para banco, Redis, frontend, Git, chat, prints ou logs.
2. Guardar cópia segura dessa chave separadamente do backup do banco. Ela será necessária para restaurar o acesso aos
   valores cifrados. Não gerar uma chave diferente a cada reinicialização. Deixar `CREDENTIALS_PREVIOUS_MASTER_KEY`
   vazio fora de uma rotação controlada.
3. Aplicar a configuração/reinicialização somente no ambiente autorizado. O compose de desenvolvimento recebe as
   duas variáveis do ambiente do executor ou de `--env-file`; o compose da Komunick usa `.env-backend-komunick`.
   Nenhum valor secreto pertence a `deploy/env-backend.example`.
4. Administrador da própria empresa confere o estado em Configurações. A nova chave de IA é digitada em campo vazio
   e salva explicitamente; uma chave salva nunca volta para a tela. Sem chave mestra válida, gravação/migração são
   recusadas. Remoção local continua disponível e não revoga o token no fornecedor.

### Configuração herdada e falhas

A migração de esquema cria o armazenamento sem mover automaticamente valores de `Settings`. Enquanto houver legado,
o estado indica migração pendente; o valor não é retornado ao navegador. A transcrição existente pode continuar
resolvendo esse valor apenas no backend até a migração.

Depois de configurar a chave mestra, usar **Proteger chave existente** (IA) ou `POST /credentials/migrate`, autenticado
como administrador da empresa. O serviço move o legado e remove a cópia legível na mesma transação. Conferir o estado
de cada empresa; não considerar que migrar uma migrou todas. Conflitos ou falhas não autorizam apagar o valor antigo.

Não substituir uma chave mestra perdida para tentar recuperar envelopes: isso não recupera os dados. Restaurar a
chave correta a partir da cópia segura ou remover/recadastrar a credencial com pessoa autorizada. Falha de decifragem
ou fornecedor deve bloquear somente a operação dependente; o recebimento normal de áudio continua funcionando.

### Substituição, remoção e rotação

- **Token do fornecedor:** gerar um substituto no fornecedor, salvar via PUT `/credentials/:key` com `{value}` e
  confirmar o estado. Revogar o token antigo no fornecedor por seu fluxo próprio; DELETE remove somente a cópia local.
  Os identificadores aceitos são `openAiKey`, `acessoriasApiToken`, `sciPartnerToken` e `sciClientToken`. As rotas usam
  a empresa da sessão administrativa, sem parâmetro para escolher outra empresa, e não devolvem o valor.
- **Chave mestra:** planejar janela e backup; colocar a chave ativa anterior em `CREDENTIALS_PREVIOUS_MASTER_KEY` e
  uma nova chave aleatória em `CREDENTIALS_MASTER_KEY`. Aplicar ambas juntas ao backend autorizado, executar a migração
  administrativa de cada empresa e conferir a recifragem antes de retirar a anterior. Não perder nenhuma das duas
  durante uma rotação parcial. Tratar erro antes de avançar, sem descartar envelopes indecifráveis.
- **Recuo de aplicação:** manter `CompanyCredentials` e as chaves preserva os dados; não executar `down` como rotina
  de recuperação. Código anterior ao P0 não lê o novo armazenamento e pode voltar a expor configurações herdadas.
  Não restaurar automaticamente credenciais em texto comum nem tratar o recuo como compatível sem avaliação.

Tokens locais de API, pagamentos, certificados, 2FA e sessões WhatsApp mantêm os mecanismos dos respectivos módulos.
O P0 não é uma migração global de todos os segredos herdados. Consulte o TAD para autorização do contexto e limites.

## 10. Assistente simulado — P1 (RF-021)

O P1 entrega o percurso de resumo/sugestão e revisão humana com provedor mock local. Não conecta um modelo de IA,
não lê a chave de transcrição e não precisa de crédito/faturamento. A simulação não mede a qualidade de um modelo real.

Para o piloto de desenvolvimento com dados fictícios:

1. Definir `AI_ASSISTANT_MODE=mock` somente no ambiente do backend de teste e aplicar a reinicialização autorizada.
   O compose de desenvolvimento recebe a variável do executor/arquivo de ambiente; o modelo de publicação mantém
   `AI_ASSISTANT_MODE=disabled`. Um valor diferente de `mock` não ativa um provedor externo.
2. Entrar como administrador de uma empresa inteiramente fictícia e habilitar o assistente simulado em Configurações
   (`aiAssistantEnabled=enabled`). A configuração vem desligada; habilitar A não muda B. Não habilitar empresas com
   conversas reais para este roteiro de validação.
3. Abrir um atendimento fictício autorizado, pedir resumo ou sugestão e conferir **Simulação**, referências e avisos.
   Somente texto elegível do atendimento atual entra no contexto, até 30 mensagens/12.000 caracteres; contexto parcial
   e ausência de informação são indicados. Notas/anexos e outros atendimentos do cliente ficam de fora.
4. Revisar/editar a sugestão e escolher **Usar no rascunho** para anexar ao texto já escrito. A ação não envia.
   O envio normal continua separado e não deve ser exercitado na validação com o WhatsApp pessoal desconectado.

Resultados não aceitos ficam na memória do percurso; cancelar ou trocar conversa os descarta. Depois de anexado,
o texto é um rascunho comum e segue o armazenamento local herdado do composer. Logs/auditoria não guardam o texto
integral nem o contexto. A simulação não grava mensagens, notas ou filas de envio.

Para desativar, desligar a opção da empresa ou voltar o modo do backend para `disabled`; não há migração de esquema
nem dado de atendimento a desfazer. Uma resposta em andamento perde validade se acesso/configuração mudar antes de
ser devolvida. O usuário continua responsável por revisar qualquer texto já aceito no próprio rascunho.

Conectar um provedor real exige outro recorte autorizado: modelo, conteúdo/base interna, dados permitidos, orçamento,
política do fornecedor e avaliação com casos aprovados. Trocar o valor de uma variável não conecta esse provedor.

## 11. Clientes e pendências Acessórias — P2 simulado (RF-022)

Este recorte usa somente um provedor mock local. Não configura token, não consulta Acessórias real e não aprova o
plano/licença/API do escritório. Os dados e campos apresentados são fictícios; não são confirmação de prazo fiscal,
entrega, pagamento ou cumprimento de obrigação.

Para validar no desenvolvimento, usando apenas uma empresa e contatos inteiramente fictícios:

1. Definir `ACESSORIAS_MODE=mock` no backend de teste e reiniciar nesse ambiente autorizado. O compose de dev recebe
   a variável do executor/arquivo de ambiente; o modelo de publicação mantém `ACESSORIAS_MODE=disabled`.
2. Administrador habilita `acessoriasEnabled=enabled` em Configurações da empresa fictícia. Modo e flag são barreiras
   independentes, desligadas por padrão. Habilitar A não habilita B; valores desconhecidos não conectam serviço real.
3. Abrir um atendimento fictício autorizado e o painel Acessórias. O administrador escolhe no catálogo mock e confirma
   o vínculo **local** daquele contato. Um contato pode ter mais de um cliente externo; a seleção de consulta é explícita.
   Nenhum nome/telefone/CNPJ de mensagem cria vínculo ou libera cadastro automaticamente.
4. Consultar cadastro/pendências, páginas, fonte/horários e avisos. O catálogo inclui casos fictícios de dados vazios,
   desatualizados, erro funcional, acesso recusado, limite e timeout; esses casos não provam o contrato do fornecedor real.
5. Para remover, confirmar a desvinculação local. Isso não exclui o cliente nem altera pendências no fornecedor.
   Uma notificação sem conteúdo cadastral invalida o painel desse contato quando entregue; após desconexão, a próxima
   consulta sempre valida novamente o vínculo e as permissões.

Dados consultados ficam somente em memória do painel. Sem exportação, download, sincronização, cache compartilhado,
integração com IA ou envio de mensagem. O rascunho e os dados do atendimento não são alterados pela consulta.

Para desativar, desligar flag da empresa ou voltar `ACESSORIAS_MODE=disabled`. Isso bloqueia clients/catalog/consultas,
inclusive para administrador; a UI fica indisponível. DELETE `/tickets/:ticketId/acessorias/links/:externalClientId`
continua disponível à administração autorizada para revogar **um vínculo local conhecido**, sem depender do provedor.
Não há um catálogo irrestrito ou consulta de cadastro liberado por essa exceção.

A migração de esquema cria apenas o cadastro de vínculos. Ao recuar a aplicação, manter essa tabela preserva os
mapeamentos; não executar reversão destrutiva como recuperação padrão. A chave mestra P0 e as configurações P1 são
independentes desse modo. Conexão real, token, contrato/licença, ambiente autorizado, quotas e documentos exigem outro
recorte; mudar uma variável não implementa o conector real.

## 12. Visualizadores de arquivos da conversa — RF-023

A melhoria usa o armazenamento existente e não requer chave, provedor externo, variável nova ou migração de banco.
Publicar frontend/backend compatíveis para disponibilizar a área **Arquivos** e a nova API de anexos. O percurso é
iniciado pela pessoa no atendimento autorizado; IA/Acessórias permanecem independentes e não recebem os arquivos.

Prévias locais de PDF, JPEG, PNG, GIF, WebP, MP4 e WebM têm limite de 25 MiB, uma ativa por vez. O navegador carrega
bytes pela API autenticada, sem token em URL; PDF usa canvas e controles de página/zoom. Vídeo depende de codecs do
navegador. Arquivo ausente, inválido/com senha, grande ou incompatível mostra seu estado. Download/Abrir original é
ação explícita; erro de acesso não abre automaticamente uma URL alternativa.

Os links legados `/public/*` no Express, o alias nginx e os links enviados ao destinatário continuam públicos.
Esta entrega não privatiza esses arquivos. Não bloquear apenas uma rota esperando proteção completa: também há
entrega direta pelo nginx e compatibilidade com o envio de arquivos grandes. Migração para armazenamento privado,
URLs temporárias e alteração de envio precisam de plano próprio.

Para validar no dev, usar somente duas empresas, mensagens e arquivos novos/fictícios, sem WhatsApp pessoal ou envio.
Conferir paginação e acesso por empresa/cliente/setor, HEAD/Range/download, PDF com duas páginas, imagens e vídeos,
falhas e troca de contexto; remover apenas IDs e diretório rastreados das fixtures. Preservar a master P0 e os modos
IA/Acessórias desligados. Recuar o código não exige apagar arquivos nem reverter dados.
