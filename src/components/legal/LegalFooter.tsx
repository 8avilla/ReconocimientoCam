import Link from "next/link";
import { LEGAL_LINKS } from "@/lib/legal";
import styles from "./LegalPage.module.css";

export function LegalFooter() {
  return (
    <footer className={styles.footer} data-print-hide>
      <nav aria-label="Información legal">
        {/* Not preloaded: they are rarely opened, and the requests would compete with the screen's own. */}
        {LEGAL_LINKS.map((link) => (
          <Link key={link.href} href={link.href} prefetch={false}>{link.label}</Link>
        ))}
      </nav>
    </footer>
  );
}
