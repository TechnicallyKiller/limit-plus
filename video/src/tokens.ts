/** Same tokens as app/styles/tokens.css. The film only uses these. */
export const C = {
  obsidian0: "#07070A", obsidian1: "#0E0E13", obsidian2: "#15151C", obsidian3: "#23232D",
  bone: "#EDE8DD", boneDim: "#A39E94", boneFaint: "#6B675F",
  flame: "#FF5B22", amber: "#FFB547", volt: "#C8F53C", iris: "#9C7CFF", up: "#3DDC97",
};
export const FPS = 30;
export const sec = (s: number) => Math.round(s * FPS);
export const mono = `'Martian Mono', ui-monospace, monospace`;
export const sans = `Archivo, system-ui, sans-serif`;
