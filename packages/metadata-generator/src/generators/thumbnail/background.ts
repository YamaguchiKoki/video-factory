// 拡散モデルは日本語を正しく描けないため、背景には一切の文字を出させない。
// タイトルと日付は compose.ts が canvas で描く。
// タイトルを引数として一切受け取らない設計にすることで、「画像プロンプトに
// 日本語タイトルが混入しない」という不変条件をテストではなく型シグネチャで
// 保証している（渡しようがない）。
export const buildBackgroundPrompt = (): string =>
  "abstract modern news broadcast background, deep blue and teal gradient, " +
  "geometric shapes, clean professional studio lighting, " +
  "no text, no letters, no typography, no watermark";
