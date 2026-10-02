import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Acerca de | Super Torneos",
  description: "Qué es Super Torneos y cómo contactarnos.",
};

export default function AboutPage() {
  return (
    <LegalPage title="Acerca de Super Torneos">
      <p>
        Super Torneos es una plataforma para organizar campeonatos deportivos desde el celular o el computador: equipos,
        jugadores, partidos, posiciones, sanciones y carnets digitales, con verificación de identidad por código QR o
        reconocimiento facial para evitar suplantaciones.
      </p>

      <h2>Cómo funciona</h2>
      <ul>
        <li>Cualquiera puede seguir un torneo sin crear cuenta.</li>
        <li>Los organizadores inician sesión con Google para crear y administrar sus torneos.</li>
        <li>Cada torneo tiene sus propios organizadores y permisos.</li>
      </ul>

      <h2>Enlaces</h2>
      <ul>
        <li>
          Sitio web: <a href={SITE_URL}>{SITE_URL.replace("https://", "")}</a>
        </li>
        <li>
          Contacto: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </li>
        <li>
          <Link href="/privacidad">Política de Privacidad</Link>
        </li>
        <li>
          <Link href="/terminos">Términos y Condiciones</Link>
        </li>
        <li>
          <Link href="/soporte">Soporte y preguntas frecuentes</Link>
        </li>
      </ul>
    </LegalPage>
  );
}
