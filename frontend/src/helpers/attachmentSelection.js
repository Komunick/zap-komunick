// Zap Komunick: one rule for every way of attaching a file to a ticket
// (attach button, paste and drag and drop). Empty files cannot be sent
// through WhatsApp and dragged folders are not files: both are reported and
// left out instead of failing later on the server.

export const selectAttachments = fileList => {
  const files = [];
  const skipped = [];
  Array.from(fileList || []).forEach(file => {
    if (!file || file.isFolder || !file.size) skipped.push(file);
    else files.push(file);
  });
  return { files, skipped };
};

// True only when the drag carries files, not selected text or a link.
export const dragHasFiles = dataTransfer =>
  !!dataTransfer &&
  Array.from(dataTransfer.types || []).some(type => type === "Files");

// Files of a drop, with dragged folders marked so selectAttachments skips
// them. Browsers expose a folder as a File, recognizable only by its entry.
export const filesFromDrop = dataTransfer => {
  const files = Array.from(dataTransfer?.files || []);
  const items = Array.from(dataTransfer?.items || []).filter(
    item => item.kind === "file"
  );
  if (items.length !== files.length) return files;
  return files.map((file, index) => {
    const entry = items[index].webkitGetAsEntry?.();
    return entry?.isDirectory ? { name: file.name, isFolder: true } : file;
  });
};
