import React from "react";
import Link from "next/link";
import { Fab } from "./Fab";
import type { MenuAction } from "./ActionMenu";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: { label: string; href?: string }[];
  /** Buttons shown next to the title (on phones too, unless `mobileActions` is given). */
  actions?: React.ReactNode;
  /** On phones the header buttons are replaced by a floating "+" button with these actions. */
  mobileActions?: MenuAction[];
}

export function PageHeader({ title, description, breadcrumb, actions, mobileActions }: PageHeaderProps) {
  return (
    <header className="page-header">
      {breadcrumb && (
        <nav className="breadcrumb" aria-label="Ruta">
          {breadcrumb.map((item, index) => (
            <span key={item.label}>
              {index > 0 && " › "}
              {item.href ? <Link href={item.href}>{item.label}</Link> : item.label}
            </span>
          ))}
        </nav>
      )}
      <div className="page-header-top">
        <div>
          <h1>{title}</h1>
          {description && <p className="description">{description}</p>}
        </div>
        {actions && <div className={`page-header-actions${mobileActions ? " only-desktop" : ""}`}>{actions}</div>}
        {mobileActions && <Fab actions={mobileActions} />}
      </div>
    </header>
  );
}
