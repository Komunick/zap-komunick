# Usabilidade do chat interno

## Objetivo e referência

Melhorar a comunicação da equipe na lista de conversas, leitura e envio de mensagens, nos temas claro e escuro e
no celular. Recorte autorizado no chat em 30/10/2026, após a issue com Título/Objetivo/Escopo/Critérios de aceite.
Referência de produto: PRD RF-010; código examinado na revisão `0befd736ca1ccd68d4057050a6e4f0e7384bd067`.

## Mudança

- Busca por conversas e pessoas com ação de limpar, seleção e não lidas identificáveis. Distinguir carregamento,
  falha recuperável e lista vazia/sem resultados, preservando os critérios atuais de busca e ordenação.
- Mensagens e anexos contidos na largura disponível, com remetente, horário, quebras de linha e texto longo legíveis.
- Campo de mensagem identificado: Enter envia, Shift+Enter insere linha e composição de texto não envia antes de
  terminar. Envio pendente impede duplicação; falha mantém o texto ou anexo para correção e nova tentativa.
- Carregamento e falha do histórico têm feedback próprio e opção de repetir. Trocar de conversa durante uma busca
  de mensagens não pode inserir o resultado anterior na conversa atual; socket e HTTP não duplicam a mesma mensagem.
- No celular, lista e conversa continuam alternadas pelo botão de voltar. Preservar conversas diretas, grupos,
  participantes e ações já existentes do dono, paginação de histórico, anexos/galeria e gravação de áudio.

## Critérios de aceite

- Usuários fictícios conseguem abrir uma conversa direta e um grupo, enviar e ler mensagens; ordenação e não lidas
  continuam atualizadas no percurso real com dois atores.
- A busca filtra e pode ser limpa; carregamento, vazio e erro recuperável são distinguíveis.
- Texto não é perdido numa falha de envio, Shift+Enter não envia e o envio pendente não cria mensagens repetidas.
- Resposta atrasada de outra conversa é ignorada; histórico pode ser repetido após erro sem duplicar mensagens.
- Temas claro/escuro e largura de celular têm leitura e controles utilizáveis, sem transbordamento causado pelas
  mensagens ou pelo campo de envio. Validar também teclado e anexos afetados.
- Documentação e versão local correspondem ao código do PR; manter os dados locais existentes e abrir PR sem merge.

## Limites

Sem fornecedor externo, WhatsApp, alteração produtiva, migrations, dependências novas ou mudança de contrato/API.
Não inclui busca no conteúdo completo do histórico, novas permissões, edição/exclusão de mensagens ou persistência
de rascunho entre conversas. A revisão encontrou controles de autorização legados incompletos no backend do chat;
a melhoria de interface não os corrige nem comprova isolamento. Sua correção exige recorte separado antes de uso real.
