import { createCanvas } from "@napi-rs/canvas";
import { Cause, Effect, type Exit, Option } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { Script } from "../../schema";

// ============================================
// Mock infrastructure/bedrock-image
// ============================================

const { mockGenerateBackgroundImage } = vi.hoisted(() => ({
  mockGenerateBackgroundImage: vi.fn(),
}));

vi.mock("../../infrastructure/bedrock-image", async (importActual) => {
  const actual =
    await importActual<typeof import("../../infrastructure/bedrock-image")>();
  return {
    ...actual,
    createBedrockImageClient: vi.fn().mockReturnValue({}),
    generateBackgroundImage: () => mockGenerateBackgroundImage,
  };
});

const { BedrockImageError } = await import(
  "../../infrastructure/bedrock-image"
);
const { generateThumbnail } = await import("./index");

type TestError = { readonly message: string };

// Proves the failure travelled through the typed error channel (Effect.fail),
// not an escaped exception (Effect.die). `runPromiseExit`'s `_tag: "Failure"`
// is true for both, so asserting only that would still pass if the
// implementation regressed to throwing. Cause.findErrorOption returns Some
// only when the cause contains a Fail reason; it returns None for a cause
// made only of Die (or Interrupt) reasons.
const expectTypedFailureMessage = (
  exit: Exit.Exit<unknown, TestError>,
  expectedSubstring: string,
): void => {
  expect(exit._tag).toBe("Failure");
  if (exit._tag !== "Failure") return;

  const errorOption = Cause.findErrorOption(exit.cause);
  expect(Option.isSome(errorOption)).toBe(true);
  if (!Option.isSome(errorOption)) return;

  expect(errorOption.value.message).toContain(expectedSubstring);
};

const PNG_SIGNATURE = "89504e470d0a1a0a";

const readSize = (png: Buffer): { width: number; height: number } => ({
  width: png.readUInt32BE(16),
  height: png.readUInt32BE(20),
});

// 実際の Bedrock 出力と同じ 2016x1152 の有効な PNG を base64 で作る。
const buildBackgroundBase64 = (): string => {
  const canvas = createCanvas(2016, 1152);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#14324f";
  ctx.fillRect(0, 0, 2016, 1152);
  return canvas.toBuffer("image/png").toString("base64");
};

const buildScript = (): Script =>
  ({
    title: "テストラジオ 2026年4月11日号",
    newsItems: [],
    sections: [],
  }) as unknown as Script;

describe("generateThumbnail", () => {
  it("should return a composed 1280x720 PNG on success", async () => {
    // Arrange
    mockGenerateBackgroundImage.mockReturnValue(
      Effect.succeed(buildBackgroundBase64()),
    );

    // Act
    const result = await Effect.runPromise(generateThumbnail(buildScript()));

    // Assert
    expect(result.contentType).toBe("image/png");
    const png = Buffer.from(result.imageBase64, "base64");
    expect(png.subarray(0, 8).toString("hex")).toBe(PNG_SIGNATURE);
    // compose ステップが実際に走ったこと（背景をそのまま通していないこと）の証明。
    // 背景は 2016x1152 だが、合成後は必ず 1280x720 になる。
    expect(readSize(png)).toEqual({ width: 1280, height: 720 });
  });

  it("should propagate a background generation failure", async () => {
    // Arrange
    mockGenerateBackgroundImage.mockReturnValue(
      Effect.fail(new BedrockImageError({ message: "AccessDeniedException" })),
    );

    // Act
    const exit = await Effect.runPromiseExit(generateThumbnail(buildScript()));

    // Assert — このコードベースが所有するステージ接頭辞を検証する。
    // 下層のSDKメッセージ（"AccessDeniedException"）自体には依存しない。
    // ライブラリの文言が変わっても、このプレフィックスは我々のコードが
    // 付けているのでテストは壊れない。
    expectTypedFailureMessage(exit, "Background generation failed:");
  });

  it("should propagate a compose failure when the background is not a valid image", async () => {
    // Arrange
    mockGenerateBackgroundImage.mockReturnValue(
      Effect.succeed(Buffer.from("not a real image").toString("base64")),
    );

    // Act
    const exit = await Effect.runPromiseExit(generateThumbnail(buildScript()));

    // Assert — このコードベースが所有するステージ接頭辞を検証する。
    // @napi-rs/canvas の loadImage が投げる下層メッセージ（"Unsupported image type"）
    // 自体には依存しない。バージョンアップで文言が変わってもこのテストは壊れない。
    // "Background generation failed:"（背景生成失敗テスト）とは別物であることも保証する。
    expectTypedFailureMessage(exit, "Thumbnail composition failed:");
  });
});
