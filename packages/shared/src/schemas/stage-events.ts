import { z } from "zod";

export const ScriptGeneratorInputSchema = z
  .object({
    genre: z
      .string()
      .describe(
        "対象ジャンル（例: 政治経済 / テクノロジー）。LLMがTavily経由でニュースを検索する際の絞り込みに利用",
      ),
  })
  .describe("script-generator Lambda の起動ペイロード");
export type ScriptGeneratorInput = z.infer<typeof ScriptGeneratorInputSchema>;

export const MetadataGeneratorInputSchema = z
  .object({
    scriptKey: z
      .string()
      .min(1)
      .describe(
        "script-generator が出力した Script JSON の S3 キー（例: script-generator/script.json）",
      ),
  })
  .describe("metadata-generator Lambda の起動ペイロード");
export type MetadataGeneratorInput = z.infer<
  typeof MetadataGeneratorInputSchema
>;

export const TtsWorkerInputSchema = z
  .object({
    scriptKey: z
      .string()
      .min(1)
      .describe("音声化対象の Script JSON の S3 キー"),
  })
  .describe(
    "tts-worker (ECS Fargate) のジョブパラメータ。CLI フラグ --input-key と等価",
  );
export type TtsWorkerInput = z.infer<typeof TtsWorkerInputSchema>;
