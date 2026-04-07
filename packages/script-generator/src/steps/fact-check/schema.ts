import { z } from "zod";

export const VerifiedTopicSchema = z.object({
  id: z.string(),
  title: z.string(),
  verifiedFacts: z.array(z.string()).describe("クロスチェックで確認済みの事実"),
  reliabilityScore: z.number().min(0).max(1).describe("信頼性スコア [0, 1]"),
  contradictions: z.array(z.string()).describe("ソース間の矛盾点"),
  sourceUrls: z.array(z.string().url()),
});

export const VerifiedTopicsOutputSchema = z.array(VerifiedTopicSchema);
export type VerifiedTopicsOutput = z.infer<typeof VerifiedTopicsOutputSchema>;
