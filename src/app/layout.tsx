import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Caveat, Inter, Instrument_Serif } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { SITE } from "@/lib/site";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} · AI tutor for your lectures and homework`, template: `%s · ${SITE.name}` },
  description: SITE.tagline,
  applicationName: SITE.name,
  keywords: ["AI tutor", "lecture", "homework help", "study", "calculus", "linear algebra", "chemistry", "physics"],
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name} · AI tutor for your lectures and homework`,
    description: SITE.tagline,
    url: SITE.url,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: { card: "summary_large_image", title: SITE.name, description: SITE.tagline, images: ["/opengraph-image"] },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${caveat.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
