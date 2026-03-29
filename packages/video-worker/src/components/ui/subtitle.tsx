import type React from "react";
import { Img, staticFile } from "remotion";

type SubtitleBackgroundProps = {
  text: string;
  fontSize?: number;
  bottom?: number;
  className?: string;
  leftImage?: string;
  rightImage?: string;
  imageHeight?: number;
};

export const SubtitleBackground: React.FC<SubtitleBackgroundProps> = ({
  text,
  fontSize = 48,
  bottom = 80,
  className,
  leftImage,
  rightImage,
  imageHeight = 180,
}) => {
  return (
    <div
      className="absolute left-0 right-0 flex justify-center z-10"
      style={{ bottom }}
    >
      {/* 左側のキャラクター画像 */}
      {leftImage && (
        <Img
          src={staticFile(leftImage)}
          style={{
            position: "absolute",
            left: "5%",
            top: "50%",
            transform: "translateY(-50%)",
            height: imageHeight,
            width: "auto",
            objectFit: "contain",
            zIndex: 20,
          }}
        />
      )}

      {/* 字幕ボックス */}
      <div
        className={`w-[90%] h-[280px] flex items-center justify-center bg-black/35 backdrop-blur-[16px] backdrop-saturate-[180%] border border-white/[0.08] rounded-xl px-8 shadow-[0_8px_32px_rgba(0,0,0,0.24)] ${className ?? ""}`}
        style={{ zIndex: 10 }}
      >
        <span
          className="text-white font-semibold text-center whitespace-pre-wrap break-keep tracking-[0.02em] leading-[1.4]"
          style={{
            fontSize,
            fontFamily: "'Inter', 'Noto Sans JP', 'Hiragino Sans', sans-serif",
            textShadow: "0 1px 4px rgba(0, 0, 0, 0.7)",
          }}
        >
          {text}
        </span>
      </div>

      {/* 右側のキャラクター画像 */}
      {rightImage && (
        <Img
          src={staticFile(rightImage)}
          style={{
            position: "absolute",
            right: "5%",
            top: "50%",
            transform: "translateY(-50%)",
            height: imageHeight,
            width: "auto",
            objectFit: "contain",
            zIndex: 20,
          }}
        />
      )}
    </div>
  );
};

export default SubtitleBackground;
