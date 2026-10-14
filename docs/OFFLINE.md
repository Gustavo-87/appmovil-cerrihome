# Android sin Internet — versión 0.4.0

La interfaz está dentro del APK, no se descarga del Mac para abrirse. Firestore mantiene una caché persistente de los datos ya consultados. Las operaciones se guardan en una cola separada en IndexedDB, con usuario, identificador único y hora del dispositivo. El Mac valida y confirma su sincronización cuando vuelve a estar accesible.

## Preparación del teléfono (una vez con Internet)

1. Instala el APK. Si el Mac está publicado con Funnel, el teléfono no necesita Tailscale; sigue [la guía de acceso público](PUBLIC_ACCESS.md).
2. Actualiza primero el servidor del Mac a 0.4.0 y reinícialo. En `.server.env`, añade el origen Android conservando los otros orígenes:

```dotenv
ALLOWED_ORIGINS=http://localhost:4173,http://127.0.0.1:4173,https://mac-mini.tail653cc7.ts.net,https://localhost
```

3. Abre la app Android e ingresa con una cuenta autorizada. Espera a que carguen reservas, vehículos y novedades. Mantén la sesión iniciada.
4. Crea un registro de prueba conectado y comprueba que desaparece de los pendientes y aparece en la web del Mac.
5. Activa modo avión, registra un vehículo, su salida y una novedad. Cierra y vuelve a abrir la app: deben seguir disponibles como registros locales.
6. Desactiva modo avión, recupera Internet (y Tailscale solo si el servidor sigue privado) y abre la app. Pulsa **Sincronizar ahora** si lo necesitas. Comprueba los registros en el Mac y que no se duplicaron.

El primer acceso de un teléfono nuevo necesita Internet. Recuperar contraseña o cambiar de cuenta sin una sesión preparada no puede autenticarse offline.

## Qué funciona sin conexión

- Abrir el APK con la sesión previamente preparada.
- Consultar la última información descargada.
- Registrar ingresos, salidas, novedades y sus resoluciones.
- Crear solicitudes de reserva y cancelaciones locales.
- Conservar esos cambios al cerrar y reabrir la app.

Los cambios se muestran como **Pendiente de sincronizar**, no como operaciones confirmadas en Firebase. **Una reserva offline no garantiza disponibilidad:** otros teléfonos pueden estar reservando el mismo horario. Al sincronizar se validan conflictos y fechas; una solicitud cuya hora ya pasó puede rechazarse.

Gestión de usuarios, restablecimiento de contraseña y confirmación de operaciones requieren conexión. La web no incorpora un service worker: abrir o recargar la web desde fuera del Mac necesita acceso al servidor. El modo descrito aquí corresponde al APK con sus recursos incluidos.

## Sincronización y revisión

Mientras la app está abierta, reintenta al recuperar red y periódicamente cuando hay pendientes. Si se cerró o Android detuvo el proceso, reabre la app para sincronizar. Tener Wi-Fi no garantiza acceso al Mac: también deben funcionar Internet, Tailscale y el servidor.

El servidor utiliza comprobantes de operación dentro de las mismas transacciones que los registros. Si una respuesta se pierde después de guardarse, reenviar el mismo identificador devuelve el resultado previo y evita duplicados. Las horas de ingresos y salidas conservan el momento registrado por el dispositivo; la auditoría conserva además la hora de recepción del servidor. Mantén correcto el reloj del teléfono.

Los rechazos por cruces, placas duplicadas o datos inválidos aparecen en **Sincronización → requieren revisión**. El registro local se conserva para revisarlo; puedes reintentar si resolviste la causa o descartar explícitamente ese cambio y registrar la corrección. No se sobrescriben operaciones de otros dispositivos para resolver conflictos.

Si el servidor es antiguo, los registros quedan pendientes y la app pide actualizarlo antes de enviarlos. Las cuentas desactivadas no pueden sincronizar. Sin conexión solo se conoce el último permiso descargado; la revocación efectiva se verifica al reconectar.

Los pendientes pertenecen a la cuenta que los creó. Cerrar sesión no los borra, pero solo se sincronizan al volver a ingresar con esa cuenta. La app avisa si cierras sesión con pendientes.

**No desinstales la app ni borres su almacenamiento mientras existan pendientes.** Esos registros todavía no están en Firebase ni en el respaldo del Mac. Actualizar conservando identificador y firma mantiene el almacenamiento; las APK de depuración generadas con claves distintas no pueden actualizarse entre sí.

## Actualizar el servidor del Mac sin mover la carpeta

Desde Terminal, dentro de la misma carpeta que ya utiliza tu LaunchAgent, ejecuta:

```zsh
CERRITOS_UPDATE_DIR="$(mktemp -d)"
curl -fL https://github.com/Gustavo-87/appmovil-cerrihome/archive/refs/heads/firebase-golfito-0.3.0.zip -o "$CERRITOS_UPDATE_DIR/source.zip"
unzip -q "$CERRITOS_UPDATE_DIR/source.zip" -d "$CERRITOS_UPDATE_DIR"
ditto "$CERRITOS_UPDATE_DIR/appmovil-cerrihome-firebase-golfito-0.3.0" .
npm ci
npm approve-scripts esbuild @firebase/util protobufjs
npm rebuild esbuild @firebase/util protobufjs
npm test
npm run build:production
```

La descarga contiene los archivos públicos del proyecto, no `.env.local` ni `.server.env`; al mezclar se conservan tus configuraciones privadas. No cambies el nombre ni la ubicación de la carpeta del servicio. La rama conserva su nombre histórico, pero `package.json` debe mostrar versión 0.4.0.

Edita `.server.env`, añade `https://localhost` a `ALLOWED_ORIGINS` como se muestra arriba y reinicia:

```bash
launchctl kickstart -k "gui/$(id -u)/com.cerritoshome.web"
```

Si todavía ejecutas el servidor manualmente, detén la Terminal anterior con Ctrl+C y usa `npm run serve`. No vuelvas a ejecutar `admin:bootstrap`: las cuentas existentes y los datos de Firebase se conservan.

## Compilar en tu Mac

En `.env.local`, configura:

```dotenv
VITE_API_ORIGIN=https://mac-mini.tail653cc7.ts.net
```

Con JDK 21 y Android SDK 36 preparados:

```bash
npm ci
npm test
npm run android:apk
```

El comando genera `artifacts/cerritos-home-0.4.0-debug.apk`. `android:sync` comprueba que Android tiene configurado un origen HTTPS. Nunca añadas la credencial privada del servidor al APK.

El APK es de pruebas y necesita validación en tu teléfono, especialmente reapertura en modo avión, almacenamiento de WebView y recuperación de Tailscale. La firma de distribución y las pruebas físicas son pasos distintos de compilarlo. Se recomienda un Android moderno con Android System WebView actualizado.
