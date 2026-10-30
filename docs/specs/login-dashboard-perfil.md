# Login sem consultas administrativas para usuários comuns

## Objetivo e mudança aprovada

Corrigir os erros 403 de `/dashboard/tickets`, `/dashboard/users` e `/dashboard/status` disparados durante o login
de usuários comuns. O destino e a montagem da página devem respeitar o perfil da sessão, sem abrir transitoriamente
o dashboard administrativo. Escopo aprovado explicitamente pelo usuário em 30/10/2026, após texto de issue no chat.

## Escopo e comportamentos preservados

- Usuário comum entra em `/tickets`; administrador com interface administrativa disponível continua entrando em `/`.
  Preservar o destino já previsto para `hideAdminUI` e a conclusão do login com 2FA.
- Aguardar a resolução da sessão antes de montar conteúdo que dependa do perfil. Reabrir `/login`, restaurar sessão
  e abrir `/` diretamente não devem provocar consultas administrativas de um usuário comum.
- O dashboard continua funcional para administradores. A interface não substitui a autorização do servidor:
  as três APIs continuam exigindo autenticação e perfil administrativo, com 403 para usuário comum autenticado.
- Corrigir somente o fluxo de navegação/carregamento necessário. Não ampliar permissões, alterar políticas de
  autenticação, implementar outro dashboard ou operar integrações, produção, ARM07/DNS ou WhatsApp.
- Usar dados fictícios, atualizar documentação e versão local e abrir PR sem merge. Preservar dados/login/chave
  e entregas anteriores, incluindo a proteção de anexos privados do chat.

## Critérios de aceite

- Login de usuário comum chega a uma tela permitida sem montar o dashboard nem solicitar suas APIs administrativas;
  nenhum 403 dessas consultas deve precisar ser ignorado na validação final.
- Administrador continua vendo o dashboard e recebendo respostas autorizadas das três APIs.
- Chamada direta de usuário comum autenticado às APIs continua recebendo 403, sem dados administrativos.
- Sessão em restauração não renderiza conteúdo protegido prematuramente; navegação direta e sessão já autenticada
  obedecem ao mesmo destino permitido. Fluxo com 2FA mantém o desafio antes de concluir a autenticação.
- Regressão reproduz o defeito na base `8f58724dda1abb8d4dffeb318641a633fa3a9b2d` e passa após a correção.
- Login e destino final validados com dados fictícios nos temas claro/escuro, desktop/celular, sem erros inesperados
  de HTTP/JavaScript. Documentação e versão local atualizadas; PR pronto para revisão, sem merge.

## Referências

- [PRD, RF-009](../PRD.md#rf-009--identidade-visual-da-komunick) e [princípios de testes](../PRINCIPLES.md#2-testes-de-comportamento-junto-com-o-código).
- Na base, `Route` redireciona qualquer sessão autenticada de uma rota pública para `/`, enquanto `useAuth` direciona
  usuário comum a `/tickets`. As rotas backend do dashboard exigem `isAdmin`; esse bloqueio é correto e deve permanecer.
