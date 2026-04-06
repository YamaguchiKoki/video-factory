import { z } from "zod";

export const WorkflowInputSchema = z.object({
  genre: z.string().describe("e.g. 政治経済"),
});
export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;

export const TopicSchema = z.object({
  id: z.enum(["news-1", "news-2", "news-3"]),
  title: z.string(),
  summary: z.string(),
  sourceUrls: z.array(z.string().url()).optional(),
});
export type Topic = z.infer<typeof TopicSchema>;

export const TopicsOutputSchema = z.array(TopicSchema).length(3);
