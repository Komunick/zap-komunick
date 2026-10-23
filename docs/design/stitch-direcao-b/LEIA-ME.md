# Direção B (Stitch) — exportações e tokens

Código das telas da **Direção B — Menu preto**, exportado em 23/10/2026 do projeto "Zap Komunick Interface Concepts" no
Google Stitch (Tailwind via CDN, só referência visual; o frontend é React + Material-UI e não usa este HTML).

| Arquivo | Tela |
| --- | --- |
| `atendimentos.html` | Atendimentos (Direção B) |
| `kanban.html` | Kanban |
| `painel-sla.html` | Painel de SLA |
| `contatos.html` | Contatos |
| `agendamentos.html` | Agendamentos (janela "Mensagem Pendente") |
| `usuarios.html` | Usuários (janela "Editar usuário") |
| `login.html` | Login em duas colunas |

Os textos de exemplo e as imagens das telas são fictícios; a logo vem de um endereço temporário do Stitch.

## Onde cada valor foi parar (`frontend/src/theme/komunick.js`)

| Valor da Direção B | Token (`theme.komunick.*`) |
| --- | --- |
| Menu lateral `#020605`, ícones `#A3A3A3`, ativo `#35B62E` com barra verde à esquerda | `sidebar`, `sidebarText`, `sidebarTextActive`, `sidebarHover`, `sidebarActive`, `accent` |
| Divisórias do menu `#1A221E` | `sidebarBorder` |
| Texto principal `#020605` | `text` (claro) |
| Balão do atendente `#EAF7EA` com borda `#CDECCB` | `bubbleMine`, `bubbleMineBorder` |
| Etiqueta `#EAEFEA` | `tagBackground` |
| Linha selecionada: contorno verde de 2 px | `selectedRow`, `accent` |
| Verde escuro de botão `#1F7F1B`, hover `#196916` | `BRAND_GREEN_DEEP`, `BRAND_GREEN_PRESSED` |

Raios (cartão 14, botão 10, etiqueta 8, janela 18) e fundo `#F3F5F4` já eram os do tema. O menu continua alternando entre
largo e só ícones; a Direção B mostra só ícones.
