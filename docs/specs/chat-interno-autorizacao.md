# Autorização do chat interno

## Objetivo e referência

Corrigir o acesso às operações e aos eventos do chat interno por empresa e participação, preservando os fluxos
legítimos do PRD RF-010. Escopo aprovado explicitamente no chat em 30/10/2026 após a issue para o Linear.
Base examinada: `00bdf2be672d2f6d3fcc9f9299be022950aa49b4`, PR26 de usabilidade, sem merge.

## Comportamento

- Lista, consulta por UUID, histórico, envio e leitura usam o ator autenticado e sua empresa atual. Conversa de outra
  empresa, inexistente ou ausência de participação respondem como conversa não encontrada, sem revelar seu conteúdo.
  Ator removido ou contexto de empresa já divergente do cadastro atual é recusado por falta de permissão.
  Perfil administrador/super não substitui participação. Associação legada entre empresas também não concede acesso.
- Somente o dono que participa do grupo pode editar título/participantes ou excluir o grupo. Membro sem essa permissão
  recebe 403. Conversas diretas continuam sem edição de participantes/título e sem exclusão.
- A lista inteira de participantes é validada antes de qualquer escrita: IDs válidos e usuários da mesma empresa.
  O dono permanece participante. Dados do corpo não substituem ator, empresa nem o ID da rota.
- Marcar como lida altera somente a associação do ator autenticado; o `userId` legado do corpo é ignorado.
- Criação, edição, mensagem, leitura e exclusão são emitidas somente a destinatários autorizados no momento da emissão.
  Salas de usuário são candidatas, não permissão. Revalidar empresa/participação também para sockets já conectados;
  token cuja empresa difere da empresa atual do usuário é desconectado antes de criar sessão ou entrar em salas.
  O cliente vincula a conexão ao ID e à empresa do token e encerra a conexão anterior ao trocar de identidade,
  encerrar sessão ou perder uma identidade válida; não manter eventos do usuário anterior.
- Ao remover alguém do grupo, enviar apenas a indicação de remoção `{action: "delete", id}` ao antigo participante
  ainda da mesma empresa, sem o chat atualizado. Quem foi readicionado não recebe remoção obsoleta. Página e popover
  removem os dados em cache dessa conversa. Excluir envia somente essa indicação aos antigos participantes válidos.
- O upload exige autorização antes do Multer e nova verificação na persistência. Arquivos exclusivos da requisição
  são limpos se houver revogação durante o envio ou falha antes da confirmação; não remover nem sobrescrever arquivos
  preexistentes. Nomes aleatórios são exclusivos do storage do chat, preservando nomes apresentados e contratos de mídia.
- Mutações e validação final usam transação/bloqueio compatível com alterações de participantes. Nada é emitido antes
  do commit; erro na autorização dos destinatários retém o evento, sem transformar escrita já confirmada em nova tentativa.
  Respostas/eventos não incluem senha, hash, códigos 2FA ou outros campos privados de usuários.

## Critérios de aceite

- Empresas fictícias A/B, dono, membro e não participante comprovam negativas de leitura, envio, edição, exclusão e
  upload; respostas negadas não alteram banco/arquivos nem publicam eventos com conteúdo.
- Participantes estrangeiros ou entrada inválida não causam alteração parcial; associação legada indevida não libera
  lista/histórico/eventos. Leitura com `userId` de outro participante altera somente o próprio ator autorizado.
- Remoção concorrente e mudança de empresa revogam operações/eventos; upload interrompido por revogação é limpo com
  segurança. Observadores fictícios não recebem eventos de conversas sem participação, inclusive criação/edição.
- Dono/membros legítimos continuam criando grupos/diretos, enviando/recebendo texto e anexos, lendo, paginando,
  administrando o grupo pelo dono e recebendo atualizações; removidos perdem a conversa também no popover.
- Atualizar documentação e versão local com dados anteriores preservados, somente testes fictícios e PR sem merge.

## Limites

Sem migração, dependência nova, alteração produtiva, WhatsApp ou redesenho global da autenticação. Esta correção
protege as APIs, a admissão/persistência de uploads e os eventos do chat. A entrega pública legada em `/public`
(RF-023) não se torna um download privado neste recorte; links antigos não são revogados nem migrados.
Colisão de nomes e contagem de não lidas de outros módulos não fazem parte desta mudança.
