# Layouts próprios (Stitch) — 26/10/2026

Três direções de layout geradas no projeto "Komunick Workspace Atendimentos" do Google Stitch, com dados fictícios.
O HTML é só referência visual (Tailwind por CDN); o frontend é React + Material-UI.

| Arquivo | Direção | Situação |
| --- | --- | --- |
| `layout1-workspace` | Trilho de ícones, painel de visões, lista, conversa e painel do cliente, escuro | **Implementado** como layout "Workspace" (casca: trilho, barra do topo plana, busca Ctrl K) |
| `layout2-foco` | Sem barra lateral, navegação em abas no topo, claro | **Implementado** como layout "Foco" |
| `layout3-painel` | Barra lateral compacta, 3 colunas e gaveta do cliente, claro e quente | Não implementado |

## O que entrou no app

- Escolha do layout no menu do usuário ("Layout: Workspace" / "Layout: Foco"), salva no navegador (`layoutMode`).
- Barra do topo plana nos dois, com busca global (`Ctrl K`: páginas e atendimentos), interruptor "Modo escuro" e o usuário.
- Workspace: trilho de ícones (com dica ao passar o mouse; abre em menu largo pelo botão dentro da barra lateral).
- Foco: logo e abas de navegação no topo, com as páginas de administração no menu "Mais".
- Conteúdo sem cartões flutuantes nem margens; no celular os dois usam a gaveta com o botão de hambúrguer.

## Ainda não feito (do desenho)

Painel do cliente fixo à direita da conversa (carteira, SLA e etiquetas), visões "Meus / Aguardando / Pausados / Resolvidos"
na lista e a lista com o cartão mais enxuto. Hoje a tela de Atendimentos mantém a lista e o painel de contato do Ticketz.
