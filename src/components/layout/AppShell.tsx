"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays, ChartColumn, Eye, Gavel, Home, Lock, MoreHorizontal, Settings, Shield, Trophy, Users,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useIsMobile } from "@/lib/client/useMediaQuery";
import { GlobalSearch } from "./GlobalSearch";
import { RoleSwitcher } from "./RoleSwitcher";
import { useRole } from "./RoleContext";
import { canAccess, ROLE_LABEL } from "@/lib/roles";
import { EmptyState } from "@/components/ui";
import { useChampionship } from "./ChampionshipContext";
import styles from "./AppShell.module.css";

interface NavItem { href: string; label: string; icon: LucideIcon }

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/championships", label: "Campeonatos", icon: Trophy },
  { href: "/teams", label: "Equipos", icon: Shield },
  { href: "/players", label: "Jugadores", icon: Users },
  { href: "/matches", label: "Partidos", icon: CalendarDays },
  { href: "/stats", label: "Estadísticas", icon: ChartColumn },
  { href: "/sanctions", label: "Sanciones", icon: Gavel },
  { href: "/admin", label: "Administración", icon: Settings },
];

// Phone bottom bar: the main destinations the role can open; everything else lives behind "Más".
const BOTTOM_HREFS = ["/", "/matches", "/stats", "/teams"];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function SearchButton() {
  const { current } = useChampionship();
  return current ? <GlobalSearch championshipId={current._id} /> : null;
}

function ChampionshipSelect() {
  const { championships, current, setCurrentId, favoriteIds } = useChampionship();
  const isMobile = useIsMobile();
  if (championships.length === 0) return null;
  return (
    <select
      className={`select ${styles.championshipSelect}`}
      aria-label="Campeonato activo"
      value={current?._id ?? ""}
      onChange={(event) => setCurrentId(event.target.value)}
    >
      {[...championships].sort((a, b) => Number(favoriteIds.has(b._id)) - Number(favoriteIds.has(a._id))).map((item) => (
        <option key={item._id} value={item._id}>{favoriteIds.has(item._id) ? "★ " : ""}{isMobile ? item.name : `${item.name} · ${item.season}`}</option>
      ))}
    </select>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { role } = useRole();

  const visible = NAV_ITEMS.filter((item) => canAccess(role, item.href));
  const isBottom = (item: NavItem) => BOTTOM_HREFS.includes(item.href);
  const BOTTOM_ITEMS = visible.filter(isBottom);
  const MORE_ITEMS = visible.filter((item) => !isBottom(item));
  const allowed = canAccess(role, pathname);

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Image src="/logo-wordmark.jpg" alt="Super Torneos" width={208} height={69} priority className={styles.brandLogo} />
        </div>
        <nav className={styles.nav} aria-label="Principal">
          {visible.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`${styles.navItem} ${isActive(pathname, href) ? styles.active : ""}`}>
              <Icon size={20} aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className={styles.viewport}>
        <header className={styles.topbar}>
          <Image src="/logo-wordmark.jpg" alt="Super Torneos" width={96} height={32} priority className={styles.topbarLogo} />
          <div className={styles.topbarActions}>
            <SearchButton />
            <RoleSwitcher />
            <ChampionshipSelect />
          </div>
        </header>
        <main className={styles.content}>
          {role !== "admin" && (
            <div className="role-banner" role="status">
              <Eye size={16} aria-hidden /> Viendo la app como <strong>{ROLE_LABEL[role]}</strong>
            </div>
          )}
          {allowed ? children : (
            <EmptyState
              icon={<Lock size={28} />}
              title="Esta sección no está disponible para tu rol"
              description={`Como ${ROLE_LABEL[role].toLowerCase()} no tienes acceso a esta pantalla. Cambia de rol con el ojo de la barra superior.`}
              action={<Link href="/" className="btn primary">Ir al inicio</Link>}
            />
          )}
        </main>

        <nav className={styles.bottomNav} aria-label="Principal">
          {BOTTOM_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`${styles.bottomItem} ${isActive(pathname, href) ? styles.active : ""}`}>
              <Icon size={24} aria-hidden /> {label}
            </Link>
          ))}
          <button className={`${styles.bottomItem} ${MORE_ITEMS.some((item) => isActive(pathname, item.href)) ? styles.active : ""}`} onClick={() => setMoreOpen(true)}>
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
