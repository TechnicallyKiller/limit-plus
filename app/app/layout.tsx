import type { Metadata } from "next";
import { Archivo, Martian_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Nav from "@/components/Nav";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const martian = Martian_Mono({ subsets: ["latin"], variable: "--font-martian-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Limit+",
  description: "Name your price for a stock. Get paid while you wait.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${martian.variable}`}>
      <body>
        <Providers>
          <Nav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
