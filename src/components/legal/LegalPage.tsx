import styles from "./LegalPage.module.css";

/** Shared look for the plain-text pages (privacy, terms, support...): a readable column with headings. */
export function LegalPage({ title, updatedAt, children }: { title: string; updatedAt?: string; children: React.ReactNode }) {
  return (
    <article className={styles.page}>
      <h1>{title}</h1>
      {updatedAt && <p className={styles.updated}>Última actualización: {updatedAt}</p>}
      {children}
    </article>
  );
}
