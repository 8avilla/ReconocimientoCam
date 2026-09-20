"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays, ChartColumn, ClipboardCheck, Gavel, Home, MoreHorizontal, ScanLine, Shield, Trophy, Users, Volleyball,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { QR_VERIFICATION_ENABLED } from "@/lib/features";
import { useChampionship } from "./ChampionshipContext";
import styles from "./AppShell.module.css";

interface NavItem { href: string; label: string; icon: LucideIcon }

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/championships", label: "Campeonatos", icon: Trophy },
  { href: "/teams", label: "Equipos", icon: Shield },
  { href: "/players", label: "Jugadores", icon: Users },
  { href: "/matches", label: "Partidos", icon: CalendarDays },
  { href: "/attendance", label: "Asistencia", icon: ClipboardCheck },
  { href: "/stats", label: "Estadísticas", icon: ChartColumn },
  { href: "/sanctions", label: "Sanciones", icon: Gavel },
];

const MORE_ITEMS = NAV_ITEMS.filter((item) => ["/championships", "/players", "/stats", "/sanctions"].includes(item.href));

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function ChampionshipSelect() {
  const { championships, current, setCurrentId } = useChampionship();
  if (championships.length === 0) return null;
  return (
    <select
      className={`select ${styles.championshipSelect}`}
      aria-label="Campeonato activo"
      value={current?._id ?? ""}
      onChange={(event) => setCurrentId(event.target.value)}
    >
      {championships.map((item) => (
        <option key={item._id} value={item._id}>{item.name} · {item.season}</option>
      ))}
    </select>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandLogo}><Volleyball size={24} /></span>
          <div>
            <span className={styles.brandTitle}>SUPER TORNEOS</span>
            <span className={styles.brandSubtitle}>Fútbol que nos une</span>
          </div>
        </div>
        <nav className={styles.nav} aria-label="Principal">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`${styles.navItem} ${isActive(pathname, href) ? styles.active : ""}`}>
              <Icon size={20} aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className={styles.viewport}>
        <header className={styles.topbar}>
          <span className={styles.topbarBrand}><Volleyball size={20} /> Super Torneos</span>
          <ChampionshipSelect />
        </header>
        <main className={styles.content}>{children}</main>

        <nav className={styles.bottomNav} aria-label="Principal">
          <Link href="/" className={`${styles.bottomItem} ${isActive(pathname, "/") ? styles.active : ""}`}>
            <Home size={24} aria-hidden /> Inicio
          </Link>
          <Link href="/matches" className={`${styles.bottomItem} ${isActive(pathname, "/matches") ? styles.active : ""}`}>
            <CalendarDays size={24} aria-hidden /> Partidos
          </Link>
          <Link href="/attendance" className={styles.scanButton} aria-label="Asistencia">
            {QR_VERIFICATION_ENABLED ? <ScanLine size={28} aria-hidden /> : <ClipboardCheck size={28} aria-hidden />}
          </Link>
          <Link href="/teams" className={`${styles.bottomItem} ${isActive(pathname, "/teams") ? styles.active : ""}`}>
            <Shield size={24} aria-hidden /> Equipos
          </Link>
          <button className={styles.bottomItem} onClick={() => setMoreOpen(true)}>
            <MoreHorizontal size={24} aria-hidden /> Más
          </button>
        </nav>
      </div>

      <Modal open={moreOpen} title="Más opciones" onClose={() => setMoreOpen(false)}>
        <div className="stack-sm">
          {MORE_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="btn secondary block" onClick={() => setMoreOpen(false)}>
              <Icon size={20} aria-hidden /> {label}
            </Link>
          ))}
        </div>
      </Modal>
    </div>
  );
}
