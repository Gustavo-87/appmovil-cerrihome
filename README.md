# Cerritos Home

Versión **0.3.0**, para portería y administración del conjunto. React, TypeScript, Vite y Android con Capacitor.

## Funciones

- Reservas de **Salón social, Gimnasio y Golfito**, conflictos de horarios y cancelación con historial.
- Vehículos: ingreso, placas activas únicas y salida.
- Novedades y resolución.
- Firebase Authentication: correo y contraseña, establecimiento inicial y recuperación.
- Administración: creación de cuentas, asignación de los dos roles y desactivación.
- Firestore: información compartida en vivo, reglas de lectura y escrituras validadas en el Mac mediante transacciones.
- Tema claro/oscuro y exportación CSV administrativa.

La migración a Firebase reemplaza Supabase. No hay acceso para residentes ni editor de roles personalizados. Las reservas locales antiguas de BBQ se convierten a Golfito al leerlas; no se importan automáticamente a Firestore.

## Activación en Firebase gratuito y Mac mini

Sigue [PRODUCTION.md](docs/PRODUCTION.md). Debes crear un proyecto **Spark**, habilitar correo/contraseña y Firestore, publicar reglas y configurar el Mac. No se utilizan Cloud Functions ni servicios de SMS. Las cuotas gratuitas deben vigilarse; no son ilimitadas.

```bash
npm ci
cp .env.example .env.local
cp .server.env.example .server.env
```

Configura la aplicación web de Firebase en `.env.local`. En `.server.env`, configura el ID del proyecto, la ruta a una cuenta de servicio privada fuera del repositorio y los orígenes HTTPS de Tailscale. **La credencial privada nunca va en `VITE_*` ni en la web.**

```bash
npm test
npm run admin:bootstrap
npm run build:production
npm run serve
```

El primer administrador requiere `ADMIN_EMAIL` y `ADMIN_NAME`; consulta la guía antes de ejecutarlo. El servidor web y API escucha en `127.0.0.1:4173`; Tailscale Serve proporciona HTTPS. El Mac debe permanecer encendido para guardar datos y administrar cuentas. `npm run prepare:mac` genera un LaunchAgent para revisar e instalar.

## Desarrollo y pruebas

```bash
npm run dev -- --port 5173
npm run build
npm test
```

En desarrollo, `/api` se reenvía al servidor Node del puerto 4173. Para la demostración local sin Firebase:

```bash
VITE_DEMO_MODE=true npm run dev -- --port 5173
```

En otra terminal:

```bash
BROWSER_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

En Mac, instala Chromium con `npx playwright install chromium` y omite `BROWSER_EXECUTABLE_PATH`. La demostración solo está disponible en desarrollo y usa datos ficticios.

`npm test` verifica dominio, compatibilidad de BBQ/Golfito, permisos, configuración, transacciones del servidor con almacén simulado y acceso por contraseña con servicios simulados. Para reglas reales y transacciones concurrentes de Firestore, con Node 24, Java 21 y posibilidad de descargar el emulador:

```bash
npm run test:firebase
```

Este comando usa un proyecto local `demo-cerritos`; no accede a datos reales. `npm run test:server` requiere una compilación de producción preparada. Consulta [VALIDATION.md](docs/VALIDATION.md) para conocer qué se verificó realmente.

## Android

Sigue [ANDROID.md](docs/ANDROID.md), configura Firebase y `VITE_API_ORIGIN` con el HTTPS del Mac antes de sincronizar:

```bash
npm run android:sync
npm run android:open
npm run android:apk
```

APK de pruebas: `artifacts/cerritos-home-0.3.0-debug.apk`. Es de depuración; esta versión todavía requiere validación física y preparación de firma de distribución.

## Archivos principales

- `src/AuthGate.tsx`: correo/contraseña y perfil en vivo.
- `src/backend.ts`: Firebase web, listeners y API del Mac.
- `src/UsersPanel.tsx`: administración de cuentas y roles.
- `server/api.mjs`: verificación de tokens y rutas privadas.
- `server/operations.mjs`: transacciones y reglas de negocio.
- `firebase/firestore.rules`: permisos de Firestore.
- `scripts/bootstrap-admin.mjs`: primer administrador.
- `scripts/serve.mjs`: web y API en el Mac.
- `docs/PRODUCTION.md`: activación completa con Spark y Tailscale.

Cada tarea en la nube ya se ejecuta en un entorno aislado. Utiliza esta copia del repositorio; no crees un Git worktree salvo petición expresa.
