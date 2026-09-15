import type { Metadata, Viewport } from "next";
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
  title: "Mi-Reli — Reliable rides from the SGR terminus",
  description:
    "Mi-Reli shuttles SGR passengers between Mombasa Terminus (MTM) and the coast: shared-ride pickup and drop-off points across the North Coast (Bamburi, Nyali, Mtwapa, Malindi) and South Coast (Likoni, Diani) — every cab timed to a Madaraka Express departure or arrival. Pay with M-Pesa.",
  keywords: ["Mi-Reli", "Mombasa", "SGR", "Madaraka Express", "Mombasa Terminus", "feeder", "cab", "M-Pesa", "Nyali", "Bamburi", "Mtwapa", "Likoni", "Diani"],
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#166534",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
