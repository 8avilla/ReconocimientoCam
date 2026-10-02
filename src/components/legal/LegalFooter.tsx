import Link from "next/link";
import { LEGAL_LINKS } from "@/lib/legal";
import styles from "./LegalPage.module.css";

export function LegalFooter() {
  return (
    <footer className={styles.footer}>
      <nav aria-label="Información legal">
        {LEGAL_LINKS.map((link) => (
          <Link key={link.href} href={link.href}>{link.label}</Link>
        ))}
      </nav>
    </footer>
  );
}
