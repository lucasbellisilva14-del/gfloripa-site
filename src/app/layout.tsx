import type { Metadata } from "next";
import ChatWidget from "@/components/ChatWidget";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.nagamboaimoveis.com.br"),
  title: "Nagamboa Imóveis | Garopaba e Praia da Gamboa",
  description: "Casas frente-mar, apartamentos com vista e terrenos à beira da Gamboa. Encontre seu refúgio em Garopaba, SC.",
  openGraph: {
    type: "website",
    siteName: "Nagamboa Imóveis",
    locale: "pt_BR",
    title: "Nagamboa Imóveis | Garopaba e Praia da Gamboa",
    description: "Casas frente-mar, apartamentos com vista e terrenos à beira da Gamboa. Encontre seu refúgio em Garopaba, SC.",
    url: "/",
  },
};

const realEstateAgentJsonLd = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  name: "Nagamboa Imóveis",
  url: "https://www.nagamboaimoveis.com.br",
  areaServed: [
    { "@type": "City", name: "Garopaba" },
    { "@type": "Place", name: "Praia da Gamboa" },
  ],
  address: {
    "@type": "PostalAddress",
    addressLocality: "Garopaba",
    addressRegion: "SC",
    addressCountry: "BR",
  },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(realEstateAgentJsonLd) }}
        />
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
