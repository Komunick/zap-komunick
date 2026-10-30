import { publicFileRelativePath } from "../../helpers/PublicFilePathRules";

describe("public file path confinement", () => {
  it.each([
    undefined,
    "",
    "/absolute.txt",
    "../private/chat/file.txt",
    "folder/../../private/file.txt",
    "folder/./file.txt",
    "folder//file.txt",
    "folder/",
    "..\\private\\file.txt",
    "C:/private/file.txt",
    "file\u0000.txt",
    "file\n.txt"
  ])("rejects an ambiguous or escaping public path: %p", value => {
    expect(publicFileRelativePath(value)).toBeUndefined();
  });

  it.each(["ordinary.png", "media-persistant/10/folder/invoice.pdf"])(
    "keeps another module's valid public relative path: %s",
    value => expect(publicFileRelativePath(value)).toBe(value)
  );
});
