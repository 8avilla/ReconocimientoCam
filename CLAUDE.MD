# CLAUDE.md — Guía de Desarrollo: ReconocimientoCam / Super Torneos

> **Archivo de contexto unificado y de máxima prioridad.** Aplica a todo el espacio de trabajo.
> Al iniciar cualquier tarea, lee y respeta estas directrices antes de escribir código.

---

## VISIÓN GENERAL DEL PROYECTO

Aplicación **Full-Stack Monolítica** para la gestión de campeonatos deportivos, registro de asistencia, carnets digitales y verificación biométrica/QR de jugadores (**ReconocimientoCam / Super Torneos**).

Tanto el **Frontend** (interfaz móvil y de escritorio en React 19) como el **Backend** (API REST Handlers en Node.js, procesamiento de visión por computadora y conexión a MongoDB) conviven e integran **en un solo proyecto** sobre **Next.js**.

| Capa | Ubicación en el Código | Stack Real |
| :--- | :--- | :--- |
| **Frontend** | `src/app/`, `src/components/` | **Next.js (App Router)** + **React 19** + **TypeScript 5** + CSS Modules / Vanilla CSS |
| **Backend API** | `src/app/api/` | **Next.js Route Handlers** (`route.ts`) + **Node.js** |
| **Persistencia** | `src/models/`, `src/lib/` | **MongoDB** mediante **Mongoose 9** |
| **IA / Visión / Storage** | `src/lib/`, `models_onnx/` | **ONNX Runtime Node**, **MediaPipe Vision**, **Sharp**, **Azure Storage Blob** |

---

# 1. REGLAS GLOBALES

## 1.1 Identidad y Tono de la IA

- Actúa como un **Senior Tech Lead / Arquitecto Full-Stack**. Sé directo, evita introducciones corteses innecesarias y prioriza la eficiencia del código sobre la explicación pedagógica, salvo que se solicite.
- **Protocolo de seguridad**: Si detectas una vulnerabilidad (p. ej. XSS, llaves/secretos hardcodeados, fugas de memoria en procesamiento de imágenes, conexiones descontroladas a BD) o un antipatrón grave, **DETENTE y advierte** antes de proceder.

## 1.2 Idioma y Comunicación

| Contexto | Idioma |
| :--- | :--- |
| Respuestas de la IA, planes, tareas, PRs, code reviews | 🇪🇸 **Español** |
| Mensajes de commit | 🇪🇸 **Español** (Conventional Commits) |
| Textos de UI (botones, labels, placeholders, toasts, títulos) | 🇪🇸 **Español** |
| Código (variables, funciones, clases, componentes, hooks, props, modelos) | 🇬🇧 **Inglés** |
| Comentarios en código y logs técnicos | 🇬🇧 **Inglés** |
| Nombres de archivos, carpetas, rutas, endpoints API, variables de entorno | 🇬🇧 **Inglés** |
| Tests (`describe`/`it`) | 🇪🇸 Español (legibilidad del equipo); cuerpo del test en inglés |

**Reglas duras:**
- ❌ Prohibido el *Spanglish* en código o comentarios.
- ❌ Nunca textos de UI en inglés para usuarios hispanohablantes.
- ❌ Nunca logs técnicos en español (dificulta búsqueda y diagnóstico).
- ❌ **Nunca** menciones IA, Claude o herramientas de IA en mensajes de commit.

## 1.3 Principios de Ingeniería Transversales

- **SOLID**, **DRY** y **Clean Code** como base no negociable.
- **Composición sobre herencia.**
- Nombres **mnemónicos y auto-descriptivos** en inglés.
- Nunca escribas código sin funcionalidad concreta o alineación con un objetivo del sistema.
- Soluciones **listas para producción**: manejo de errores, validación de entradas (Zod/Mongoose) y observabilidad incluidos.

## 1.4 Convenciones de Commits (Conventional Commits)

```text
feat(match): agregar verificación facial de jugador en cancha
fix(camera): resolver memory leak en captura de frames de video
perf(onnx): optimizar tiempo de inferencia en modelo de embeddings
refactor(api): centralizar conexión a mongodb con singleton de mongoose
test(player): agregar pruebas de integración para registro de asistencia
```

**Prohibido:** `"arreglé bug"`, `"mejoras"`, `"cambios por IA"`, `"update"`.

---

# 2. PROTOCOLO DE CLARIFICACIÓN Y PLANIFICACIÓN

1. **Regla de confianza**: Si la confianza en los requisitos está por debajo del **90%**, DETENTE y pide clarificación antes de planear o codificar.
2. **Consulta estructurada**: Agrupa todas las ambigüedades (flujo de datos, casos extremos, esquemas de BD) en una sola respuesta.
3. **Propuesta activa**: Propón soluciones técnicas concretas indicando cómo respetan la arquitectura del proyecto.

## 2.1 Protocolo de Plan de Implementación

Para solicitudes de desarrollo significativas (crear características, refactorizaciones estructurales):
1. **Crear Plan**: Especifica objetivo, archivos a crear/modificar, dependencias y pasos lógicos.
2. **Obtener aprobación**: Detente y solicita confirmación del usuario antes de modificar el código.

---

# 3. ESTRUCTURA Y CONVENCIONES DEL PROYECTO (FULL-STACK MONOLITH)

La aplicación sigue una arquitectura organizada dentro de `src/`:

```text
src/
├── app/                  # Next.js App Router (Páginas y Endpoints)
│   ├── layout.tsx        # Layout principal de la aplicación
│   ├── page.tsx          # Página principal / Dashboard
│   ├── globals.css       # Estilos globales y tokens CSS
│   ├── checkin/          # Vistas de registro/asistencia
│   ├── employees/        # Vistas de administración/jugadores
│   └── api/              # BACKEND: API Route Handlers (Next.js API)
│       ├── employees/    # API endpoints (/api/employees)
│       └── match/        # API endpoints (/api/match)
├── components/           # FRONTEND: Componentes React de interfaz
│   ├── ui/               # Componentes reutilizables (Button, Input, Card)
│   ├── match/            # Componentes específicos de partidos
│   └── player/           # Componentes específicos de jugadores/biometría
├── lib/                  # BACKEND/SHARED: Lógica de negocio y servicios
│   ├── db.ts             # Conexión centralizada a MongoDB via Mongoose
│   ├── azure.ts          # Cliente de Azure Blob Storage
│   ├── vision.ts         # Integración con MediaPipe / ONNX Runtime
│   └── utils.ts          # Utilidades puras
└── models/               # BACKEND: Modelos de Mongoose (Schemas)
    ├── Employee.ts       # Modelo de Jugador / Empleado
    └── Match.ts          # Modelo de Partido / Asistencia
```

---

# 4. ESPECIFICACIONES DE FRONTEND (React 19 + Next.js App Router)

## 4.1 Server vs. Client Components

- Por defecto, las páginas y layouts en `src/app/` son **Server Components**.
- Agrega `'use client';` al inicio del archivo **únicamente** en componentes que requieran interactividad del navegador (state de React, hooks como `useState`, `useEffect`, eventos onClick, cámara web, escaneo QR).

## 4.2 Estado y Datos

- **Mobile First & Responsive**: Sigue las pautas visuales de [DESIGN_GUIDE_UX_UI.MD](file:///home/ivan/Documentos/Proyectos/ReconocimientoCam/DESIGN_GUIDE_UX_UI.MD).
- **Tipado estricto**: Prohibido `any`. Usa TypeScript interfaces/types compartidos.
- **Formularios e Inputs**: Maneja adecuadamente estados de carga (`loading`), errores visuales e inhabilitación durante peticiones asíncronas.

## 4.3 Feedback Visual

Toda acción asíncrona en la UI debe reflejar su estado:
- Estado de carga en botones o contenedores (`disabled`, spinner).
- Mensajes de confirmación o error claros en español (Toast, Alerta o Banner).

---

# 5. ESPECIFICACIONES DE BACKEND (Next.js API Route Handlers + Mongoose)

## 5.1 Route Handlers (`src/app/api/.../route.ts`)

- Implementa métodos HTTP explícitos: `export async function GET(request: Request)`, `POST`, `PUT`, `DELETE`.
- Devuelve siempre objetos `NextResponse.json(data, { status })`.
- Utiliza códigos HTTP adecuados: `200 OK`, `201 Created`, `400 Bad Request`, `404 Not Found`, `500 Internal Server Error`.

Ejemplo de estructura limpia:

```typescript
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Employee } from '@/models/Employee';

export async function GET() {
  try {
    await connectToDatabase();
    const employees = await Employee.find().lean();
    return NextResponse.json(employees, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch employees:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching employees' },
      { status: 500 }
    );
  }
}
```

## 5.2 Persistencia con Mongoose (`src/models/` y `src/lib/db.ts`)

- **Conexión reutilizable**: Centraliza la conexión en `src/lib/db.ts` aprovechando el caché global de Node.js para evitar conexiones duplicadas en Serverless / Next.js dev server.
- **Modelos Mongoose**: Define los esquemas en `src/models/` con TypeScript interfaces asociadas.

## 5.3 Procesamiento de Visión por Computadora y Archivos (`src/lib/`)

- Aísla la lógica pesada de inferencia de IA (ONNX Runtime, MediaPipe) y manipulación de imágenes (`sharp`) en módulos bajo `src/lib/`.
- Gestiona eficientemente la memoria al procesar buffers o tensores de imágenes en Node.js.

---

# 6. COMANDOS DEL PROYECTO

| Comando | Acción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor monolítico de desarrollo Next.js (puerto 3096 con `.env.local`) |
| `npm run build` | Compila la aplicación completa para producción |
| `npm run start` | Inicia el servidor compilado en producción |
| `npm run lint` | Ejecuta la verificación de ESLint en todo el proyecto |

---

# 7. PLANTILLA DE PULL REQUEST

```markdown
## Descripción

[Resumen del cambio realizado en el monolito (Frontend/Backend)]

## Tipo de Cambio

- [ ] Nueva funcionalidad (Feature)
- [ ] Corrección de bug (Fix)
- [ ] Ajuste visual / UI
- [ ] Refactorización de código / API
- [ ] Cambio en modelos de base de datos / Mongoose

## Checklist

- [ ] Pruebas locales completadas (Frontend y Backend)
- [ ] Verificación de TypeScript y Linter sin errores (`npm run lint`)
- [ ] Sin uso de `any`
- [ ] Manejo de errores y logs en inglés verificados
- [ ] Cumplimiento con la guía UI/UX (Mobile First)
```

