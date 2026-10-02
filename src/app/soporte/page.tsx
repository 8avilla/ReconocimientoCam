import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Soporte | Super Torneos",
  description: "Ayuda y contacto de Super Torneos.",
};

export default function SupportPage() {
  return (
    <LegalPage title="Soporte">
      <p>
        ¿Tienes un problema o una pregunta? Escríbenos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> y te
        responderemos lo antes posible. Si es un error, cuéntanos qué hacías, en qué pantalla y desde qué dispositivo.
      </p>

      <h2>Preguntas frecuentes</h2>

      <h3>¿Necesito una cuenta para ver un torneo?</h3>
      <p>
        No. Cualquier persona puede ver torneos, partidos, posiciones y equipos sin iniciar sesión. La cuenta es para
        organizar torneos o administrarlos si te invitaron.
      </p>

      <h3>¿Cómo inicio sesión?</h3>
      <p>
        Pulsa «Iniciar sesión» y elige «Continuar con Google», o usa tu correo y contraseña si tu cuenta tiene una.
      </p>

      <h3>Olvidé mi contraseña</h3>
      <p>
        En la pantalla de inicio de sesión con correo, pulsa «¿Olvidaste tu contraseña?» y te enviaremos un enlace para crear
        una nueva.
      </p>

      <h3>¿Cómo organizo mi propio torneo?</h3>
      <p>
        Inicia sesión y crea un torneo desde la pantalla principal. Después puedes invitar a otros organizadores por correo.
      </p>

      <h3>La verificación facial no reconoce a un jugador</h3>
      <p>
        Procura buena luz y que el jugador mire de frente a la cámara. Si no funciona, se puede verificar con el código QR del
        carnet o hacer una revisión manual indicando el motivo.
      </p>

      <h3>La cámara no se activa</h3>
      <p>
        Revisa que la app tenga permiso de cámara en los ajustes de tu teléfono. La usamos solo para escanear códigos QR y
        verificar jugadores.
      </p>

      <h3>¿Cómo elimino mi cuenta o mis datos?</h3>
      <p>
        Mira <Link href="/eliminar-cuenta">cómo eliminar tu cuenta</Link>. Para consultas sobre privacidad, revisa la{" "}
        <Link href="/privacidad">Política de Privacidad</Link>.
      </p>
    </LegalPage>
  );
}
