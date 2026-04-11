import { Schema } from "effect";
import type { Script } from "../schema";
import { DescriptionResultSchema } from "../schema";
import { createTextGenerator } from "./create-text-generator";

export const DESCRIPTION_AGENT_ID = "description-agent";

// ============================================
// Error type
// ============================================

export class DescriptionGenerationError extends Schema.TaggedErrorClass<DescriptionGenerationError>()(
  "DescriptionGenerationError",
  { message: Schema.String },
) {}

// ============================================
// Public function
// ============================================

export const generateDescription = createTextGenerator({
  agentId: DESCRIPTION_AGENT_ID,
  schema: DescriptionResultSchema,
  createError: (message) => new DescriptionGenerationError({ message }),
  buildPrompt: buildDescriptionPrompt,
});

// ============================================
// Helpers
// ============================================

function buildDescriptionPrompt(script: Script): string {
  const newsLines = script.newsItems
    .map((item) =>
      item.sourceUrl
        ? `- ${item.title} (出典: ${item.sourceUrl})`
        : `- ${item.title}`,
    )
    .join("\n");
  return `以下のラジオ番組スクリプトに基づいて、YouTube動画の概要欄テキストを生成してください。

タイトル: ${script.title}
取り上げるニュース:
${newsLines}

概要欄には番組の内容を簡潔に紹介し、視聴者に興味を持ってもらえるようにしてください。出典URLが含まれる場合は、概要欄の末尾に「参考リンク」セクションとして出典URLを掲載してください。`;
}
