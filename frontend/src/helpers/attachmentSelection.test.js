import {
  dragHasFiles,
  filesFromDrop,
  selectAttachments
} from "./attachmentSelection";

const file = (name, size, type = "application/pdf") =>
  new File([new Uint8Array(size)], name, { type });

test("keeps real files, in order", () => {
  const a = file("Guia DAS.PDF", 10);
  const b = file("foto.jpg", 5, "image/jpeg");
  expect(selectAttachments([a, b])).toEqual({ files: [a, b], skipped: [] });
});

test("skips empty files and dragged folders", () => {
  const ok = file("contrato.pdf", 10);
  const emptyFile = file("vazio.pdf", 0);
  const folder = { name: "Documentos", isFolder: true };
  expect(selectAttachments([emptyFile, ok, folder])).toEqual({
    files: [ok],
    skipped: [emptyFile, folder]
  });
});

test("only a drag that carries files counts", () => {
  expect(dragHasFiles({ types: ["Files"] })).toBe(true);
  expect(dragHasFiles({ types: ["text/plain", "text/html"] })).toBe(false);
  expect(dragHasFiles(undefined)).toBe(false);
});

test("marks dropped folders by their entry", () => {
  const a = file("a.pdf", 3);
  const folder = file("Pasta", 4096, "");
  const dataTransfer = {
    files: [a, folder],
    items: [
      { kind: "file", webkitGetAsEntry: () => ({ isDirectory: false }) },
      { kind: "file", webkitGetAsEntry: () => ({ isDirectory: true }) }
    ]
  };
  const dropped = filesFromDrop(dataTransfer);
  expect(dropped[0]).toBe(a);
  expect(dropped[1]).toEqual({ name: "Pasta", isFolder: true });
  expect(selectAttachments(dropped).files).toEqual([a]);
});

test("without entries the files pass through", () => {
  const a = file("a.pdf", 3);
  expect(filesFromDrop({ files: [a] })).toEqual([a]);
});
