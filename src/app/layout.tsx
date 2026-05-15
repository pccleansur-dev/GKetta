import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sistema Kettal",
  description: "Panel interno para clientes, cuentas corrientes, pedidos, ventas y caja.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-[var(--background)] font-[family-name:var(--font-sans)] text-[var(--text-primary)] antialiased">
        {children}
      </body>
    </html>
  );
}
