import "./index.css";
import { Effect } from "effect";
import { Composition, staticFile } from "remotion";
import { MainComposition } from "./components/composition";
import { parseEnrichedScript } from "./core/enriched-parser";
import { VideoPropsSchema } from "./schema/schema";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Main"
      component={MainComposition}
      durationInFrames={30 * 182}
      fps={30}
      width={1920}
      height={1080}
      schema={VideoPropsSchema}
      calculateMetadata={async () => {
        const jsonContent = await fetch(staticFile("script.json")).then((r) =>
          r.text(),
        );
        const props = await Effect.runPromise(
          parseEnrichedScript(jsonContent, "audio.wav"),
        );
        return {
          durationInFrames: Math.ceil(props.totalDurationSec * 30),
          props,
        };
      }}
      defaultProps={{
        title: "",
        newsItems: [],
        totalDurationSec: 0,
        lines: [],
        sectionMarkers: [],
      }}
    />
  );
};
