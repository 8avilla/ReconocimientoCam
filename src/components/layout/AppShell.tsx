"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays, ChartColumn, ChevronDown, Gavel, Home, Lock, LogIn, MoreHorizontal, Settings, Shield, SlidersHorizontal, Trophy, Users,
  type LucideIcon,
} from "lucide-react";
import { Avatar, EmptyState, Modal } from "@/components/ui";
import { championshipPath, isEntityPath, parseChampionshipPath } from "@/lib/paths";
import { canAccess } from "@/lib/roles";
import { useChampionship } from "./ChampionshipContext";
import { ChampionshipSwitcher } from "./ChampionshipSwitcher";
import { GlobalSearch } from "./GlobalSearch";
import { useRole } from "./RoleContext";
import { AccountModal } from "./RoleSwitcher";
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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { role, user, isSignedIn } = useRole();
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
          <div className="scopeBlock">
            <Link href="/" className={styles.scopeBack}>← Todos los campeonatos</Link>
            <button className={styles.scopeButton} onClick={() => setSwitchOpen(true)} aria-label="Cambiar de campeonato">
              <Trophy size={18} style={{ color: "var(--color-primary)", gridColumn: 1, gridRow: "1 / span 2" }} />
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
          <AccountButton user={user} isSignedIn={isSignedIn} onClick={() => setAccountOpen(true)} />
        </div>
      </aside>

      <div className={styles.viewport}>
        <header className={styles.topbar}>
          <Link href="/" aria-label="Todos los campeonatos" className={styles.topbarLogoLink}>
            <Image src="/logo-wordmark.jpg" alt="Super Torneos" width={96} height={32} priority className={styles.topbarLogo} />
          </Link>
          <div className={styles.topbarActions}>
            <GlobalSearch championshipId={scopeId ?? undefined} />
            {scoped && (
              <button className={styles.scopeChip} onClick={() => setSwitchOpen(true)} aria-label="Cambiar de campeonato">
                <Trophy size={14} style={{ color: "#facc15" }} />
                <span className="truncate">{current?.name ?? "Campeonato"}</span>
                <ChevronDown size={14} aria-hidden />
              </button>
            )}
          </div>
        </header>
        <main className={styles.content}>
          {allowed ? children : (
            <EmptyState
              icon={<Lock size={28} />}
              title={isSignedIn ? "Esta sección no está disponible para ti" : "Inicia sesión para ver esto"}
              description={
                isSignedIn
                  ? "No administras este campeonato, así que esta pantalla no es para ti."
                  : "Esta pantalla es para quien organiza el campeonato. Inicia sesión con Google si te invitaron a organizarlo."
              }
              action={
                isSignedIn ? (
                  <Link href={scopeId ? championshipPath(scopeId) : "/"} className="btn primary">Volver</Link>
                ) : (
                  <button className="btn primary" onClick={() => setAccountOpen(true)}><LogIn size={18} aria-hidden /> Iniciar sesión</button>
                )
              }
            />
          )}
        </main>

        <nav className={styles.bottomNav} aria-label={scoped ? "Campeonato" : "Principal"}>
          {bottom.map((item) => (
            <Link key={item.href} href={item.href} className={`${styles.bottomItem} ${isActive(pathname, item) ? styles.active : ""}`}>
              <item.icon size={22} aria-hidden /> {item.label}
            </Link>
          ))}
          <button className={`${styles.bottomItem} ${more.some((item) => isActive(pathname, item)) ? styles.active : ""}`} onClick={() => setMoreOpen(true)}>
            <MoreHorizontal size={22} aria-hidden /> Más
          </button>
        </nav>
      </div>

      <Modal open={moreOpen} title="Más opciones" onClose={() => setMoreOpen(false)}>
        <div className="stack" style={{ gap: "var(--space-md)" }}>
          {more.length > 0 && (
            <div>
              <div className="text-secondary text-small" style={{ fontWeight: 700, textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5 }}>
                Operación del Torneo
              </div>
              <div className="stack-sm">
                {more.map((item) => (
                  <Link key={item.href} href={item.href} className="btn secondary block" onClick={() => setMoreOpen(false)}>
                    <item.icon size={20} aria-hidden /> {item.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-secondary text-small" style={{ fontWeight: 700, textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5 }}>
              Navegación del Sistema
            </div>
            <div className="stack-sm">
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
            </div>
          </div>

          <div>
            <div className="text-secondary text-small" style={{ fontWeight: 700, textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5 }}>
              Mi Cuenta
            </div>
            <AccountButton user={user} isSignedIn={isSignedIn} onClick={() => { setMoreOpen(false); setAccountOpen(true); }} />
          </div>
        </div>
      </Modal>


      {/* Rendered at the shell's top level (not nested in the "Más" sheet), so closing that sheet never takes this down with it. */}
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />

      <ChampionshipSwitcher open={switchOpen} section={routed?.section ?? null} onClose={() => setSwitchOpen(false)} />
    </div>
  );
}

function AccountButton({ user, isSignedIn, onClick }: { user: { name: string; image?: string | null } | null; isSignedIn: boolean; onClick: () => void }) {
  return (
    <button className="btn secondary block account-button" onClick={onClick}>
      {isSignedIn && user ? (
        <>
          <Avatar src={user.image ?? undefined} name={user.name} size={24} />
          <span className="truncate">{user.name}</span>
        </>
      ) : (
        <>
          <LogIn size={20} aria-hidden /> Iniciar sesión
        </>
      )}
    </button>
  );
}
