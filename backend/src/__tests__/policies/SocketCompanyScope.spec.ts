import fs from "fs";
import path from "path";

/**
 * `io.emit(...)` entrega o evento a TODOS os sockets conectados, de todas as
 * empresas. Como o nome do evento só carrega o id da empresa (`company-<id>-…`),
 * qualquer usuário autenticado que escute o nome de outra empresa receberia os
 * dados dela. Eventos de empresa precisam sair pela sala da empresa:
 * `io.to(`company-${companyId}-mainchannel`).emit(...)`.
 */

const SRC_ROOT = path.resolve(__dirname, "../..");

// Eventos globais por desenho (avisos da plataforma, listados sem filtro de empresa).
const GLOBAL_EVENTS = new Set(["company-announcement"]);

const listSources = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : listSources(full);
    }
    return entry.name.endsWith(".ts") ? [full] : [];
  });

const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const BROADCAST =
  /\b(?:io|getIO\(\))\s*\.emit\(\s*(["'`])((?:(?!\1)[^\\]|\\.)*)\1/g;

const findBroadcasts = (code: string): string[] => {
  const events: string[] = [];
  let match: RegExpExecArray | null = BROADCAST.exec(code);
  while (match) {
    events.push(match[2]);
    match = BROADCAST.exec(code);
  }
  BROADCAST.lastIndex = 0;
  return events;
};

describe("escopo por empresa nos eventos de socket", () => {
  it("detecta o broadcast global e ignora comentários e emissões por sala", () => {
    const sample = [
      "// io.emit(`company-${a}-x`, {});",
      "io.emit(`company-${companyId}-queue`, {});",
      "getIO().emit('schedule', {});",
      "io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-queue`, {});",
      "socket.emit('error', {});"
    ].join("\n");

    expect(findBroadcasts(stripComments(sample))).toEqual([
      "company-${companyId}-queue",
      "schedule"
    ]);
  });

  it("nenhum evento de empresa é emitido para todos os sockets", () => {
    const offenders: string[] = [];

    listSources(SRC_ROOT).forEach(file => {
      const events = findBroadcasts(
        stripComments(fs.readFileSync(file, "utf8"))
      );
      events
        .filter(event => !GLOBAL_EVENTS.has(event))
        .forEach(event =>
          offenders.push(
            `${path.relative(SRC_ROOT, file).split(path.sep).join("/")}: ${event}`
          )
        );
    });

    expect(offenders).toEqual([]);
  });
});
