# Migração privada de anexos no Windows

## Objetivo e autorização

Em 04/11/2026, o usuário autorizou resolver as pendências registradas sem novas pausas para aprovação.
Este recorte corrige o EPERM da migração de anexos do chat no Windows, preservando integridade e acesso privado.
Não inclui deploy, merge, WhatsApp, alterações de outros módulos ou operação sobre mídia existente do usuário.

## Garantias

- Manter publicação por hardlink exclusivo, cópia temporária, flush, comparação SHA-256 e validação dos caminhos.
- Remover a origem pública somente depois de confirmar a cópia privada íntegra e sincronizada. A retomada deve
  verificar e sincronizar também uma cópia privada que já exista após interrupção.
- Usar sincronização suportada no Windows, sem transformar erro de I/O em sucesso. Preservar fsync de diretórios
  nos sistemas que o suportam e documentar a diferença entre flush de arquivo/metadados e flush de diretório.
  Abrir o diretório com `O_WRONLY` no Windows, pois FlushFileBuffers exige acesso de escrita; em POSIX, manter
  `O_RDONLY | O_DIRECTORY`. Fazer preflight nas raízes pública/privada e nos diretórios que contêm a raiz privada
  antes de publicar qualquer hardlink. Erro de abertura, flush ou fechamento continua abortando a migração.
- Conservar locks do PostgreSQL, referências RAW, recusa de conflitos/symlinks e checagem de prontidão. Uma falha
  não autoriza apagar dados, restaurar URL pública ou remover os bloqueios para conseguir iniciar o aplicativo.
- Validar antes/depois em armazenamento e banco fictícios próprios, com hash e associação preservados, arquivo
  alheio intacto, interrupção/retomada e falhas de flush. Não usar public/private da instância QA em execução.

## Verificação

Executar Jest diretamente com guard de rede, build, tipos e lint. Reproduzir o erro da revisão anterior e o fluxo
corrigido no Windows real. Exercitar o ramo POSIX por testes de contrato e registrar separadamente o que depende
de CI Linux; simulação não equivale a execução nativa. A entrega deve informar resultados e limites reais, sem
afirmar resistência a corte de energia que não tenha sido ensaiada.

O Windows não representa os bits de permissão POSIX como ACLs. Os testes preservam o pedido de modo `0600` e
testam junctions nativas; a verificação de bits `0600` e symlinks de arquivo permanece no POSIX. O armazenamento
Windows também precisa de permissões locais adequadas para a conta do serviço. A matriz de CI acrescenta Windows
com Node 22 e 24, sem servidor ou PostgreSQL; o ensaio local com PostgreSQL usa cluster e arquivos próprios.

Referências: [anexos privados](chat-anexos-privados.md), [TAD](../TAD.md) e [princípios](../PRINCIPLES.md).

Fontes técnicas: [FlushFileBuffers](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers),
[cache de arquivo e metadados](https://learn.microsoft.com/en-us/windows/win32/fileio/file-caching) e
[implementação Windows do libuv](https://github.com/libuv/libuv/blob/v1.x/src/win/fs.c).
