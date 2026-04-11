import { Schema } from "effect";
import type { Script } from "../schema";
import { CommentResultSchema } from "../schema";
import { createTextGenerator } from "./create-text-generator";

export const COMMENT_AGENT_ID = "comment-agent";

// ============================================
// Error type
// ============================================

export class CommentGenerationError extends Schema.TaggedErrorClass<CommentGenerationError>()(
  "CommentGenerationError",
  { message: Schema.String },
) {}

// ============================================
// Public function
// ============================================

export const generateComment = createTextGenerator({
  agentId: COMMENT_AGENT_ID,
  schema: CommentResultSchema,
  createError: (message) => new CommentGenerationError({ message }),
  buildPrompt: buildCommentPrompt,
});

// ============================================
// Helpers
// ============================================

function buildCommentPrompt(script: Script): string {
  const newsTitles = script.newsItems.map((item) => item.title).join("\n- ");
  return `以下のラジオ番組スクリプトに基づいて、YouTube動画のコメント欄に投稿する固定コメントを生成してください。

タイトル: ${script.title}
取り上げるニュース:
- ${newsTitles}

視聴者への感謝と、番組内容に関する感想・コメントを促す自然な文章を作成してください。気になったニュースに触れて視聴者の関心を引き出すようにしてください。`;
}
