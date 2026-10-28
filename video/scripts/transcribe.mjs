// Transcribes video/vo/1.ogg..7.ogg locally with whisper.cpp so each phrase can be matched to its script line.
// Run from the video folder:  nice -n 15 node scripts/transcribe.mjs
// Downloads whisper.cpp (GitHub) and the base.en model (Hugging Face) into /tmp/whisper.cpp, then builds it.
import { installWhisperCpp, downloadWhisperModel, transcribe } from "@remotion/install-whisper-cpp";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const to = path.resolve("/tmp/whisper.cpp");
fs.mkdirSync("/tmp/vowav", { recursive: true });
for (let i = 1; i <= 7; i++) {
  // 16 kHz mono wav is what whisper.cpp expects
  execFileSync("npx", ["remotion", "ffmpeg", "-y", "-loglevel", "error", "-i", `vo/${i}.ogg`, "-ac", "1", "-ar", "16000", `/tmp/vowav/${i}.wav`], { stdio: "inherit" });
}
await installWhisperCpp({ to, version: "1.5.5", printOutput: false });
await downloadWhisperModel({ model: "base.en", folder: to, printOutput: false });

const out = {};
for (let i = 1; i <= 7; i++) {
  const r = await transcribe({ inputPath: `/tmp/vowav/${i}.wav`, whisperPath: to, whisperCppVersion: "1.5.5", model: "base.en", tokenLevelTimestamps: false });
  out[i] = r.transcription.map((t) => ({ from: t.offsets.from / 1000, to: t.offsets.to / 1000, text: t.text.trim() }));
  console.log(i, JSON.stringify(out[i]));
}
fs.writeFileSync("vo/transcript.json", JSON.stringify(out, null, 1));
console.log("wrote vo/transcript.json");
