import type React from "react";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, VT323 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { VimProvider } from "@/components/providers/vim-provider";

const display = VT323({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "AI Vim Golf Arena",
  description:
    "Watch AI models compete to solve Vim Golf challenges with the fewest keystrokes",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#18181b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script src="/coi-serviceworker.js" async></script>
      </head>
      <body
        className={`${body.variable} ${display.variable} ${mono.variable} font-sans antialiased bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground`}
        suppressHydrationWarning
      >
        <VimProvider>{children}</VimProvider>
        <Analytics />
      </body>
    </html>
  );
}
