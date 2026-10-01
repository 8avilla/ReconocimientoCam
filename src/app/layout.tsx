import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthSessionProvider } from "@/components/layout/AuthSessionProvider";
import { ChampionshipProvider } from "@/components/layout/ChampionshipContext";
import { RoleProvider } from "@/components/layout/RoleContext";
import { ServiceWorkerRegister } from "@/components/layout/ServiceWorkerRegister";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Super Torneos",
  description: "Plataforma de gestión de torneos, partidos y verificación de jugadores.",
};

export const viewport: Viewport = {
  themeColor: "#0a3fb5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        <ServiceWorkerRegister />
        <AuthSessionProvider>
          <ToastProvider>
            <ChampionshipProvider>
              <RoleProvider>
                <AppShell>{children}</AppShell>
              </RoleProvider>
            </ChampionshipProvider>
          </ToastProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
