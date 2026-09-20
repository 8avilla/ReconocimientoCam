# Guía de Diseño de Interfaz (UI/UX) — Super Torneos

**Versión:** 1.0
**Producto:** Super Torneos — Plataforma de gestión de campeonatos de fútbol
**Enfoque:** Web Application · Mobile First · Responsive
**Estilo:** Deportivo, moderno, limpio, confiable y orientado a operación en cancha.

Este documento define los lineamientos visuales, de experiencia de usuario y de interfaz de **Super Torneos**.

El objetivo es garantizar que todas las vistas —administración, equipos, jugadores, partidos, asistencia, verificación, estadísticas y configuración— mantengan una identidad visual consistente tanto en dispositivos móviles como en tabletas y escritorio.

La aplicación debe priorizar especialmente el uso desde **teléfonos móviles durante la operación de los partidos**, donde el árbitro, planillero o delegado puede necesitar registrar asistencia y verificar jugadores rápidamente.

---

# 1. Principios de diseño

La interfaz de Super Torneos debe seguir estos principios:

### 1.1 Mobile First

Toda interfaz debe diseñarse primero para móvil y posteriormente adaptarse a tablet y desktop.

La experiencia móvil es prioritaria para:

* Registro de jugadores.
* Carnet digital.
* Convocatorias.
* Asistencia.
* Verificación de jugadores.
* Registro de eventos.
* Consulta de partidos.
* Consulta de estadísticas.

Desktop debe ofrecer una experiencia más amplia para:

* Administración del campeonato.
* Configuración.
* Gestión de equipos.
* Reportes.
* Estadísticas.
* Auditoría.
* Gestión masiva de información.

---

### 1.2 Simplicidad operacional

Las acciones realizadas en cancha deben requerir el menor número posible de pasos.

Ejemplo:

**Verificar jugador**

```text
Escanear QR
     ↓
Identificar jugador
     ↓
Capturar rostro
     ↓
Validar
     ↓
Confirmar asistencia
```

No se deben crear flujos innecesariamente largos para acciones frecuentes.

---

### 1.3 Jerarquía visual clara

Cada pantalla debe tener una acción principal claramente identificable.

Ejemplo:

```text
Verificación de jugador

[ Información del jugador ]

[ Escanear QR ]

[ Capturar rostro ]

[ Confirmar asistencia ]
```

La acción principal debe diferenciarse visualmente de acciones secundarias.

---

### 1.4 Consistencia

Un componente debe comportarse y verse igual en toda la aplicación.

Por ejemplo:

* Todos los botones primarios utilizan el mismo estilo.
* Todos los estados "Verificado" utilizan el mismo tratamiento.
* Todos los jugadores utilizan la misma estructura de información.
* Todos los encabezados siguen la misma jerarquía.
* Todos los formularios mantienen el mismo espaciado.

---

# 2. Design Tokens

## 2.1 Paleta de colores

La identidad visual de Super Torneos utiliza **verde como color de acción**, **navy como color estructural** y blancos/grises como superficies principales.

### Primary — Verde Super Torneos

```text
#16A34A
```

Uso:

* Botones principales.
* Acciones de confirmación.
* Elementos seleccionados.
* Estados positivos.
* Indicadores de progreso.
* Elementos de navegación activa.

---

### Primary Dark

```text
#15803D
```

Uso:

* Hover.
* Active.
* Estados presionados.
* Elementos de mayor contraste.

---

### Primary Light

```text
#DCFCE7
```

Uso:

* Fondos de estados positivos.
* Badges.
* Cards informativas.
* Fondos secundarios.
* Confirmaciones.

---

### Navy — Color estructural

```text
#0F172A
```

Uso:

* Sidebar desktop.
* Encabezados importantes.
* Elementos de identidad.
* Texto de máxima jerarquía.
* Componentes relacionados con la marca.

---

### Navy Light

```text
#1E293B
```

Uso:

* Variaciones del sidebar.
* Hover de navegación.
* Elementos secundarios oscuros.

---

### Background

```text
#F8FAFC
```

Fondo general de la aplicación.

Debe evitarse el uso de blanco puro como fondo global.

---

### Surface

```text
#FFFFFF
```

Uso:

* Cards.
* Formularios.
* Paneles.
* Modales.
* Listados.

---

### Text Primary

```text
#0F172A
```

Texto principal.

---

### Text Secondary

```text
#64748B
```

Texto secundario, descripciones y metadatos.

---

### Text Disabled

```text
#94A3B8
```

Elementos deshabilitados.

---

