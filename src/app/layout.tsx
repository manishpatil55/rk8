import type { Metadata } from "next";
import { JetBrains_Mono, IBM_Plex_Sans } from "next/font/google";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { CommandPalette } from "@/components/chrome/CommandPalette";
import "./globals.css";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "RK8:// — every cartridge ever mounted",
    template: "%s · RK8://",
  },
  description:
    "Browser-based retro gaming. Every classic system, playable instantly — no installs, no ads. From one gamer to another.",
  openGraph: {
    title: "RK8:// — every cartridge ever mounted",
    description:
      "Browser-based retro gaming. Every classic system, playable instantly — no installs, no ads.",
    siteName: "RK8://",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jetbrains.variable} ${plex.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <div className="rk8-ambient" aria-hidden />
        <Header />
        <main className="relative flex-1">{children}</main>
        <Footer />
        <CommandPalette />
      </body>
    </html>
  );
}
