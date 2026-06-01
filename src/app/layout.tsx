import type { Metadata } from "next";
import { Bangers, VT323, Geist, Geist_Mono } from "next/font/google";
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

const vt323 = VT323({
  weight: "400",
  variable: "--font-vt323",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Party OS - Neo Retro Edition",
  description: "Des jeux complètement déjantés sur Windows 98 !",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} ${bangers.variable} ${vt323.variable}`}>
      <body className="antialiased selection:bg-[#000080] selection:text-white">
        <div className="min-h-screen overflow-x-hidden">
            {children}
        </div>
      </body>
    </html>
  );
}