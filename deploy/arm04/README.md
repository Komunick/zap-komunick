# Saída para o WhatsApp na ARM04

O backend de produção pode usar um proxy HTTP CONNECT na rede interna. O proxy aceita o IPv4 do
backend e encaminha TCP 443 para os domínios do WhatsApp. Ele consulta o DNS e conecta somente
ao endereço público validado. O cliente mantém a validação do certificado TLS.

Antes de ativar, confira os endereços do projeto `superchat` e a situação dos canais. O backend
tenta iniciar os canais cadastrados ao subir. Faça backup do banco, dos arquivos e da configuração
Traefik. Instale `whatsapp-connect-proxy.cjs` em
`/opt/zap-komunick/superchat/whatsapp-egress/`, com leitura para o usuário do contêiner e escrita
restrita ao operador. Mescle `whatsapp-egress.yaml` no override de produção
`/opt/zap-komunick/superchat/current/traefik.yaml`. O script de promoção copia esse override
para a próxima release. Confira o Compose resultante antes de promover.

Valide que somente o proxy participa da rede de saída, que o backend, o banco e o Redis continuam
na rede interna e que o proxy não publica portas. Teste um destino permitido e um destino negado.
Na tela Conexões, confirme que o canal apresenta o QR para que o responsável faça o pareamento.

Para reverter, restaure o override anterior, recrie o backend de produção com o Compose original
e remova o contêiner do proxy e sua rede exclusiva. Preserve os volumes e o banco do ambiente.
