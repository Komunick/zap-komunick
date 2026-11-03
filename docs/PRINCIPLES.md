# Principles — Komunick

Critérios de qualidade da implementação e dos testes. Autorizações, revisão, integração e publicação ficam no `DELIVERY-WORKFLOW.md`. A adoção e as alterações destes princípios exigem revisão humana.

## 1. Simplicidade primeiro — KISS, YAGNI e DRY

Resolva a necessidade atual com a menor solução suficiente, sem sacrificar correção, segurança ou integridade. Reaproveite recursos e convenções existentes; não crie camadas ou otimizações para possibilidades futuras.

Justifique brevemente novas dependências e abstrações estruturais no plano: necessidade atual, alternativa existente e motivo da escolha. Extrações locais de funções dentro dos padrões aprovados não exigem justificativa formal.

Centralize regras com o mesmo significado e motivo de mudança. Não una conceitos diferentes apenas pela semelhança do código nem remova validações complementares para reduzir repetição.

## 2. Testes de comportamento junto com o código

Toda regra de negócio implementada ou alterada deve ter teste automatizado na mesma entrega; reaproveite testes existentes quando já comprovarem o comportamento. Defina o resultado esperado a partir dos requisitos e fontes aprovados antes de implementar a parte correspondente, indicando no plano curto como observá-lo. Ler o código para conhecer interfaces e convenções é permitido; seu comportamento não é a única definição do resultado correto. Não é obrigatório escrever todos os testes antes de todo o código.

Correções de comportamento incluem um teste de regressão. Execute-o sem a correção e confirme que falha pelo defeito esperado, não por erro de ambiente; depois confirme que passa com a correção. Confira também os comportamentos aprovados que devem permanecer válidos, com exemplos pertinentes da definição da mudança; não preserve o defeito como requisito. Registre as execuções no PR. O que não pôde ser executado é uma limitação, não evidência de sucesso.

Verifique resposta, estado dos dados e efeitos permitidos ou proibidos na camada que sustenta o critério: função, integração ou percurso de interface, conforme necessário. Confira a preparação dos dados, a identidade autenticada e a ação exercitada quando pertinentes. Uma chamada simulada ou uma falha de autenticação não comprova, por si só, uma regra de persistência ou autorização. Use simulações para isolar dependências, sem substituir a propriedade demonstrada. Pergunte: “Este teste passaria mesmo com o comportamento errado?”.

**Muitas combinações de dados:** avalie testes parametrizados (uma tabela de casos) ou baseados em propriedades (uma regra verificada com entradas variadas). Prefira a opção mais simples que demonstre o comportamento necessário. O resultado esperado vem da regra aprovada e de uma referência independente, não da própria função de produção testada. Não há biblioteca nova obrigatória nem exigência para toda tarefa; casos gerados não provam todas as entradas possíveis.

**Configuração e inicialização:** quando a mudança depender do registro de rotas, permissões, componentes ou processamento assíncrono, confira o caminho real que monta e inicia a aplicação, em ambiente seguro e sem operar produção. Uma montagem exclusiva dos testes não comprova a configuração usada pela aplicação. Reutilize a montagem pertinente entre aplicação e testes quando adequado, sem refatoração ampla ou teste de ponta a ponta obrigatório para toda mudança.

Em correções somente de conteúdo ou apresentação visual, sem alteração funcional, uma verificação manual pode substituir um novo teste quando a automação não for adequada. Registre motivo, procedimento e resultado no PR. Isso não dispensa testes de cálculos, permissões, segurança, integridade ou comportamento, nem autoriza desativar verificações obrigatórias.

