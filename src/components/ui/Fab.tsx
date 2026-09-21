"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Modal } from "./Modal";
import type { MenuAction } from "./ActionMenu";

/**
 * Mobile floating "+" button. One action runs directly; several open a bottom sheet with the choices.
 * It sits above the bottom navigation and only renders on phones.
 */
export function Fab({ actions, label = "Acciones" }: { actions: MenuAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const available = actions.filter((action) => !action.disabled);
  if (available.length === 0) return null;

  const single = available.length === 1 ? available[0] : null;
  const className = "fab only-mobile";
  return (
    <>
      {single?.href ? (
        <Link href={single.href} className={className} aria-label={single.label}><Plus size={26} aria-hidden /></Link>
      ) : (
        <button className={className} aria-label={single?.label ?? label} onClick={() => (single ? single.onClick?.() : setOpen(true))}>
          <Plus size={26} aria-hidden />
        </button>
      )}
      <Modal open={open} title={label} onClose={() => setOpen(false)}>
        <div className="stack-sm">
          {available.map((action, index) =>
            action.href ? (
              <Link key={action.label} href={action.href} className={`btn ${index === 0 ? "primary" : "secondary"} block`} onClick={() => setOpen(false)}>{action.icon}{action.label}</Link>
            ) : (
              <button
                key={action.label}
                className={`btn ${index === 0 ? "primary" : "secondary"} block`}
                onClick={() => {
                  setOpen(false);
                  action.onClick?.();
                }}
              >
                {action.icon}{action.label}
              </button>
            )
          )}
        </div>
      </Modal>
    </>
  );
}
