# P2 — consultas Acessórias com vínculo explícito (simulação)

## Objetivo e autorização

Pedido de 27/10/2026: implementar o painel de consultas de clientes e pendências do Acessórias, usando mocks e dados
fictícios; atualizar a documentação e abrir PR, sem merge. Base: `b3445ab7ff88a620774effab251c15b8fd439fd9`, PR #19.
O [plano da rodada 3](rodada-3-ia-integracoes.md) orienta a direção. Este recorte não conecta o fornecedor real;
[P0](p0-credenciais-isolamento.md) fornece as regras de isolamento, e P1 permanece independente.

## Comportamento

- Provedor mock local, com catálogo e pendências inteiramente fictícios. Não usa token, rede, SDK, MCP, IA, fila ou
  escrita em fornecedor. Os campos são um contrato interno de simulação, sem afirmar compatibilidade com a API real.
- Desligado por padrão: exige `ACESSORIAS_MODE=mock` no backend e `acessoriasEnabled=enabled` na empresa, controlado
  por administrador. Valor desconhecido não ativa integração externa. A interface identifica **Simulação**.
- O painel abre a partir de atendimento autorizado e válido, em desktop/celular, sem alterar rascunho/leitura/SLA.
  Lista somente clientes externos explicitamente vinculados ao contato daquele atendimento. Sem vínculo, não tenta
  adivinhar cliente por telefone, nome, CNPJ em mensagem ou parâmetro de empresa fornecido pelo navegador.
- Administrador da empresa consulta o catálogo mock e confirma criar/remover **vínculo local**. Atendente não gerencia
  vínculos nem recebe catálogo irrestrito. Um contato pode representar mais de um cliente externo; selecionar o cliente
  é uma ação explícita. Cadastro/pendências de outro contato ou empresa não são liberados por conhecer o ID externo.
- Vínculos são persistidos por empresa/contato/provedor/ID externo, com unicidade do mesmo vínculo. Criar repetido não
  duplica; remover repetido é seguro. Remoção local administrativa continua possível com a consulta desativada, sem
  consultar fornecedor. Não confundir exclusão do vínculo com exclusão do cliente ou de pendências externas.
- A consulta mostra cadastro fictício, identificador/documento rotulado como fictício, pendências, competência e
  prazo não confirmado, com paginação de cinco itens. Informa origem, horário da consulta, atualização da fonte e
  condição desatualizada. Não apresenta uma simulação como confirmação fiscal, pagamento ou obrigação cumprida.
- Falha, indisponibilidade, vazio e desatualização têm estados distintos. Erro não deixa dados antigos parecerem uma
  consulta atual. Cancelamento, troca de ticket/cliente ou revogação do vínculo impedem inserir resposta atrasada no
  contexto errado. Dados consultados ficam apenas na memória do painel, sem cache compartilhado ou exportação.
  Evento na própria empresa transmite apenas o identificador do contato para invalidar o painel correspondente;
  sem entrega do evento, o snapshot já recebido não tem revogação visual instantânea e toda nova consulta revalida acesso.
- Backend verifica sessão, compliance, empresa/cliente/setor e vínculo antes e depois de consulta assíncrona. Uma
  remoção/recriação do mesmo vínculo durante a consulta não reaproveita a autorização antiga. O navegador fornece
  somente seleção/página ou ID externo para vínculo, sem escolher empresa/contato/provedor.
- Auditoria registra somente ação e identificadores/metadados, sem cadastro, documento ou lista de pendências.
  Corpos indevidos/JSON inválido e falhas de provedor não expõem esses dados em logs, telemetria ou mensagens de erro.

## Critérios observáveis

1. Modos desligado e desconhecido recusam consultas; flag de A não habilita B. Operações seguem a autorização do P0
   e o compliance existente. Somente administração atual da própria empresa altera vínculos.
2. Duas empresas com IDs externos iguais e clientes locais distintos comprovam isolamento de catálogo, vínculos,
   cadastro e pendências. Atendente sem setor/fora do setor e cliente não vinculado não recebem conteúdo.
3. Um contato com múltiplos vínculos exige seleção e mostra somente o cliente escolhido; remoção/duplicação e
   tentativa de fornecer empresa/contato extras são tratadas sem ampliar o acesso.
4. Pendências paginam sem duplicação/lacuna; página inválida é recusada; vazio e origem/horários/desatualização são
   visíveis. Mocks exercitam erro funcional em HTTP 200, credencial recusada, limite, timeout e saída malformada,
   sem criar requisito ou promessa de comportamento do serviço real.
5. Troca/cancelamento/resposta tardia, mudança de acesso/flag e vínculo revogado/recriado não revelam dados indevidos.
   Rascunho, leitura, SLA, responsável, notas, mensagens e IA permanecem iguais; nenhuma tentativa de envio/fornecedor.
6. Interface cobre consulta, seleção, vínculo administrativo confirmado, paginação, vazio, erro e desatualização em
   claro/escuro e desktop/celular. Resultados não ficam em localStorage/sessionStorage, logs ou auditoria.
7. Testes usam exclusivamente fixtures rastreadas e mocks. As evidências executadas ficam no PR, com limpeza dos dados
   e restauração do modo desligado no dev.

## Limites

Não integra API Acessórias real, não cadastra credenciais reais nem aprova plano/licença/sandbox. Não implementa
sincronização, webhook, documentos/downloads, escrita externa, automações, SCI ou consulta pela IA. Vincular localmente
um cliente é requisito de autorização da consulta, não uma operação no sistema contábil. O catálogo de falhas é uma
ferramenta de simulação; não comprova resiliência contra serviço externo em produção.

Configuração/recuperação ficam no TAD e DEPLOY; manter a tabela de vínculos ao recuar preserva o mapeamento. Nenhuma
publicação, produção, merge ou reconexão do WhatsApp pessoal faz parte desta entrega.
