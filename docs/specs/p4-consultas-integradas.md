# P4 — consultas integradas com revisão humana (simulação)

## Pedido e limite da mudança

Em 30/10/2026 o responsável escolheu **P4: consultas integradas de IA, Acessórias e SCI, com mocks e dados fictícios**.
Base: `44b5bb967f3e93927d7f8b81b37ab22c5c63cfdb`, PR #23. O plano da
[rodada 3](rodada-3-ia-integracoes.md) é referência de direção; este pedido autoriza o recorte abaixo.
Reutilizar [P0](p0-credenciais-isolamento.md), [P1](p1-assistente-revisao.md),
[P2](p2-acessorias-consultas.md) e [P3](p3-sci-consultas.md), preservando seus percursos independentes.

Consulta sob demanda reúne o texto elegível do atendimento e uma página de cada fonte escolhida. Não implementa
sincronização, cursor persistente, filas, webhook, cache de resultados, IA ou fornecedores reais, credenciais,
documentos/downloads, marcação de leitura, automação de envio ou escrita externa. Não escolhe módulo SCI real.
Sem dependência nova, merge, alteração dos ambientes ARM07 ou reconexão do WhatsApp.

## Comportamento

- Novo recurso desligado por padrão: `INTEGRATED_ASSISTANT_MODE=mock` no servidor e
  `integratedAssistantEnabled=enabled` na empresa, configurável apenas pela administração atual da empresa.
  Também exige P1 habilitado. Acessórias/SCI mantêm modos e flags próprios; P4 não os habilita implicitamente.
  Modo desconhecido, flag ausente ou duplicatas divergentes bloqueiam. Os perfis ARM07 mantêm todos desligados.
- O painel abre somente em atendimento autorizado. Lista vínculos locais por provedor e exige escolher explicitamente
  ao menos uma fonte; pode consultar ambas. As seleções começam vazias, independentes mesmo com IDs externos iguais.
  Catálogo e gerenciamento de vínculos continuam nos painéis P2/P3. Nunca inferir empresa externa por mensagem/nome.
- A pessoa escolhe resumo ou sugestão e solicita a consulta. Contexto de conversa segue P1: até 30 mensagens e 12.000
  caracteres de texto elegível do atendimento atual. Cada fonte externa entrega uma página explícita, de 1 a 100,
  com até 5 itens. Alterar seleção/página invalida o resultado e exige nova solicitação.
- Texto simulado determinístico cita somente relatos autorizados e metadados validados das fontes selecionadas,
  identifica origem/horários e informa limites/paginação. Não confirma obrigação cumprida, pagamento, prazo fiscal
  ou conteúdo de documento. Mensagens e metadados são dados não confiáveis, sem poder conceder ferramenta/permissão.
- Falhas operacionais de fonte (recusa simulada, quota, timeout, corpo inválido) são parciais e explícitas, separadas
  por provedor; não viram lista vazia ou sucesso silencioso. Dados desatualizados e páginas incompletas têm avisos.
  Perda de autorização, vínculo/contexto ou flag durante a operação recusa todo o resultado.
- A autorização final, contexto de mensagens, flags e versões dos vínculos selecionados são conferidos depois dos
  awaits. Leitura final usa a transação e o lock do contato compartilhado com o CRUD dos vínculos. Nenhum fornecedor
  aguarda dentro desse lock. Os namespaces empresa/contato/provedor continuam separados.
- Sugestão fica editável em memória. Anexar ao rascunho é ação humana separada, com revalidação imediata do contexto
  local e vínculos, inclusive sem evento Socket.IO. Preserva texto existente; não envia nem altera leitura, SLA,
  notas, estado, etiquetas, mensagens ou credenciais. Após aceite, o texto segue o rascunho normal herdado de P1.
- `contextVersion` é um SHA256 do contexto local estável e da seleção, sem conteúdo legível; serve para comparar
  versões, não como credencial ou concessão de acesso. Revalidação sempre autentica e verifica permissões atuais.
  Não armazena resultados/sessões adicionais e não promete atualizar o fornecedor sem uma nova consulta.
- Fechar, cancelar, trocar atendimento/cliente/página/ator ou receber evento de flag/vínculo limpa e invalida respostas
  antigas. Sem entrega do evento não há promessa de apagar instantaneamente um snapshot recebido; consulta e aceite
  sempre revalidam. Resumos, sugestões não aceitas e metadados não ficam em storage, logs, auditoria ou jobs.

