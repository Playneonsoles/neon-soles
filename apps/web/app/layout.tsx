import type { Metadata, Viewport } from "next";
import { Inter, Orbitron } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { CaBar } from "@/components/CaBar";
import { CityBackdrop } from "@/components/CityBackdrop";
import { FloatingActions } from "@/components/FloatingActions";
import { Providers } from "./providers";

const display = Orbitron({ subsets: ["latin"], variable: "--font-display", weight: ["500", "700", "900"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: { default: "Neon Soles · $WALK", template: "%s · Neon Soles" },
  description: "Walk every day, earn $WALK, upgrade your shoes.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Neon Soles", statusBarStyle: "black-translucent" },
  icons: { apple: "/icon-192.png" },
};
export const viewport: Viewport = { themeColor: "#0B0F1A", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="pb-20 font-sans antialiased">
        <CityBackdrop />
        <Providers><CaBar />{children}<FloatingActions /></Providers>
      </body>
    </html>
  );
}
