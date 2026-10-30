import path from "path";
import { promises as fs } from "fs";
import {
  inspectChatMediaReadiness,
  migrateChatMedia,
  summarizeChatMediaInventory
} from "../services/ChatService/ChatMediaMigrationService";
import { chatMediaDirectory } from "../config/chatMedia";
import { hasChatMediaMigrationConflict } from "../helpers/ChatMediaRules";

type Mode = "inspect" | "execute" | "check";
const args = process.argv.slice(2);
const mode: Mode = args.includes("--execute")
  ? "execute"
  : args.includes("--check")
    ? "check"
    : "inspect";

async function main(): Promise<void> {
  if (args.includes("--help")) {
    process.stdout.write(
      "migrateChatMedia [--dry-run|--check|--execute] [--report]\nDefault: dry-run; --report writes details only to private/chat-media-migration-report.json.\n"
    );
    return;
  }
  if (
    args.some(
      arg => !["--dry-run", "--check", "--execute", "--report"].includes(arg)
    ) ||
    args.filter(arg => ["--dry-run", "--check", "--execute"].includes(arg))
      .length > 1
  )
    throw new Error("ERR_CHAT_MEDIA_MIGRATION_ARGUMENTS");
  const database = (await import("../database")).default;
  let envelope: object;
  try {
    if (args.includes("--report")) {
      try {
        await fs.lstat(
          path.join(
            path.dirname(chatMediaDirectory),
            "chat-media-migration-report.json"
          )
        );
        throw new Error("ERR_CHAT_MEDIA_REPORT_EXISTS");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    const inventory = args.includes("--execute")
      ? await migrateChatMedia()
      : await inspectChatMediaReadiness();
    if (args.includes("--report")) {
      const privateRoot = path.dirname(chatMediaDirectory);
      const stat = await fs.lstat(privateRoot);
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        (await fs.realpath(privateRoot)) !== privateRoot
      )
        throw new Error("ERR_CHAT_MEDIA_STORAGE_UNSAFE");
      await fs.writeFile(
        path.join(privateRoot, "chat-media-migration-report.json"),
        JSON.stringify(inventory, null, 2) + "\n",
        { mode: 0o600, flag: "wx" }
      );
    }
    const migratable = !hasChatMediaMigrationConflict(inventory);
    const ok = mode === "inspect" ? migratable : inventory.ready;
    envelope = {
      kind: "chat-media-migration",
      schemaVersion: 1,
      mode,
      counts: summarizeChatMediaInventory(inventory),
      inventoryAvailable: true,
      ok
    };
    if (!ok) process.exitCode = 1;
  } finally {
    await database.close();
  }
  process.stdout.write(JSON.stringify(envelope) + "\n");
}

if (require.main === module) {
  main().catch(() => {
    // Do not log paths, filenames, query values, credentials or file content.
    process.stderr.write(
      "Chat media migration did not complete; preserve storage and inspect the private inventory.\n"
    );
    process.stdout.write(
      JSON.stringify({
        kind: "chat-media-migration",
        schemaVersion: 1,
        mode,
        counts: null,
        inventoryAvailable: false,
        ok: false,
        code: "ERR_CHAT_MEDIA_MIGRATION_FAILED"
      }) + "\n"
    );
    process.exitCode = 1;
  });
}
