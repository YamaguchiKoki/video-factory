import { makeTransform, rotate, translate } from "@remotion/animation-utils";
import { LightLeak } from "@remotion/light-leaks";
import { TransitionSeries } from "@remotion/transitions";
import {
  AbsoluteFill,
  Img,
  interpolate,
  // OffthreadVideo,
  Series,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import SubtitleBackground from "./components/ui/subtitle";
export const PlayGround = () => {
  return (
    <AbsoluteFill>
      {/* AbsoluteFillはコンポーネントツリーの下に行くに連れてzIndexが大きくなる */}
      <AbsoluteFill>
        <Img src={staticFile("bg.jpeg")} />
      </AbsoluteFill>

      <Series>
        {/* from指定なしで直列 */}
        <Series.Sequence durationInFrames={80}>
          <TransitionSeries>
            {/* fromを指定しなくても直列になる */}
            <TransitionSeries.Sequence durationInFrames={60}>
              <AbsoluteFill
                style={{
                  backgroundColor: "#0b84f3",
                }}
              />
              <Title title="A" />
            </TransitionSeries.Sequence>
            <TransitionSeries.Overlay durationInFrames={20}>
              <LightLeak hueShift={180} />
            </TransitionSeries.Overlay>
            <TransitionSeries.Sequence durationInFrames={60}>
              <AbsoluteFill color="#0b84f3" />
              <Title title="B" />
            </TransitionSeries.Sequence>
          </TransitionSeries>
        </Series.Sequence>

        <Series.Sequence durationInFrames={30}>
          <Title title="Hello" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={30}>
          <Title title="World" />
        </Series.Sequence>
      </Series>

      <AbsoluteFill>
        <SubtitleBackground
          text="aaa"
          leftImage="left.png"
          rightImage="right.png"
        />
      </AbsoluteFill>

      <AbsoluteFill>{/* avatar */}</AbsoluteFill>
    </AbsoluteFill>
  );
};

const Title: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ fps, frame });
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const multiTransform = makeTransform([rotate(45), translate(50, 50)]);

  return (
    <AbsoluteFill>
      <div
        style={{
          opacity,
          textAlign: "center",
          fontSize: "7em",
          transform: `scale(${scale}) ${multiTransform}`,
        }}
      >
        {title}
      </div>
    </AbsoluteFill>
  );
};
