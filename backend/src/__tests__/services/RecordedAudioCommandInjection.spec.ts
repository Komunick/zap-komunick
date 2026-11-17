import fs from "fs";
import os from "os";
import path from "path";
import childProcess from "child_process";
import { getMessageFileOptions } from "../../services/WbotServices/SendWhatsAppMedia";
import { safeUploadExtension } from "../../helpers/SafeUploadExtension";
import uploadConfig from "../../config/upload";
import privateFilesConfig from "../../config/privateFiles";

// A real temporary directory holds the canary files. ffmpeg points at a binary
// that does not exist, so conversion fails and nothing else may run.
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "zapk-audio-"));

jest.mock("@ffmpeg-installer/ffmpeg", () => ({
  path: require("path").join(
    require("os").tmpdir(),
    "zapk-audio-no-such-dir",
    "missing-ffmpeg"
  )
}));
jest.mock("../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../helpers/CheckSettings", () => jest.fn());
jest.mock("../../helpers/saveMediaFile", () => jest.fn());
jest.mock("../../models/Ticket", () => ({}));
jest.mock("../../services/WbotServices/wbotMessageListener", () => ({
  verifyMediaMessage: jest.fn(),
  verifyMessage: jest.fn()
}));
jest.mock("../../services/WbotServices/getJidOf", () => ({
  getJidOf: jest.fn()
}));
jest.mock("../../utils/logger", () => ({
  logger: { error: jest.fn(), debug: jest.fn(), warn: jest.fn() }
}));

const canaries = ["quote", "subshell", "ampersand"].map(name =>
  path.join(sandbox, `pwned-${name}`)
);
// Breaks out of the old `-i "${audio}"` quoting on POSIX shells (`;`, `$()`)
// and on cmd.exe (`&`), each branch writing its own canary file.
const maliciousPath =
  `${sandbox}${path.sep}voice"; touch ${canaries[0]}; ` +
  `$(touch ${canaries[1]}) & echo pwned> ${canaries[2]} & ".mp3`;
const convert = () =>
  getMessageFileOptions("audio-record-site.mp3", maliciousPath, "audio/mpeg");
const settle = () => new Promise(resolve => setTimeout(resolve, 500));

afterEach(() => {
  jest.restoreAllMocks();
  canaries.forEach(file => fs.rmSync(file, { force: true }));
});
afterAll(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

describe("recorded audio conversion", () => {
  it("does not run commands embedded in the media path", async () => {
    const result = await convert();
    await settle();

    expect(result).toBeNull();
    canaries.forEach(file => expect(fs.existsSync(file)).toBe(false));
  });

  it("passes the media path to ffmpeg as one argument, without a shell", async () => {
    const exec = jest.spyOn(childProcess, "exec");
    const execFile = jest.spyOn(childProcess, "execFile").mockImplementation(((
      ...args: unknown[]
    ) => {
      const callback = args[args.length - 1] as (error: Error) => void;
      callback(new Error("fictional ffmpeg failure"));
      return {} as childProcess.ChildProcess;
    }) as unknown as typeof childProcess.execFile);

    await convert();

    expect(exec).not.toHaveBeenCalled();
    expect(execFile).toHaveBeenCalledTimes(1);
    const [binary, argv, options] = execFile.mock.calls[0] as unknown[];
    expect(binary).toBe(
      path.join(os.tmpdir(), "zapk-audio-no-such-dir", "missing-ffmpeg")
    );
    expect(argv).toEqual([
      "-i",
      maliciousPath,
      "-vn",
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "libopus",
      "-b:a",
      "0",
      expect.stringMatching(/\.ogg$/)
    ]);
    expect(options).toEqual(expect.objectContaining({ shell: false }));
  });
});

describe("stored upload names", () => {
  it.each([
    ['voice.mp3"; touch /tmp/pwned; "', ""],
    ["voice.$(id)", ""],
    ["voice.mp3;rm", ""],
    ["voice.m p3", ""],
    ["voice.ogg&calc", ""],
    ["voice.`id`", ""],
    ["noextension", ""],
    [undefined, ""],
    ["voice.mp3", ".mp3"],
    ["Foto.JPEG", ".JPEG"],
    ["arquivo.tar.gz", ".gz"]
  ])("keeps only a plain extension from %p", (name, expected) => {
    expect(safeUploadExtension(name)).toBe(expected);
  });

  it.each([
    ["public uploads", uploadConfig],
    ["private files", privateFilesConfig]
  ])("%s never store shell metacharacters", (_name, config) => {
    const storage = config.storage as unknown as {
      getFilename: (
        req: unknown,
        file: { originalname: string },
        cb: (error: Error | null, name: string) => void
      ) => void;
    };
    const names: string[] = [];
    ["voice.mp3", 'x.mp3"; touch /tmp/pwned; "', "x.$(id)"].forEach(
      originalname =>
        storage.getFilename({}, { originalname }, (_error, name) =>
          names.push(name)
        )
    );

    // Public uploads add a random hex part so files of one request never collide.
    expect(names[0]).toMatch(/^\d+(-[0-9a-f]{12})?\.mp3$/);
    expect(names[1]).toMatch(/^\d+(-[0-9a-f]{12})?$/);
    expect(names[2]).toMatch(/^\d+(-[0-9a-f]{12})?$/);
  });
});
