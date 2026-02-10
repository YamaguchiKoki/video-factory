import "./index.css";
import { type CalculateMetadataFunction, Composition } from "remotion";
import { z } from "zod";
import { VideoComposition } from "./components/VideoComposition";
import type { ParsedScript, Speaker } from "./core/script-types";
import { parsedScriptSchema } from "./core/script-types";
import { HelloWorld, myCompSchema } from "./HelloWorld";
import { Logo, myCompSchema2 } from "./HelloWorld/Logo";
import { loadMockScript } from "./lib/load-mock-script";
import { PlayGround } from "./playground";

// Each <Composition> is an entry in the sidebar!

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
      <Composition
        // You can take the "id" to render a video:
        // npx remotion render HelloWorld
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        // You can override these props for each render:
        // https://www.remotion.dev/docs/parametrized-rendering
        schema={myCompSchema}
        defaultProps={{
          titleText: "Welcome to Remotion",
          titleColor: "#000000",
          logoColor1: "#91EAE4",
          logoColor2: "#86A8E7",
        }}
      />

      {/* Mount any React component to make it show up in the sidebar and work on it individually! */}
      <Composition
        id="OnlyLogo"
        component={Logo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        schema={myCompSchema2}
        defaultProps={{
          logoColor1: "#91dAE2" as const,
          logoColor2: "#86A8E7" as const,
        }}
      />

      <Composition
        id="playground"
        component={PlayGround}
        durationInFrames={100}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* VideoComposition for radio video generation */}
      <Composition
        id="VideoComposition"
        // Cast to any to bypass type checking for dynamic props
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
