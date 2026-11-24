# Alerta de chamados de suporte no Windows

Programa pequeno para o computador de quem atende os chamados de suporte do SuperChat (RF-030). Ele fica rodando
escondido, pergunta ao SuperChat a cada 30 segundos o que está esperando na fila e, quando chega um chamado novo ou uma
mensagem nova de um solicitante, mostra um aviso do Windows e apita. Clicar no aviso abre a aba **Suporte**.

Funciona com o navegador fechado. Não precisa de administrador nem instala nada fora da conta do usuário.

## O que ele usa

- **Chave do alerta.** Não é login e não é senha. Ela abre uma rota só: `GET /backend/support/alerts`, que devolve
  quantos chamados esperam o suporte e, de cada um, número, título, empresa, solicitante, prioridade e horário. Não dá
  para ler a conversa, responder nem ver anexos com ela.
- O servidor guarda só o SHA-256 da chave. No computador ela fica cifrada pelo Windows para a conta do usuário
  (DPAPI): copiar o arquivo para outra conta ou outra máquina não serve.

## Instalar

1. Um superadministrador gera a chave, com a sessão dele: `POST /backend/support/alert-token`. A resposta mostra a
   chave uma única vez (`sca_` e mais 43 caracteres). Gerar outra invalida a anterior.
2. No computador de quem atende, pelo PowerShell, nesta pasta:

   ```powershell
   .\instalar.ps1 -Chave sca_...
   ```

   Sem `-Chave`, o instalador pede a chave na tela.

O instalador copia o programa para `%LOCALAPPDATA%\Komunick\SuperChatAlerta`, guarda a chave cifrada, cria o atalho
"SuperChat - Alerta de chamados" na pasta Inicializar do usuário (é o que faz o alerta começar junto com o Windows) e
já deixa o alerta rodando.

Para conferir o aviso e o apito:

```powershell
powershell -File "$env:LOCALAPPDATA\Komunick\SuperChatAlerta\alerta-suporte.ps1" -Teste
```

## Ajustes

| Opção do `instalar.ps1` | Padrão | Para que serve |
|---|---|---|
| `-Url` | `https://superchat.komunick.com` | Endereço do SuperChat. |
| `-Intervalo` | `30` | Segundos entre as consultas (mínimo 10). |
| `-RelembrarMinutos` | `0` | Repete o aviso a cada tantos minutos enquanto houver chamado esperando. `0` avisa só a novidade. |
| `-SemIniciar` | | Instala sem deixar rodando; o alerta começa no próximo logon. |
| `-Remover` | | Para o alerta e apaga programa, chave, atalho e o nome registrado para o aviso. |

Rodar o instalador de novo troca a chave ou os ajustes.

## Como ele decide avisar

- Avisa uma vez por novidade: chamado novo, ou mensagem nova do solicitante num chamado que o suporte já tinha lido.
- Um chamado deixa de contar quando alguém do suporte o abre no SuperChat.
- Várias novidades na mesma consulta viram um aviso só, com a lista.
- O apito toca mesmo com as notificações do Windows desligadas. O aviso na tela respeita o "Não perturbe".
- Sem internet, ele só anota no log e continua tentando. Se o servidor recusar a chave, avisa uma vez.

O log fica em `%LOCALAPPDATA%\Komunick\SuperChatAlerta\alerta.log`.

## Desligar o acesso

Pelo servidor, um superadministrador apaga a chave com `DELETE /backend/support/alert-token`; o programa passa a
receber recusa e avisa. No computador, `.\instalar.ps1 -Remover`.
