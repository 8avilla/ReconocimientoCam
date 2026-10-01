# App Android (TWA) de Super Torneos

La app Android es un contenedor que abre https://supertorneos.com.co en Chrome a pantalla completa.
La web (Next.js) sigue siendo la única fuente de código.

## Generar el AAB
```bash
cd twa
npm i -g @bubblewrap/cli
bubblewrap init --manifest=https://supertorneos.com.co/manifest.webmanifest   # o usar twa-manifest.json ya incluido
bubblewrap build        # genera app-release-bundle.aab (subir a Play) y app-release-signed.apk (pruebas)
```
Requiere JDK 17 y Android SDK (Bubblewrap ofrece descargarlos). Guarda `supertorneos.keystore` y su
contraseña en un lugar seguro (NO subir al repo, ya está en .gitignore).

## Digital Asset Links (quita la barra de URL)
1. Sube el AAB a Play Console (prueba interna).
2. En Play Console → Integridad de la app → Firma de la app, copia el SHA-256 del certificado de firma de la app.
3. Copia `assetlinks.template.json` a `public/.well-known/assetlinks.json` con ese SHA-256
   (si quieres probar con el APK local, agrega también el SHA-256 de tu keystore: `bubblewrap fingerprint`).
4. Despliega la web y verifica: https://supertorneos.com.co/.well-known/assetlinks.json

## Para actualizar
Los cambios de la web llegan solos. Solo se republica el AAB si cambias icono, nombre o versión
(sube `appVersionCode` en twa-manifest.json).
