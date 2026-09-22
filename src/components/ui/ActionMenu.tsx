"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";

export interface MenuAction {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  /** Destructive action: shown in red and separated from the rest. */
  danger?: boolean;
}

/**
 * Overflow ("⋯") menu: keeps secondary and destructive actions out of the way, with 44px touch targets.
 * Keyboard: opens focused on the first item, arrow keys move between items, Home/End jump to the ends,
 * Escape closes and returns focus to the trigger button (as does picking an item or clicking outside).
 */
export function ActionMenu({ actions, label = "Más acciones" }: { actions: MenuAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const menuId = useId();

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const items = itemRefs.current.filter((item): item is HTMLElement => item !== null);
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        items[0]?.focus();
      } else if (event.key === "End") {
        event.preventDefault();
        items[items.length - 1]?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="action-menu" ref={rootRef}>
      <button ref={triggerRef} className="icon-button" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen((value) => !value)}>
        <MoreVertical size={20} />
      </button>
      {open && (
        <div className="action-menu-list" id={menuId} role="menu">
          {actions.map((action, index) => {
            const className = `action-menu-item${action.danger ? " danger" : ""}`;
            const content = <>{action.icon}{action.label}</>;
            const ref = (node: HTMLElement | null) => {
              itemRefs.current[index] = node;
            };
            return action.href && !action.disabled ? (
              <Link key={action.label} ref={ref} href={action.href} role="menuitem" className={className} onClick={() => close(false)}>{content}</Link>
            ) : (
              <button
                key={action.label}
                ref={ref}
                role="menuitem"
                className={className}
                disabled={action.disabled}
                onClick={() => {
                  close(true);
                  action.onClick?.();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
