# Arquitectura Full-Stack — ReconocimientoCam / Super Torneos

## 1. Visión General del Sistema

**ReconocimientoCam / Super Torneos** está construido sobre una **arquitectura monolítica Full-Stack** utilizando **Next.js (App Router)** con **React 19**, **TypeScript** y **MongoDB (Mongoose)**.

El objetivo principal es mantener la simplicidad de despliegue, la velocidad de desarrollo y el tipado de extremo a extremo integrando la interfaz de usuario (móvil y escritorio), la API REST backend y el motor de procesamiento biométrico/reconocimiento facial **en una sola base de código**.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NEXT.JS FULL-STACK MONOLITH                              │
│                                                                             │
│  ┌─────────────────────────────────┐   ┌─────────────────────────────────┐  │
│  │     FRONTEND (React 19 UI)      │   │     BACKEND API (Node.js)       │  │
│  │                                 │   │                                 │  │
│  │ - Server & Client Components    │ ──▶ Route Handlers (src/app/api/)   │  │
│  │ - Layouts, Pages, Dashboard     │   │ - REST Endpoints (GET, POST...) │  │
│  │ - Mobile First UX (CSS/Tokens)  │   │ - Controller Logic & Validation │  │
│  └─────────────────────────────────┘   └─────────────────────────────────┘  │
│                                                         │                   │
│                                                         ▼                   │
│                                        ┌─────────────────────────────────┐  │
│                                        │  SERVICES & PERSISTENCE (lib/)  │  │
│                                        │                                 │  │
│                                        │ - Mongoose Models (MongoDB)     │  │
│                                        │ - ONNX / MediaPipe Vision IA    │  │
│                                        │ - Sharp Image Processing        │  │
│                                        │ - Azure Storage Blob            │  │
│                                        └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Principios Arquitectónicos

1. **Monolito de Alta Cohesión (Single Repository & Runtime)**
   Frontend y Backend comparten modelos de datos, validaciones y tipos de TypeScript directamente sin necesidad de generar clientes API externos ni mantener múltiples proyectos desacoplados.

