# Levar o SuperChat para outra VM ARM64

Este pacote instala o SuperChat em qualquer VM ARM64 com Docker e migra os dados de uma VM para outra. O que muda de
uma VM para outra fica em `host.env`; nada aqui cita uma VM específica.

| Arquivo | Onde roda | O que faz |
| --- | --- | --- |
| `preflight.sh` | destino | Confere a VM. Só lê |
| `instalar.sh` | destino | Instala o operador em `/opt/zap-komunick/bin`. Não sobe ambiente nem liga o poller |
| `exportar.sh` | origem | Gera o pacote: banco, arquivos, Redis e segredos cifrados |
| `importar.sh` | destino | Restaura o pacote, como ensaio ou em definitivo, e confere as contagens |
| `zapk.sh` | destino | Publicação do dia a dia (`poll`, `deploy-dev`, `promote`) |

As imagens são construídas no destino a partir do Git, na mesma revisão do pacote.

## Regras que não podem ser quebradas

1. **Nunca deixe os dois SuperChats ligados com a mesma sessão de WhatsApp.** Um derruba o outro e as chaves das
   conversas se embaralham. A origem para antes de o destino subir.
2. O pacote contém dados de clientes. Copie só por SSH, com permissão 600, e apague ao final nas duas pontas.
3. A senha do pacote fica fora dele. Sem ela não há como abrir as credenciais (`CREDENTIALS_MASTER_KEY`).
4. Homologação e produção migram em pacotes separados. Nunca restaure um no lugar do outro.

## 1. Preparar o destino (sem parar nada)

```sh
git clone https://github.com/Komunick/zap-komunick.git && cd zap-komunick
sudo bash deploy/vm/preflight.sh
sudo mkdir -p /opt/zap-komunick
sudo install -m 0644 deploy/vm/host.env.example /opt/zap-komunick/host.env   # preencha
sudo bash deploy/vm/instalar.sh
```

- Com **Traefik** (o do Coolify, por exemplo), informe a rede Docker e a faixa IPv4 dela. O Traefik precisa ter o
  resolvedor `letsencrypt` e os pontos de entrada `http` e `https`.
- Com **Caddy** no host, use os fragmentos `deploy/arm07/Caddyfile.*`. O sistema responde em `127.0.0.1:5480`
  (produção) e `127.0.0.1:5481` (homologação).
- Libere 80 e 443 no firewall da VM e na rede da nuvem.
- Reduza o TTL do DNS de `superchat.komunick.com` e `superchatdev.komunick.com` para 300 s, um dia antes.
- Se a VM já teve SuperChat (volumes `superchat_*`), o preflight acusa. Decida o que fazer com eles antes de seguir.

## 2. Ensaiar

Na origem, com o sistema no ar:

```sh
sudo bash deploy/vm/exportar.sh production /root/superchat-pacote-ensaio
```

Copie para o destino e restaure como ensaio:

```sh
sudo /opt/zap-komunick/bin/importar.sh production /root/superchat-pacote-ensaio --ensaio
```

O ensaio é um projeto separado (`superchatensaio`), sem domínio, sem saída para a internet, sem sessão de WhatsApp e
sem a fila de agendamentos. Responde em `127.0.0.1:5495`. Divergências pequenas nas contagens são normais, porque a
origem continuou gravando. Anote o tempo: ele dá o tamanho da parada. Depois remova e apague o pacote:

```sh
sudo /opt/zap-komunick/bin/importar.sh production --remover-ensaio
```

## 3. Virar

Comece pela homologação, com os mesmos passos e `development`. Depois a produção, fora do horário de atendimento:

1. Avise a equipe. Combine quem terá o celular na mão, caso um canal peça QR Code.
2. Na origem: `sudo bash exportar.sh production /root/superchat-pacote --final`. Pede confirmação, **para o ambiente**
   e desliga o poller.
3. Copie o pacote para o destino.
4. No destino: `sudo /opt/zap-komunick/bin/importar.sh production /root/superchat-pacote --definitivo`. Se alguma
   contagem divergir, o backend não sobe.
5. Aponte o DNS para o IP novo. O certificado HTTPS sai quando o domínio chegar à VM.
6. Confira `/deployment.json`, `/login`, `/backend/`, os canais em **Conexões**, uma mensagem recebida, uma enviada e
   um anexo antigo.
7. Com os dois ambientes no destino: `sudo systemctl enable --now zapk-poller.timer`.

As sessões de WhatsApp vão junto, então os canais devem reconectar sem QR. A troca de IP pode fazer o WhatsApp pedir
novo pareamento; tenha o celular à mão. Quem estiver com o SuperChat aberto recarrega a página.

## Voltar atrás

1. **Pare o destino primeiro**: `docker compose -p superchat stop`. Confirme que parou.
2. Volte o DNS.
3. Na origem: `cd /opt/zap-komunick/superchat/current && docker compose --env-file .env -f compose.yaml -f traefik.yaml up -d`.
   Depois religue o poller: `sudo systemctl enable --now zapk-poller.timer`.
4. O que entrou no destino depois da virada não está na origem. Se o destino chegou a conectar o WhatsApp, as chaves da
   origem ficaram velhas: se houver erro para ler ou enviar, leia o QR Code de novo.

## 4. Liberar a VM antiga

Só depois de alguns dias sem problema, e com a confirmação do dono, porque apagar não tem volta:

1. Copie o último pacote final e a pasta `backups/` para um lugar seguro, e confira os `SHA256SUMS`.
2. Confirme que o DNS não aponta mais para a VM antiga e que os contêineres `superchat*` estão parados.
3. Remova os projetos `superchat` e `superchatdev` (contêineres, redes e volumes), as imagens `zapk-*`,
   `/opt/zap-komunick` e as unidades `zapk-poller.*`. Não use `docker system prune`: a VM tem outros sistemas.
4. Apague os pacotes de migração e o log do incidente guardado em `/root/superchat-incidentes`, se não for mais preciso.
5. Atualize a seção 13 de `docs/DEPLOY.md` com a VM nova.
