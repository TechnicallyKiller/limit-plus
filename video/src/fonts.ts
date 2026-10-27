import { loadFont as loadArchivo } from "@remotion/google-fonts/Archivo";
import { loadFont as loadMono } from "@remotion/google-fonts/MartianMono";

export const archivo = loadArchivo("normal", { weights: ["400", "600", "900"], subsets: ["latin"] });
export const martian = loadMono("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
