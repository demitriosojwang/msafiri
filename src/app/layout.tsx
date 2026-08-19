import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SGR Feeder — Mombasa Terminus",
  description: "Book a seat in a cab heading to or from the SGR Mombasa Terminus. Converts the informal 'wait until full' stage mechanic into digital fill-up, with reverse-engineered trip timing.",
  keywords: ["SGR", "Mombasa", "Feeder", "Cab", "Kenya", "Transport"],
  authors: [{ name: "SGR Feeder Prototype" }],
  openGraph: {
    title: "SGR Feeder — Mombasa Terminus",
    description: "Book a cab to/from the SGR terminus. Digital fill-up, reverse-engineered leave times.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
