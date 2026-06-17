import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "TradeScore — The Trust Layer for African Commerce",
  description:
    "Reputation infrastructure that turns informal trust signals into structured, portable, verifiable reputation for African businesses.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "TradeScore", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1f9d57",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
