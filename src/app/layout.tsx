import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nagamboa Imóveis — Garopaba & Praia da Gamboa",
  description: "Casas frente-mar, apartamentos com vista e terrenos à beira da Gamboa. Encontre seu refúgio em Garopaba, SC.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Marcellus&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body style={{ background: '#0A1430', color: '#fff', fontFamily: "'Jost', sans-serif" }} className="min-h-full flex flex-col pad-b">
        {children}
      </body>
    </html>
  );
}