### Border

```text
#E2E8F0
```

Bordes y separadores.

---

### Estados

#### Success

```text
Color: #16A34A
Background: #DCFCE7
```

Uso:

* Verificado.
* Activo.
* Presente.
* Pago realizado.
* Partido finalizado correctamente.

#### Warning

```text
Color: #D97706
Background: #FEF3C7
```

Uso:

* Pendiente.
* Revisión requerida.
* Jugador con documentación pendiente.

#### Error

```text
Color: #DC2626
Background: #FEE2E2
```

Uso:

* No coincide.
* Suspendido.
* Error.
* Irregularidad.

#### Info

```text
Color: #2563EB
Background: #DBEAFE
```

Uso:

* Información.
* Procesos en curso.
* Mensajes informativos.

---

# 3. Tipografía

La tipografía principal será:

```text
Inter
```

Fallback:

```text
system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

## Escala

| Token      | Tamaño | Peso | Uso                    |
| ---------- | -----: | ---: | ---------------------- |
| Display    |   32px |  700 | Métricas principales   |
| H1         |   24px |  700 | Título de página       |
| H2         |   20px |  700 | Sección                |
| H3         |   18px |  600 | Card / módulo          |
| Body Large |   16px |  400 | Información importante |
| Body       |   14px |  400 | Texto general          |
| Small      |   12px |  400 | Metadatos              |
| Caption    |   11px |  500 | Información auxiliar   |

En móvil se debe evitar utilizar textos inferiores a **12px**, excepto elementos puramente decorativos.

---

# 4. Sistema de espaciado

Se utilizará una escala basada en múltiplos de 4px:

```text
4px   → xs
8px   → sm
12px  → md
16px  → lg
20px  → xl
24px  → 2xl
32px  → 3xl
40px  → 4xl
48px  → 5xl
```

Regla general:

* Dentro de controles: 8–12px.
* Dentro de cards: 16px.
* Separación entre secciones: 24px.
* Separación entre módulos importantes: 32px.
* Margen exterior de página móvil: 16px.
* Margen exterior desktop: 24–32px.

---

# 5. Border Radius

La interfaz debe transmitir una sensación moderna y deportiva, pero sin exagerar el uso de formas redondeadas.

```text
4px  → sm
8px  → md
12px → lg
16px → xl
999px → pill
```

Uso:

* Inputs: 8px.
* Botones: 8px.
* Cards: 12px.
* Cards destacadas: 16px.
* Badges: pill.
* Avatar: 50%.

---

# 6. Sombras

Las sombras deben ser sutiles.

### Shadow Small

```css
0 1px 2px rgba(15, 23, 42, 0.05)
```

### Shadow Base

```css
0 4px 12px rgba(15, 23, 42, 0.08)
```

### Shadow Elevated

```css
0 8px 24px rgba(15, 23, 42, 0.10)
```

No utilizar sombras fuertes de manera generalizada.

---

# 7. Cards

Las Cards son el principal mecanismo para organizar información.

## Card estándar

```text
Background: #FFFFFF
Border: 1px solid #E2E8F0
Border-radius: 12px
Padding: 16px
Shadow: 0 1px 2px rgba(...)
```

Las cards deben utilizarse para:

* Información de jugador.
* Equipo.
* Próximo partido.
* Resumen de asistencia.
* Resultado de verificación.
* Estadísticas.
* Alertas.
* Resumen del campeonato.

---

## Card de jugador

La estructura recomendada:

```text
┌─────────────────────────────┐
│ [FOTO]  Juan Pérez          │
│         #10 · Delantero     │
│                             │
│         ✓ Verificado        │
│                             │
│                     >       │
└─────────────────────────────┘
```

La foto debe tener suficiente tamaño para permitir una identificación visual rápida.

---

# 8. Botones

## Botón Primary

```text
Background: #16A34A
Text: #FFFFFF
Radius: 8px
Height: 44px
Padding: 0 16px
Font: 14px / 600
```

Ejemplos:

* Guardar jugador.
* Confirmar asistencia.
* Registrar equipo.
* Finalizar partido.
* Verificar jugador.

En acciones críticas realizadas desde móvil, se recomienda una altura de **48px**.

---

## Botón Secondary

```text
Background: #FFFFFF
Border: 1px solid #E2E8F0
Text: #0F172A
Radius: 8px
```

---

## Botón Ghost

Sin fondo ni borde.

Uso:

* Ver detalles.
* Editar.
* Cancelar.
* Acciones secundarias.

---

## Botón Danger

```text
Background: #DC2626
Text: #FFFFFF
```

Uso:

* Eliminar.
* Rechazar.
* Bloquear.
* Invalidar verificación.

No utilizar Danger como acción secundaria normal.

---

# 9. Formularios

Los formularios deben ser simples y verticales.

## Label

```text
Font-size: 12px
Font-weight: 500
Color: #334155
Margin-bottom: 6px
```

## Input

```text
Height: 44px
Background: #FFFFFF
Border: 1px solid #CBD5E1
Border-radius: 8px
Padding: 0 12px
Font-size: 14px
```

En móvil:

```text
min-height: 44px
```

Preferiblemente utilizar 48px para campos críticos.

---

## Estado Focus

```text
Border: #16A34A
Box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.12)
```

---

## Error

```text
Border: #DC2626
```

Mostrar el mensaje debajo del campo:

```text
⚠ El documento ya está registrado.
```

---

# 10. Navegación

## Mobile

La aplicación utilizará **Bottom Navigation** para las funciones principales.

Ejemplo:

```text
┌───────────────────────────────────┐
│                                   │
│           CONTENIDO               │
│                                   │
├───────────────────────────────────┤
│ 🏠       ⚽       ▣       👥    ⋯ │
│Inicio  Partidos Asistencia Equipos│
└───────────────────────────────────┘
```

La navegación principal móvil debe tener máximo **5 opciones visibles**.

Las funciones menos frecuentes estarán dentro de:

```text
Más
```

---

## Desktop

Utilizar **Sidebar lateral izquierdo**.

```text
Super Torneos

