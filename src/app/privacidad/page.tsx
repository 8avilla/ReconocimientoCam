import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de Privacidad | Super Torneos",
  description: "Cómo Super Torneos recoge, usa y protege tus datos personales y biométricos.",
};

const UPDATED_AT = "2 de octubre de 2026";

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Política de Privacidad" updatedAt={UPDATED_AT}>
      <p>
        Super Torneos (supertorneos.com.co y su aplicación para Android) es una plataforma para organizar campeonatos
        deportivos: equipos, jugadores, partidos, sanciones y verificación de identidad de los jugadores. Esta política
        explica qué datos tratamos, para qué, y cuáles son tus derechos conforme a la Ley 1581 de 2012 de Colombia
        (protección de datos personales) y sus decretos reglamentarios.
      </p>

      <h2>1. Responsable del tratamiento</h2>
      <p>
        El responsable del tratamiento es Super Torneos. Puedes contactarnos en{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>2. Datos que recogemos</h2>
      <p>
        <strong>De las personas que usan la plataforma (organizadores, delegados, árbitros):</strong>
      </p>
      <ul>
        <li>Nombre, correo electrónico y foto de perfil, al iniciar sesión con Google o con correo y contraseña.</li>
        <li>Rol y permisos asignados dentro de cada campeonato.</li>
        <li>
          Registros de uso (pantallas visitadas, rol y fecha) y de auditoría de acciones, para seguridad y mejora del
          servicio.
        </li>
      </ul>
      <p>
        <strong>De los jugadores registrados en un campeonato:</strong>
      </p>
      <ul>
        <li>Nombre completo y, de forma opcional, documento de identidad y fecha de nacimiento.</li>
        <li>Fotografía de identificación y fotografías generales.</li>
        <li>
          <strong>Datos biométricos (dato sensible):</strong> una plantilla numérica del rostro, calculada a partir de la
          fotografía de inscripción, usada para verificar la identidad.
        </li>
        <li>Resultado, fecha y método de cada verificación de identidad, y la evidencia capturada en ella.</li>
        <li>Participación en partidos, asistencia, goles, tarjetas y sanciones.</li>
      </ul>

      <h2>3. Para qué usamos los datos</h2>
      <ul>
        <li>Permitir el acceso seguro a la plataforma y aplicar los permisos de cada rol.</li>
        <li>Gestionar campeonatos, equipos, partidos, resultados, sanciones y estadísticas.</li>
        <li>
          Verificar que quien juega es quien dice ser, mediante código QR del carnet digital o reconocimiento facial, y
          evitar suplantaciones.
        </li>
        <li>Enviar correos transaccionales (por ejemplo, restablecer la contraseña).</li>
        <li>Mantener la seguridad del servicio y mejorarlo.</li>
      </ul>
      <p>No vendemos tus datos ni los usamos para publicidad.</p>

      <h2>4. Datos biométricos y consentimiento</h2>
      <p>
        El rostro es un dato sensible. Solo tratamos la plantilla facial de un jugador si existe su autorización previa,
        expresa e informada (o la de su representante legal si es menor de edad), que queda registrada con su fecha. La
        autorización es voluntaria: el jugador puede negarse, y en ese caso se verificará su identidad por otros medios,
        como el código QR o la revisión manual por parte del personal del torneo. Puede revocarla en cualquier momento
        escribiéndonos, y eliminaremos su plantilla facial.
      </p>
      <p>
        La plantilla facial se usa únicamente para verificar identidad en el contexto del campeonato. La fotografía de
        inscripción se compara con la imagen capturada en el momento de la verificación; no se usa para identificar a
        personas fuera de la plataforma.
      </p>

      <h2>5. Permiso de cámara</h2>
      <p>
        La aplicación solicita acceso a la cámara únicamente para escanear códigos QR, registrar la fotografía de un
        jugador y realizar la verificación facial. No accedemos a la cámara en segundo plano ni a tu galería.
      </p>

      <h2>6. Con quién compartimos los datos</h2>
      <p>Solo compartimos datos con proveedores que nos prestan el servicio, bajo obligaciones de confidencialidad:</p>
      <ul>
        <li>Google, para el inicio de sesión con tu cuenta de Google.</li>
        <li>Microsoft Azure, para el almacenamiento de fotografías y evidencias.</li>
        <li>Proveedores de base de datos, alojamiento y envío de correo.</li>
      </ul>
      <p>
        Los datos personales de los jugadores solo son visibles para los organizadores y el personal autorizado del
        campeonato en el que participan, según su rol. Podemos entregar información si una autoridad competente lo exige
        conforme a la ley.
      </p>

      <h2>7. Conservación</h2>
      <p>
        Conservamos los datos mientras la cuenta o el jugador permanezcan registrados y sea necesario para el
        campeonato. Los registros de uso se eliminan automáticamente a los 180 días. Al solicitar la eliminación de tus
        datos, los borramos o anonimizamos, salvo lo que debamos conservar por obligación legal.
      </p>

      <h2>8. Seguridad</h2>
      <p>
        Usamos conexiones cifradas (HTTPS), contraseñas almacenadas con hash, control de acceso por roles y plantillas
        faciales que no se exponen por defecto a la interfaz. Ningún sistema es infalible, pero aplicamos medidas
        razonables para proteger tu información.
      </p>

      <h2>9. Tus derechos</h2>
      <p>Como titular de los datos puedes, en cualquier momento:</p>
      <ul>
        <li>Conocer, actualizar y rectificar tus datos.</li>
        <li>Solicitar prueba de la autorización otorgada.</li>
        <li>Ser informado del uso que se ha dado a tus datos.</li>
        <li>Revocar la autorización y solicitar la supresión de tus datos.</li>
        <li>Presentar quejas ante la Superintendencia de Industria y Comercio.</li>
      </ul>
      <p>
        Para ejercerlos, escríbenos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> indicando tu nombre y qué
        deseas hacer. Responderemos dentro de los plazos de la ley.
      </p>

      <h2>10. Menores de edad</h2>
      <p>
        Pueden participar jugadores menores de edad registrados por su equipo u organizador. El tratamiento de sus datos,
        y en especial de los biométricos, requiere la autorización de su padre, madre o representante legal. La
        plataforma no está dirigida a menores para que creen cuentas por su cuenta.
      </p>

      <h2>11. Eliminación de cuenta y datos</h2>
      <p>
        Puedes eliminar tu cuenta tú mismo, en cualquier momento: inicia sesión, abre <strong>Mi perfil</strong> y pulsa{" "}
        <strong>Eliminar mi cuenta</strong>. Las instrucciones completas, incluso si no puedes entrar, están en{" "}
        <Link href="/eliminar-cuenta">supertorneos.com.co/eliminar-cuenta</Link>.
      </p>
      <p>
        Al eliminarla borramos tu perfil, tu acceso y tus registros de uso, y quitamos tu nombre de los registros de asistencia y verificación. El registro de auditoría de la plataforma, que es inalterable por seguridad, conserva el nombre de quien realizó cada acción.
        Los campeonatos que organizabas no se eliminan, porque contienen información de otras personas: pasan a un
        coorganizador, si lo hay, o a la administración. Tus torneos de demostración sí se borran.
      </p>
      <p>
        Si no puedes acceder a tu cuenta, o quieres que eliminemos también los datos de un jugador (incluida su plantilla
        facial), escríbenos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> desde el correo asociado.
      </p>

      <h2>12. Cambios a esta política</h2>
      <p>
        Podemos actualizar esta política. Publicaremos la versión vigente en esta página con su fecha de actualización.
      </p>
    </LegalPage>
  );
}
