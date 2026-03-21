import { z } from "zod";

export const EnrichedTopicSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  xOpinions: z.array(z.string()).describe("X上の意見一覧"),
  detailedContext: z.string().describe("詳細な背景・コンテキスト"),
  sourceUrls: z.array(z.string().url()),
});
export type EnrichedTopic = z.infer<typeof EnrichedTopicSchema>;

export const EnrichedTopicsOutputSchema = z.array(EnrichedTopicSchema);
export type EnrichedTopicsOutput = z.infer<typeof EnrichedTopicsOutputSchema>;
