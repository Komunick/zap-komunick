/**
 * Junta os pedaços de um stream em um único Buffer.
 *
 * Os pedaços ficam em uma lista e são concatenados uma vez no fim. Concatenar a
 * cada pedaço (`buffer = Buffer.concat([buffer, chunk])`) copia o acumulado
 * inteiro N vezes: para 15 MiB em pedaços de 16 KiB são cerca de 1 900 ms de CPU
 * e mil alocações grandes por download, contra poucos milissegundos aqui.
 *
 * `onProgress` recebe o total acumulado depois de cada pedaço.
 */
export const collectStream = async (
  stream: AsyncIterable<Buffer>,
  onProgress?: (totalSize: number) => void
): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  let totalSize = 0;

  // eslint-disable-next-line no-restricted-syntax
  for await (const chunk of stream) {
    chunks.push(chunk);
    totalSize += chunk.length;
    onProgress?.(totalSize);
  }

  // O @types/node 17 com o TypeScript 5.9 não aceita Buffer[] aqui (mesmo cast usado no projeto).
  return Buffer.concat(chunks as unknown as Uint8Array[], totalSize);
};
