"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * The phone's back button closes the topmost open overlay instead of leaving the page.
 *
 * Every open overlay pushes one history entry tagged `{ modal: true }`. Rules that keep the history honest:
 *  - Closing with the overlay's own X / Esc / backdrop goes through `requestClose`, which does `history.back()`;
 *    the popstate handler then closes it, so no entry is left behind.
 *  - Closing from the outside (parent state, a saved form) leaves a "stale" entry. If nothing navigates, it is
 *    given back shortly after. It is NEVER given back while a navigation may be pending: a popstate would make
 *    Next.js restore the previous URL and undo the navigation (this is what sent "Jugadores" to "Clasificación").
 *  - A stale entry that is still there when the user presses back is recognized by its tag and skipped.
 */
type Entry = { close: () => void };
const stack: Entry[] = [];
let ignoredPops = 0;
let listening = false;
let lastLinkClickAt = 0;

const skipBack = () => {
  ignoredPops++;
  window.history.back();
};

function onPopState(event: PopStateEvent) {
  const landedOnTaggedEntry = Boolean(event.state?.modal);
  if (ignoredPops > 0) {
    ignoredPops--;
    // Still on a leftover entry of a closed overlay: keep going until the real page.
    if (landedOnTaggedEntry && stack.length === 0) skipBack();
    return;
  }
  if (stack.length > 0) {
    stack.pop()?.close();
    if (landedOnTaggedEntry && stack.length === 0) skipBack();
  } else if (landedOnTaggedEntry) {
    skipBack();
  }
}

/**
 * Call right before a `router.push/replace` that happens while an overlay closes (e.g. "delete, then go back to the
 * list"). A router navigation only changes the address once the new page is ready, which can take longer than the
 * grace period below; without this the closing overlay would hand its history entry back in the meantime and the
 * browser would restore the old address, undoing the navigation.
 */
export function noteNavigation() {
  lastLinkClickAt = Date.now();
}

function watchLinkClicks() {
  document.addEventListener("click", (event) => {
    if ((event.target as Element | null)?.closest?.("a[href]")) lastLinkClickAt = Date.now();
  }, true);
}

/** While `open`, the phone's back button calls `onClose`. Returns the function to use for the overlay's own close controls. */
export function useBackButtonClose(open: boolean, onClose: () => void): () => void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const entryRef = useRef<Entry | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!listening) {
      listening = true;
      window.addEventListener("popstate", onPopState);
      watchLinkClicks();
    }
    const entry: Entry = { close: () => onCloseRef.current() };
    entryRef.current = entry;
    window.history.pushState({ modal: true }, "");
    stack.push(entry);
    // The query counts too: a search-only navigation (`router.replace("?s=phases")`) must not be undone either.
    const addressAtOpen = window.location.pathname + window.location.search;
    return () => {
      entryRef.current = null;
      const index = stack.indexOf(entry);
      if (index === -1) return; // closed by the back button: nothing left behind
      stack.splice(index, 1);
      // Closed from the outside: give the entry back once things settle, unless the page is navigating.
      setTimeout(() => {
        const navigating = Date.now() - lastLinkClickAt < 2000 || window.location.pathname + window.location.search !== addressAtOpen;
        if (stack.length === 0 && !navigating && window.history.state?.modal) skipBack();
      }, 400);
    };
  }, [open]);

  return useCallback(() => {
    const entry = entryRef.current;
    if (entry && stack[stack.length - 1] === entry) window.history.back();
    else onCloseRef.current();
  }, []);
}
