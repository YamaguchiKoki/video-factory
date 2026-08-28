import { fileURLToPath } from "node:url";
import type { SKRSContext2D } from "@napi-rs/canvas";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";

export const THUMBNAIL_WIDTH = 1280;
export const THUMBNAIL_HEIGHT = 720;

const FONT_FAMILY = "NotoSansJP";
const MAX_TITLE_LINES = 3;
const MAX_FONT_SIZE = 72;
const MIN_FONT_SIZE = 40;
const FONT_SIZE_STEP = 4;
const TITLE_MARGIN_X = 80;
const DATE_FONT_SIZE = 32;
const DATE_MARGIN = 40;

// Lambda では lambda.mjs と assets/ が LAMBDA_TASK_ROOT 直下に並ぶため、
// ソースツリーからの相対パスでは解決できない。
// ローカル（vitest / tsx）ではソースツリーから辿る。
const fontPath = process.env.LAMBDA_TASK_ROOT
  ? `${process.env.LAMBDA_TASK_ROOT}/assets/NotoSansJP.ttf`
  : fileURLToPath(new URL("../../../assets/NotoSansJP.ttf", import.meta.url));

// registerFromPath はパス不正・読み込み失敗時も例外を投げず null を返すだけなので、
// 戻り値を確認せずに無視すると「フォントが登録されていないのに成功扱いになる」
// サイレント障害になる。macOSのようにCJKフォールバックが効く環境では気づけず、
// フォントがほぼ無いLambdaのベースイメージで初めて豆腐/空白タイトルとして表面化する。
const fontKey = GlobalFonts.registerFromPath(fontPath, FONT_FAMILY);
if (fontKey === null) {
  throw new Error(`Failed to register font "${FONT_FAMILY}" from ${fontPath}`);
}

type ComposeInput = {
  readonly background: Buffer;
  readonly title: string;
  readonly date: string;
};