Inicio
Campeonato
Equipos
Jugadores
Partidos
Asistencia
Estadísticas
Sanciones
Reportes
Configuración
```

La opción activa debe utilizar:

```text
Background: rgba(22, 163, 74, 0.16)
Color: #16A34A
```

---

# 11. Responsive Design

La aplicación debe utilizar tres grandes puntos de adaptación:

### Mobile

```text
320px – 767px
```

Características:

* Una columna.
* Bottom navigation.
* Cards a ancho completo.
* Formularios verticales.
* Acciones principales de ancho completo.
* Tablas transformadas en cards/listas.

---

### Tablet

```text
768px – 1023px
```

Características:

* Sidebar compacto opcional.
* 2 columnas cuando sea conveniente.
* Cards agrupadas.
* Formularios de 2 columnas cuando exista espacio.

---

### Desktop

```text
1024px+
```

Características:

* Sidebar completo.
* Contenido central.
* Grids de 2–4 columnas.
* Tablas completas.
* Paneles laterales.
* Mayor densidad de información.

---

# 12. Regla fundamental Mobile First

Nunca se debe crear una vista desktop y posteriormente intentar "encogerla".

La implementación debe seguir:

```text
Mobile
   ↓
Tablet
   ↓
Desktop
```

Por ejemplo:

### Mobile

```text
Jugador
Foto
Nombre
Estado
Acciones
```

### Desktop

```text
Foto | Jugador | Equipo | Posición | Estado | Acciones
```

La información es la misma; cambia su distribución.

---

# 13. Tablas

Las tablas son apropiadas para desktop.

En móvil deben transformarse cuando sea necesario.

### Desktop

```text
Jugador | Equipo | Posición | Estado | Verificación | Acciones
```

### Mobile

```text
┌───────────────────────────┐
│ [Foto] Juan Pérez         │
│ Atlas FC · #10            │
│                           │
│ ✓ Verificado              │
│                           │
│                 Ver >     │
└───────────────────────────┘
```

No forzar tablas horizontales cuando la información pueda representarse mediante cards.

---

# 14. Estados deportivos

Super Torneos necesita un sistema de estados visual consistente.

### Jugador

```text
🟢 Activo
🟡 Pendiente
🔴 Suspendido
⚪ Inactivo
```

### Asistencia

```text
🟢 Presente
⚪ Ausente
🟡 Pendiente
```

### Verificación

```text
🟢 Verificado
🟡 Revisar
🔴 No coincide
⚪ Sin verificar
```

### Partido

```text
🔵 Programado
🟢 En curso
⚫ Finalizado
🟡 Aplazado
🔴 Suspendido
⚪ W.O.
```

Los estados deben utilizar siempre:

```text
Icono + texto
```

No depender únicamente del color.

---

# 15. Verificación de jugadores

La verificación es una funcionalidad crítica y debe tener una interfaz especialmente sencilla.

## Flujo

```text
1. Escanear QR
        ↓
2. Identificar jugador
        ↓
