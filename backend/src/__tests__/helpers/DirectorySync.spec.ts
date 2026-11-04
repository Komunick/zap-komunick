import { constants, promises as fs } from "fs";
import path from "path";
import os from "os";
import syncDirectory from "../../helpers/DirectorySync";

afterEach(() => jest.restoreAllMocks());

it("flushes a real owned directory using the native platform handle", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "superchat-dir-sync-")
  );
  try {
    await expect(syncDirectory(directory)).resolves.toBeUndefined();
  } finally {
    await fs.rmdir(directory);
  }
});

it.each([
  { platform: "win32" as const, flags: constants.O_WRONLY },
  {
    platform: "linux" as const,
    flags: constants.O_RDONLY | constants.O_DIRECTORY
  }
])(
  "requests the required directory rights on $platform",
  async ({ platform, flags }) => {
    const handle = {
      sync: jest.fn(async () => undefined),
      close: jest.fn(async () => undefined)
    };
    const open = jest
      .spyOn(fs, "open")
      .mockResolvedValue(
        handle as unknown as Awaited<ReturnType<typeof fs.open>>
      );
    await syncDirectory("owned-fixture-directory", platform);
    expect(open).toHaveBeenCalledWith("owned-fixture-directory", flags);
    expect(handle.sync).toHaveBeenCalledTimes(1);
    expect(handle.close).toHaveBeenCalledTimes(1);
  }
);

it("propagates a directory-open failure instead of treating it as supported", async () => {
  const failure = Object.assign(new Error("fixture directory access"), {
    code: "EACCES"
  });
  jest.spyOn(fs, "open").mockRejectedValue(failure);
  await expect(syncDirectory("owned-fixture-directory")).rejects.toBe(failure);
});

it("closes the handle and propagates a failed flush", async () => {
  const failure = Object.assign(new Error("fixture flush failure"), {
    code: "EIO"
  });
  const handle = {
    sync: jest.fn(async () => {
      throw failure;
    }),
    close: jest.fn(async () => undefined)
  };
  jest
    .spyOn(fs, "open")
    .mockResolvedValue(
      handle as unknown as Awaited<ReturnType<typeof fs.open>>
    );
  await expect(syncDirectory("owned-fixture-directory")).rejects.toBe(failure);
  expect(handle.close).toHaveBeenCalledTimes(1);
});

it("does not hide a directory-handle close error", async () => {
  const failure = Object.assign(new Error("fixture close failure"), {
    code: "EIO"
  });
  const handle = {
    sync: jest.fn(async () => undefined),
    close: jest.fn(async () => {
      throw failure;
    })
  };
  jest
    .spyOn(fs, "open")
    .mockResolvedValue(
      handle as unknown as Awaited<ReturnType<typeof fs.open>>
    );
  await expect(syncDirectory("owned-fixture-directory")).rejects.toBe(failure);
});
