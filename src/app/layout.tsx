import type { Metadata } from "next";
import { Bangers, Comic_Neue, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bangers = Bangers({
  weight: "400",
  variable: "--font-bangers",
  subsets: ["latin"],
});

const comicNeue = Comic_Neue({
  weight: ["400", "700"],
  variable: "--font-comic-neue",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Party Games - MAX GOOFY EDITION",
  description: "Des jeux complètement déjantés !",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} ${bangers.variable} ${comicNeue.variable}`}>
      <body
        className="antialiased selection:bg-pink-500 selection:text-white"
      >
        <div className="min-h-screen overflow-x-hidden">
            {children}
        </div>
      </body>
    </html>
  );
}