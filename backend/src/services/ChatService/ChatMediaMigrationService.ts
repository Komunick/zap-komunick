import path from "path";
import { constants, promises as fs } from "fs";
import { createHash, randomUUID } from "crypto";
import { QueryTypes, Transaction, Op } from "sequelize";
import uploadConfig from "../../config/upload";
import {
  chatMediaDirectory,
  ensureChatMediaDirectory,
  inspectChatMediaDirectory
} from "../../config/chatMedia";
import {
  chatMediaBasename,
  hasChatMediaMigrationConflict,
  isChatUploadName,
  publicChatMediaReference
} from "../../helpers/ChatMediaRules";
import ChatMessage from "../../models/ChatMessage";

interface MediaReferenceTable {
  table: string;
  columns: string[];
  keys?: string[];
}
const MEDIA_REFERENCES: MediaReferenceTable[] = [
  { table: "Messages", columns: ["mediaUrl", "thumbnailUrl"] },
  { table: "Announcements", columns: ["mediaPath"] },
  { table: "Campaigns", columns: ["mediaPath"] },
  { table: "Schedules", columns: ["mediaPath"] },
  { table: "Queues", columns: ["mediaPath"] },
  { table: "QueueOptions", columns: ["mediaPath"] },
  { table: "Contacts", columns: ["profilePicUrl", "profileHiresPictureUrl"] },
  {
    table: "Settings",
    columns: ["value"],
    keys: [
      "appLogoLight",
      "appLogoDark",
      "appLogoFavicon",
      "loginSidePanelImage",
      "loginBackgroundContent"
    ]
  }
];

export interface ChatMediaInventoryFile {
  name: string;
  references: number;
  orphan: boolean;
  public: boolean;
  private: boolean;
  publicHash?: string;
  privateHash?: string;
  sharedTables: string[];
  problem?: "unsafe-public" | "unsafe-private" | "different-bytes";
}
export interface ChatMediaInventory {
  files: ChatMediaInventoryFile[];
  invalidReferences: number;
  unsafeStorage: boolean;
  ready: boolean;
}

async function regularFile(
  filePath: string
): Promise<"absent" | "regular" | "unsafe"> {
  try {
    const stat = await fs.lstat(filePath);
    return stat.isFile() &&
      !stat.isSymbolicLink() &&
      (await fs.realpath(filePath)) === filePath
      ? "regular"
      : "unsafe";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "absent";
    throw error;
  }
}

async function digest(filePath: string): Promise<string> {
  const handle = await fs.open(
    filePath,
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    const hash = createHash("sha256"),
      buffer = new Uint8Array(1024 * 1024);
    let position = 0,
      completed = false;
    while (!completed) {
      const { bytesRead } = await handle.read(
        buffer,
        0,
        buffer.length,
        position
      );
      if (!bytesRead) completed = true;
      else {
        hash.update(buffer.subarray(0, bytesRead));
        position += bytesRead;
      }
    }
    return hash.digest("hex");
  } finally {
    await handle.close();
  }
}

async function sharedReferences(
  names: Set<string>,
  transaction?: Transaction
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (!names.size) return result;
  for (let index = 0; index < MEDIA_REFERENCES.length; index += 1) {
    const descriptor = MEDIA_REFERENCES[index];
    // Identifiers are a fixed allowlist. Only structural media fields are read;
    // no message bodies, credentials or unrelated settings enter the inventory.
    const columns = descriptor.columns.map(column => `"${column}"`).join(", ");
    const rows = await ChatMessage.sequelize.query<Record<string, unknown>>(
      `SELECT ${columns} FROM "${descriptor.table}" WHERE ${descriptor.keys ? '"key" IN (:keys)' : descriptor.columns.map(column => `"${column}" IS NOT NULL`).join(" OR ")}`,
      {
        replacements: descriptor.keys ? { keys: descriptor.keys } : {},
        transaction,
        type: QueryTypes.SELECT
      }
    );
    rows.forEach(row =>
      descriptor.columns.forEach(column => {
        const name = publicChatMediaReference(
          row[column],
          process.env.BACKEND_URL || "",
          process.env.FRONTEND_URL || ""
        );
        if (name && names.has(name)) {
          const tables = result.get(name) || [];
          if (!tables.includes(descriptor.table)) tables.push(descriptor.table);
          result.set(name, tables);
        }
      })
    );
  }
  return result;
}

