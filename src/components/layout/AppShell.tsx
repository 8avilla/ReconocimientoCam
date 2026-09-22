"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays, ChartColumn, ChevronDown, Eye, Gavel, Home, Lock, MoreHorizontal, Settings, Shield, SlidersHorizontal, Trophy, Users,
  type LucideIcon,
} from "lucide-react";
import { EmptyState, Modal } from "@/components/ui";
import { championshipPath, isEntityPath, parseChampionshipPath } from "@/lib/paths";
import { canAccess, ROLE_LABEL } from "@/lib/roles";
import { useChampionship } from "./ChampionshipContext";
import { ChampionshipSwitcher } from "./ChampionshipSwitcher";
import { GlobalSearch } from "./GlobalSearch";
import { useRole } from "./RoleContext";
import { RoleModal } from "./RoleSwitcher";
import styles from "./AppShell.module.css";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Detail pages (a match, a team...) that belong to this section and keep it highlighted. */
  alsoActiveFor?: string[];
  /** Shown in the phone bottom bar (the rest go behind "Más"). */
  primary?: boolean;
}

/** Sections of one championship, in the order they appear. */
function championshipItems(id: string): NavItem[] {
  return [
    { href: championshipPath(id), label: "Resumen", icon: Home, primary: true },
    { href: championshipPath(id, "partidos"), label: "Partidos", icon: CalendarDays, alsoActiveFor: ["/matches/"], primary: true },
    { href: championshipPath(id, "clasificacion"), label: "Clasificación", icon: ChartColumn, primary: true },
    { href: championshipPath(id, "equipos"), label: "Equipos", icon: Shield, alsoActiveFor: ["/teams/"], primary: true },
    { href: championshipPath(id, "jugadores"), label: "Jugadores", icon: Users, alsoActiveFor: ["/players/"] },
    { href: championshipPath(id, "sanciones"), label: "Sanciones", icon: Gavel },
    { href: championshipPath(id, "gestionar"), label: "Gestionar", icon: SlidersHorizontal, alsoActiveFor: ["/phases/"] },
  ];
}

const isActive = (pathname: string, item: NavItem) => {
  const scoped = parseChampionshipPath(item.href);
  const exact = scoped && !item.href.slice(`/c/${scoped.id}`.length);
  if (item.alsoActiveFor?.some((prefix) => pathname.startsWith(prefix))) return true;
  return exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
};

