# Autorização da mídia e das opções de setores

Recorte autorizado em 04/11/2026: corrigir as pendências de autorização de setores, validar com dados fictícios,
atualizar documentação/versão local e abrir PR, sem merge, deploy ou WhatsApp. A listagem `GET /queue` pertence
à correção independente de isolamento de consulta; este recorte trata mídia e opções.

## Contrato

- Administrador e superusuário com perfil administrativo operam na empresa da sessão, após conferir cadastro,
  empresa, perfil e privilégio atuais no banco. Não há exceção cross-company nestas rotas: a seleção de setores
  em Empresas → Usuários usa somente `GET /queue`; mídia e opções usam a sessão da empresa administrada.
- Autorizar setor/opção antes de o multipart gravar um arquivo. Sem permissão, nenhum upload, arquivo ou registro
  é alterado. Operações autorizadas mantêm campos, rotas e respostas existentes.
- Opções pertencem ao setor raiz da cadeia de pais. Preservar filhos com `queueId` direto e legados com
  `queueId=null`; pais e encaminhamentos precisam ser da mesma empresa, e os vínculos da cadeia precisam apontar
  para o mesmo setor. Recusar ciclos, vínculos quebrados e transferência de uma opção existente entre setores.
- A lista sem filtros inclui somente opções válidas da própria empresa. `queueId` limita a árvore de um setor;
  `parentId=-1` seleciona raízes, um pai positivo seleciona filhos diretos e `queueOptionId` seleciona uma opção.
  O cadastro recebe `parentId=null` para raízes. IDs malformados recebem 400 (`ERR_BAD_REQUEST`); ator comum ou
  obsoleto, 403 (`ERR_NO_PERMISSION`); referência externa ou inexistente, 404 (`ERR_QUEUE_NOT_FOUND`).
- Cadastro/edição aceitam somente campos funcionais permitidos. Body não define id, empresa, caminho ou nome de
  mídia. Uploads usam o setor autorizado e nome de arquivo seguro; exclusão valida caminho e armazenamento antes
  de remover o arquivo. A mídia de setores continua pública como no comportamento herdado.
- Edição de setores também filtra campos protegidos. Antes de excluir uma opção ou setor, conferir a árvore que
  será apagada por cascata; vínculos legados contaminados não podem apagar dados de outra empresa.
- Encaminhamento legado ausente ou externo não muda a propriedade da opção: leitura e exclusão próprias continuam
  disponíveis. A edição valida o encaminhamento efetivo, inclusive quando omitido no body; é possível repará-lo
  enviando `forwardQueueId=null`, mas não salvar outras alterações mantendo o vínculo inválido.

## Verificação prevista

Reproduzir as falhas anteriores em rotas reais/JWT/controladores/serviços, com doubles de persistência que aplicam
os filtros recebidos. Cobrir duas empresas, admin/super da própria empresa, ator removido/transferido/rebaixado,
raízes/filhos legados, relações inválidas, upload negado antes do parser e exclusão confinada. Confirmar falha na
base e sucesso no candidato; conferir API isolada com PostgreSQL e arquivos fictícios sob coordenação do responsável.
Resultados executados ficam no PR, sem segredo ou dado real. Não iniciar bootstrap, Docker ou WhatsApp.

Referências: [PRD RF-019](../PRD.md), [TAD](../TAD.md) e [princípios](../PRINCIPLES.md).
