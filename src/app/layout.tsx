import type { Metadata } from "next";
import "./globals.css";
import { PricingProvider } from "@/context/PricingContext";

export const metadata: Metadata = {
  title: "Konfigurator Garaży 3D",
  description: "Zbuduj swój własny garaż w 3D i otrzymaj wycenę online.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className="antialiased">
      <body>
        {/*
          PricingProvider owinięty tutaj — działa dla CAŁEJ aplikacji,
          zarówno dla konfiguratora (/) jak i panelu admina (/admin).
        */}
        <PricingProvider>{children}</PricingProvider>
      </body>
    </html>
  );
}