3. Capturar rostro
        ↓
4. Comparar
        ↓
5. Mostrar resultado
        ↓
6. Confirmar asistencia
```

La interfaz debe mostrar siempre el paso actual.

```text
✓ Escanear QR
→ Capturar rostro
○ Validar
○ Confirmar
```

---

## Resultado positivo

```text
┌──────────────────────────────┐
│       ✓ IDENTIDAD VALIDADA   │
│                              │
│        [ FOTO ]              │
│                              │
│       Juan Pérez             │
│       Atlas FC               │
│       #10 · Delantero        │
│                              │
│       Confianza: 98.4%       │
│                              │
│   [ Confirmar asistencia ]   │
└──────────────────────────────┘
```

---

## Resultado negativo

```text
┌──────────────────────────────┐
│      ⚠ VERIFICACIÓN FALLIDA │
│                              │
│ El rostro no coincide con    │
│ el jugador registrado.       │
│                              │
│ [ Intentar nuevamente ]      │
│ [ Revisión manual ]          │
└──────────────────────────────┘
```

La interfaz no debe bloquear al árbitro sin ofrecer un mecanismo de revisión manual cuando las reglas del campeonato lo permitan.

---

# 16. Dashboard

El dashboard debe mostrar primero la información más importante.

### Mobile

```text
Super Torneos

Próximo partido
┌───────────────────────┐
│ Atlas FC   VS Brazuca │
│ Hoy · 7:00 PM         │
│ Cancha La 10          │
└───────────────────────┘

Acciones rápidas

[ Asistencia ]
[ Partidos ]

Resumen
12 equipos
186 jugadores
8 partidos
```

---

### Desktop

Utilizar:

```text
┌────────────────────────────────────┐
│ Resumen del campeonato             │
├─────────┬─────────┬─────────┬──────┤
│ Equipos │Jugadores│Partidos │Alertas│
├─────────┴─────────┴─────────┴──────┤
│ Próximos partidos                   │
│                                    │
├───────────────────┬────────────────┤
│ Tabla              │ Últimos juegos │
└───────────────────┴────────────────┘
```

---

# 17. Iconografía

Utilizar una única familia de iconos.

Preferiblemente:

```text
Material Symbols / Material Icons
```

o una librería equivalente basada en estilo **outline**.

Los iconos deben:

* Mantener el mismo peso visual.
* Tener tamaños consistentes.
* No mezclarse con múltiples estilos.
* Tener tooltip en desktop cuando no exista texto.

Tamaños:

```text
16px → información secundaria
20px → controles
24px → navegación
28–32px → acciones destacadas
```

---

# 18. Fotografía de jugadores

La fotografía tiene un papel funcional, no solamente decorativo.

Debe mantenerse:

```text
Aspect ratio: 1:1
Object-fit: cover
Border-radius: 50% o 12px
```

La misma fotografía debe utilizarse en:

* Perfil.
* Carnet.
* Lista de jugadores.
* Convocatoria.
* Asistencia.
* Verificación.
* Estadísticas.

Esto permite que el administrador y árbitro identifiquen visualmente al jugador.

---

# 19. Acciones rápidas

Las funciones utilizadas durante un partido deben estar disponibles con pocos toques.

Ejemplo:

```text
Partido

Atlas FC  VS  Brazuca FC

[ Escanear jugador ]

