# Arquivos e visualizadores na conversa

## Pedido e referência

Pedido posterior ao P2: ampliar a integração com arquivos e oferecer PDF, imagens e vídeos embutidos, com interação
semelhante à do WhatsApp. Base examinada: `c54f3e56d551b588588dc5e63cd6917265f77f63`, PR #20. Este recorte é uma
melhoria do chat, independente do provedor Acessórias. Mantém as regras de acesso P0 e o histórico RF-017 do PRD.
WhatsApp é referência de interação; não se copia código nem se conecta uma conta pessoal para testar.

## Comportamento definido

- Botão **Arquivos** no atendimento válido abre uma área responsiva com documentos, imagens e vídeos do histórico
  permitido daquele contato. Filtros por tipo, paginação própria e busca por nome **nos arquivos carregados**; não
  apresentar apenas as mensagens já carregadas no chat como se fossem todos os anexos do histórico.
- Arquivo pode ser aberto pela mensagem ou pela área de arquivos. PDF sem o envelope específico do WhatsApp também
  é reconhecido como documento; tipos desconhecidos não viram vídeo por exclusão. Mensagens excluídas não recebem
  acesso ao novo visualizador; isso não exclui arquivos físicos nem define nova política de retenção.
- Visualizador dentro do aplicativo: imagem com zoom/rotação; vídeo com controles nativos e reprodução iniciada pela
  pessoa; PDF em canvas, uma página por vez, anterior/próxima, seleção de página e zoom/ajuste. Não usa serviço externo
  de documentos, iframe de conteúdo arbitrário, formulários ou scripts do PDF. A galeria navega nos itens carregados.
- Uma prévia ativa por vez, até **25 MiB** por arquivo. Blob recebido pelo cliente autenticado da aplicação, com
  cancelamento/timeout e liberação das URLs locais ao fechar, trocar mídia ou contexto. Tamanho, formato, arquivo ausente,
  PDF inválido/com senha e codec não suportado têm respostas compreensíveis; erro não deixa prévia antiga parecer atual.
- Download do conteúdo carregado depende de ação explícita. Arquivos grandes, externos ou sem prévia podem oferecer
  **Abrir original** pelo mecanismo legado, após obter metadados autorizados; nunca como fallback automático a 401/403.
  Não enviar, encaminhar, alterar rascunho ou marcar leitura por abrir a área/visualizador.

## Acesso e compatibilidade

- Listagem, item e conteúdo exigem autenticação/compliance e acesso atual à empresa, contato e setor. O servidor
  define o contexto. Histórico anterior respeita `messageVisibility` e transferência conforme RF-017; conhecer um ID
  ou cursor não autoriza outro atendimento/cliente. Identidade da mensagem inclui **id e ticket de origem**.
- Nova API: GET `/tickets/:ticketId/attachments` com `kind=all|pdf|image|video|other`, cursor opaco e limite 1..50
  (padrão 20); GET `/:sourceTicketId/:messageId` para metadados e HEAD/GET `/:sourceTicketId/:messageId/content`.
  Metadados não contêm corpo da mensagem, JSON do WhatsApp ou caminho físico. Cursor é validado e reescopado.
- Conteúdo aceita somente arquivo local regular, com caminho real contido no armazenamento existente e namespace
  de empresa coerente quando presente. Não faz fetch/proxy/redirecionamento de URL externa. Assinatura/MIME são
  conferidos para PDF, JPEG, PNG, GIF, WebP, MP4 e WebM; HTML/SVG/Office não são embutidos. Range simples, HEAD,
  `private, no-store`, `nosniff` e nova autorização antes de enviar os headers. Não colocar token na URL.
- **Limite herdado confirmado:** `/public/*` no Express e o alias nginx entregam arquivos por URL pública; o envio
  atual também usa esses links para anexos grandes. Esta entrega não torna essas URLs privadas. Não bloquear somente
  uma dessas rotas nem quebrar a entrega ao destinatário. Protege as novas APIs e não promete isolamento global dos
  bytes já públicos. Privatização/migração do armazenamento e do envio exigem outro recorte.

## Critérios observáveis

1. PDF com e sem `dataJson`, imagem, vídeo e outro arquivo são classificados corretamente; nome/tipo são legíveis.
   Prévia abre dentro da conversa e da área de arquivos, sem enviar mensagem ou alterar rascunho/leitura/SLA.
2. Arquivos de histórico anterior permitido aparecem com paginação independente; nenhum item de outra empresa,
   contato ou setor proibido aparece. IDs iguais em tickets diferentes não se confundem; cursores não ampliam acesso.
3. PDF real de duas páginas permite mudar página e zoom; imagem permite ampliar/girar; vídeo fictício reproduz,
   pausa e avança. Claro/escuro e desktop/celular cobrem os três formatos, com controles identificados e foco/fechamento.
4. Nova API prova HEAD/GET, MIME, bytes e Range 206/416 reais. Nega arquivo externo, traversal/symlink para fora,
   namespace de outra empresa, assinatura divergente, removido e limite; respostas/logs não revelam corpo, URL ou caminho.
5. Troca de mídia/ticket, cancelamento, remoção e mudança de permissões durante consulta impedem resposta antiga no
   contexto errado. Requests, tarefas PDF e Object URLs são encerrados; erro de acesso não abre o link público.
6. Vazio, carregamento, arquivo ausente/corrompido/grande, PDF com senha e vídeo não suportado são tratados sem travar
   o chat. Download explícito conserva os bytes; nenhum conteúdo executável é interpretado como documento HTML.
7. Testes usam somente novas identidades, mensagens e arquivos fictícios rastreados; zero envio/fornecedor/WhatsApp
   pessoal. Limpeza é restrita a IDs e diretório de fixtures; master P0 e modos IA/Acessórias desligados são preservados.

## Fora do recorte

Nova integração de armazenamento/S3, privatização de URLs legadas, alteração do upload/compressão/envio, documentos
do Acessórias/SCI, extração por IA, edição/OCR, antivírus, migração/remoção de arquivos existentes e produção.
Não há migração de esquema: recuar o código não apaga nem move anexos. Evidências executadas ficam no PR.
