import "./index.css";
import { type CalculateMetadataFunction, Composition } from "remotion";
import { z } from "zod";
import { VideoComposition } from "./components/VideoComposition";
import type { ParsedScript, Speaker } from "./core/script-types";
import { parsedScriptSchema } from "./core/script-types";
import { loadMockScript } from "./lib/load-mock-script";

// VideoComposition props type
type VideoCompositionProps = {
  script: ParsedScript;
  audioPath: string;
  speakers: Speaker[];
};

// Calculate metadata to load mock script dynamically
const calculateVideoMetadata: CalculateMetadataFunction<
  VideoCompositionProps
> = async () => {
  const script = await loadMockScript();

  const fps = 30;
  const durationInFrames = Math.ceil(script.metadata.durationSeconds * fps);

  return {
    durationInFrames,
    props: {
      script,
      audioPath: "audio.wav",
      speakers: script.speakers,
    },
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* VideoComposition for radio video generation */}
      <Composition
        id="VideoComposition"
        // biome-ignore lint/suspicious/noExplicitAny: Remotion Composition requires cast for dynamic schema-validated props
        component={VideoComposition as any}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        schema={z.object({
          script: parsedScriptSchema,
          audioPath: z.string(),
          speakers: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              role: z.enum(["agent", "questioner"]),
              avatarPath: z.string(),
              voiceId: z.string().optional(),
            }),
          ),
        })}
        calculateMetadata={calculateVideoMetadata}
        defaultProps={{
          script: {
            metadata: {
              title: "Loading...",
              createdAt: "2026-02-09T09:00:00.000Z",
              durationSeconds: 120,
            },
            speakers: [],
            segments: [],
          },
          audioPath: "audio.wav",
          speakers: [],
        }}
      />
    </>
  );
};