export const composeThumbnail = async (
  input: ComposeInput,
): Promise<Buffer> => {
  const canvas = createCanvas(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
  const ctx = canvas.getContext("2d");

  // 背景は 16:9 で返るので、切り抜き無しの等比縮小で埋まる。
  const image = await loadImage(input.background);
  ctx.drawImage(image, 0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

  // 文字のコントラストを確保する暗色オーバーレイ。
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

  const maxWidth = THUMBNAIL_WIDTH - TITLE_MARGIN_X * 2;
  const layout = fitTitle(ctx, input.title, maxWidth);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${layout.fontSize}px ${FONT_FAMILY}`;

  const lineHeight = layout.fontSize * 1.4;
  const blockHeight = lineHeight * layout.lines.length;
  const firstLineY = THUMBNAIL_HEIGHT / 2 - blockHeight / 2 + lineHeight / 2;

  layout.lines.forEach((line, index) => {
    ctx.fillText(line, THUMBNAIL_WIDTH / 2, firstLineY + lineHeight * index);
  });

  ctx.font = `${DATE_FONT_SIZE}px ${FONT_FAMILY}`;
  ctx.textAlign = "right";
  // "middle" ではなく "alphabetic" を使っている。日付は常に「YYYY年M月D日」形式
  // （漢字+数字）で、この組み合わせのディセンダは32pxで実測3px程度しかなく、
  // 40pxのDATE_MARGIN内に収まる。日付フォーマットを変える場合はこの前提を見直すこと。
  ctx.textBaseline = "alphabetic";
  ctx.fillText(
    input.date,
    THUMBNAIL_WIDTH - DATE_MARGIN,
    THUMBNAIL_HEIGHT - DATE_MARGIN,
  );

  return canvas.toBuffer("image/png");
};

// ============================================
// Helpers
// ============================================

type TitleLayout = {
  readonly fontSize: number;
  readonly lines: readonly string[];
};

// 72px から 4px 刻みで縮め、3行に収まる最大サイズを選ぶ。
// 下限まで縮めても収まらない場合は最終行を省略記号で切る。
const fitTitle = (
  ctx: SKRSContext2D,
  title: string,
  maxWidth: number,
): TitleLayout => {
  const sizes = buildSizes();

  const fitting = sizes
    .map((fontSize) => {
      ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
      // measureText は都度の ctx.font 設定に依存するため、ここでクロージャとして束縛する
      // （DIとしてカリー化: wrap 自体は canvas を知らない純粋なアルゴリズムのまま保てる）。
      const measure = (text: string) => ctx.measureText(text).width;
      return { fontSize, lines: wrap(measure, title, maxWidth) };
    })
    .find((candidate) => candidate.lines.length <= MAX_TITLE_LINES);

  if (fitting) return fitting;

  ctx.font = `bold ${MIN_FONT_SIZE}px ${FONT_FAMILY}`;
  const measure = (text: string) => ctx.measureText(text).width;
  const all = wrap(measure, title, maxWidth);
  return {
    fontSize: MIN_FONT_SIZE,
    lines: truncate(all, MAX_TITLE_LINES),
  };
};

const buildSizes = (): readonly number[] =>
  Array.from(
    {
      length: Math.floor((MAX_FONT_SIZE - MIN_FONT_SIZE) / FONT_SIZE_STEP) + 1,
    },
    (_unused, index) => MAX_FONT_SIZE - index * FONT_SIZE_STEP,
  );

type WrapState = {
  readonly completed: readonly string[];
  readonly current: string;
};

// 行頭禁則: 句読点・閉じ括弧・拗音/促音の小書き文字などは行頭に来てはならない
// （日本語組版のルール）。該当文字が行頭に来そうな時は、ぶら下げ処理として
// 直前の行の末尾にそのまま付け足し、maxWidthをわずかに超えることを許容する。
const LINE_START_FORBIDDEN_CHARS = new Set(
  "、。，．・：；？！゛゜ヽヾゝゞ々ー）］｝〉》」』】〕ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ％",
);

const isForbiddenAtLineStart = (char: string): boolean =>
  LINE_START_FORBIDDEN_CHARS.has(char);

// ぶら下げ先の行が存在し、かつ空行ではないこと（空行にぶら下げても行頭違反は解消しない）。
const canHangOnto = (completed: readonly string[]): boolean =>
  completed.length > 0 && completed[completed.length - 1] !== "";

const hangOnto = (
  completed: readonly string[],
  char: string,
): readonly string[] => [
  ...completed.slice(0, -1),
  `${completed[completed.length - 1]}${char}`,
];

// テキスト幅を測る関数を注入する（DI）。wrap 自体は canvas / SKRSContext2D を
// 一切知らない純粋な文字列アルゴリズムとして保つ。
type MeasureText = (text: string) => number;

// 日本語には単語境界が無いので1文字ずつ詰める。
// 行配列への追記は行が確定した時（改行 or 幅超過）だけ行い、
// 1文字ごとのspreadコピーを避けてO(文字数)に抑える。
//
// 注意（禁則ぶら下げの幅は無制限）: ぶら下げは幅チェック無しで行末に追加する。
// "、".repeat(N) のように禁則文字だけが連続する退化的な入力では、1行が
// maxWidth を大きく超えて伸び続け得る（fitTitle は行数しか見ないため検出できない）。
// 実際のタイトルはLLM生成の見出しであり、意味のある文が禁則文字だけで構成される
// ことは無いためこの縮退ケースは許容している。幅上限を設けるなら、ぶら下げ前に
// measure(target + char) <= maxWidth + 許容幅 を検査する形になるが、境界条件が
// 増えて上の禁則の不変条件（行頭に禁則文字が来ない）の例外条件も複雑化するため、
// 現時点ではコメントでの明示に留めている。
const wrap = (
  measure: MeasureText,
  title: string,
  maxWidth: number,
): readonly string[] => {
  const chars = Array.from(title);
  if (chars.length === 0) return [];

  const state = chars.reduce<WrapState>(
    (acc, char) => {
      if (char === "\n")
        return { completed: [...acc.completed, acc.current], current: "" };

      if (acc.current === "") {
        // 新しい行の先頭に来ようとしている文字。禁則文字ならぶら下げる（幅は見ない。上の注意参照）。
        if (isForbiddenAtLineStart(char) && canHangOnto(acc.completed))
          return { completed: hangOnto(acc.completed, char), current: "" };
        return { completed: acc.completed, current: char };
      }

      const candidate = acc.current + char;
      if (measure(candidate) <= maxWidth)
        return { completed: acc.completed, current: candidate };

      // 折り返す文字が禁則文字なら、新しい行を始めさせず今の行にぶら下げる（幅は見ない。上の注意参照）。
      if (isForbiddenAtLineStart(char))
        return {
          completed: [...acc.completed, acc.current + char],
          current: "",
        };

      return { completed: [...acc.completed, acc.current], current: char };
    },
    Object.freeze({ completed: [], current: "" }),
  );

  return [...state.completed, state.current];
};

const truncate = (
  lines: readonly string[],
  limit: number,
): readonly string[] => {
  if (lines.length <= limit) return lines;

  const kept = lines.slice(0, limit);
  const last = kept[kept.length - 1] ?? "";
  // UTF-16コード単位ではなくコードポイント単位で切る。
  // 絵文字などのサロゲートペアの境目で slice すると壊れた単独サロゲートが残る。
  const truncatedLast = Array.from(last).slice(0, -1).join("");
  return [...kept.slice(0, -1), `${truncatedLast}…`];
};

// テスト専用の再公開。composeThumbnail 以外の関数を通常の公開APIとして
// 使わせないため、wrap / truncate はモジュール内部に留め、ここでのみ露出する。
// フォールバックさせずここに含めた関数は composeThumbnail から直接テストできない
// （PNGのバイト列からは行分割や切り詰め位置を検証できないため）。
export const __testing = { wrap, truncate };
