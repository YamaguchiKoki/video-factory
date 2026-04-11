import type { Mastra } from "@mastra/core/mastra";
import { Effect } from "effect";
import type { CommentGenerationError } from "../generators/comment";
import { generateComment } from "../generators/comment";
import type { DescriptionGenerationError } from "../generators/description";
import { generateDescription } from "../generators/description";
import type { ThumbnailGenerationError } from "../generators/thumbnail";
import { generateThumbnail } from "../generators/thumbnail";
import type { MetadataOutput, Script } from "../schema";

type GenerationError =
  | ThumbnailGenerationError
  | DescriptionGenerationError
  | CommentGenerationError;

export const generateMetadata = (
  script: Script,
  mastra: Mastra,
): Effect.Effect<MetadataOutput, GenerationError> =>
  Effect.all(
    [
      generateThumbnail(script),
      generateDescription(script, mastra),
      generateComment(script, mastra),
    ],
    { concurrency: 3 },
  ).pipe(
    Effect.map(([thumbnail, description, comment]) => ({
      thumbnail,
      description,
      comment,
    })),
  );
