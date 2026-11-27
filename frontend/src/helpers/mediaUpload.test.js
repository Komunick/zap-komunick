import Compressor from "compressorjs";
import { sendMediasInOrder } from "./mediaUpload";

jest.mock("compressorjs", () => jest.fn());

const image = (name, type = "image/jpeg") =>
  new File(["foto ficticia"], name, { type });
const pdf = name =>
  new File(["%PDF-1.4 ficticio"], name, { type: "application/pdf" });

// What one request carried: the names of its files and its text.
const sentBy = post =>
  post.mock.calls.map(([formData]) => ({
    medias: formData.getAll("medias").map(file => file.name),
    body: formData.getAll("body"),
    fromMe: formData.get("fromMe")
  }));

// Compression that takes `delays[name]` ms and gives back a smaller copy.
const compressAfter = delays =>
  Compressor.mockImplementation((file, options) => {
    setTimeout(
      () =>
        options.success(new File(["menor"], file.name, { type: "image/jpeg" })),
      delays[file.name] || 0
    );
  });

beforeEach(() => jest.clearAllMocks());

test("each file goes in its own request, in the order chosen, however long each compression takes", async () => {
  compressAfter({ "primeira.jpg": 60, "segunda.jpg": 1 });
  const post = jest.fn().mockResolvedValue({});
  const files = [image("primeira.jpg"), image("segunda.jpg"), pdf("guia.pdf")];

  const result = await sendMediasInOrder(files, post);

  expect(sentBy(post)).toEqual([
    { medias: ["primeira.jpg"], body: ["primeira.jpg"], fromMe: "true" },
    { medias: ["segunda.jpg"], body: ["segunda.jpg"], fromMe: "true" },
    { medias: ["guia.pdf"], body: ["guia.pdf"], fromMe: "true" }
  ]);
  expect(result).toEqual({ sent: 3, pending: [], error: null });
});

test("the next file only starts after the server answered the previous one", async () => {
  compressAfter({});
  const events = [];
  const post = jest.fn(async formData => {
    const [{ name }] = formData.getAll("medias");
    events.push(`sobe ${name}`);
    await new Promise(resolve => setTimeout(resolve, 20));
    events.push(`resposta ${name}`);
  });

  await sendMediasInOrder([pdf("a.pdf"), image("b.jpg"), pdf("c.pdf")], post);

  expect(events).toEqual([
    "sobe a.pdf",
    "resposta a.pdf",
    "sobe b.jpg",
    "resposta b.jpg",
    "sobe c.pdf",
    "resposta c.pdf"
  ]);
});

test("the compressed copy is what goes, under the name the compression gave it", async () => {
  Compressor.mockImplementation((file, options) => {
    const copy = new Blob(["menor"], { type: "image/jpeg" });
    copy.name = "print.jpg";
    options.success(copy);
  });
  const post = jest.fn().mockResolvedValue({});
  const original = new File(["x".repeat(500)], "print.png", {
    type: "image/png"
  });

  await sendMediasInOrder([original], post);

  expect(Compressor).toHaveBeenCalledWith(
    original,
    expect.objectContaining({ quality: 0.7 })
  );
  const [file] = post.mock.calls[0][0].getAll("medias");
  expect(file.name).toBe("print.jpg");
  expect(file.size).toBe(5);
  expect(post.mock.calls[0][0].get("body")).toBe("print.jpg");
});

test("an image the browser cannot compress goes as it is", async () => {
  Compressor.mockImplementation((file, options) =>
    options.error(new Error("Failed to load the image."))
  );
  const post = jest.fn().mockResolvedValue({});
  const heic = new File(["foto do iphone"], "IMG_0001.heic", {
    type: "image/heic"
  });

  const result = await sendMediasInOrder([heic, pdf("guia.pdf")], post);

  const [file] = post.mock.calls[0][0].getAll("medias");
  expect(file.name).toBe("IMG_0001.heic");
  expect(file.size).toBe(heic.size);
  expect(result.sent).toBe(2);
});

test("documents are not compressed", async () => {
  const post = jest.fn().mockResolvedValue({});

  await sendMediasInOrder([pdf("guia.pdf")], post);

  expect(Compressor).not.toHaveBeenCalled();
});

test("the first failure stops the list and gives back what was not sent", async () => {
  compressAfter({});
  const failure = new Error("Request failed with status code 400");
  const post = jest
    .fn()
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce(failure);
  const files = [pdf("a.pdf"), image("b.jpg"), image("c.jpg")];

  const result = await sendMediasInOrder(files, post);

  expect(sentBy(post).map(request => request.medias)).toEqual([
    ["a.pdf"],
    ["b.jpg"]
  ]);
  expect(result.sent).toBe(1);
  expect(result.pending).toEqual([files[1], files[2]]);
  expect(result.error).toBe(failure);
  // the file after the failure was not even prepared
  expect(Compressor).toHaveBeenCalledTimes(1);
});

test("progress covers the whole list, not only the file on its way", async () => {
  const seen = [];
  const post = jest.fn(async (_formData, onProgress) => {
    onProgress(0.5);
    onProgress(1);
  });

  await sendMediasInOrder(
    [pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf"), pdf("d.pdf")],
    post,
    fraction => seen.push(fraction)
  );

  expect(seen).toEqual([0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]);
});
