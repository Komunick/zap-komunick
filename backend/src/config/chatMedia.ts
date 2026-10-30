import path from "path";
import { promises as fs } from "fs";
import AppError from "../errors/AppError";
import uploadConfig from "./upload";
import { chatMediaBasename } from "../helpers/ChatMediaRules";

const applicationRoot = path.resolve(uploadConfig.directory, "..");
export const chatMediaDirectory = path.join(applicationRoot, "private", "chat");

export async function inspectChatMediaDirectory(): Promise<boolean> {
  const directories = [
    applicationRoot,
    path.join(applicationRoot, "private"),
    chatMediaDirectory
  ];
  for (let index = 0; index < directories.length; index += 1) {
    const directory = directories[index];
    try {
      const stat = await fs.lstat(directory);
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        (await fs.realpath(directory)) !== directory
      )
        throw new AppError("ERR_CHAT_MEDIA_STORAGE_UNSAFE", 503);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
  return true;
}

export async function ensureChatMediaDirectory(): Promise<void> {
  if ((await fs.realpath(applicationRoot)) !== applicationRoot)
    throw new AppError("ERR_CHAT_MEDIA_STORAGE_UNSAFE", 503);
  const directories = [
    path.join(applicationRoot, "private"),
    chatMediaDirectory
  ];
  for (let index = 0; index < directories.length; index += 1) {
    const directory = directories[index];
    try {
      await fs.mkdir(directory, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const stat = await fs.lstat(directory);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (await fs.realpath(directory)) !== directory
    )
      throw new AppError("ERR_CHAT_MEDIA_STORAGE_UNSAFE", 503);
  }
  await fs.chmod(chatMediaDirectory, 0o700);
}

export async function resolveChatMediaFile(value: unknown): Promise<string> {
  const filename = chatMediaBasename(value);
  if (!filename || !(await inspectChatMediaDirectory()))
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  const candidate = path.join(chatMediaDirectory, filename);
  try {
    const stat = await fs.lstat(candidate);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      (await fs.realpath(candidate)) !== candidate
    )
      throw new AppError("ERR_NO_CHAT_FOUND", 404);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new AppError("ERR_NO_CHAT_FOUND", 404);
    throw error;
  }
  return candidate;
}
