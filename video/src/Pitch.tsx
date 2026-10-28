import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Act0 } from "./Act0";
import { Act1 } from "./Act1";
import { Act2 } from "./Act2";
import { Act3, Act4, Coda } from "./Act3";
import { Caption } from "./parts";
import { C, sec } from "./tokens";

const CAPTIONS = [
  { from: 4.2, to: 7.0, text: "Every limit order is someone waiting." },
  { from: 7.0, to: 8.9, text: "For free." },
  { from: 11.2, to: 14.2, text: "What if waiting paid?" },
  { from: 18.0, to: 25.6, text: "Name your price. Market makers pay for your patience." },
  { from: 26.0, to: 30.4, text: "They bid in secret." },
  { from: 31.2, to: 35.9, text: "The auction ends at a moment no one can predict." },
  { from: 40.2, to: 44.4, text: "Friday's official close decides." },
  { from: 44.5, to: 48.6, text: "Stock at your price. Or your money back." },
  { from: 49.0, to: 52.4, text: "Either way, you already got paid." },
];

export const Pitch: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const abs = useCurrentFrame() / 30;
  return (
    <AbsoluteFill style={{ background: C.obsidian0 }}>
      <Audio src={staticFile("sfx.wav")} />
      <Sequence from={0} durationInFrames={sec(9)}><Act0 w={w} h={h} /></Sequence>
      <Sequence from={sec(9)} durationInFrames={sec(6)}><Act1 w={w} h={h} /></Sequence>
      <Sequence from={sec(15)} durationInFrames={sec(22)}><Act2 w={w} h={h} /></Sequence>
      <Sequence from={sec(37)} durationInFrames={sec(3)}><Act3 w={w} h={h} /></Sequence>
      <Sequence from={sec(40)} durationInFrames={sec(11)}><Act4 w={w} h={h} /></Sequence>
      <Sequence from={sec(51)} durationInFrames={sec(9)}><Coda w={w} h={h} /></Sequence>
      <Caption lines={CAPTIONS} abs={abs} />
    </AbsoluteFill>
  );
};
