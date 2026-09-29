"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays, ChartColumn, ChevronDown, Gavel, Home, Lock, LogIn, MoreHorizontal, Settings, Shield, SlidersHorizontal, Trophy, Users,
  type LucideIcon,
} from "lucide-react";
import { ChampionshipTile } from "@/components/championship/ChampionshipTile";
import { Avatar, Badge, EmptyState, Modal } from "@/components/ui";
import { championshipPath, isEntityPath, parseChampionshipPath } from "@/lib/paths";
import { CHAMPIONSHIP_STATUS_LABEL } from "@/lib/labels";
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
    : [{ href: "/", label: "Torneos", icon: Trophy, primary: true }, ...(canAccess(role, "/admin") ? [{ href: "/admin", label: "Administración", icon: Settings, primary: true }] : [])];
  const bottom = items.filter((item) => item.primary);
  const more = items.filter((item) => !item.primary);
  const allowed = canAccess(role, pathname);
  const status = current ? CHAMPIONSHIP_STATUS_LABEL[current.status] : null;
  // On desktop the whole nav sits in the top bar; "Administración" joins the row instead of a separate spot.
  const desktopItems: NavItem[] = scoped && canAccess(role, "/admin") ? [...items, { href: "/admin", label: "Administración", icon: Settings }] : items;

  return (
    <div className={styles.container}>
      <div className={styles.viewport}>
        <header className={styles.topbar}>
          <div className={styles.topbarTop}>
            <Link href="/" aria-label="Todos los torneos" className={styles.topbarLogoLink}>
              <Image src="/brand-wordmark.png" alt="Super Torneos" width={140} height={46} priority className={styles.topbarLogo} />
            </Link>

            {scoped && (
              <button className={styles.scopeChip} onClick={() => setSwitchOpen(true)} aria-label="Cambiar de torneo">
                <Trophy size={14} style={{ color: "#facc15" }} />
                <span className="truncate">{current?.name ?? "Torneo"}</span>
                <ChevronDown size={14} aria-hidden />
              </button>
            )}
            {scoped && (
              <button className={styles.scopeButtonTop} onClick={() => setSwitchOpen(true)} aria-label="Cambiar de torneo">
                <ChampionshipTile logoUrl={current?.logoUrl} size={32} />
                <span className={styles.scopeName}>{current?.name ?? "Torneo"}</span>
                {status && <Badge tone={status.tone}>{status.label}</Badge>}
                {current && <Badge icon={<Trophy size={12} />}>{`Temporada ${current.season}`}</Badge>}
                <ChevronDown size={16} aria-hidden />
              </button>
            )}

            <div className={styles.topbarActions}>
              <GlobalSearch championshipId={scopeId ?? undefined} />
              <AccountMenuTrigger user={user} isSignedIn={isSignedIn} onClick={() => setAccountOpen(true)} />
            </div>
          </div>

          {scoped && (
            <nav className={styles.desktopNav} aria-label="Torneo">
              {desktopItems.map((item) => (
                <Link key={item.href} href={item.href} className={`${styles.desktopNavItem} ${isActive(pathname, item) ? styles.active : ""}`}>
                  <item.icon size={18} aria-hidden />
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </header>
        <main className={styles.content}>
          {allowed ? children : (
            <EmptyState
              icon={<Lock size={28} />}
              title={isSignedIn ? "Esta sección no está disponible para ti" : "Inicia sesión para ver esto"}
              description={
                isSignedIn
                  ? "No administras este torneo, así que esta pantalla no es para ti."
                  : "Esta pantalla es para quien organiza el torneo. Inicia sesión con Google si te invitaron a organizarlo."
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

        <nav className={styles.bottomNav} aria-label={scoped ? "Torneo" : "Principal"}>
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
                  <Trophy size={20} aria-hidden /> Cambiar de torneo
                </button>
              )}
              {scoped && (
                <Link href="/" className="btn secondary block" onClick={() => setMoreOpen(false)}>Ver todos los torneos</Link>
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

/** Desktop top-bar trigger: avatar, name and a chevron — opens the same account modal as the mobile "Más" sheet. */
function AccountMenuTrigger({ user, isSignedIn, onClick }: { user: { name: string; image?: string | null } | null; isSignedIn: boolean; onClick: () => void }) {
  return (
    <button className={styles.accountTrigger} onClick={onClick} aria-label={isSignedIn ? "Mi cuenta" : "Iniciar sesión"}>
      {isSignedIn && user ? (
        <>
          <Avatar src={user.image ?? undefined} name={user.name} size={28} />
          <span className={`${styles.accountTriggerName} truncate`}>{user.name}</span>
          <ChevronDown size={16} aria-hidden />
        </>
      ) : (
        <>
          <LogIn size={18} aria-hidden />
          <span className={styles.accountTriggerName}>Iniciar sesión</span>
        </>
      )}
    </button>
  );
}
