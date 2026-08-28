import { fc, it } from "@fast-check/vitest";
import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, vi } from "vitest";
import {
  __testing,
  composeThumbnail,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_WIDTH,
} from "./compose";

const { wrap, truncate } = __testing;

const PNG_SIGNATURE = "89504e470d0a1a0a";

// 行頭禁則の対象文字（compose.ts の LINE_START_FORBIDDEN_CHARS と同じ集合）。
// テスト側で「行頭に来ていないこと」を検証するために持つ。
const FORBIDDEN_AT_LINE_START = new Set(
  "、。，．・：；？！゛゜ヽヾゝゞ々ー）］｝〉》」』】〕ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ％",
);

// 単純な等幅の測定関数。1文字=1単位として扱うため、実フォント/canvasに依存せず
// wrap の折り返しロジックだけを高速・決定的にテストできる。
const unitMeasure = (text: string): number => Array.from(text).length;

// UTF-16のロー/ハイサロゲートが対になっていない（壊れている）ことを検出する。
const hasLoneSurrogate = (text: string): boolean =>
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(
    text,
  );

// テスト用のダミー背景。実際の Bedrock 出力と同じ 2016x1152 で作る。
const buildBackground = (): Buffer => {
  const canvas = createCanvas(2016, 1152);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#14324f";
  ctx.fillRect(0, 0, 2016, 1152);
  return canvas.toBuffer("image/png");
};

const readSize = (png: Buffer): { width: number; height: number } => ({
  width: png.readUInt32BE(16),
  height: png.readUInt32BE(20),
});

describe("composeThumbnail", () => {
  it("should produce a 1280x720 PNG", async () => {
    // Act
    const png = await composeThumbnail({
      background: buildBackground(),
      title: "高市政権、食料品の消費税率を1%に引き下げ",
      date: "2026年8月26日",
    });

    // Assert
    expect(png.subarray(0, 8).toString("hex")).toBe(PNG_SIGNATURE);
    expect(readSize(png)).toEqual({
      width: THUMBNAIL_WIDTH,
      height: THUMBNAIL_HEIGHT,
    });
  });

  it("should handle an extremely long title without throwing", async () => {
    // Arrange
    const title = "長いタイトル".repeat(50);

    // Act
    const png = await composeThumbnail({
      background: buildBackground(),
      title,
      date: "2026年8月26日",
    });

    // Assert
    expect(readSize(png)).toEqual({
      width: THUMBNAIL_WIDTH,
      height: THUMBNAIL_HEIGHT,
    });
  });

  it.prop([fc.string()])(
    "should always produce a valid 1280x720 PNG for any title",
    async (title) => {
      // Act
      const png = await composeThumbnail({
        background: buildBackground(),
        title,
        date: "2026年8月26日",
      });

      // Assert — どんな文字列でも例外を投げず、寸法が変わらないことが不変条件
      expect(png.subarray(0, 8).toString("hex")).toBe(PNG_SIGNATURE);
      expect(readSize(png)).toEqual({
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_HEIGHT,
      });
    },
    // 実際にcanvasへレンダリングするため1回あたり数十msかかり、既定100回実行だと
    // vitestのデフォルト5000msタイムアウトを超える。実処理コストによる正当な遅さ。
    20000,
  );
});

describe("wrap (行頭禁則)", () => {
  it("should not let a line start with 、 even when it would naturally wrap there", () => {
    // Arrange — 「あ」5文字ちょうどで折り返す幅に設定し、6文字目に禁則文字「、」を置く。
    // 禁則処理が無ければ「、」だけが2行目の先頭に来てしまう。
    const maxWidth = 5;
    const title = `${"あ".repeat(5)}、${"あ".repeat(5)}`;

    // Act
    const lines = wrap(unitMeasure, title, maxWidth);

    // Assert
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(FORBIDDEN_AT_LINE_START.has(line.at(0) ?? "")).toBe(false);
    }
    // ぶら下げにより1行目の末尾に「、」が付いていること。
    expect(lines[0]?.endsWith("、")).toBe(true);
  });

  // fc.string() のデフォルト文字集合はほぼASCIIで、日本語の禁則文字を
  // 実質的に生成しない（2000サンプルで0件を確認済み）。それでは禁則ロジックを
  // 検証できないため、禁則文字を高確率で含む専用のアルファベットを使う。
  const kinsokuProneCharArb = fc.constantFrom(
    ...Array.from(FORBIDDEN_AT_LINE_START),
    "あ",
    "い",
    "う",
    "漢",
    "字",
    "A",
    "1",
    " ",
    "\n",
  );
  const kinsokuProneTitleArb = fc.string({ unit: kinsokuProneCharArb });

  // unitMeasure(1文字=1単位)を使うため canvas を経由せず、100回実行でも
  // ミリ秒オーダーで終わる。タイムアウト延長は不要。
  it.prop([kinsokuProneTitleArb])(
    "should never produce a line starting with a forbidden character " +
      "(except a lone forbidden char with no preceding non-empty line to hang onto)",
    (title) => {
      // Act
      const lines = wrap(unitMeasure, title, 5);

      // Assert
      lines.forEach((line, index) => {
        const first = line.at(0) ?? "";
        if (!FORBIDDEN_AT_LINE_START.has(first)) return;

        // 許容される唯一の例外: 直前に「ぶら下げ先」となる空でない行が無いケース
        // （タイトル冒頭が禁則文字、または直前行が空文字列だった場合）。
        const previous = lines[index - 1];
        expect(previous === undefined || previous === "").toBe(true);
      });
    },
  );
});

describe("truncate (コードポイント安全な切り詰め)", () => {
  it("should not leave a lone surrogate when truncating at an astral character boundary", () => {
    // Arrange — 2行目の末尾が絵文字（サロゲートペア）になるようにする。
    const lines = ["line0", "line1💥", "line2"];

    // Act
    const result = truncate(lines, 2);

    // Assert — 絵文字はコードポイント単位で丸ごと落ち、壊れたサロゲートは残らない。
    expect(result).toEqual(["line0", "line1…"]);
    for (const line of result) {
      expect(hasLoneSurrogate(line)).toBe(false);
    }
  });
});

describe("font registration guard", () => {
  it("should throw loudly when the font file cannot be resolved, instead of silently falling back", async () => {
    // Arrange — registerFromPath は不正パスでも例外を投げず null を返すだけなので、
    // モジュール初期化時にそれを確認して throw するガードが効いているか、
    // 実際に存在しないパスを LAMBDA_TASK_ROOT として与えて再読み込みで検証する。
    vi.resetModules();
    vi.stubEnv(
      "LAMBDA_TASK_ROOT",
      "/nonexistent-lambda-task-root-for-test-xyz",
    );

    try {
      // Act & Assert
      await expect(import("./compose")).rejects.toThrow(
        /Failed to register font "NotoSansJP" from/,
      );
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
