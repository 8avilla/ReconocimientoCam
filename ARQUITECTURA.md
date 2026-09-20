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
│   │   ├── matches/[id]                    # Partido: pestañas Asistencia (plantilla completa, QR, verificación facial), Eventos y Resumen
│   │   ├── attendance/                     # Índice de partidos abiertos; /[matchId] redirige al partido (pestaña Asistencia)
│   │   ├── sanctions/                      # Suspensiones vigentes, cumplidas y manuales
│   │   ├── stats/                          # Posiciones, goleadores, asistencias y tarjetas
│   │   └── api/                  # BACKEND: Route Handlers REST
│   │       ├── championships/    # CRUD de campeonatos, /[id]/standings y /[id]/stats
│   │       ├── teams/            # CRUD de equipos, /[id]/shield, /[id]/roster
│   │       ├── players/          # CRUD de identidad, /[id]/face, /[id]/card
│   │       ├── registrations/    # Inscripción jugador ↔ equipo ↔ campeonato
│   │       ├── matches/          # CRUD de partidos, /[id]/attendance (plantilla completa, sin convocatoria manual), /check-ins,
│   │       │                     #   /lookup (QR/documento), /verifications, /verifications/manual,
│   │       │                     #   /events (+ /[eventId]/void), /transition (inicio, medio tiempo, fin)
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
│   │   ├── rules/                # Reglas de negocio puras (partido, posiciones, campeonato)
│   │   ├── services/             # Casos de uso: registrations, callups, checkins, players
│   │   └── validation/           # Esquemas Zod (mensajes en español)
│   └── models/                   # Mongoose: Championship, Team, Player, TeamRegistration,
│                                 #   Match, MatchCallUp, PlayerCheckIn, IdentityVerification, AuditLog
├── scripts/                      # seed (npm run seed), calibrate, reembed
├── docs/CALIBRACION_FACIAL.md    # Método y resultados de los umbrales de verificación
├── models_onnx/                  # Modelos ONNX de reconocimiento facial
├── .env.local / .env.example     # Variables de entorno
└── vitest.config.ts              # Pruebas unitarias (npm test)
```

### Modelo de dominio

`Championship → Team → TeamRegistration ← Player` (la identidad del jugador es independiente de su inscripción).
`Match → MatchCallUp → PlayerCheckIn → IdentityVerification`. No hay convocatoria manual: `syncMatchCallUps` convoca
automáticamente a todos los jugadores activos de ambos equipos (al crear el partido y al consultar asistencia, QR o verificación).
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
