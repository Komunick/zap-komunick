# P0 — credenciais e isolamento do contexto

## Objetivo e recorte autorizado

Pedido de 27/10/2026: implementar o P0 do [plano da rodada 3](rodada-3-ia-integracoes.md), proteger credenciais e
validar o isolamento por empresa/cliente com dados fictícios, atualizar a documentação e abrir PR, sem merge.
Base examinada: `0fcca49517418fe12fe67b43977eb182457cc4f9`, sobre o PR de segurança #17 (`6682e92`).

O defeito de credenciais está no uso de `Settings.value` e sua inclusão em respostas de autenticação/configuração.
O defeito de contexto está em leituras de notas sem autorização completa e em consultas nas quais uma lista vazia
de setores elimina a restrição. O vínculo entre atendimento e cliente precisa ser conferido antes da leitura/escrita.

## Comportamento a entregar

- Guardar as credenciais de IA/Acessórias/SCI por empresa em armazenamento cifrado restrito ao backend. Chave mestra
  fora do banco, recebida pela configuração do servidor, sem derivação de senha/JWT. Nenhum valor secreto ou envelope
  cifrado deve acompanhar login, refresh, configurações, eventos, jobs ou auditoria.
- Administração por sessão autenticada da própria empresa: consultar somente estado, cadastrar/substituir, remover e
  migrar credenciais herdadas. O ID da empresa vem da sessão, sem sobrescrita por body/query. Sem chave mestra válida,
  recusar gravação/migração; não apagar silenciosamente uma configuração herdada ou um valor indecifrável.
- A configuração de IA mostra estado e campo de substituição vazio/oculto. Salvar é explícito; desfocar não escreve.
  Remover exige confirmação e informa que revogação no fornecedor é uma ação distinta. Preservar a transcrição
  opcional herdada e o registro normal de áudio quando houver falha de credencial/fornecedor.
- Antes de acessar notas, atendimento por ID/UUID e histórico, conferir empresa, atendimento e cliente. Administrador
  fica limitado à própria empresa; atendente precisa do setor permitido. Sem setores não significa acesso geral.
  Notas de outro cliente ou com vínculo incoerente são recusadas; edição não transfere vínculo/autor por dados enviados.
- A autorização também vale nos eventos em tempo real: ser o atendente atribuído ou manter uma sala antiga não concede
  acesso sem setor. Transferência e mudança de permissões retiram assinaturas indevidas; emissores revalidam os
  destinatários antes de enviar contexto. Mutações HTTP não podem contornar a restrição de leitura pelo retorno.
- Preservar a agenda de contatos geral da empresa (RF-018), a privacidade do histórico (RF-017) e as mensagens do
  atendimento atual para o setor que o recebe. Consultar contexto sem solicitar marcação de leitura não modifica
  leitura, SLA, atendimento ou envia mensagem.

## Critérios observáveis

- Duas empresas fictícias reais no banco de desenvolvimento, com clientes, setores, usuários, mensagens e notas
  distintos. IDs/UUIDs, pares atendimento/cliente, cursores e referências de mensagens não atravessam a autorização.
- Administrador de A não lê nem altera contexto/credencial de B; atendente fora do setor ou sem setor não obtém o
  contexto restrito. Atendente do setor correto e administrador da própria empresa mantêm os caminhos permitidos.
- Um valor fictício identificável não aparece nas respostas de autenticação/configuração, logs, auditoria ou jobs;
  no armazenamento protegido, não permanece legível. Trocar empresa/chave/envelope invalida a decifragem.
- Substituição, remoção e migração mantêm isolamento; erro, chave mestra ausente/incorreta e conflito não destroem
  valores existentes. Configuração herdada pendente não é exposta ao navegador nem duplicada após a migração.
- Valores legados duplicados e divergentes são um conflito, sem escolha arbitrária ou descarte. JSON inválido e erro
  de persistência não incluem corpo, parâmetros ou SQL secreto no log/telemetria.
- A interface cobre carregamento, sucesso, falha, migração e remoção confirmada; não preenche o campo com chave salva,
  não grava ao desfocar e não persiste o valor digitado em armazenamento do navegador.
- As regressões reproduzem o defeito anterior e passam com a correção; os resultados executados ficam no PR.

## Limites e pendências

Não implementar IA assistida, conectores, vinculação a cadastros externos, chamadas a fornecedores, envio automático,
publicação ou operação produtiva. O catálogo inicial de credenciais prepara armazenamento, sem habilitar integração.
Produto/módulos SCI, contrato Acessórias, orçamento, conteúdo e dados permitidos do piloto continuam pendentes.

Esta entrega cifra as quatro credenciais previstas no plano. Tokens de APIs locais, pagamentos, certificados e
WhatsApp seguem seus módulos existentes; a defesa do payload geral remove segredos conhecidos de `Company.settings`,
sem afirmar que todo armazenamento herdado passou a ser um cofre. Downloads privados de documentos contábeis precisam
ser implementados antes de incluir documentos no contexto de IA; esse fluxo ainda não existe no piloto.

Operação, migração e recuperação ficam no TAD e no guia de configuração; os critérios gerais de engenharia seguem
`PRINCIPLES.md` e `DELIVERY-WORKFLOW.md`. Nenhum teste depende de chaves reais ou de uma conexão WhatsApp.
