import type { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { Cause, Effect, type Exit, Option } from "effect";
import { describe, expect, it, vi } from "vitest";
import { generateBackgroundImage } from "./bedrock-image";

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

const buildResponse = (payload: unknown) => ({
  body: new TextEncoder().encode(JSON.stringify(payload)),
});

const buildClient = (send: ReturnType<typeof vi.fn>) => ({ send }) as never;

describe("generateBackgroundImage", () => {
  it("should return the base64 image on success", async () => {
    // Arrange
    const send = vi
      .fn()
      .mockResolvedValue(
        buildResponse({ seeds: [1], finish_reasons: [null], images: ["QUJD"] }),
      );

    // Act
    const result = await Effect.runPromise(
      generateBackgroundImage(buildClient(send))("a prompt"),
    );

    // Assert
    expect(result).toBe("QUJD");
  });

  it("should send the stability request shape", async () => {
    // Arrange
    const send = vi
      .fn()
      .mockResolvedValue(
        buildResponse({ seeds: [1], finish_reasons: [null], images: ["QUJD"] }),
      );

    // Act
    await Effect.runPromise(
      generateBackgroundImage(buildClient(send))("a prompt"),
    );

    // Assert
    expect(send).toHaveBeenCalledTimes(1);
    const [[command]] = send.mock.calls as [[InvokeModelCommand]];
    expect(command.input.modelId).toBe("stability.stable-image-core-v1:1");

    const decodedBody = JSON.parse(
      new TextDecoder().decode(command.input.body as Uint8Array),
    );
    expect(decodedBody).toEqual({
      prompt: "a prompt",
      mode: "text-to-image",
      aspect_ratio: "16:9",
      output_format: "png",
    });
  });

  it("should fail when the content filter rejects the prompt", async () => {
    // Arrange
    const send = vi.fn().mockResolvedValue(
      buildResponse({
        seeds: [1],
        finish_reasons: ["CONTENT_FILTERED"],
        images: ["QUJD"],
      }),
    );

    // Act
    const exit = await Effect.runPromiseExit(
      generateBackgroundImage(buildClient(send))("a prompt"),
    );

    // Assert
    expectTypedFailureMessage(exit, "rejected");
  });

  it("should fail when no image is returned", async () => {
    // Arrange
    const send = vi
      .fn()
      .mockResolvedValue(
        buildResponse({ seeds: [1], finish_reasons: [null], images: [] }),
      );

    // Act
    const exit = await Effect.runPromiseExit(
      generateBackgroundImage(buildClient(send))("a prompt"),
    );

    // Assert
    expectTypedFailureMessage(exit, "No image returned");
  });

  it("should fail when the client throws", async () => {
    // Arrange
    const send = vi.fn().mockRejectedValue(new Error("AccessDeniedException"));

    // Act
    const exit = await Effect.runPromiseExit(
      generateBackgroundImage(buildClient(send))("a prompt"),
    );

    // Assert
    expectTypedFailureMessage(exit, "AccessDeniedException");
  });
});
