# P1 — resumos e sugestões com revisão humana

## Objetivo e autorização

Pedido de 27/10/2026: implementar resumos e sugestões de resposta com revisão humana, usando mocks e dados fictícios;
atualizar documentação e abrir PR, sem merge. Base: `adfb0b0b7aa13ac1b7435d16bdbaf6c64fe14041`, PR #18 de P0.
O [plano da rodada 3](rodada-3-ia-integracoes.md) orienta a direção; este pedido autoriza somente o recorte abaixo.
O [P0](p0-credenciais-isolamento.md) fornece a autorização por empresa/cliente/setor e as regras de privacidade.

## Recorte

- Provedor simulado local e determinístico, sem chamada a modelo/fornecedor real, chave, faturamento ou dependência
  nova. O contrato prepara o percurso de revisão; não demonstra qualidade de um modelo de IA real.
- Recurso desligado por padrão. Exige `AI_ASSISTANT_MODE=mock` no backend e `aiAssistantEnabled=enabled` na empresa,
  alterado pelo administrador. Modo ausente/desconhecido não habilita chamada externa. A interface identifica simulação.
- Resumo e sugestão são solicitados por clique em atendimento autorizado. O contexto é somente texto elegível do
  **atendimento atual**, até 30 mensagens/12.000 caracteres; não inclui histórico de outros atendimentos, notas,
  anexos, áudio, reações, notas de transferência ou mensagens excluídas. Contexto limitado informa que é parcial.
- O backend monta o contexto; o cliente não fornece texto, empresa, contato, IDs de referência nem instruções ao
  provedor. A autorização vem da sessão e é conferida antes e após a geração. Mudança de acesso/configuração ou de
  uma mensagem usada não pode produzir resultado autorizado com dados antigos indevidos.
- Resumo extrativo apresenta relatos/citações, sem confirmar que um pagamento ou obrigação aconteceu. Sugestão usa
  texto neutro para pedir/conferir informações, sem inventar prazo, valor ou parecer contábil. Informação insuficiente
  é sinalizada. Mensagens são dados não confiáveis e não concedem ferramentas, permissões ou execução de instruções.
- Saída estruturada informa tipo, modo simulado, necessidade de revisão, referências válidas e limites/avisos do
  contexto. Saída malformada ou referência fora do contexto é recusada; nenhum SQL, URL ou segredo é solicitado ao modelo.
- A pessoa revisa a sugestão em campo editável e usa uma ação separada para anexar ao rascunho. Não há envio por essa
  ação. Texto existente é preservado; cancelar, erro, timeout, trocar atendimento ou receber resposta atrasada não
  apagam nem inserem conteúdo no editor errado. Edição/resposta/mídia/gravação não recebem inserção indevida.
  Editor/assistente só ficam disponíveis com ID válido e contexto da rota carregado; não criar rascunho sem dono nem
  deixar uma resposta antiga de carregamento substituir o atendimento selecionado.
- Resultados ficam apenas em memória durante o percurso. Depois do aceite, o texto passa a ser um rascunho normal do
  composer, com a persistência local herdada. Não gravar resumo/sugestão/prompt completo em mensagens, notas, jobs,
  auditoria ou logs. Auditoria guarda apenas identificadores, tipo, provedor e metadados de execução.

## Critérios observáveis

1. Sem modo/flag, não há geração; a configuração de uma empresa não habilita outra. Perfil e setor seguem o P0.
2. Duas empresas fictícias, dois clientes de uma mesma empresa, usuário sem setor e fora do setor comprovam que texto
   e referências não atravessam contexto. Pedidos com empresa/contato/contexto extras são recusados.
3. Referências apontam somente a mensagens elegíveis selecionadas; limites e ausência de informação são visíveis.
   Mensagem excluída/editada ou transferência no intervalo da geração não contorna a revalidação.
4. Instruções maliciosas recebidas em mensagens não ativam rede, ferramenta, escrita, envio ou outro cliente. Casos
   fictícios com dados ausentes/contraditórios não geram confirmação de fatos externos.
5. Gerar, cancelar e anexar ao editor não alteram leitura, SLA, estado, responsável ou mensagens do atendimento.
   A geração não lê chaves de IA nem dispara filas de envio ou chamadas ao WhatsApp/fornecedores.
6. Interface cobre carregamento, resultado, erro, cancelamento, edição, anexo explícito, troca de conversa e respostas
   atrasadas; funciona em temas claro/escuro e celular/desktop. Não persiste resultado não aceito no navegador.
7. Verificações de serviço, API e interface usam somente mocks/fixtures rastreados. Evidências de execução ficam no PR.

## Fora do recorte

Provedor real, escolha de modelo, custo/qualidade/latência de IA real, base de conhecimento ou procedimentos ainda não
aprovados, RAG/embeddings, documentos contábeis, resumos de todo o cliente, conectores Acessórias/SCI, automação de envio,
etiquetas e alterações externas. Contratos e política de dados continuam necessários antes de ampliar o piloto.

Sem merge, publicação, produção ou reconexão do WhatsApp pessoal. Não criar pré-requisito de chave/faturamento para
executar esta simulação. Aprovar esse percurso não aprova um modelo real nem o envio de dados a terceiros.
