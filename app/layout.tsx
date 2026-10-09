import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./central-scene.css";
import "./investigation.css";
import "./fleet-atlas.css";
import "./orbita.css";
import "./operational-refinements.css";

export const metadata: Metadata = {
  title: "JARVIS — Cognitive Maintenance OS",
  description: "Investigue a frota, conecte evidências e preserve a memória técnica de cada veículo.",
  applicationName: "Jarvis",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Jarvis",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/jarvis-globe-32.png", sizes: "32x32", type: "image/png" },
      { url: "/jarvis-globe-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/jarvis-globe-32.png",
    apple: { url: "/jarvis-globe-180.png", sizes: "180x180", type: "image/png" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#040c14",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased orbit-theme">{children}</body>
    </html>
  );
}
