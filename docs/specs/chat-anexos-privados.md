# Anexos privados do chat interno

## Objetivo e referência

Impedir a entrega pública de anexos do chat interno, incluindo os existentes, e preservar o acesso dos participantes
autorizados. Escopo aprovado no chat em 30/10/2026 após texto de issue para o Linear. Base examinada:
`aefdae2d5b88c99fa8f347c972754dc1874c93ca`, PR27, sem merge. Complementa RF-010 e substitui o limite de entrega pública
do chat registrado na especificação anterior de autorização; os arquivos dos demais módulos seguem seus contratos.

## Comportamento e limites

- Novos anexos ficam em `private/chat`, fora da raiz pública. A mensagem expõe somente uma URL de conteúdo por
  identidade de chat/mensagem; nenhum nome de storage, token ou segredo compõe essa URL.
- Cada GET, HEAD, Range ou requisição condicional exige autenticação, empresa atual e participação atual no chat.
  Administrador/super sem participação não tem acesso. A mensagem deve pertencer ao chat autorizado.
- A rota de mídia aceita o Bearer já usado pela API ou a sessão HttpOnly `jrt` para os elementos nativos do navegador.
  Somente essa rota admite cookie: conferir assinatura, versão do token e empresa contra o usuário atual, sem emitir
  tokens ou alterar a sessão. Credenciais simultâneas divergentes ou inválidas são recusadas, sem fallback.
- Sem credencial válida, recusar antes de metadados ou bytes. Para usuário autenticado sem acesso, preservar a resposta
  indistinguível de recurso não encontrado. Autorizar também antes de respostas parciais, 304 ou 416.
- Conteúdo privado usa `Cache-Control: private, no-store`, varia por Authorization/Cookie e não pode ser servido por
  cache público ou alias estático. Manter streaming, HEAD e Range para reprodução e download.
- Imagens, áudio, vídeo, galeria e downloads existentes continuam funcionando. Preservar o download de PDF atual do
  chat; esta mudança não acrescenta outro visualizador. Erro de acesso nunca abre a URL pública antiga.
  Troca de usuário/empresa ou revogação limpa os players, a galeria e o estado local correspondente.
- Inline somente para formatos seguros, com tipo e disposição definidos pelo servidor e `nosniff`; conteúdo ativo
  como HTML/SVG deve ser baixado, sem execução no origin da aplicação. Caminhos e symlinks não podem escapar das raízes.

## Migração e recuperação

- Manter o basename RAW das mensagens e suas associações; mover somente os bytes para a raiz privada, sem migration
  de schema. Identificar legados pelas referências de ChatMessages e pelo namespace próprio `chat-UUID`, inclusive
  órfãos identificáveis. Não adivinhar nem apagar arquivos desconhecidos sem origem registrada.
- Disponibilizar inventário/dry-run antes de execução explícita em manutenção. Validar nomes, referências compartilhadas,
  arquivos regulares e integridade antes de remover qualquer origem. Se outro módulo usa o mesmo caminho, recusar o
  cutover antes de alterações e apresentar o conflito para resolução; não quebrar nem reescrever esse módulo em silêncio.
- Copiar sem sobrescrever, verificar hashes e só então remover a cópia pública. Interrupção deve permitir retomada segura,
  mantendo arquivos íntegros; ausência anterior de arquivo continua indisponível e deve constar no inventário.
  Não fazer fallback de leitura pública nem rollback automático para uma versão que volte a publicar anexos.
- Antes de escutar HTTP, a nova versão verifica a prontidão e recusa iniciar com cópias públicas conhecidas pendentes.
  A rota pública também bloqueia nomes identificados como anexos de chat, inclusive se forem recolocados em `public`.
  O nginx deve encaminhar a decisão para o backend, sem alias que contorne a verificação.
- Esta entrega não revoga cópias já baixadas ou caches anteriores fora do controle do servidor, nem redesenha a revogação
  global de JWTs. Autorizar cada nova requisição; bytes já entregues não podem ser recuperados do destinatário.

## Critérios de aceite

- Empresas e participantes fictícios provam acesso legítimo e negativas para anônimo, não participante, outra empresa,
  participante removido, ator transferido e mensagem de outro chat, sem conteúdo ou metadados indevidos.
- Arquivos anteriores ao cutover mantêm hash, associação e acesso privado após migração; seus links públicos antigos
  não entregam bytes por GET/HEAD/Range/inline/condicionais, pelo Express nem pelo nginx.
- Um arquivo público de outro módulo permanece funcional. Conflitos, interrupção, retomada, arquivo ausente,
  travessia e symlinks não causam perda, sobrescrita ou exposição de arquivos alheios.
- Reprodução, galeria e downloads autorizados continuam válidos nos dois temas e celular. Troca de ator e remoção não
  mantêm novo acesso, galeria ou players da conversa revogada.
- Atualizar documentação e versão local, preservar banco/login/chave e ambientes anteriores, somente dados fictícios
  e PR sem merge. Não operar produção, ARM07/DNS ou WhatsApp nesta execução.
