# Changelog

Mudanças relevantes para quem usa, integra ou opera o projeto.

## Não publicado

### Adicionado

- Painel de SLA (menu Gerência, só administradores): atendimentos em aberto, aguardando, em atendimento, estourados,
  abertos há mais de N horas, clientes e grupos sem resposta, por fila e por atendente ("Sem dono" incluído). Selo
  "SLA" na lista de atendimentos para quem passou do prazo. Prazo e limite de horas em Configurações › SLA e carteira
  de clientes; o prazo começa desligado.
- Carteira de clientes: responsável por contato (definido por administradores), coluna "Carteira" e filtro "Minha
  carteira" em Contatos. Com "Enviar direto para o responsável" ligado em Configurações, o atendimento novo ou
  reaberto do contato vai para o responsável sem passar pelo chatbot.
- Kanban: tela com a coluna "Em aberto" e uma coluna por etiqueta marcada como Kanban (chave nova na edição da
  etiqueta); arrastar ou "Mover para" troca a etiqueta de Kanban do atendimento.
- Horário de acesso por usuário: dias e faixa de horário no cadastro; fora dele o login e a renovação de sessão são
  recusados. Administradores não são bloqueados.
- Agendamento recorrente: repetir todo dia, semana, mês ou ano, com data final opcional; o próximo envio é criado
  depois de cada envio.
- `docker-compose-dev-app.yaml`: ambiente de desenvolvimento completo em contêineres (portas 5420 e 5421).

### Alterado

- A tela "Sobre" aponta o código-fonte para github.com/Komunick/zap-komunick (AGPL) e credita o Ticketz.

### Operação

- Quatro migrações novas (`20261021120000` a `20261021120300`) rodam na subida do backend; nenhuma remove dados.