## Contrato interno

Base autenticada `/tickets/:ticketId/integrated-assistant`, seguindo compliance e autorização do P0.

- `GET /status`: `{enabled,mode,simulated:true,requiresReview:true,reason,limits,providers}`.
  Limits: `{maxMessages:30,maxCharacters:12000,pageSize:5,maxPage:100}`. Providers contém `acessorias` e `sci`,
  cada um `{enabled,mode,reason}`; reasons estáveis sem conteúdo do fornecedor.
- `GET /clients`: `{mode:"mock",simulated:true,providers:{acessorias,sci}}`. Cada envelope tem
  `{state:"ready"|"disabled"|"error",clients,source,errorCode}`. Só vínculos autorizados, sem catálogo geral;
  `clients` e `source` usam DTOs estritos P2/P3, fonte indisponível não devolve dados anteriores.
- `POST` base: corpo exato `{kind:"summary"|"reply",sources:{acessorias,sci}}`. Ambos os campos de fonte são
  obrigatórios, cada valor `null` ou `{externalClientId,page}`, ao menos um selecionado. Empresa/contato/texto,
  URL, ferramenta ou chaves adicionais não são aceitos.
- Resultado: `{ticketId,contactId,kind,mode:"mock",simulated:true,requiresReview:true,text,references,context,
  sources,warnings,generatedAt,contextVersion}`. References/context seguem P1. Cada fonte é
  `{state:"ready"|"error"|"notSelected",data,errorCode}`; `data` só contém DTO de detalhe P2/P3 validado ou `null`.
  Texto, referências e avisos são limitados; nenhuma URL arbitrária/conteúdo extra é aceito.
- `POST /review`: corpo exato `{kind:"reply",sources,contextVersion}`, com a mesma seleção. Não recebe texto editado,
  não chama fornecedor nem gera novamente; confere autorização/snapshot locais na transação final. Mudança recusa
  com erro estável e exige nova consulta. Sucesso `{valid:true,mode:"mock",simulated:true}` não envia ou grava rascunho.
- Erros próprios `ERR_INTEGRATED_ASSISTANT_*`; erros de autorização/contexto dos percursos existentes continuam
  seguros. Rotas e configuração entram na classificação de privacidade antes de Sentry/logger, inclusive JSON
  inválido e caminhos codificados. Auditoria contém apenas ação, IDs e metadados mínimos, nunca resultado/versão/texto.

## Critérios observáveis

1. Modos/flags desligados ou divergentes recusam; configuração de A não habilita B. Só administrador atual altera
   a flag própria. Identidade/empresa/perfil/setores são recarregados, sem confiar em claims antigos.
2. Duas empresas, dois clientes e IDs repetidos em provedores demonstram que conversa, seleção, vínculos, dados e
   revisão não atravessam contexto. Usuário sem setor/fora do setor é recusado; parâmetros extras não ampliam acesso.
3. Seleção inicial vazia; uma/duas fontes e páginas distintas retornam apenas metadados escolhidos, no limite e sem
   duplicação indevida. Vazio, desatualização e cada falha parcial ficam identificados, preservando fontes válidas.
4. Remover/recriar vínculo, editar/excluir mensagem usada no contexto, transferir ticket/ator, alterar perfil/setor/flag durante consulta
   ou antes do aceite invalida o resultado. Provar concorrência com o lock real e rejeição do review sem evento.
5. Instruções maliciosas em mensagens não acionam rede, ferramenta, escrita ou envio. Referências e texto seguem
   apenas contexto permitido; erro e payload inválido não revelam dados/segredos em resposta, console ou telemetria.
6. Interface claro/escuro e desktop/celular cobre seleção, carregamento, sucesso/parcial/erro, cancelamento, edição,
   anexo explícito, preservação do rascunho e respostas atrasadas. Conteúdo não aceito permanece só em memória.
7. Testes usam fixtures rastreadas/isoladas. Snapshots de negócio, leitura, SLA, credenciais e rascunho permanecem
   iguais salvo a ação humana de anexar. Remover só fixtures; preservar instalação/demonstração P3 e segredos locais.

Evidências executadas ficam no PR, sem atribuir resultados P3 ao código novo. A versão de demonstração P4 pode usar
ambiente local separado com dados fictícios; publicar ou integrar fornecedores reais exige outro recorte autorizado.
