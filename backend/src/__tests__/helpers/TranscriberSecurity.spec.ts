import OpenAI from "openai";
import { transcriber } from "../../helpers/transcriber";
import { logger } from "../../utils/logger";

const mockCreate = jest.fn();
jest.mock("openai", () =>
  jest.fn().mockImplementation(() => ({
    audio: { transcriptions: { create: mockCreate } }
  }))
);
jest.mock("fs", () => ({
  __esModule: true,
  default: { createReadStream: jest.fn().mockReturnValue({}) }
}));
jest.mock("../../helpers/mediaConversion", () => ({
  convertAudioToOggOpus: jest.fn()
}));
jest.mock("../../helpers/bufferToReadStreamTmp", () => ({
  bufferToReadStreamTmp: jest.fn()
}));
jest.mock("../../utils/logger", () => ({ logger: { error: jest.fn() } }));

describe("optional transcription credential handling", () => {
  it.each([
    ["openai", "https://api.openai.com/v1", "gpt-4o-mini-transcribe"],
    ["groq", "https://api.groq.com/openai/v1", "whisper-large-v3-turbo"]
  ])(
    "preserves the existing %s provider configuration and returns transcription",
    async (provider, baseURL, model) => {
      mockCreate.mockResolvedValue({ text: "fixture transcription" });
      const result = await transcriber(
        "fixture.ogg",
        { apiKey: "fixture-private-key-not-real", provider },
        "fixture.ogg"
      );
      expect(result).toBe("fixture transcription");
      expect(OpenAI).toHaveBeenLastCalledWith({
        apiKey: "fixture-private-key-not-real",
        baseURL
      });
      expect(mockCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({ model })
      );
    }
  );

  it("does not log provider errors that repeat submitted credentials", async () => {
    const value = "fixture-private-key-not-real";
    mockCreate.mockRejectedValue({
      message: `Invalid API key: ${value}`,
      status: 401,
      request: { headers: { authorization: value } }
    });
    expect(
      await transcriber(
        "fixture.ogg",
        { apiKey: value, provider: "openai" },
        "fixture.ogg"
      )
    ).toBeNull();
    expect(logger.error).toHaveBeenLastCalledWith(
      { provider: "openai", status: 401 },
      "Error creating transcription"
    );
    expect(
      JSON.stringify((logger.error as jest.Mock).mock.calls)
    ).not.toContain(value);
  });
});
