import { z } from "zod";

export const ThumbnailResultSchema = z
  .object({
    imageBase64: z
      .string()
      .describe(
        "Amazon Nova Canvas が生成したPNG画像のbase64エンコード済みデータ",
      ),
    contentType: z
      .literal("image/png")
      .describe("S3 アップロード時の Content-Type"),
  })
  .describe(
    "サムネイル生成結果。metadata-generator が S3 に metadata-generator/thumbnail.png として保存",
  );
export type ThumbnailResult = z.infer<typeof ThumbnailResultSchema>;

export const DescriptionResultSchema = z
  .object({
    text: z
      .string()
      .describe(
        "YouTube動画の概要欄テキスト。番組内容の紹介と参考リンクセクションを含む",
      ),
  })
  .describe(
    "概要欄生成結果。metadata-generator が S3 に metadata-generator/description.json として保存",
  );
export type DescriptionResult = z.infer<typeof DescriptionResultSchema>;

export const CommentResultSchema = z
  .object({
    text: z
      .string()
      .describe("動画公開時に投稿する固定コメント本文。視聴者の感想を促す内容"),
  })
  .describe(
    "固定コメント生成結果。metadata-generator が S3 に metadata-generator/comment.json として保存",
  );
export type CommentResult = z.infer<typeof CommentResultSchema>;

export const MetadataOutputSchema = z
  .object({
    thumbnail: ThumbnailResultSchema,
    description: DescriptionResultSchema,
    comment: CommentResultSchema,
  })
  .describe(
    "metadata-generator パイプラインの集約結果。3つの generator を Effect.all で並列実行した戻り値",
  );
export type MetadataOutput = z.infer<typeof MetadataOutputSchema>;
