# Atualizações do Ticketz

O Zap Komunick é um fork do [Ticketz](https://github.com/ticketz-oss/ticketz). O workflow **Sincronizar com o
Ticketz** (`.github/workflows/sincronizar-ticketz.yml`) traz as atualizações do Ticketz para cá sem ninguém precisar
lembrar de olhar.

## O que ele faz

Todo dia às 06:17 (horário de Brasília), e quando alguém roda à mão em Actions › Sincronizar com o Ticketz › Run
workflow:

1. Busca o `main` do Ticketz e compara com o `dev` daqui. Se o `dev` já tem tudo, para por aí.
2. Atualiza a branch `ticketz-upstream`, que acompanha o `main` do Ticketz.
3. Abre o PR `ticketz-upstream` → `dev`, ou atualiza o que já estiver aberto. O PR informa:
   - quantos commits novos chegaram e até qual versão;
   - se há conflito com o `dev` e em quais arquivos;
   - as migrações novas e se as dependências mudaram;
   - a lista de commits.

O workflow nunca mexe no `dev` nem no `main`. Integrar continua sendo decisão de quem revisa o PR, como em qualquer
mudança (Komunick Patterns).

A lógica fica em `.github/scripts/sincronizar-ticketz.sh`, que também roda fora do GitHub (ver "Rodar à mão").

## Configuração única

O workflow só passa a rodar depois que este arquivo chegar ao `main`, a branch padrão do repositório: o GitHub só
agenda workflows que estão nela.

Para o workflow conseguir abrir o PR, escolha uma das opções:

- **Mais simples:** em Settings › Actions › General › Workflow permissions, marcar "Allow GitHub Actions to create and
  approve pull requests". Hoje está desmarcado.
- **Mais completo:** criar um token de acesso pessoal *fine-grained* só para este repositório, com Contents, Pull
  requests e Workflows em "Read and write", e guardá-lo como o segredo `SINCRONIZAR_TICKETZ_TOKEN` (Settings › Secrets
  and variables › Actions). Com ele:
  - o PR roda as checagens do repositório (PRs abertos pelo token padrão do Actions não disparam outros workflows);
  - a sincronização também funciona quando o Ticketz muda arquivos de `.github/workflows`, coisa que o token padrão
    não pode enviar.

Sem nenhuma das duas, o workflow atualiza a branch `ticketz-upstream` e termina com erro, deixando no resumo do run o
link para abrir o PR à mão.

O GitHub desliga workflows agendados de repositórios públicos depois de 60 dias sem nenhuma atividade no repositório.
Se isso acontecer, ele avisa por e-mail; basta reativar em Actions.

## Como integrar o PR

- Use **Create a merge commit**. Nunca squash nem rebase: o merge commit guarda a ligação com o histórico do Ticketz,
  e a próxima sincronização traz só o que for novo. Com squash, o Git perde essa ligação e os mesmos conflitos voltam
  a cada atualização.
- Antes de integrar:
  - suba o ambiente de desenvolvimento (`docker-compose-dev-app.yaml`) para as migrações novas rodarem;
  - rode os testes do backend;
  - abra as telas que os commits tocaram.
- Depois do merge, o PR seguinte só aparece quando o Ticketz tiver commits novos.

## Quando há conflito

O PR mostra os arquivos em conflito. Para resolver:

```bash
git fetch origin
git switch ticketz-upstream
git merge origin/dev
# resolva os arquivos, mantendo as mudanças do Zap Komunick (trechos com o comentário "Zap Komunick",
# translate/languages/komunick.js, theme/komunick.js e os helpers próprios)
git commit
git push origin ticketz-upstream
```

O workflow preserva os commits feitos na branch: na próxima rodada, ele junta o Ticketz novo por cima da resolução.
Quando a resolução já está no `dev` (PR integrado), a branch recomeça do `main` do Ticketz.

## Rodar à mão

De um clone do repositório, com o `gh` logado numa conta com acesso de escrita:

```bash
DRY_RUN=1 bash .github/scripts/sincronizar-ticketz.sh
```

`DRY_RUN=1` só mostra o que seria feito e o texto do PR. Sem ele, o script envia a branch e abre o PR (passe também
`REPO=Komunick/zap-komunick`). O script não muda a branch nem os arquivos da sua cópia de trabalho: o merge, quando
precisa, acontece numa pasta temporária.

Variáveis opcionais: `UPSTREAM_URL` (padrão `https://github.com/ticketz-oss/ticketz.git`), `UPSTREAM_BRANCH`
(`main`), `BASE_BRANCH` (`dev`) e `SYNC_BRANCH` (`ticketz-upstream`).
