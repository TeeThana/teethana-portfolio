import type { Metadata } from "next";
import {
  Manrope,
  IBM_Plex_Mono,
  Newsreader,
  Noto_Sans_Thai,
} from "next/font/google";
import "@designcodeio/threeui/style.css";
import "./globals.css";
const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});
const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});
const thai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["400", "500", "600"],
  variable: "--font-thai",
  display: "swap",
});
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: "Teethana — Code, craft & a little dimension",
    template: "%s · Teethana",
  },
  description:
    "Thana Sukonthabut — DevOps Engineer & Full Stack Developer. Explore work in CI/CD, cloud platforms, web applications, and automation.",
  robots: { index: true, follow: true },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${sans.variable} ${mono.variable} ${serif.variable} ${thai.variable}`}
      >
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
