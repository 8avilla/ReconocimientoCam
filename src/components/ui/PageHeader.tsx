import React from "react";
import Link from "next/link";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, breadcrumb, actions }: PageHeaderProps) {
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
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
    </header>
  );
}