export async function inspectChatMediaReadiness(
  transaction?: Transaction
): Promise<ChatMediaInventory> {
  const references = await ChatMessage.findAll({
    attributes: ["mediaPath"],
    where: { mediaPath: { [Op.ne]: null } },
    raw: true,
    transaction
  });
  const counts = new Map<string, number>();
  let invalidReferences = 0,
    unsafeStorage = false;
  references.forEach(row => {
    const raw = row.mediaPath;
    // Empty mediaPath is the historical text-message representation.
    if (raw === "") return;
    const name = chatMediaBasename(raw);
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
    else invalidReferences += 1;
  });
  let publicEntries: string[] = [];
  try {
    const publicStat = await fs.lstat(uploadConfig.directory);
    if (
      !publicStat.isDirectory() ||
      publicStat.isSymbolicLink() ||
      (await fs.realpath(uploadConfig.directory)) !== uploadConfig.directory
    )
      unsafeStorage = true;
    else publicEntries = await fs.readdir(uploadConfig.directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  try {
    if (await inspectChatMediaDirectory()) {
      const privateNames = await fs.readdir(chatMediaDirectory);
      privateNames
        .filter(name => chatMediaBasename(name))
        .forEach(name => {
          if (!counts.has(name)) counts.set(name, 0);
        });
    }
  } catch {
    unsafeStorage = true;
  }
  publicEntries.filter(isChatUploadName).forEach(name => {
    if (!counts.has(name)) counts.set(name, 0);
  });
  const shared = await sharedReferences(new Set(counts.keys()), transaction);
  const files: ChatMediaInventoryFile[] = [];
  const names = [...counts.keys()].sort();
  for (let index = 0; index < names.length; index += 1) {
    const name = names[index];
    const entry: ChatMediaInventoryFile = {
      name,
      references: counts.get(name),
      orphan: counts.get(name) === 0,
      public: false,
      private: false,
      sharedTables: shared.get(name) || []
    };
    if (!unsafeStorage) {
      const source = path.join(uploadConfig.directory, name),
        destination = path.join(chatMediaDirectory, name);
      const publicState = await regularFile(source),
        privateState = await regularFile(destination);
      entry.public = publicState !== "absent";
      entry.private = privateState !== "absent";
      if (publicState === "unsafe") entry.problem = "unsafe-public";
      else if (privateState === "unsafe") entry.problem = "unsafe-private";
      else if (entry.public) {
        entry.publicHash = await digest(source);
        if (entry.private) {
          entry.privateHash = await digest(destination);
          if (entry.privateHash !== entry.publicHash)
            entry.problem = "different-bytes";
        }
      }
    }
    files.push(entry);
  }
  const ready =
    !hasChatMediaMigrationConflict({
      unsafeStorage,
      invalidReferences,
      files
    }) && files.every(file => !file.public);
  return { files, invalidReferences, unsafeStorage, ready };
}

export async function assertChatMediaReady(): Promise<void> {
  const inventory = await inspectChatMediaReadiness();
  if (!inventory.ready) throw new Error("ERR_CHAT_MEDIA_MIGRATION_REQUIRED");
}

// Also used by public delivery after startup: reinserting a file must not
// restore its public URL. Query failure never authorizes a public response.
export async function isProtectedChatPublicPath(
  relativePath: string
): Promise<boolean> {
  const basename = chatMediaBasename(relativePath);
  if (!basename) return false;
  if (isChatUploadName(basename)) return true;
  if (await inspectChatMediaDirectory()) {
    if (
      (await regularFile(path.join(chatMediaDirectory, basename))) !== "absent"
    )
      return true;
  }
  return (await ChatMessage.count({ where: { mediaPath: basename } })) > 0;
}

async function syncDirectory(directory: string): Promise<void> {
  const handle = await fs.open(
    directory,
    constants.O_RDONLY | constants.O_DIRECTORY
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function copyExclusive(
  source: string,
  destination: string,
  expectedHash: string
): Promise<void> {
  const temporary = path.join(
    chatMediaDirectory,
    `.chat-migration-${randomUUID()}.tmp`
  );
  const input = await fs.open(
    source,
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  let output: Awaited<ReturnType<typeof fs.open>>;
  try {
    output = await fs.open(
      temporary,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600
    );
    const buffer = new Uint8Array(1024 * 1024);
    let position = 0;
    let completed = false;
    while (!completed) {
      const { bytesRead } = await input.read(
        buffer,
        0,
        buffer.length,
        position
      );
      if (!bytesRead) completed = true;
      else {
        let written = 0;
        while (written < bytesRead) {
          const { bytesWritten } = await output.write(
            buffer,
            written,
            bytesRead - written,
            position + written
          );
          if (!bytesWritten) throw new Error("ERR_CHAT_MEDIA_MIGRATION_WRITE");
          written += bytesWritten;
        }
        position += bytesRead;
      }
    }
    await output.sync();
    if ((await digest(temporary)) !== expectedHash)
      throw new Error("ERR_CHAT_MEDIA_MIGRATION_CHANGED");
    // Hard-link publication is atomic and refuses an existing destination.
    // Source/public may be on another volume, so rename is not sufficient.
    await fs.link(temporary, destination);
    await syncDirectory(chatMediaDirectory);
  } finally {
    await input.close();
    if (output) {
      await output.close();
      await fs.unlink(temporary).catch(error => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
}

export async function migrateChatMedia(): Promise<ChatMediaInventory> {
  return ChatMessage.sequelize.transaction(async transaction => {
    await ChatMessage.sequelize.query(
      "SELECT pg_advisory_xact_lock(20261030, 271)",
      { transaction }
    );
    const tables = [
      "ChatMessages",
      ...MEDIA_REFERENCES.map(reference => reference.table)
    ].sort();
    await ChatMessage.sequelize.query(
      `LOCK TABLE ${tables.map(table => `"${table}"`).join(", ")} IN SHARE MODE`,
      { transaction }
    );
    const inventory = await inspectChatMediaReadiness(transaction);
    if (hasChatMediaMigrationConflict(inventory))
      throw new Error("ERR_CHAT_MEDIA_MIGRATION_CONFLICT");
    const pending = inventory.files.filter(file => file.public);
    if (pending.length) await ensureChatMediaDirectory();
    for (let index = 0; index < pending.length; index += 1) {
      const file = pending[index],
        source = path.join(uploadConfig.directory, file.name),
        destination = path.join(chatMediaDirectory, file.name);
      if (!file.private)
        await copyExclusive(source, destination, file.publicHash);
      if (
        (await regularFile(source)) !== "regular" ||
        (await regularFile(destination)) !== "regular" ||
        (await digest(source)) !== file.publicHash ||
        (await digest(destination)) !== file.publicHash
      )
        throw new Error("ERR_CHAT_MEDIA_MIGRATION_CHANGED");
      await fs.unlink(source);
      await syncDirectory(uploadConfig.directory);
    }
    return inspectChatMediaReadiness(transaction);
  });
}

export function summarizeChatMediaInventory(inventory: ChatMediaInventory) {
  return {
    referencedFiles: inventory.files.filter(file => file.references > 0).length,
    identifiableOrphans: inventory.files.filter(file => file.orphan).length,
    pendingPublicFiles: inventory.files.filter(file => file.public).length,
    privateFiles: inventory.files.filter(file => file.private).length,
    missingFiles: inventory.files.filter(file => !file.public && !file.private)
      .length,
    conflicts: inventory.files.filter(
      file => file.problem || (file.public && file.sharedTables.length)
    ).length,
    invalidReferences: inventory.invalidReferences,
    unsafeStorage: inventory.unsafeStorage ? 1 : 0
  };
}