Preserve regressões válidas, mesmo quando não repetidas na tarefa. Não enfraqueça testes nem ajuste critérios para acomodar defeitos; uma regra realmente incorreta precisa de confirmação do responsável. Durante a implementação, rode os testes afetados; a CI aplica as verificações obrigatórias à revisão atual. Um comando com saída de sucesso não basta: confirme que o caso citado existe, foi selecionado, executou e demonstrou o resultado na revisão avaliada. Caso ignorado, seleção vazia ou execução de outra revisão não é evidência de atendimento. Uma execução de suíte pode comprovar vários critérios; não são exigidos um comando ou relatório por critério. Declare limitações de cobertura e, para conjuntos aprovados no escopo, confira os membros previstos sem inventar combinações fora dele.

Em pontos críticos, falhas controladas ou testes de mutação podem avaliar a capacidade dos testes de detectar erros. Use somente cópia descartável e isolada, sem dados, credenciais ou conexões produtivas e sem efeitos em terceiros. Nunca leve a falha ao PR nem altere trabalho compartilhado. São opcionais e não provam ausência de outros defeitos.

## 3. Código e interação compreensíveis

Use nomes claros, responsabilidades definidas e convenções do projeto. Aplique formatação e lint pertinentes. Não introduza código morto; remova o que a alteração tornar sem uso. Comente motivos e restrições, não o óbvio.

Nas interfaces, confira o percurso afetado, não só o diff: carregamento, sucesso, erro e os cuidados pertinentes de teclado, foco e identificação dos campos. Um protótipo só é necessário quando ajudar a resolver uma dúvida de interação; verificações básicas não comprovam conformidade completa de acessibilidade.

## 4. Documentação sem duplicação

Atualize apenas a fonte cujo conteúdo mudou. Comandos e particularidades ficam no `AGENTS.md`; comportamento do produto no PRD; recorte e critérios da mudança em `docs/specs/` quando necessário (ou no registro suficiente indicado); desenho e estratégia de testes no TAD; critérios de engenharia aqui; execução e entrega no workflow.

A especificação da mudança referencia regras compartilhadas e explicita o que muda, sem reproduzir o PRD ou criar outro TAD. Mantenha coerência entre as fontes; contradições exigem esclarecimento. Depois da entrega, preserve-a como registro histórico, não como outra descrição do produto a manter indefinidamente.

No mesmo PR da alteração, atualize instruções afetadas de configuração, uso ou manutenção, sem valores secretos. A relação entre critérios, testes e resultados fica no PR. O Linear mantém o link e o status. Notas relevantes para usuários, integrações ou operação seguem a regra do CHANGELOG no workflow.

## 5. Segurança e dados

Não inclua segredos no código, arquivos versionados, exemplos, testes ou logs. Valide entradas nas bordas de confiança: APIs, arquivos, mensagens e respostas de integrações. Verifique permissões na camada responsável pela operação, não apenas na interface.

No tratamento de dados pessoais, observe a LGPD: limite coleta e uso ao necessário e aplique acesso e regras confirmadas de retenção, exclusão e compartilhamento. Não invente permissões ou prazos para suprir decisões pendentes.

## 6. Mudanças pequenas e recuperação segura

Divida funcionalidades em entregas pequenas, coesas e verificáveis. Evite refatorações alheias à tarefa e preserve comportamento aprovado ao refatorar. Avalie compatibilidade ao alterar dados, interfaces ou contratos.

Mudanças de dados precisam de recuperação segura e testada: retorno compatível ou correção adiante, preservando os dados. Não exija um procedimento de desfazer que cause perda. Sem alternativa segura, registre o impedimento e obtenha decisão humana antes da operação. Um rollback de aplicação não desfaz automaticamente mudanças de dados.

Decisões de negócio e arquitetura ainda não autorizadas seguem o workflow; escolhas locais dentro das restrições aprovadas continuam permitidas.

## 7. Observabilidade

Registre erros com contexto útil: momento, operação ou componente, motivo e identificador de correlação quando pertinente. Preserve detalhes diagnósticos sem expor segredos ou dados pessoais desnecessários.

Garanta que os responsáveis possam consultar os sinais de falha. Não silencie erros nem os apresente como sucesso.
