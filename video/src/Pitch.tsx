import { AbsoluteFill, Sequence } from "remotion";
import { Act0 } from "./Act0";
import { C, sans, sec } from "./tokens";

/** Acts are added one at a time. Until an act exists, its slot is a plain black frame with its name. */
const Todo: React.FC<{ name: string }> = ({ name }) => (
  <AbsoluteFill style={{ background: C.obsidian0, alignItems: "center", justifyContent: "center", color: C.boneFaint, fontFamily: sans, fontSize: 28 }}>{name}</AbsoluteFill>
);

export const Pitch: React.FC<{ w: number; h: number }> = ({ w, h }) => (
  <AbsoluteFill style={{ background: C.obsidian0 }}>
    <Sequence from={0} durationInFrames={sec(9)}><Act0 w={w} h={h} /></Sequence>
    <Sequence from={sec(9)} durationInFrames={sec(6)}><Todo name="The hole and the title" /></Sequence>
    <Sequence from={sec(15)} durationInFrames={sec(22)}><Todo name="The descent" /></Sequence>
    <Sequence from={sec(37)} durationInFrames={sec(3)}><Todo name="The kick" /></Sequence>
    <Sequence from={sec(40)} durationInFrames={sec(11)}><Todo name="The totem" /></Sequence>
    <Sequence from={sec(51)} durationInFrames={sec(9)}><Todo name="Coda" /></Sequence>
  </AbsoluteFill>
);
