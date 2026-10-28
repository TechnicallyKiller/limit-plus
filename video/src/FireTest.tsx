import { AbsoluteFill } from "remotion";
import { Fire } from "./Fire";
import { C } from "./tokens";
export const FireTest: React.FC<{ w: number; h: number }> = ({ w, h }) => (
  <AbsoluteFill style={{ background: C.obsidian0 }}>
    <Fire w={w} h={h} sources={[{ x: w / 2, y: h * 0.72 }]} height={h * 0.55} spread={h * 0.07} intensity={1} />
    <Fire w={w} h={h} sources={Array.from({ length: 14 }, (_, i) => ({ x: w * 0.2 + i * 6, y: h * 0.4 }))} height={h * 0.18} spread={h * 0.025} intensity={1} seed={9} />
  </AbsoluteFill>
);
