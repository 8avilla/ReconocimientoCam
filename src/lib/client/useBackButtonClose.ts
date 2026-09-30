"use client";

import { useEffect, useRef } from "react";

/**
 * The phone's back button closes the topmost open modal instead of leaving the page.
 * Each open modal owns one history entry; entries are counted (not tagged) because Next.js rewrites history.state.
 * Closing a modal by any other means (X, Esc, parent state) gives its entry back, once, after the current
 * render settles — so a modal that closes while the next one opens in the same commit doesn't confuse the history.
 */
const modalStack: Array<() => void> = [];
let historyEntries = 0;
let ignoredPops = 0;
let listening = false;
let reconcileTimer: ReturnType<typeof setTimeout> | undefined;
// Navigations (links, router.push) that happen while an overlay closes must not be undone by giving its entry back.
let foreignPushes = 0;
let ownPush = false;
let patched = false;

function watchNavigation() {
  if (patched) return;
  patched = true;
  const original = window.history.pushState.bind(window.history);
  window.history.pushState = (...args: Parameters<History["pushState"]>) => {
    if (!ownPush) foreignPushes++;
    return original(...args);
  };
}

function pushOwnEntry() {
  ownPush = true;
  try {
    window.history.pushState({ modal: true }, "");
  } finally {
    ownPush = false;
  }
}

function onPopState() {
  if (ignoredPops > 0) {
    ignoredPops--;
    return;
  }
  if (historyEntries === 0) return;
  historyEntries--;
  modalStack.pop()?.();
}

function reconcileHistory() {
  clearTimeout(reconcileTimer);
  const pushesBefore = foreignPushes;
  reconcileTimer = setTimeout(() => {
    const extra = historyEntries - modalStack.length;
    if (extra <= 0) return;
    historyEntries -= extra;
    // The page navigated meanwhile: going back would undo it, so the stale entries are left in place.
    if (foreignPushes !== pushesBefore) return;
    ignoredPops++;
    window.history.go(-extra);
  }, 120);
}

/** While `open`, the phone's back button calls `onClose` (closing the topmost overlay) instead of leaving the page. */
export function useBackButtonClose(open: boolean, onClose: () => void) {
  // Callers pass a new onClose on every render; the effect must only run when the overlay opens or closes.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    if (!listening) {
      window.addEventListener("popstate", onPopState);
      listening = true;
    }
    watchNavigation();
    const close = () => onCloseRef.current();
    pushOwnEntry();
    historyEntries++;
    modalStack.push(close);
    return () => {
      const index = modalStack.indexOf(close);
      if (index !== -1) modalStack.splice(index, 1);
      reconcileHistory();
    };
  }, [open]);
}
