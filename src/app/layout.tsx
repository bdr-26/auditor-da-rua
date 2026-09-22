import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { APP_NAME } from "@/lib/constants";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Auditoria multilojas do grupo Burger da Rua",
  manifest: "/manifest.webmanifest",
  applicationName: APP_NAME,
  appleWebApp: { capable: true, statusBarStyle: "default", title: APP_NAME, startupImage: ["/icons/icon-1024.png"] },
  formatDetection: { telephone: false },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png", shortcut: "/icons/icon-192.png" },
  other: { "mobile-web-app-capable": "yes", "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body style={{ fontFamily: "var(--font-inter), var(--font-sans)" }}>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
