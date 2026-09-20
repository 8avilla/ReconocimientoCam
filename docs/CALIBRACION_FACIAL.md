# Calibración de la verificación facial

**Fecha:** 2026-09-19 · **Modelo:** ArcFace `w600k_r50` (embeddings de 512 dimensiones, similitud coseno) · **Detector:** SCRFD `det_10g`

## Decisión

| Umbral (por campeonato) | Valor | Significado |
| :--- | ---: | :--- |
| `verifyThreshold` | **0.35** | Similitud ≥ 0.35 → **Verificado** |
| `reviewThreshold` | **0.25** | Entre 0.25 y 0.35 → **Revisar** (revisión manual). Menor → **No coincide** |

Los valores numéricos se mantienen, pero ahora **son válidos**: antes se aplicaban a un pipeline sin detección ni alineación, con el que 0.35 rechazaba (o mandaba a revisión) al 18 % de las personas legítimas. El cambio importante fue el pipeline (ver abajo), no el número.

## Pipeline

1. El navegador recorta el rostro con MediaPipe (`FaceCapture`, 320 px).
2. El servidor detecta el rostro con SCRFD; si no lo encuentra en un recorte muy ajustado, reintenta con un margen gris del 50 %.
3. Alinea el rostro con los 5 puntos faciales a la plantilla ArcFace (112×112) y calcula el embedding.
4. Rechaza imágenes sin rostro (`no_face`) o con más de un rostro comparable (`multiple_faces`).

Los embeddings llevan versión (`embeddingVersion`, actualmente 2). Los de versiones anteriores no se comparan; se regeneran con `npm run reembed`.

## Método

- **Datos:** LFW (Labeled Faces in the Wild), 1 483 fotos de 498 personas → 1 668 pares de la misma persona y 1 097 235 pares de personas distintas.
- **Herramienta:** `npm run calibrate -- <carpeta> [--stress 250] [--cache archivo.json]`. La carpeta tiene una subcarpeta por persona con al menos 2 fotos.
- Pipeline **anterior** (recorte estirado a 112 px, aproximación del recorte del navegador) frente al **alineado**.

## Resultados (fotos limpias)

| Umbral | Anterior: falsas aceptaciones | Anterior: legítimos aceptados | Alineado: falsas aceptaciones | Alineado: legítimos aceptados |
| ---: | ---: | ---: | ---: | ---: |
| 0.25 | 0.6068 % | 91.8 % | 0.0155 % | 95.0 % |
| 0.30 | 0.1495 % | 87.9 % | 0.0031 % | 94.9 % |
| **0.35** | 0.0334 % | 82.0 % | **0.0008 %** | **94.8 %** |
| 0.40 | 0.0071 % | 73.6 % | 0.0005 % | 94.1 % |
| 0.50 | 0.0005 % | 48.9 % | 0.0004 % | 90.5 % |

- Misma persona (alineado): mediana 0.67; personas distintas: mediana 0.00, percentil 99.99 en 0.26.
- El piso de ~0.0005 % de falsas aceptaciones son duplicados/errores de etiquetado de LFW (el máximo entre "distintos" es 0.95), no confusiones reales.
- Ruta real de producción (recortes ajustados tipo navegador → detector → alineación), 101 pares: legítimos entre 0.30 y 0.82 (mediana 0.69); distintos, máximo 0.25 sobre 10 100 comparaciones. Con 0.35: 99 % aceptados, 0 falsas aceptaciones.

## Condiciones adversas (alineado, 498 intentos, 124 000 comparaciones de impostores)

| Condición | Umbral 0.25 | Umbral 0.30 | Umbral 0.35 |
| :--- | :--- | :--- | :--- |
| Poca luz (40 % de brillo) | 97.0 % legítimos / 0.0073 % falsas | 96.8 % / 0.0008 % | **96.4 % / 0 %** |
| Ruido + JPEG fuerte | 97.0 % / 0.0097 % | 97.0 % / 0.0008 % | **96.2 % / 0 %** |
| Baja resolución (30 %) + desenfoque | 93.4 % / 0.0129 % | 86.5 % / 0.0008 % | **76.3 % / 0.0008 %** |

La baja resolución es lo que más degrada. Con 0.35, el 24 % de esos intentos caería en revisión, y con 0.25 el 93 % llega al menos a revisión: por eso se mantiene la banda de revisión y la revisión manual.

## Por qué se mantiene 0.35 (y no 0.30)

Bajar a 0.30 sube los legítimos aceptados en condiciones muy malas, pero reduce el margen frente a los parecidos (hermanos, familiares), que superan con facilidad los máximos de LFW entre desconocidos. En una liga de barrio ese es el riesgo real. Los gemelos idénticos no se pueden distinguir con ningún umbral.

## Límites de esta calibración

- LFW son fotos de prensa de figuras públicas: sesgo demográfico (mayoría hombres adultos de piel clara) y sin las condiciones de cancha (contraluz, movimiento, gorras). **Se recomienda repetirla con fotos de los propios jugadores** (con su consentimiento) y ajustar los umbrales por campeonato.
- Los intentos degradados son simulaciones, no capturas reales con cámaras de teléfono.
- Detección de vida (foto de una foto) no está implementada; un rostro impreso puede engañar al sistema.
- El rechazo por "más de un rostro" puede ser conservador en fotos con público al fondo (~8 % en fotos de prensa de LFW).

## Cómo repetirla con datos propios

```bash
# Estructura: fotos/<Nombre_Jugador>/foto1.jpg, foto2.jpg, ...
npm run calibrate -- ./fotos --cache /tmp/embeddings.json --stress 50 --out reporte.json
```

El reporte propone el umbral para falsas aceptaciones objetivo (1 %, 0.1 %, 0.01 %) y la tabla por umbral. Cambia los valores en la pantalla del campeonato (Reglas → Umbrales).
