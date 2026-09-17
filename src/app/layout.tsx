import type { Metadata } from "next";
import { Inter, Caveat } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VideoTutor",
  description: "Pause any video. Get it explained — with diagrams.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${caveat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
