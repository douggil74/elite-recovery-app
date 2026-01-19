import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Elite Recovery of Louisiana | Professional Fugitive Recovery",
  description: "Licensed bail enforcement and fugitive recovery services in Louisiana. We combine human intelligence with AI-powered analysis to locate and recover fugitives.",
  keywords: ["bail enforcement", "fugitive recovery", "Louisiana", "bail bonds", "skip tracing"],
  authors: [{ name: "Elite Recovery of Louisiana" }],
  openGraph: {
    title: "Elite Recovery of Louisiana",
    description: "We find those who don't want to be found. Professional fugitive recovery combining human intelligence with AI-powered analysis.",
    type: "website",
    locale: "en_US",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-black`}>
        {children}
      </body>
    </html>
  );
}
