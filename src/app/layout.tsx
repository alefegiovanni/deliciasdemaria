import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Delícias de Maria",
  description: "O melhor delivery da região",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Senior: Prevents auto-zoom on mobile
  viewportFit: 'cover',
};

import StoreClosedOverlay from "@/components/StoreClosedOverlay";
import GlobalNotificationSystem from "@/components/GlobalNotificationSystem";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body>
        {children}
        <StoreClosedOverlay />
        <GlobalNotificationSystem />
      </body>
    </html>
  );
}
