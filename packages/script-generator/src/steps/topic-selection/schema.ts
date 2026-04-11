import {
  type ScriptGeneratorInput as WorkflowInput,
  ScriptGeneratorInputSchema as WorkflowInputSchema,
} from "@video-factory/shared";
import { z } from "zod";

export { type WorkflowInput, WorkflowInputSchema };

export const TopicSchema = z.object({
  id: z.string().describe("news-1, news-2, or news-3"),
  title: z.string(),
  summary: z.string(),
  sourceUrls: z.array(z.string().url()).optional(),
});
export type Topic = z.infer<typeof TopicSchema>;

export const TopicsOutputSchema = z.array(TopicSchema).length(3);
