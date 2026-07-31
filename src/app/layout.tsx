import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
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
  title: "Jack'in Pusulası",
  description:
    "Arkadaşlarının tam konumunu değil, sadece hangi yönde ve ne kadar uzakta olduklarını gösteren pusula.",
  appleWebApp: {
    title: "Pusula",
    statusBarStyle: "black-translucent",
    capable: true,
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  other: {
    // Eski iOS Safari sürümleri sadece bu eski etiketi tanıyor; yukarıdaki
    // appleWebApp yeni "mobile-web-app-capable" etiketini üretiyor.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0a09",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
