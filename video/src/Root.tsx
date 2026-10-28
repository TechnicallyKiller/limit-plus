import { Composition } from "remotion";
import "./fonts";
import { Pitch } from "./Pitch";
import { FireTest } from "./FireTest";
import { Intro } from "./Intro";
import { Intro2 } from "./Intro2";
import { FPS, sec } from "./tokens";

export const RemotionRoot = () => (
  <>
    <Composition id="Pitch" component={Pitch} durationInFrames={sec(60)} fps={FPS} width={1080} height={1350} defaultProps={{ w: 1080, h: 1350 }} />
    <Composition id="Pitch16" component={Pitch} durationInFrames={sec(60)} fps={FPS} width={1920} height={1080} defaultProps={{ w: 1920, h: 1080 }} />
    <Composition id="Intro" component={Intro} durationInFrames={1800} fps={FPS} width={1080} height={1350} defaultProps={{ w: 1080, h: 1350 }} />
    <Composition id="Intro2" component={Intro2} durationInFrames={1740} fps={FPS} width={1080} height={1350} defaultProps={{ w: 1080, h: 1350 }} />
    <Composition id="FireTest" component={FireTest} durationInFrames={90} fps={FPS} width={1080} height={1350} defaultProps={{ w: 1080, h: 1350 }} />
  </>
);