function SearchButton({ championshipId }: { championshipId: string }) {
  return <GlobalSearch championshipId={championshipId} />;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const { role } = useRole();
  const { current } = useChampionship();

  // Inside a championship (its own address, or one of its detail pages) the menu is that championship's sections.
  const routed = parseChampionshipPath(pathname);
  const scopeId = routed?.id ?? (isEntityPath(pathname) ? current?._id ?? null : null);
  const scoped = Boolean(scopeId);

  const items: NavItem[] = scopeId
    ? championshipItems(scopeId).filter((item) => canAccess(role, item.href))
    : [{ href: "/", label: "Campeonatos", icon: Trophy, primary: true }, ...(canAccess(role, "/admin") ? [{ href: "/admin", label: "Administración", icon: Settings, primary: true }] : [])];
  const bottom = items.filter((item) => item.primary);
  const more = items.filter((item) => !item.primary);
  const allowed = canAccess(role, pathname);

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Image src="/logo-wordmark.jpg" alt="Super Torneos" width={208} height={69} priority className={styles.brandLogo} />
        </div>
        {scoped && (
          <div className={styles.scopeBlock}>
            <Link href="/" className={styles.scopeBack}>← Todos los campeonatos</Link>
            <button className={styles.scopeButton} onClick={() => setSwitchOpen(true)} aria-label="Cambiar de campeonato">
              <span className={styles.scopeName}>{current?.name ?? "Campeonato"}</span>
              <span className={styles.scopeSeason}>{current ? `Temporada ${current.season}` : ""}</span>
              <ChevronDown size={16} aria-hidden />
            </button>
          </div>
        )}
        <nav className={styles.nav} aria-label={scoped ? "Campeonato" : "Principal"}>
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={`${styles.navItem} ${isActive(pathname, item) ? styles.active : ""}`}>
              <item.icon size={20} aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          {scoped && canAccess(role, "/admin") && (
            <Link href="/admin" className={styles.navItem}><Settings size={20} aria-hidden /> Administración</Link>
          )}
          <button className="btn secondary block role-menu-button" onClick={() => setRoleOpen(true)}>
            <Eye size={20} aria-hidden /> Ver como: {ROLE_LABEL[role]}
            {role !== "admin" && <span className="role-dot-inline" aria-hidden />}
          </button>
        </div>
      </aside>

      <div className={styles.viewport}>
        <header className={styles.topbar}>
          <Link href="/" aria-label="Todos los campeonatos" className={styles.topbarLogoLink}>
            <Image src="/logo-wordmark.jpg" alt="Super Torneos" width={96} height={32} priority className={styles.topbarLogo} />
          </Link>
          <div className={styles.topbarActions}>
            {scopeId && <SearchButton championshipId={scopeId} />}
            {scoped && (
              <button className={styles.scopeChip} onClick={() => setSwitchOpen(true)} aria-label="Cambiar de campeonato">
                <span className="truncate">{current?.name ?? "Campeonato"}</span>
                <ChevronDown size={16} aria-hidden />
              </button>
            )}
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
              description={`Como ${ROLE_LABEL[role].toLowerCase()} no tienes acceso a esta pantalla. Puedes cambiar de rol en «Ver como».`}
              action={<Link href={scopeId ? championshipPath(scopeId) : "/"} className="btn primary">Volver</Link>}
            />
          )}
        </main>

        <nav className={styles.bottomNav} aria-label={scoped ? "Campeonato" : "Principal"}>
          {bottom.map((item) => (
            <Link key={item.href} href={item.href} className={`${styles.bottomItem} ${isActive(pathname, item) ? styles.active : ""}`}>
              <item.icon size={24} aria-hidden /> {item.label}
            </Link>
          ))}
          <button className={`${styles.bottomItem} ${more.some((item) => isActive(pathname, item)) ? styles.active : ""}`} onClick={() => setMoreOpen(true)}>
            <MoreHorizontal size={24} aria-hidden /> Más
          </button>
        </nav>
      </div>

      <Modal open={moreOpen} title="Más opciones" onClose={() => setMoreOpen(false)}>
        <div className="stack-sm">
          {more.map((item) => (
            <Link key={item.href} href={item.href} className="btn secondary block" onClick={() => setMoreOpen(false)}>
              <item.icon size={20} aria-hidden /> {item.label}
            </Link>
          ))}
          {scoped && (
            <button className="btn secondary block" onClick={() => { setMoreOpen(false); setSwitchOpen(true); }}>
              <Trophy size={20} aria-hidden /> Cambiar de campeonato
            </button>
          )}
          {scoped && (
            <Link href="/" className="btn secondary block" onClick={() => setMoreOpen(false)}>Ver todos los campeonatos</Link>
          )}
          {scoped && canAccess(role, "/admin") && (
            <Link href="/admin" className="btn secondary block" onClick={() => setMoreOpen(false)}><Settings size={20} aria-hidden /> Administración</Link>
          )}
          <button className="btn secondary block role-menu-button" onClick={() => { setMoreOpen(false); setRoleOpen(true); }}>
            <Eye size={20} aria-hidden /> Ver como: {ROLE_LABEL[role]}
            {role !== "admin" && <span className="role-dot-inline" aria-hidden />}
          </button>
        </div>
      </Modal>

      {/* Rendered at the shell's top level (not nested in the "Más" sheet), so closing that sheet never takes this down with it. */}
      <RoleModal open={roleOpen} onClose={() => setRoleOpen(false)} />

      <ChampionshipSwitcher open={switchOpen} section={routed?.section ?? null} onClose={() => setSwitchOpen(false)} />
    </div>
  );
}
