import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Términos y Condiciones | Super Torneos",
  description: "Condiciones de uso de la plataforma Super Torneos.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Términos y Condiciones" updatedAt="2 de octubre de 2026">
      <p>
        Estos términos regulan el uso de Super Torneos (supertorneos.com.co y su aplicación para Android). Al usar la
        plataforma los aceptas. Si no estás de acuerdo, no la uses.
      </p>

      <h2>1. Qué es Super Torneos</h2>
      <p>
        Es una herramienta para organizar campeonatos deportivos: equipos, jugadores, partidos, sanciones, estadísticas y
        verificación de identidad de los jugadores. Cualquier persona puede consultar los torneos públicos; para organizar o
        administrar uno hace falta una cuenta.
      </p>

      <h2>2. Tu cuenta</h2>
      <ul>
        <li>Debes dar datos verdaderos y mantener tu cuenta segura. Eres responsable de lo que se haga con ella.</li>
        <li>Debes ser mayor de edad para crear una cuenta de organizador.</li>
        <li>Podemos suspender o eliminar cuentas que incumplan estos términos.</li>
      </ul>

      <h2>3. Responsabilidad de los organizadores</h2>
      <p>
        Quien registra jugadores en un torneo es responsable de los datos que carga. En particular, el organizador debe:
      </p>
      <ul>
        <li>Contar con la autorización de cada jugador (o de su representante legal, si es menor de edad) para tratar sus datos.</li>
        <li>
          Obtener su <strong>consentimiento expreso para el tratamiento de datos biométricos</strong> (reconocimiento facial)
          antes de usarlos, e informarle que puede negarse y ser verificado por otros medios.
        </li>
        <li>Registrar solo datos veraces y necesarios para el torneo.</li>
        <li>Atender las solicitudes de los jugadores para corregir o eliminar sus datos.</li>
      </ul>

      <h2>4. Uso aceptable</h2>
      <p>No puedes usar la plataforma para:</p>
      <ul>
        <li>Suplantar a otra persona o registrar datos o fotografías de alguien sin su autorización.</li>
        <li>Subir contenido ilegal, ofensivo o que vulnere derechos de terceros.</li>
        <li>Intentar acceder sin permiso a cuentas o datos ajenos, o interferir con el funcionamiento del servicio.</li>
        <li>Usar el reconocimiento facial para fines distintos a la verificación de jugadores en un torneo.</li>
      </ul>

      <h2>5. Contenido</h2>
      <p>
        Conservas los derechos sobre el contenido que cargas (logos, fotografías, datos de tu torneo). Nos autorizas a
        almacenarlo y mostrarlo dentro de la plataforma según la visibilidad que elijas para tu torneo.
      </p>

      <h2>6. Disponibilidad y límites</h2>
      <p>
        Nos esforzamos por mantener el servicio disponible, pero se ofrece «tal cual», sin garantía de funcionamiento
        ininterrumpido. El reconocimiento facial es una ayuda y puede equivocarse: la decisión final sobre la identidad de un
        jugador es de quien organiza el partido. En la medida que la ley lo permita, no respondemos por daños indirectos
        derivados del uso de la plataforma.
      </p>

      <h2>7. Datos personales</h2>
      <p>
        Tratamos los datos personales según nuestra <Link href="/privacidad">Política de Privacidad</Link>. Puedes{" "}
        <Link href="/eliminar-cuenta">eliminar tu cuenta</Link> cuando quieras.
      </p>

      <h2>8. Cambios</h2>
      <p>
        Podemos actualizar estos términos. Publicaremos la versión vigente en esta página con su fecha. Si sigues usando la
        plataforma después del cambio, lo aceptas.
      </p>

      <h2>9. Ley aplicable y contacto</h2>
      <p>
        Estos términos se rigen por las leyes de Colombia. Para cualquier duda escríbenos a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
