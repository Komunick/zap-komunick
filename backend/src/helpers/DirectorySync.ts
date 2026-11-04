import { constants, promises as fs } from "fs";

// Windows FlushFileBuffers requires a writable handle. libuv opens directory
// handles with backup semantics; POSIX keeps its read-only O_DIRECTORY fence.
export default async function syncDirectory(
  directory: string,
  platform: NodeJS.Platform = process.platform
): Promise<void> {
  const flags =
    platform === "win32"
      ? constants.O_WRONLY
      : constants.O_RDONLY | constants.O_DIRECTORY;
  const handle = await fs.open(directory, flags);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