2. **Mobile-First & Operación en Cancha**
   La arquitectura visual y de control sigue los lineamientos de [DESIGN_GUIDE_UX_UI.MD](file:///home/ivan/Documentos/Proyectos/ReconocimientoCam/DESIGN_GUIDE_UX_UI.MD). Está optimizada para baja latencia en dispositivos móviles durante la verificación biométrica y escaneo QR en cancha.

3. **Separación Clara de Responsabilidades**
   - **Vistas y Presentación (`src/app`, `src/components`)**: Renderizado UI, captura de eventos y estado del navegador.
   - **API Routes (`src/app/api`)**: Validación de peticiones HTTP, autorización y orquestación.
   - **Servicios e IA (`src/lib`)**: Conexión a BD, motor de embedding facial (ONNX/MediaPipe), procesamiento de imágenes (`sharp`) y almacenamiento.
   - **Modelos (`src/models`)**: Esquemas de Mongoose y tipos TypeScript correspondientes.

4. **Type-Safety de Extremo a Extremo**
   Tipado estricto en TypeScript. Se evita el uso de `any` tanto en la capa de datos como en componentes de interfaz.

---

## 3. Estructura del Proyecto

```text
ReconocimientoCam/
├── src/
│   ├── app/                      # NEXT.JS APP ROUTER (Vistas y API)
│   │   ├── layout.tsx / page.tsx / globals.css
│   │   ├── championships/ teams/ players/  # CRUD (Fase 3): listados, formularios, perfil y carnet
│   │   ├── championships/[id]              # Configuración: fases (todos contra todos, grupos, eliminatoria), equipos por fase, calendario
│   │   ├── phases/[id]                     # Llaves de una eliminatoria: rondas, cruces, partidos y ganadores
│   │   ├── matches/[id]                    # Partido: pestañas Asistencia (plantilla completa, QR, verificación facial), Eventos y Resumen
│   │   ├── attendance/                     # Índice de partidos abiertos; /[matchId] redirige al partido (pestaña Asistencia)
│   │   ├── sanctions/                      # Suspensiones vigentes, cumplidas y manuales
│   │   ├── stats/                          # Posiciones, goleadores, asistencias y tarjetas
│   │   └── api/                  # BACKEND: Route Handlers REST
│   │       ├── championships/    # CRUD de campeonatos, /[id]/stats y /[id]/phases
│   │       ├── teams/            # CRUD de equipos, /[id]/shield, /[id]/roster
│   │       ├── players/          # CRUD de identidad, /[id]/face, /[id]/card
│   │       ├── registrations/    # Inscripción jugador ↔ equipo ↔ campeonato
│   │       ├── matches/          # CRUD de partidos, /[id]/attendance (plantilla completa, sin convocatoria manual), /check-ins,
│   │       │                     #   /lookup (QR/documento), /verifications, /verifications/manual,
│   │       │                     #   /events (+ /[eventId]/void), /transition (inicio, medio tiempo, fin)
│   │       ├── matchdays/        # Fechas: /[id] (renombrar, eliminar); se crean en /phases/[id]/matchdays; /championships/[id]/matchdays lista todas
│   │       ├── phases/           # Fases: /[id], /teams, /draw-groups, /fixture, /standings, /bracket, /rounds (+ /ties, /fixture)
│   │       ├── ties/             # Cruces de eliminatoria: /[id]/winner y /[id]/matches
│   │       ├── suspensions/      # Sanciones: listado, manual y /[id]/lift
│   │       └── audit-logs/       # Consulta de auditoría (solo lectura)
│   ├── components/               # FRONTEND
│   │   ├── ui/                   # Design system: Button, Input/Select, Badge, Avatar, Modal, Toast, States
│   │   ├── layout/               # AppShell (sidebar + bottom nav), ChampionshipContext
│   │   ├── camera/FaceCapture    # Detección MediaPipe + recorte facial 320 px (legado reutilizado)
│   │   ├── verification/         # QrScanner (jsQR) y VerificationFlow (QR → rostro → validar → confirmar)
│   │   └── championship/ team/ match/ player/ attendance/   # Formularios, carnet con QR
│   ├── types/api.ts              # DTOs del cliente
│   ├── lib/
│   │   ├── db.ts                 # Singleton de conexión Mongoose
│   │   ├── features.ts           # Interruptores: QR_VERIFICATION_ENABLED (hoy deshabilitado)
│   │   ├── api.ts                # route(), ApiError, parseBody/parseQuery, paginación
│   │   ├── actor.ts              # Quién ejecuta la acción (sesión pendiente, ver Fase 2)
│   │   ├── audit.ts              # recordAudit() + diffChanges()
│   │   ├── azureBlob.ts          # uploadImage()/deleteImage() en Azure Blob
│   │   ├── faceEngine/           # Detección SCRFD, alineación ArcFace, embedding ONNX, clasificación 1:1
│   │   ├── rules/                # Reglas de negocio puras (partido, posiciones, calendario, campeonato)
│   │   ├── services/             # Casos de uso: registrations, callups, checkins, players
│   │   └── validation/           # Esquemas Zod (mensajes en español)
│   └── models/                   # Mongoose: Championship, Team, Player, TeamRegistration,
│                                 #   Match, MatchCallUp, PlayerCheckIn, IdentityVerification, AuditLog
├── scripts/                      # seed, calibrate, reembed, integrity (npm run integrity [-- --fix])
├── docs/CALIBRACION_FACIAL.md    # Método y resultados de los umbrales de verificación
├── models_onnx/                  # Modelos ONNX de reconocimiento facial
├── .env.local / .env.example     # Variables de entorno
└── vitest.config.ts              # Pruebas unitarias (npm test)
```

### Modelo de dominio

`Championship → Team → TeamRegistration ← Player` (la identidad del jugador es independiente de su inscripción).
`Match → MatchCallUp → PlayerCheckIn → IdentityVerification`. No hay convocatoria manual: `syncMatchCallUps` convoca
automáticamente a todos los jugadores activos de ambos equipos (al crear el partido y al consultar asistencia, QR o verificación).
**Integridad:** todo partido pertenece a una **fecha** (`Matchday`: Fecha 1, Fecha 2...), la fecha a una fase y la fase a un campeonato (sin huérfanos): `Match.matchdayId` y `phaseId` son obligatorios, la fase y el campeonato del partido se toman de su fecha, las fechas las crea el usuario (o el generador, si se usa),
no se puede borrar una fase con partidos ni un equipo que esté en una fase, y borrar un campeonato vacío elimina sus fases.
`Championship → Phase` (liga, grupos o eliminatoria: rondas → `Tie`, cruces definidos y ganador marcado por el organizador; equipos elegidos a mano; sorteo de grupos con ajuste) `→ Match` (phaseId, group).
`Match → MatchEvent` (goles, tarjetas, cambios, incidentes; se anulan, no se borran) → `Suspension`. El marcador se deriva de los eventos; la tabla y las estadísticas se calculan al consultar, solo con partidos finalizados
(desempate: puntos, diferencia de gol, goles a favor, nombre; sin enfrentamiento directo). Toda acción crítica escribe un `AuditLog` inmutable.
El QR del carnet solo contiene `Player.publicId` (opaco, sin datos personales).

---

## 4. Patrones de Diseño Implementados

### 4.1 Connection Singleton Pattern (Mongoose / MongoDB)

Para evitar la saturación de conexiones a la base de datos causada por el Hot Reload de Next.js en desarrollo o por la ejecución en Serverless, la conexión a MongoDB se centraliza en `src/lib/db.ts` utilizando una instancia en caché en `global.mongoose`.

```typescript
// src/lib/db.ts
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

let cached = (global as any).mongoose || { conn: null, promise: null };

export async function connectToDatabase() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
```

---

### 4.2 Next.js Route Handlers (Backend REST API)

Los endpoints viven en la estructura de carpetas `src/app/api/.../route.ts` y exportan funciones asíncronas nombradas según el método HTTP.

```typescript
// src/app/api/employees/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Employee } from '@/models/Employee';

export async function GET() {
  try {
    await connectToDatabase();
    const employees = await Employee.find().lean();
    return NextResponse.json(employees, { status: 200 });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}
```

---

### 4.3 Pipeline de Procesamiento de Visión e Imágenes

El pipeline de verificación biométrica funciona de manera integrada dentro del backend/servidor mediante:

1. **Captura en Cliente**: El navegador captura el cuadro de video o escaneo QR.
2. **Pre-procesamiento con Sharp**: La imagen enviada a la API o procesada en servidor se optimiza y redimensiona mediante `sharp`.
3. **Generación de Embeddings Facial**: El servicio `src/lib/vision.ts` ejecuta el modelo ONNX (`onnxruntime-node`) o MediaPipe para extraer el vector numérico del rostro.
4. **Comparación Vectorial**: Se calcula la distancia euclidiana / cosenoidal contra los embeddings guardados en MongoDB para validar la identidad del jugador.

---

### 4.4 Component Composition Pattern (Server & Client Components)

- **Server Components (por defecto)**: Carga rápida inicial de datos desde la base de datos directamente en el servidor sin pasar por `fetch`.
- **Client Components (`'use client'`)**: Reservados para componentes interactivos de UI (cámara en vivo, formularios interactivos, lector QR, diálogos).

---

## 5. Manejo de Estado y Datos

- **Estado de Servidor**: Server Components + Next.js Server Actions / API Routes.
- **Estado Local / UI**: Hooks nativos de React (`useState`, `useReducer`, `useEffect`, `useCallback`).
- **Persistencia en Base de Datos**: Mongoose Schemas con validaciones de tipos en servidor.

---

## 6. Convenciones de Código y Calidad

- **Idioma**: Código, variables, comentarios técnicos y logs en **Inglés**. Interfaz de usuario, mensajes de alerta y documentación en **Español**.
- **Linting**: Verificación continua mediante `npm run lint`.
- **Manejo de Errores**: Todo bloque de comunicación externa o base de datos incluye `try/catch` explícito, devolviendo códigos de estado HTTP apropiados (`200`, `201`, `400`, `404`, `500`).

**Programación de partidos:** los partidos (manuales o generados) pertenecen a una fecha pero se crean **sin día, hora ni cancha** (`Match.scheduledAt` opcional). El organizador los programa a mano y puede cambiarlos cuando quiera: por fecha con `PUT /matchdays/[id]/schedule` (asigna o quita día/hora/cancha en lote; el asistente "Asignar en orden" solo rellena un borrador) o partido a partido con `PATCH /matches/[id]` (`scheduledAt: null` lo quita). Los partidos en juego o finalizados no se reprograman. El generador solo agrega los cruces que faltan; reemplazar partidos programados es una opción explícita. Filtros de `/matches`: `scheduled=true|false`, `matchdayId`, `phaseId`, `order=matchday|date`.

**Autenticación (Google) y roles reales:** el login es con **Google, vía Auth.js v5** (`src/auth.ts`, proveedor `Google`; sesión JWT, sin adaptador de base de datos). Al iniciar sesión se crea o actualiza un `User` (`src/models/User.ts`: email, nombre, foto, `isAdmin`); `isAdmin` se otorga la primera vez que alguien entra con un correo listado en la variable de entorno `ADMIN_EMAILS` (editable a mano después en la colección). Tres roles, ahora reales y aplicados por el servidor, no solo por la interfaz:
- **Visitante:** cualquiera sin sesión (o con sesión pero sin organizar el campeonato que mira). Solo lectura y favoritos.
- **Organizador:** dueño (`Championship.ownerUserId`, quien lo creó) o co-organizador invitado (`Championship.organizerUserIds`) de ESE campeonato. Se administra por campeonato, no de forma global: alguien puede ser organizador de un torneo y visitante de otro. Cualquier persona con sesión puede crear un campeonato y se vuelve su dueño (`POST /championships`). Se invita a un co-organizador por correo desde Gestionar → Organizadores (`POST /championships/:id/organizers`); si esa persona no tiene cuenta todavía, el correo queda en `organizerInviteEmails` y se resuelve solo en su primer login (callback `jwt` de `src/auth.ts`).
- **Administrador:** además de lo anterior, gestiona cualquier campeonato sin ser su organizador, elimina campeonatos y entra a `/admin` (registro de actividad).

La aplicación es real en el servidor: `src/lib/permissions.ts` (`requireOrganizer`, `requireOrganizerOfChampionship`, `requireOrganizerOfPlayer`, `requireAdmin`) se llama en cada endpoint que escribe (campeonatos, fases, equipos, inscripciones, partidos, eventos, asistencia, verificación, multas, sanciones, árbitros, sitios); los `GET` siguen abiertos para cualquiera (así ve el visitante). `getActor(request)` (`src/lib/actor.ts`) mantiene su firma síncrona de siempre: `route()` (`src/lib/api.ts`) resuelve la sesión real una vez por solicitud con `auth()` y la deja disponible vía `AsyncLocalStorage` (`src/lib/requestContext.ts`), así que ningún endpoint existente tuvo que cambiar su forma de pedir el actor. En el cliente, `RoleContext` (`src/components/layout/RoleContext.tsx`) ya no es un selector guardado en el navegador: lee la sesión real (`useSession`) y compara contra el campeonato en pantalla; conserva la misma matriz de permisos y pantallas de `src/lib/roles.ts` (`can`, `canAccess`, probada en `roles.test.ts`), que no cambió.

Variables de entorno: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (crear el cliente OAuth en Google Cloud Console; URI de redirección `<dominio>/api/auth/callback/google`), `ADMIN_EMAILS`. `ALLOW_TEST_LOGIN=1` habilita, solo fuera de producción (`NODE_ENV !== "production"`), un proveedor «Credentials» sin contraseña (`test-login`) para pruebas automatizadas; no aparece como botón en la interfaz.

**Correo y contraseña + demos.** Además de Google hay inicio de sesión con correo y contraseña (proveedor `credentials` en `src/auth.ts`, con límite de 5 intentos fallidos por correo cada 15 min, `src/lib/rateLimit.ts`). El registro abierto está cerrado (`ALLOW_SELF_REGISTER=1` lo abre); las cuentas se entregan con `npm run demo:user -- correo "Nombre" [--password=...]`. **Demos:** un torneo marcado como plantilla (`npm run demo:template -- "Nombre"`) se clona por usuario al crear su cuenta con `npm run demo:user -- correo "Nombre" --demo` (`src/lib/services/demo.ts`; sin botón en la app: la persona entra con su correo y contraseña como cualquiera). `--manage="Torneo"` en ese mismo comando hace organizador de un torneo existente a la cuenta: copia privada, con el usuario como dueño, sin datos biométricos ni vínculos de borrado a las imágenes de la plantilla, y una vida de 7 días. Las vencidas se eliminan solas al crear otra demo o con `npm run demo:cleanup`.

**Multas y pagos:** los equipos pagan multas, en especial por tarjetas. El campeonato define el valor de cada amarilla (sección visible «Multas por tarjetas» del formulario del campeonato) y de cada roja (`rules.yellowCardFine`, `rules.redCardFine`; 0 = sin multa). Al registrar la tarjeta se crea automáticamente una `Fine` (una por evento; la roja por doble amarilla también) y al anular la tarjeta se cancela si nadie ha pagado (si ya hubo pagos queda marcada `eventVoided`). El organizador registra pagos, parciales si hace falta, con tipo de pago (efectivo, transferencia, Nequi, Daviplata u otro) y comprobante opcional (foto que se guarda en Azure Blob `fines/receipts` y se borra al eliminar el pago) (`POST /fines/:id/payments`, `DELETE …/payments/:paymentId`), puede perdonar o reabrir una multa y crear multas manuales (`POST /fines`). `GET /fines` devuelve la lista y un resumen (por cobrar, recaudado y lo que debe cada equipo). En la UI está en Sanciones → Multas y solo la ven quienes gestionan sanciones. Modelo en `src/models/Fine.ts`, reglas puras en `src/lib/rules/fines.ts`, servicio en `src/lib/services/fines.ts`.

**Asistencia por cámara (1:N):** en la pestaña Asistencia del partido, «Asistencia por cámara» abre la cámara y, cuando un rostro se mantiene estable (~0,7 s), envía el recorte a `POST /matches/:id/identify`. El servidor lo compara contra los rostros registrados de ambos planteles (más los suspendidos, para avisar): si el mejor supera el umbral de verificación del campeonato y le saca ≥ 0,05 al segundo, registra la asistencia con su verificación facial (`identified`); si ya estaba presente responde `already_present`; si es un suspendido, `suspended` y no registra; si es dudoso (`uncertain`) devuelve los 3 candidatos para que el operador confirme (queda como manual con motivo automático); si no hay coincidencia, `unknown`; sin rostro en el cuadro, `no_face`. Los jugadores sin rostro registrado se avisan y se siguen tomando con «Verificar» o «Manual». Componentes: `FaceCapture` (modo `auto`) y `CameraAttendanceModal`; servicio `identifyFace` en `src/lib/services/verifications.ts`.

**Velocidad de la asistencia por cámara:** (1) al abrir la pestaña Asistencia se llama a `POST /matches/:id/identify/warmup`, que carga los modelos y deja en memoria la «galería» del partido (`src/lib/services/faceGallery.ts`: vectores faciales de ambos planteles y suspendidos, umbrales; TTL 60 s y se invalida al cambiar rostros, inscripciones o suspensiones), y el teléfono precarga el detector de MediaPipe; (2) cada fotograma solo paga el reconocimiento del rostro más una consulta liviana de estados; (3) el recorte del navegador se detecta con margen desde el primer intento (`padFirst`), evitando una pasada inútil del detector; (4) el registro de la asistencia se escribe directo, sin pasar por `registerCheckIn`; (5) en el teléfono, una persona ya reconocida no se vuelve a enviar mientras siga frente a la cámara (`hold` + `onFaceLost` de `FaceCapture`). La respuesta de `/identify` incluye `timings` y el modal muestra un «Diagnóstico de velocidad». Medido en desarrollo (base en Atlas): reconocimiento ~620 → ~480 ms, registro ~965 → ~360 ms, galería 0 ms en memoria (~615 ms al armarla).

**Navegación en dos niveles (por campeonato):** `/` es la puerta de entrada (lista de campeonatos: tocar uno siempre entra; la estrella marca los que sigues). Dentro de un campeonato todo vive bajo `/c/[id]/…` y cada sección tiene su propia dirección compartible: `/c/[id]` (resumen), `/partidos`, `/clasificacion`, `/equipos`, `/jugadores`, `/sanciones` y `/gestionar` (fases y demás herramientas del organizador). El menú cambia según el nivel (`AppShell`): fuera de un campeonato solo «Campeonatos» (y Administración); dentro, las secciones de ese campeonato, con el nombre y un botón para cambiar de campeonato (`ChampionshipSwitcher`). El jugador no tiene página propia: toda su información (datos, imágenes, verificación facial, estadísticas y actividad) vive en la ficha emergente (`PlayerInfoModal`, abierta con `useOpenPlayer()`). Las páginas de detalle (`/matches/[id]`, `/teams/[id]`, `/phases/[id]`) conservan su dirección y muestran el menú del último campeonato visitado. El campeonato actual sale de la dirección (`ChampionshipContext`, que además recuerda el último visitado); las direcciones antiguas (`/matches`, `/teams`, `/players`, `/stats`, `/sanctions`, `/championships/[id]`) redirigen a su sección nueva. `src/lib/paths.ts` centraliza las rutas y `roles.ts` entiende las direcciones con `/c/…`.

**Equipo nuevo y fases:** al crear un equipo el formulario propone la fase en juego (la «actual», ver `currentPhase`) y el organizador puede cambiarla por otra de liga o grupos, o elegir «Sin fase». El servidor recibe `phaseId` (o null) en `POST /teams` y agrega el equipo a `Phase.teamIds` (una eliminatoria se rechaza: sus equipos se eligen en los cruces). Si la fase ya tiene calendario, luego se usa «Generar calendario» para crear los partidos que le faltan; en fases de grupos hay que asignarle el grupo en «Equipos» de la fase.

**Gestionar (`/c/[id]/gestionar`):** espacio del organizador con pestañas: **Fases** (`PhasesManager`), **Árbitros** (`Referee`: nombre, teléfono, documento, activo; se asignan a partidos con `Match.refereeId`; no se elimina uno con partidos, se desactiva), **Sitios** (`Venue`: nombre único por campeonato, dirección, notas; el partido conserva el nombre como texto y los formularios lo sugieren con un `datalist`), **Reglas** (resumen de datos y reglas con acceso al formulario de edición) y **Compartir** (enlace `/c/[id]`, copiar/compartir y QR, más enlaces directos por sección). Debajo, accesos a Jugadores y Sanciones. API: `/api/referees`, `/api/venues` (GET por `championshipId`, POST, PATCH/DELETE por id); la programación por fecha (`PUT /matchdays/:id/schedule`) también asigna árbitro y cancha.

## Mejoras de uso y operación (2026-09)

- **Medición de uso:** cada pantalla abierta se registra con `POST /api/usage` (patrón de ruta como `/c/:id/partidos`, rol y usuario; `UsageEvent`, se conserva 180 días, máx. 120/min por visitante). `GET /api/usage/summary?days=` (solo admin) junto con la bitácora de auditoría alimenta **Administración → Uso**.
- **Día de partido:** `LiveMatchesBanner` (en vivo y de hoy) en el Resumen y en Partidos; el botón principal de `MatchQuickStatus` usa la máquina de estados real (`POST /matches/:id/transition`: iniciar → medio tiempo → 2.º tiempo → finalizar; iniciar con menos presentes del mínimo pide motivo); asistencia masiva/individual con "Deshacer" en `POST /matches/:id/check-ins/bulk`; plantillas por equipo en móvil; `MatchQuickSchedule` edita día, hora y cancha desde el encabezado.
- **Fases y calendario:** cada fase tiene su propia pantalla (`?s=phases&phase=<id>&tab=…`, `PhaseDetail`); el checklist enlaza con `go=new|teams|fixture`; al generar el calendario se abre la programación de la primera fecha sin días y "Guardar y seguir con…" recorre las demás (`MatchdayScheduleModal`, día una vez + horarios habituales).
- **Altas rápidas:** `PlayersBulkModal` / `TeamsBulkModal` (pegar o importar CSV/TXT; `lib/client/parseRoster.ts`), `FaceQueue` (cola de rostros pendientes), "Guardar y agregar otro" en jugador, equipo, partido, multa y suspensión, y fases iniciales opcionales al crear un torneo.
- **Rutas y filtros:** `/c/[id]/jugadores/nuevo` (antes `/players/new`, que redirige); los filtros de Partidos viven en la URL (`vista, estado, fase, equipo, fecha, programacion, desde, hasta`) y los últimos usados se recuerdan por torneo.
- **Finanzas:** Sanciones reúne Multas, Cuotas de inscripción y Suspensiones; los montos se configuran en Configuración → Finanzas y multas. "Compartir" vive dentro de "Enlace, visibilidad y compartir".
- **Jugadores:** `GET /api/players` acepta `filter=no_face|has_face|incomplete` y devuelve `counts` sobre toda la búsqueda; `Player.createdByUserId` (oculto) permite deshacer una identidad creada que aún no tiene inscripción.
- **Historial del navegador:** quien navega con `router.push/replace` mientras se cierra un diálogo debe llamar antes a `noteNavigation()` (`useBackButtonClose`), o el diálogo devolverá su entrada de historial y deshará la navegación.

## Modo sin conexión (asistencia)

El árbitro o delegado puede abrir un partido ya visitado y marcar asistencia sin señal; al volver la conexión los cambios se envían solos.

- **Service worker (`public/sw.js`):** estáticos y fotos primero de caché; páginas y GET de `/api` primero de red (4 s) con caída a lo guardado. No guarda escrituras ni `/api/auth` (salvo la sesión), usuarios, auditoría ni ajustes. Solo se registra en producción. Al cerrar sesión (`signOutAndClear`, `lib/client/session.ts`) la app le manda `clear-caches`.
- **Guardar para usar sin conexión (`OfflineSaveButton`):** pide a la red las mismas direcciones que usa la pantalla del partido para que el service worker las deje guardadas (la primera visita aún no está controlada por el service worker). Si el partido muestra otros datos, añade su dirección ahí.
- **Cola de cambios (`lib/client/outbox.ts`):** asistencia manual y en bloque se guarda en `localStorage` con la hora real (`occurredAt`) y se reenvía en orden (al volver la red, al traer la app al frente y cada 20 s). `outboxApply.ts` superpone lo pendiente a la lista (marca «Sin enviar»). La cámara/verificación facial necesita conexión (corre en el servidor).
- **Servidor (`lib/rules/offline.ts`, `services/checkins.ts`):** usa `occurredAt` como `checkedInAt` si es plausible (hasta 7 días atrás, sin futuro); un cambio sin conexión **pierde** contra un registro más reciente de otra persona (`stale_offline`) y se muestra como «no se pudo aplicar»; la auditoría marca «registrada sin conexión».
- **Probado** con navegador real en build de producción (`next start`): partido guardado → sin conexión → marcar → reconectar → sincronizado con la hora original; conflicto con registro más reciente; borrado de cachés al cerrar sesión.

## Avisos (notificaciones)

Quien tiene sesión recibe avisos de lo que sigue: **torneo**, **equipo** o **jugador** (la estrella de cada pantalla). Sin sesión se puede seguir igual, pero solo se guarda en el navegador y no genera avisos; al iniciar sesión lo seguido se pasa a la cuenta una vez (`FollowProvider`, `POST /api/follows/import`).

- **Modelos:** `Follow` (quién sigue qué), `Notification` (la campana; se borran a los 60 días), `PushSubscription` (dispositivos que activaron avisos en el teléfono). Todo se borra con la cuenta (`purgeUserNotifications`).
- **A quién avisar (`lib/rules/notifications.ts`, probado):** torneo → programación, inicio y final de sus partidos; equipo → además goles y tarjetas; jugador → sus goles, tarjetas y suspensiones. Una persona recibe un aviso una sola vez y nunca el que lo provocó.
- **Disparadores (`lib/services/notifications.ts`):** `createEvent` (gol/tarjeta), `transitionMatch` y el PATCH del partido (inicio/final), crear o cambiar la fecha de un partido, `createSuspension`. Avisar nunca rompe la operación que lo origina (try/catch).
- **Entrega:** la campana (`NotificationBell`) consulta cada minuto y al volver la app al frente. Además, **Web Push** si el servidor tiene claves VAPID (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; la pública se compila: definirla antes de `next build`). El service worker muestra el aviso y abre la pantalla al tocarlo. Sin claves, la campana funciona igual. Al cerrar sesión el dispositivo se da de baja de los avisos.
- **App de Play Store (TWA):** `enableNotifications: true` en `twa/twa-manifest.json`; hay que regenerar el AAB (sube `appVersionCode`) para que Android delegue las notificaciones.
- **Sesión de una cuenta eliminada:** `resolveActor` consulta que el usuario exista; el token anterior deja de valer aunque no haya caducado.

## Reportes y exportación

- **Excel:** CSV con BOM y `;` (lo abre Excel en español), generado en el navegador con lo que la pantalla ya cargó (`lib/client/reports.ts` + `exportCsv.ts`, probados). Los textos que parecen fórmula (`=`, `+`, `-`, `@`) se neutralizan. Disponible en posiciones, goleadores/asistencias/tarjetas, calendario y resultados, y asistencia de un partido.
- **PDF:** vía imprimir del navegador («Guardar como PDF»). Lo que no debe imprimirse lleva `data-print-hide`; `/matches/[id]/planilla` es la planilla de juego (plantillas, firmas, eventos en blanco).

## Accesibilidad básica

Contrastes AA (primario `#15803d`, texto secundario `#526077`), enlace «Saltar al contenido», foco visible también en campos, objetivos táctiles de 44 px en barra y pie, `prefers-reduced-motion`, diálogos con foco atrapado que devuelven el foco. `e2e/a11y.spec.ts` pasa axe (WCAG 2.0/2.1 A y AA) sobre las pantallas principales: es el mínimo automático; lector de pantalla y teclado en dispositivo real siguen siendo revisión manual.

## Pruebas de extremo a extremo (`npm run test:e2e`)

Playwright con un navegador real contra un **build de producción** (`.next-e2e`, no toca el `next dev` en uso; `E2E_DEV=1` usa `next dev` y se saltan las pruebas sin conexión). Usa la base de `.env.local`: todo lo creado es `zz-qa-*` y se borra al terminar (`scripts/e2e-db.ts cleanup`). Requiere la plantilla de demo (`npm run demo:template`). Entra con el login real de correo y contraseña (el proveedor de pruebas sigue apagado en producción). Cubre: visitante, accesibilidad, cuenta (eliminarla y que su sesión antigua deje de valer), asistencia sin conexión (guardar, marcar, reconectar, conflicto, borrado al cerrar sesión), reportes y avisos (quién recibe qué, campana, dejar de seguir).

## Rendimiento

Medido con un build de producción contra Atlas, simulando un teléfono (4G lento, CPU 4x): **visita de vuelta** 1,2–1,8× más rápida (clasificación 1,7 s → 0,9 s), **primera visita** hasta 1,3× (el suelo son ~190 KB de JavaScript del framework). Peticiones del resumen del torneo: 12 → 5.

- **Una sola petición por pantalla (`POST /api/batch`, `lib/batch.ts`, `lib/services/batch.ts`):** ejecuta en el servidor, en paralelo, varias lecturas de una lista cerrada (`BATCHABLE`), cada una por su propio handler (mismos permisos, validación y forma de respuesta). Añade lo que la pantalla pedirá después (el torneo y las fases de un partido, la tabla de la fase actual: `followUps`). Un sub-pedido corre como la misma persona (`currentActor`).
- **Pedirla antes que el código:** `lib/screenBatch.ts` decide, solo por la dirección, qué pide cada pantalla principal. Un script en el HTML (`EarlyBatchScript`) la envía en cuanto llega la página, mientras el JavaScript aún se descarga (~2 s en un teléfono); `ScreenPrefetcher` (en `AppShell`) la adopta al arrancar y la repite al cambiar de pantalla. `screenBatchFor` debe seguir autocontenida (su texto se copia al script) y sus rutas deben ser exactamente las que construyen las pantallas (`e2e/performance.spec.ts` lo vigila). Para añadir una pantalla: añade su caso ahí y que sus `useFetch` usen esas mismas direcciones.
- **Caché en el cliente (`lib/client/fetchCache.ts`, `useFetch`):** lo ya visto se muestra al instante y se refresca de fondo; peticiones iguales simultáneas se unen; una respuesta de menos de 4 s no se repite. Cualquier escritura (`http()` no-GET) o cambio de persona la vacía. Mientras hay un lote en vuelo, las demás peticiones lo esperan (probablemente trae su respuesta). `OfflineSaveButton` va directo a la red a propósito (el service worker debe ver cada petición).
- **Solo se carga lo que se usa:** el torneo en vista se pide por sí solo (`/championships/<id o slug>`); la lista completa solo donde se muestra (`useChampionshipList`: inicio, selector, búsqueda). El resumen de configuración (`overview`) solo para quien administra. Los últimos resultados piden 4 (`order=date_desc`), no 100. «Próximos» usa `upcoming=true` (reloj del servidor) para que la dirección no dependa de la hora. El conteo de uso espera a que el navegador esté libre. `qrcode` se carga al abrir. Los enlaces del pie y de las tarjetas de equipo no se precargan.
- **Caché del servidor (`lib/serverCache.ts`):** posiciones, estadísticas, fases, resumen y torneo, 20 s como máximo. Cualquier escritura a cualquier modelo (hooks `invalidateOnWrite` en cada modelo) invalida todo al instante; solo un cambio hecho por otra instancia o directo en la base espera a que venza el tiempo. Lo que se copia sin pasar por los modelos (demos) avisa con `bumpDataVersion()`. La asistencia no repite la sincronización de convocados si fue reciente y lee en paralelo.
- **Arranque (`instrumentation.ts`):** abre la conexión a la base y carga los handlers antes de la primera visita.
- **Imágenes:** `minimumCacheTTL` de 31 días (los nombres de archivo no se reutilizan). Miniaturas de 160 px guardadas junto a cada foto/escudo/logo al subirlos (`lib/thumbs.ts`) y servidas directo del almacenamiento, sin pasar por el optimizador; **apagadas por defecto**: corre `npm run thumbs` una vez (crea los `_s` de lo ya subido; solo añade archivos) y luego compila con `NEXT_PUBLIC_IMAGE_THUMBS=1`. Una imagen sin miniatura cae sola a la original. El logo del encabezado usa una copia ya del tamaño justo (`brand-wordmark-sm.webp`).
- **Fuera del código:** el tiempo por consulta lo marca la distancia al servidor de base de datos (≈90 ms entre este equipo y Atlas); en producción el servidor debe estar en la misma región que Atlas.
