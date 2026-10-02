import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Eliminar mi cuenta | Super Torneos",
  description: "Cómo eliminar tu cuenta de Super Torneos y los datos asociados.",
};

export default function DeleteAccountPage() {
  return (
    <LegalPage title="Eliminar mi cuenta y mis datos" updatedAt="2 de octubre de 2026">
      <p>
        Puedes eliminar tu cuenta de Super Torneos en cualquier momento. Esta página explica cómo hacerlo y qué pasa con tus
        datos.
      </p>

      <h2>Si puedes iniciar sesión</h2>
      <ol>
        <li>Abre la aplicación o entra a supertorneos.com.co e inicia sesión.</li>
        <li>
          Abre tu cuenta (arriba a la derecha) y pulsa <strong>Mi perfil</strong>, o ve directamente a{" "}
          <Link href="/perfil">supertorneos.com.co/perfil</Link>.
        </li>
        <li>
          Al final de la página pulsa <strong>Eliminar mi cuenta</strong>, escribe <strong>ELIMINAR</strong> y confirma.
        </li>
      </ol>
      <p>La eliminación es inmediata y no se puede deshacer.</p>

      <h2>Si no puedes iniciar sesión</h2>
      <p>
        Escríbenos a <a href={`mailto:${CONTACT_EMAIL}?subject=Eliminar%20mi%20cuenta`}>{CONTACT_EMAIL}</a> desde el correo
        asociado a tu cuenta, con el asunto «Eliminar mi cuenta». Verificaremos que eres el titular y la eliminaremos en un
        plazo máximo de 15 días hábiles.
      </p>

      <h2>Qué datos se eliminan</h2>
      <ul>
        <li>Tu perfil: nombre, correo, foto y rol.</li>
        <li>Tu acceso a la plataforma y tus registros de uso.</li>
        <li>Tu nombre en los registros de asistencia y de verificación de jugadores en los que participaste.</li>
        <li>Tus torneos de demostración, si creaste alguno.</li>
      </ul>

      <h2>Qué datos se conservan</h2>
      <ul>
        <li>
          Los campeonatos que organizabas no se borran, porque contienen información de otras personas. Pasan a un
          coorganizador, si lo hay, o a la administración.
        </li>
        <li>
          El registro de auditoría de la plataforma, que es inalterable por seguridad, conserva el nombre de quien realizó
          cada acción.
        </li>
      </ul>

      <h2>Si eres jugador</h2>
      <p>
        Los jugadores no tienen cuenta: sus datos (nombre, fotografía y plantilla facial) los registra el organizador del
        torneo. Para pedir que los eliminemos, o revocar el consentimiento biométrico, escríbenos a{" "}
        <a href={`mailto:${CONTACT_EMAIL}?subject=Eliminar%20datos%20de%20jugador`}>{CONTACT_EMAIL}</a> indicando tu nombre,
        documento y el torneo en el que participaste.
      </p>

      <p>
        Más información en nuestra <Link href="/privacidad">Política de Privacidad</Link>.
      </p>
    </LegalPage>
  );
}
