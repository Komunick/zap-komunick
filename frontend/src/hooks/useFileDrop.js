import { useCallback, useRef, useState } from "react";
import { dragHasFiles, filesFromDrop } from "../helpers/attachmentSelection";

// Zap Komunick: drag and drop of files over a conversation. Returns whether a
// drag with files is over the area and the handlers to put on it. Dragging
// selected text or a link is left alone, so the browser keeps its behaviour.
// The files reach `onFiles` as filesFromDrop gives them: dragged folders come
// marked, for selectAttachments to leave out.
const useFileDrop = onFiles => {
  const [dragging, setDragging] = useState(false);
  // Enter and leave fire for every child the pointer crosses.
  const depth = useRef(0);
  const handler = useRef(onFiles);
  handler.current = onFiles;

  const onDragEnter = useCallback(event => {
    if (!dragHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    depth.current += 1;
    setDragging(true);
  }, []);

  const onDragOver = useCallback(event => {
    if (!dragHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragLeave = useCallback(event => {
    if (!dragHasFiles(event.dataTransfer)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  }, []);

  const onDrop = useCallback(event => {
    if (!dragHasFiles(event.dataTransfer)) return;
    // Without this the browser would open the file in place of the system.
    event.preventDefault();
    depth.current = 0;
    setDragging(false);
    handler.current(filesFromDrop(event.dataTransfer));
  }, []);

  return {
    dragging,
    dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop }
  };
};

export default useFileDrop;