16 convocados
12 verificados
2 pendientes
2 ausentes
```

La acción principal debe estar visible sin necesidad de abrir menús secundarios.

---

# 20. Feedback

Toda operación importante debe proporcionar feedback inmediato.

### Éxito

```text
✓ Jugador registrado correctamente
```

### Error

```text
✕ No fue posible registrar el jugador
```

### Procesando

```text
⟳ Verificando identidad...
```

### Advertencia

```text
⚠ Jugador suspendido
```

En móvil, los mensajes deben ser visibles y no depender exclusivamente de tooltips.

---

# 21. Modales

Los modales deben utilizarse únicamente para acciones que realmente requieren confirmación o información adicional.

Ejemplos:

* Confirmar eliminación.
* Confirmar cierre del partido.
* Mostrar detalles de una sanción.
* Confirmar una revisión manual.

En móvil deben aparecer como **bottom sheets** cuando sea apropiado.

---

# 22. Accesibilidad

La interfaz debe cumplir principios básicos de accesibilidad:

* Contraste suficiente.
* Tamaño táctil mínimo de 44px.
* Estados no dependientes únicamente del color.
* Labels visibles.
* Focus claramente identificable.
* Navegación mediante teclado en desktop.
* Textos legibles.
* Mensajes de error comprensibles.

---

# 23. Arquitectura visual de cada pantalla

Toda pantalla debe seguir, cuando corresponda, esta estructura:

```text
┌──────────────────────────────┐
│ Header / navegación          │
├──────────────────────────────┤
│ Breadcrumb / contexto        │
│                              │
│ Título                       │
│ Descripción                  │
│                              │
│ ┌──────────────────────────┐ │
│ │ Contenido principal      │ │
│ │                          │ │
│ └──────────────────────────┘ │
│                              │
│ Acciones                     │
└──────────────────────────────┘
```

En móvil se debe reducir la cantidad de elementos visibles simultáneamente.

---

# 24. Regla de densidad

Super Torneos es una aplicación operativa, no una aplicación puramente visual.

Debe existir un equilibrio entre:

**Información suficiente + lectura rápida.**

Evitar:

* Demasiados colores.
* Demasiadas cards anidadas.
* Sombras excesivas.
* Textos largos.
* Botones innecesarios.
* Iconos decorativos sin función.
* Elementos que compitan con la acción principal.

---

# 25. Identidad visual

La identidad debe transmitir:

```text
DEPORTIVA
MODERNA
CONFIABLE
SIMPLE
OPERATIVA
```

No debe parecer:

* una red social,
* una tienda deportiva,
* una aplicación financiera,
* ni un sistema administrativo antiguo.

La estética debe combinar:

**tecnología + fútbol + simplicidad operacional.**

---

# 26. Reglas específicas para Angular

Los componentes visuales deben construirse de forma reutilizable.

Ejemplo conceptual:

```text
components/
├── ui/
│   ├── button
│   ├── input
│   ├── select
│   ├── card
│   ├── badge
│   ├── avatar
│   ├── modal
│   ├── bottom-sheet
│   ├── table
│   ├── empty-state
│   ├── loading
│   └── toast
│
├── player/
│   ├── player-card
│   ├── player-avatar
│   ├── player-status
│   └── player-id-card
│
├── match/
│   ├── match-card
│   ├── match-status
│   ├── match-event
│   └── match-header
│
└── verification/
    ├── qr-scanner
    ├── face-verification
    ├── verification-status
    └── verification-result
```

Las pantallas no deberían definir estilos propios para componentes que ya existen en el Design System.

---

# 27. CSS Variables

Los tokens principales deben centralizarse.

Ejemplo:

```css
:root {
  --color-primary: #16A34A;
  --color-primary-dark: #15803D;
  --color-primary-light: #DCFCE7;

  --color-navy: #0F172A;
  --color-navy-light: #1E293B;

  --color-background: #F8FAFC;
  --color-surface: #FFFFFF;

  --color-text-primary: #0F172A;
  --color-text-secondary: #64748B;
  --color-text-disabled: #94A3B8;

  --color-border: #E2E8F0;

  --color-success: #16A34A;
  --color-warning: #D97706;
  --color-error: #DC2626;
  --color-info: #2563EB;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-pill: 999px;

  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 20px;
  --space-2xl: 24px;
  --space-3xl: 32px;

  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.05);
  --shadow-base: 0 4px 12px rgba(15, 23, 42, 0.08);
  --shadow-lg: 0 8px 24px rgba(15, 23, 42, 0.10);
}
```

---

# 28. Regla final de consistencia

Antes de crear cualquier nueva vista, se debe responder:

1. ¿Está diseñada Mobile First?
2. ¿Utiliza los tokens existentes?
3. ¿Utiliza componentes existentes?
4. ¿La acción principal es evidente?
5. ¿Funciona correctamente con una sola mano en móvil?
6. ¿Tiene una adaptación clara para desktop?
7. ¿Los estados utilizan el sistema estándar?
8. ¿Los iconos pertenecen a la misma familia?
9. ¿La jerarquía tipográfica es consistente?
10. ¿La pantalla mantiene la identidad visual de Super Torneos?

Si alguna respuesta es **no**, la pantalla debe ajustarse antes de considerarse terminada.

---

## Principio rector

> **"Una sola experiencia, cualquier dispositivo."**

Super Torneos debe sentirse como el mismo producto en un teléfono, una tableta o un computador.

El dispositivo cambia la distribución de la interfaz, pero no cambia:

* los colores,
* la tipografía,
* los componentes,
* los estados,
* los comportamientos,
* ni la identidad visual.

La prioridad siempre será:

**claridad → velocidad → consistencia → estética.**
