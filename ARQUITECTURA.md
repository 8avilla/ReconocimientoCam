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

**Multas y pagos:** los equipos pagan multas, en especial por tarjetas. El campeonato define el valor de cada amarilla (sección visible «Multas por tarjetas» del formulario del campeonato) y de cada roja (`rules.yellowCardFine`, `rules.redCardFine`; 0 = sin multa). Al registrar la tarjeta se crea automáticamente una `Fine` (una por evento; la roja por doble amarilla también) y al anular la tarjeta se cancela si nadie ha pagado (si ya hubo pagos queda marcada `eventVoided`). El organizador registra pagos, parciales si hace falta, con tipo de pago (efectivo, transferencia, Nequi, Daviplata u otro) y comprobante opcional (foto que se guarda en Azure Blob `fines/receipts` y se borra al eliminar el pago) (`POST /fines/:id/payments`, `DELETE …/payments/:paymentId`), puede perdonar o reabrir una multa y crear multas manuales (`POST /fines`). `GET /fines` devuelve la lista y un resumen (por cobrar, recaudado y lo que debe cada equipo). En la UI está en Sanciones → Multas y solo la ven quienes gestionan sanciones. Modelo en `src/models/Fine.ts`, reglas puras en `src/lib/rules/fines.ts`, servicio en `src/lib/services/fines.ts`.

**Asistencia por cámara (1:N):** en la pestaña Asistencia del partido, «Asistencia por cámara» abre la cámara y, cuando un rostro se mantiene estable (~0,7 s), envía el recorte a `POST /matches/:id/identify`. El servidor lo compara contra los rostros registrados de ambos planteles (más los suspendidos, para avisar): si el mejor supera el umbral de verificación del campeonato y le saca ≥ 0,05 al segundo, registra la asistencia con su verificación facial (`identified`); si ya estaba presente responde `already_present`; si es un suspendido, `suspended` y no registra; si es dudoso (`uncertain`) devuelve los 3 candidatos para que el operador confirme (queda como manual con motivo automático); si no hay coincidencia, `unknown`; sin rostro en el cuadro, `no_face`. Los jugadores sin rostro registrado se avisan y se siguen tomando con «Verificar» o «Manual». Componentes: `FaceCapture` (modo `auto`) y `CameraAttendanceModal`; servicio `identifyFace` en `src/lib/services/verifications.ts`.

**Velocidad de la asistencia por cámara:** (1) al abrir la pestaña Asistencia se llama a `POST /matches/:id/identify/warmup`, que carga los modelos y deja en memoria la «galería» del partido (`src/lib/services/faceGallery.ts`: vectores faciales de ambos planteles y suspendidos, umbrales; TTL 60 s y se invalida al cambiar rostros, inscripciones o suspensiones), y el teléfono precarga el detector de MediaPipe; (2) cada fotograma solo paga el reconocimiento del rostro más una consulta liviana de estados; (3) el recorte del navegador se detecta con margen desde el primer intento (`padFirst`), evitando una pasada inútil del detector; (4) el registro de la asistencia se escribe directo, sin pasar por `registerCheckIn`; (5) en el teléfono, una persona ya reconocida no se vuelve a enviar mientras siga frente a la cámara (`hold` + `onFaceLost` de `FaceCapture`). La respuesta de `/identify` incluye `timings` y el modal muestra un «Diagnóstico de velocidad». Medido en desarrollo (base en Atlas): reconocimiento ~620 → ~480 ms, registro ~965 → ~360 ms, galería 0 ms en memoria (~615 ms al armarla).

**Navegación en dos niveles (por campeonato):** `/` es la puerta de entrada (lista de campeonatos: tocar uno siempre entra; la estrella marca los que sigues). Dentro de un campeonato todo vive bajo `/c/[id]/…` y cada sección tiene su propia dirección compartible: `/c/[id]` (resumen), `/partidos`, `/clasificacion`, `/equipos`, `/jugadores`, `/sanciones` y `/gestionar` (fases y demás herramientas del organizador). El menú cambia según el nivel (`AppShell`): fuera de un campeonato solo «Campeonatos» (y Administración); dentro, las secciones de ese campeonato, con el nombre y un botón para cambiar de campeonato (`ChampionshipSwitcher`). Las páginas de detalle (`/matches/[id]`, `/teams/[id]`, `/players/[id]`, `/phases/[id]`) conservan su dirección y muestran el menú del último campeonato visitado. El campeonato actual sale de la dirección (`ChampionshipContext`, que además recuerda el último visitado); las direcciones antiguas (`/matches`, `/teams`, `/players`, `/stats`, `/sanctions`, `/championships/[id]`) redirigen a su sección nueva. `src/lib/paths.ts` centraliza las rutas y `roles.ts` entiende las direcciones con `/c/…`.

**Equipo nuevo y fases:** al crear un equipo el formulario propone la fase en juego (la «actual», ver `currentPhase`) y el organizador puede cambiarla por otra de liga o grupos, o elegir «Sin fase». El servidor recibe `phaseId` (o null) en `POST /teams` y agrega el equipo a `Phase.teamIds` (una eliminatoria se rechaza: sus equipos se eligen en los cruces). Si la fase ya tiene calendario, luego se usa «Generar calendario» para crear los partidos que le faltan; en fases de grupos hay que asignarle el grupo en «Equipos» de la fase.

**Gestionar (`/c/[id]/gestionar`):** espacio del organizador con pestañas: **Fases** (`PhasesManager`), **Árbitros** (`Referee`: nombre, teléfono, documento, activo; se asignan a partidos con `Match.refereeId`; no se elimina uno con partidos, se desactiva), **Sitios** (`Venue`: nombre único por campeonato, dirección, notas; el partido conserva el nombre como texto y los formularios lo sugieren con un `datalist`), **Reglas** (resumen de datos y reglas con acceso al formulario de edición) y **Compartir** (enlace `/c/[id]`, copiar/compartir y QR, más enlaces directos por sección). Debajo, accesos a Jugadores y Sanciones. API: `/api/referees`, `/api/venues` (GET por `championshipId`, POST, PATCH/DELETE por id); la programación por fecha (`PUT /matchdays/:id/schedule`) también asigna árbitro y cancha.
