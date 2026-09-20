import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { ChampionshipProvider } from "@/components/layout/ChampionshipContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Super Torneos - Fútbol que nos une",
  description: "Plataforma de gestión de campeonatos, partidos y verificación de jugadores.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        <ToastProvider>
          <ChampionshipProvider>
            <AppShell>{children}</AppShell>
          </ChampionshipProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
