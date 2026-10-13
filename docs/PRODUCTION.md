# Activación 0.4.0: Firebase gratuito, Mac mini y Tailscale

La aplicación usa **Firebase Authentication (correo y contraseña)** y **Cloud Firestore**, con los roles de Portería y Administrador. Los espacios son Salón social, Gimnasio y Golfito. Todavía debes crear el proyecto y comprobar el servicio real antes de ingresar datos operativos.

La web y la API funcionan en el Mac mini. Tailscale Serve proporciona HTTPS privado. El navegador lee datos autorizados de Firestore en tiempo real; las escrituras pasan por la API del Mac, que verifica el token de Firebase y el miembro activo dentro de transacciones. Así evita cruces de reservas, placas activas duplicadas y la eliminación del último administrador activo.

No se utilizan Cloud Functions, Firebase Hosting, Storage ni servicios de SMS. La cuenta de Firebase permanece en **Spark**, sin habilitar Blaze. El Mac debe estar encendido para sincronizar operaciones y gestionar cuentas. Android puede guardar registros localmente cuando no alcanza el servidor; consulta [OFFLINE.md](OFFLINE.md). Los dispositivos web deben tener Tailscale y permiso para alcanzar el Mac; una cuenta de la app no concede acceso a la tailnet.

## 1. Crear Firebase y Firestore

En Firebase Console, crea un proyecto en el plan Spark. Google Analytics es opcional y no es necesario para esta aplicación. Registra una **aplicación web** en la configuración del proyecto.

En Authentication, habilita el proveedor **Correo electrónico/Contraseña**, configura una política de contraseñas y activa la protección contra enumeración de correos si está disponible. Revisa el remitente y la plantilla de **restablecimiento de contraseña**: ese enlace se usa también para establecer la primera contraseña de una cuenta autorizada.

En Cloud Firestore, crea la base **predeterminada**, elige la región con cuidado y empieza en modo producción. Publica el contenido de `firebase/firestore.rules` en la pestaña Rules. También puedes usar la CLI:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project TU-ID-DE-PROYECTO
```

Las reglas permiten lecturas operativas a miembros activos de Portería o Administración, y deniegan todas las escrituras del navegador. Una cuenta de Authentication solo tiene acceso si posee un documento de miembro autorizado. No hay formulario de registro público. Los índices de horarios, placas activas y contador de administradores son privados del servidor.

## 2. Configuración pública de la web

Instala Node.js 24 en el Mac mini. Usa una carpeta estable para el proyecto:

```bash
npm ci
cp .env.example .env.local
```

Copia los valores de la configuración de tu aplicación web de Firebase:

```dotenv
VITE_FIREBASE_API_KEY=CLAVE-WEB-PUBLICA
VITE_FIREBASE_AUTH_DOMAIN=TU-PROYECTO.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=TU-ID-DE-PROYECTO
VITE_FIREBASE_APP_ID=ID-DE-LA-APP-WEB
VITE_API_ORIGIN=
VITE_DEMO_MODE=false
```

En web, `VITE_API_ORIGIN` vacío significa que se utiliza la misma dirección de Tailscale que sirve la página. Para un APK Android, configura esa variable con la URL HTTPS completa del Mac, sin `/api` ni rutas adicionales.

La configuración de Firebase web es pública y se incluye en la compilación. Su protección depende de las reglas y de los permisos del servidor. **Nunca copies la clave privada de la cuenta de servicio a variables `VITE_*`, al repositorio ni a `dist/`.**

## 3. Credencial privada del Mac

En Project Settings → Service Accounts → Firebase Admin SDK, genera una clave privada para el servidor y guárdala **fuera del repositorio**, en una carpeta privada del usuario que ejecutará Node. Limita sus permisos al propietario y respáldala de forma segura. No compartas ese JSON por el chat.

```bash
cp .server.env.example .server.env
```

Edita `.server.env`:

```dotenv
FIREBASE_PROJECT_ID=TU-ID-DE-PROYECTO
GOOGLE_APPLICATION_CREDENTIALS=/Users/TU-USUARIO/.config/cerritos/firebase-admin.json
ALLOWED_ORIGINS=https://TU-MAC.TU-TAILNET.ts.net,https://localhost
```

`ALLOWED_ORIGINS` contiene el origen exacto de la web y, si vas a usar Android, su origen `https://localhost`. Usa valores separados por comas, sin comodines. En desarrollo puedes añadir `http://localhost:5173`.

El Admin SDK puede saltarse las reglas de Firestore. Por eso la API valida el token, el rol y la cuenta activa, y repite la comprobación de permisos dentro de la transacción de escritura. El archivo `.server.env` se carga solo en Node y está excluido de Git.

## 4. Primer administrador

Desde el Mac con la configuración privada preparada, en Terminal (zsh):

```zsh
read -r 'ADMIN_EMAIL?Correo del administrador: '
read -r 'ADMIN_NAME?Nombre del administrador: '
export ADMIN_EMAIL ADMIN_NAME
npm run admin:bootstrap
unset ADMIN_EMAIL ADMIN_NAME
```

El script crea una cuenta con contraseña aleatoria que no se imprime ni se comparte. Inicializa al primer miembro administrador y su contador en una transacción. Si ya se inicializó, se detiene.

Después abre la aplicación, escribe el correo y pulsa **Establecer o recuperar contraseña**. Firebase enviará el enlace para definirla. El script no envía mensajes por su cuenta.

