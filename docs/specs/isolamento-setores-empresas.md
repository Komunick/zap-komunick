# Isolamento da consulta de setores por empresa

O usuário aprovou corrigir a autorização de `GET /queue`, validar com duas empresas fictícias, atualizar a versão local e abrir PR, sem merge ou deploy e mantendo o WhatsApp desconectado.

## Mudança

A consulta aceita hoje um `companyId` arbitrário, substituindo a empresa autenticada. Um atendente da empresa Alfa consegue listar os setores da empresa Beta. A listagem deve conferir o usuário, o vínculo empresarial e os privilégios atuais no banco antes de consultar setores.

Sem parâmetro, usuários e administradores continuam recebendo os setores da própria empresa, sem mudar a abrangência dessa lista. O parâmetro explícito da própria empresa também permanece válido. Consultar outra empresa exige o privilégio de superusuário atual, compatível com a identidade autenticada. Isso preserva o fluxo Empresas → Usuários → seleção de setores da empresa editada.

`companyId` deve ser uma única string com inteiro positivo em formato decimal canônico, dentro da faixa segura de inteiros do JavaScript. Valores vazios, repetidos, compostos, fracionários, negativos ou não numéricos recebem HTTP 400 (`ERR_BAD_REQUEST`). Acesso a outra empresa sem privilégio, ator inexistente ou vínculo/perfil/privilégio divergente da sessão recebem HTTP 403 (`ERR_NO_PERMISSION`), sem executar a listagem. Uma sessão cujo contexto mudou precisa ser renovada.

## Critérios de aceite

- Usuários e administradores comuns não conseguem obter os setores de outra empresa alterando a query, o corpo ou cabeçalhos da requisição.
- Empresa própria, seleção explícita da empresa própria e consulta de outra empresa por superusuário confirmado continuam funcionando.
- Ator removido, transferido ou com privilégio revogado é recusado, inclusive com token ainda válido.
- Testes de regressão exercitam rota, middleware de autenticação, controlador e filtro real do serviço; a versão anterior deve falhar nos cenários pertinentes.
- Validar pela API da instância isolada com dados fictícios, conferir os seletores de setores e preservar a interface local já atualizada no PR #33.
- Atualizar documentação e CI do candidato; abrir PR sem merge ou deploy. Não iniciar Docker, WSL, bootstrap normal ou sessões de WhatsApp.

O recorte é a listagem `GET /queue`. Outros fluxos de autorização observados durante a análise ficam registrados para definição separada, sem alterar suas permissões neste PR. Não há migração ou alteração de dados reais.

Referências: [PRD RF-019](../PRD.md), [TAD](../TAD.md) e [workflow de entrega](../DELIVERY-WORKFLOW.md).
