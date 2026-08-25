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
  title: "msafiri — Mombasa Terminus",
  description: "Book a cab to or from the Mombasa SGR Terminus. msafiri connects passengers with shared and private cab services along the Kenya coast.",
  keywords: ["msafiri", "SGR", "Mombasa", "Cab", "Kenya", "Transport", "Kenya Coast"],
  authors: [{ name: "msafiri" }],
  icons: {
    icon: "/msafiri-logo.png",
    apple: "/msafiri-logo.png",
  },
  openGraph: {
    title: "msafiri — Mombasa Terminus",
    description: "Book a cab to or from the SGR terminus. Shared rides, private charters, Kenya coast.",
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