Para las demás personas, Administración crea la cuenta y asigna Portería o Administrador. Luego pulsa **Enviar enlace de contraseña** en su fila, o indica al usuario que use el botón de recuperación del acceso. Ese envío utiliza Firebase Authentication, no un SMTP propio.

## 5. Publicar con Tailscale

```bash
npm test
npm run build:production
npm run serve
```

El servidor escucha solo en `127.0.0.1:4173`. En otra terminal:

```bash
 tailscale serve --bg http://127.0.0.1:4173
 tailscale serve status
```

Obtendrás la URL HTTPS del Mac, por ejemplo `https://mac-mini.TU-TAILNET.ts.net`. Configura ese origen en `.server.env` y añade el dominio, sin `https://`, a **Authentication → Settings → Authorized domains**. Añade `localhost` explícitamente si lo necesitas en desarrollo. Reinicia Node después de cambiar `.server.env`.

No abras el puerto 4173 en el router. Cada dispositivo del personal necesita Tailscale y las reglas de acceso de la tailnet correspondientes. Mantén HTTPS habilitado en Tailscale. No se habilita Funnel en este procedimiento.

Para que Node se reinicie cuando falle, después de verificar el arranque manual, detén `npm run serve` y prepara el LaunchAgent:

```bash
npm run prepare:mac
plutil -lint artifacts/com.cerritoshome.web.plist
mkdir -p "$HOME/Library/LaunchAgents"
cp artifacts/com.cerritoshome.web.plist "$HOME/Library/LaunchAgents/"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.cerritoshome.web.plist"
```

LaunchAgent arranca al iniciar sesión del usuario, no necesariamente antes del inicio de sesión tras reiniciar el Mac. Para arranque desatendido debes preparar y verificar un LaunchDaemon con una cuenta de servicio. Conserva las rutas de Node, del proyecto y de la credencial privada. Mantén el Mac conectado, alimentado y sin suspensión, y prueba recuperación de Node y Tailscale tras reiniciar.

Logs: `artifacts/web.log` y `artifacts/web-error.log`. Actualización:

```bash
npm ci
npm test
npm run build:production
launchctl kickstart -k "gui/$(id -u)/com.cerritoshome.web"
```

La compilación reemplaza `dist/`; utiliza una ventana de mantenimiento y guarda la versión anterior para poder restaurarla.

## 6. Cuotas del plan gratuito

Firestore gratuito tiene límites de almacenamiento y cuotas diarias de lecturas y escrituras. Como referencia habitual: 1 GiB de datos, 50.000 lecturas y 20.000 escrituras al día; confirma los límites actuales en la consola. Las transacciones, las comprobaciones de reglas, los registros de auditoría y las primeras conexiones de los listeners consumen cuota.

Los listeners reciben cambios en vivo; no se descarga toda la base cada 15 segundos. Aun así, esta versión carga la historia completa autorizada al conectarse. Revisa Usage, retención y volumen; si crece la historia, añade consultas por fecha y paginación. **Spark no garantiza capacidad ilimitada:** al agotar cuota algunas operaciones dejan de funcionar. No habilites Blaze para resolverlo sin revisar sus costes.

Las copias de seguridad administradas y determinadas exportaciones de Google pueden requerir facturación. `npm run backup` permite crear una copia JSON desde el Mac mediante el SDK, consumiendo lecturas de tu cuota. Contiene datos personales: guárdala fuera del servidor público, con acceso restringido y una copia protegida en otro dispositivo. No incluye las contraseñas de Firebase Authentication y no sustituye un procedimiento de restauración probado. El CSV de reservas tampoco es un respaldo completo.

## 7. Verificación antes de uso real

1. Solicita el enlace del primer administrador, establece contraseña e ingresa. Comprueba contraseña incorrecta y recuperación.
2. Autoriza Portería; envía su enlace e ingresa desde otro dispositivo autorizado en Tailscale. No debe aparecer Administración ni permitirse cambios de cuentas por API.
3. Crea una reserva de Golfito futura y confirma que aparece en ambos equipos. Intenta reservas cruzadas simultáneamente: solo una puede guardarse.
4. Registra una placa, intenta duplicarla, registra salida y vuelve a ingresarla. Crea y resuelve una novedad.
5. Desactiva una cuenta y comprueba que pierde acceso a nuevas lecturas y escrituras. El último administrador activo no puede desactivarse ni perder su rol.
6. Cierra sesión y comprueba que desaparece la información. Una pantalla o CSV ya descargados no pueden borrarse a distancia.
7. Desconecta el Mac: las escrituras deben fallar sin anunciarse como guardadas. Comprueba recuperación después de reiniciar el Mac.
8. Publica y verifica las reglas; revisa cuota y auditoría. Prueba un respaldo y un procedimiento de restauración en un proyecto de prueba.

Android conserva la interfaz instalada, la sesión preparada, los datos descargados y los registros locales cuando no hay conexión. El primer acceso, la recuperación de contraseña, la gestión de cuentas y la sincronización requieren conexión. Las reservas pendientes requieren validación del servidor y pueden rechazarse por conflictos o fechas ya transcurridas. Esta sesión no tiene acceso a tu cuenta de Firebase ni al Mac. Las pruebas locales no acreditan por sí solas el despliegue real.
