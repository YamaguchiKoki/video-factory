import { describe, expect, it } from "vitest";
import { buildBackgroundPrompt } from "./background";

describe("buildBackgroundPrompt", () => {
  it("should instruct the model not to render any text", () => {
    // Act
    const prompt = buildBackgroundPrompt();

    // Assert
    expect(prompt).toContain("no text");
  });

  // buildBackgroundPrompt はタイトルを引数として受け取らないため、「日本語タイトルが
  // 画像プロンプトに漏れない」という不変条件はもはやテストではなく型シグネチャで
  // 保証されている（渡しようがない）。この関数が今後も維持すべきなのは、
  // プロンプト文字列そのものに日本語（CJK文字）を書き込まないことなので、
  // その不変条件をここで検証する。将来だれかが定数プロンプトに日本語を
  // 直接埋め込んだ場合に検知できる。
  it("should not contain any CJK characters in the prompt itself", () => {
    // Act
    const prompt = buildBackgroundPrompt();

    // Assert
    expect(prompt).not.toMatch(/[぀-ヿ㐀-鿿]/);
  });
});
