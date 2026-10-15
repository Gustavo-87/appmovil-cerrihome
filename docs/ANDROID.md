# Pruebas de Cerritos Home en Android

**Entrega 0.5.0 para teléfono nuevo:** consulta [ANDROID-NEW-PHONE.md](ANDROID-NEW-PHONE.md).
Se ha autorizado una firma permanente nueva, independiente de las APK anteriores.
No instales esta entrega como actualización ni desinstales la aplicación anterior.
Las referencias 0.4.0 de esta guía corresponden al procedimiento anterior;
el código actual usa versionName 0.5.0 y versionCode 8.

La aplicación incluye la interfaz dentro del APK y conecta directamente a Firebase para autenticación y lecturas compartidas, y a la API del Mac para guardar operaciones. Después del primer acceso permite consultas y registros locales sin Internet; no necesita Vite, pero necesita alcanzar el Mac por Tailscale para escribir datos. Configura primero el proyecto real según [la guía de producción](PRODUCTION.md), incluidos Firebase, `VITE_API_ORIGIN` con el HTTPS del Mac y el origen Android en `ALLOWED_ORIGINS` del servidor. Sin configuración no permite ingresar. Sigue el recorrido de [OFFLINE.md](OFFLINE.md) para preparar y probar el teléfono.

## Instalar el APK de pruebas

1. Descarga el archivo `cerritos-home-0.4.0-debug.apk` generado en `artifacts/` y transfiérelo al teléfono por USB, o descárgalo directamente desde el teléfono si tienes acceso al archivo.
2. Abre el archivo en Android. Cuando el sistema lo solicite, permite **Instalar aplicaciones desconocidas** únicamente para la aplicación que estás utilizando para abrirlo (por ejemplo, Archivos).
3. Instala y abre **Cerritos Home**. Puedes desactivar ese permiso después de la instalación.
4. Entra con un correo autorizado por administración y su contraseña. Prueba inicialmente con datos ficticios: los registros se guardan en la base de datos compartida.

El APK es de depuración, firmado automáticamente con una clave de desarrollo. No es una versión publicada en Google Play ni una firma de producción. El archivo `.sha256` permite comprobar que el APK no cambió durante la transferencia.

Una actualización mantiene los datos únicamente si conserva el mismo identificador de aplicación, una versión compatible y la misma firma. Si Android muestra un conflicto de firma al cambiar entre APK generado aquí y APK generado en tu Mac, ambas máquinas usan claves de desarrollo diferentes. No desinstales una versión con datos que necesites conservar: desinstalar borra el almacenamiento local. La exportación CSV solo contiene las reservas; el respaldo completo se gestiona en Firestore.

## Preparar el Mac

1. Instala Node.js 24 y [Android Studio](https://developer.android.com/studio).
2. En Android Studio, abre **SDK Manager** e instala:
   - **Android SDK Platform 36** (Android 16).
   - **Android SDK Build-Tools 35.0.0**.
   - **Android SDK Platform-Tools**.
   - Para usar un emulador: Android Emulator y una imagen de sistema ARM64 en Mac con Apple Silicon, o x86_64 en Mac Intel.
3. Usa JDK 21 o superior compatible con Gradle 8.14.3; se recomienda JDK 21. El proyecto está validado con JDK 21. Android Studio puede proporcionar el JDK desde su instalación.
4. En Terminal, entra en la carpeta del proyecto y actualízalo:

```bash
git pull origin main
npm ci
npm run android:sync
npm run android:open
```

`android:sync` compila la web y actualiza los archivos y plugins del proyecto Android. `android:open` abre la carpeta `android/` en Android Studio. La primera sincronización de Gradle descarga herramientas y dependencias; necesita Internet.

Si Android Studio solicita una ubicación de SDK o JDK, configura la que acabas de instalar. En **Settings → Build, Execution, Deployment → Build Tools → Gradle**, revisa **Gradle JDK**. Configura `.env.local` con Firestore antes de sincronizar. Configura los valores públicos de Firebase y la dirección HTTPS de la API del Mac. La credencial privada de servidor nunca debe estar en el APK.

## Ejecutar en tu teléfono desde Android Studio

1. En el teléfono: **Ajustes → Acerca del teléfono → Número de compilación**, toca siete veces para habilitar las opciones de desarrollador. La ubicación exacta varía según el fabricante.
2. Activa **Depuración USB** en Opciones de desarrollador.
3. Conecta el teléfono al Mac con un cable que permita transferencia de datos y acepta la autorización de depuración en el teléfono.
4. En Android Studio, selecciona el teléfono como dispositivo de ejecución, el módulo **app**, y pulsa **Run ▶**.
5. Alternativamente, después de configurar las herramientas, ejecuta `npm run android:run` y selecciona el dispositivo.

Para simular un teléfono, crea uno en **Device Manager**, inicia el emulador y selecciónalo en lugar del dispositivo USB.

Después de cambiar React, estilos o plugins, vuelve a ejecutar `npm run android:sync` antes de pulsar Run. Recargar Vite no actualiza una app ya instalada.

## Generar tu propio APK desde Terminal

En una instalación estándar de Android Studio en Mac:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
npm run android:apk
```

El script también intenta detectar estas rutas automáticamente. Si instalaste Android Studio o el SDK en otro lugar, usa las rutas reales. El comando compila la web, sincroniza Capacitor y ejecuta `:app:assembleDebug`.

Resultados:

- `artifacts/cerritos-home-0.4.0-debug.apk`
- `artifacts/cerritos-home-0.4.0-debug.apk.sha256`
- Original de Gradle: `android/app/build/outputs/apk/debug/app-debug.apk`

Para instalar por USB desde Terminal, con el teléfono autorizado:

```bash
"$ANDROID_HOME/platform-tools/adb" devices
"$ANDROID_HOME/platform-tools/adb" install -r artifacts/cerritos-home-0.4.0-debug.apk
```

`-r` solicita una actualización conservando datos cuando la firma y la versión son compatibles. Si falla, lee el error antes de intentar una desinstalación.

## Recorrido de prueba

1. **Reservas:** crea una reserva, intenta otra en la misma zona y horario, confirma que se rechaza el cruce, cancela y comprueba que libera la franja.
2. **Vehículos:** registra una placa, comprueba que no admite un segundo ingreso activo y registra la salida.
3. **Novedades:** registra una observación ligada a la placa y márcala como resuelta.
4. **Administración:** busca un residente y exporta las reservas. Android abre el menú del sistema para compartir el CSV. Cancelar ese menú no debe mostrarse como una exportación exitosa.
5. **Persistencia:** cambia el tema, cierra la app y ábrela otra vez; verifica la sesión, la consulta de datos compartidos y la apariencia seleccionada.
6. **Botón Atrás:** cierra primero un formulario o el menú, regresa a Inicio desde otra sección y minimiza la app si ya está en Inicio.
7. **Pantalla y teclado:** prueba un teléfono pequeño, ambos temas, orientación horizontal, formularios con teclado abierto y navegación por gestos. Revisa que los controles no queden detrás de las barras del sistema.
8. **Conexión:** verifica que los cambios aparezcan en otro equipo autorizado. En modo avión, una operación no debe anunciarse como guardada. Activa modo avión, registra un vehículo y una novedad, cierra/reabre y verifica los pendientes. Al reconectar, comprueba sincronización sin duplicados. Las reservas pendientes no están confirmadas y pueden rechazarse por conflicto.

Registrar modelo de teléfono, versión de Android y de Android System WebView al reportar un problema. Usa un WebView actualizado. El mínimo configurado es Android 7/API 24, aunque se recomienda probar primero en Android 10 o posterior.

## Configuración técnica

- Capacitor 8.5.2; aplicación `com.cerritoshome.app`.
- `versionName`: `0.4.0`; `versionCode`: `4`.
- SDK de compilación/objetivo: 36; mínimo: 24.
- Gradle 8.14.3 con SHA256 oficial fijado; Android Gradle Plugin 8.13.0.
- Los plugins `App`, `Filesystem` y `Share` gestionan el botón Atrás y el CSV nativo. `SystemBars`, incluido en Capacitor, adapta las barras del sistema al tema y los márgenes seguros.
- CSV temporal en caché privada y acceso compartido únicamente al directorio de reportes. No se solicitan permisos generales de archivos, cámara ni ubicación.
- Copias automáticas Android desactivadas. Los registros operativos están en Firestore; configura sus respaldos y verifica restauración.
- APK, cachés, archivos `local.properties` y claves de firma no se versionan. No se configura `server.url`: el APK contiene su propia interfaz.

Las pruebas de navegador y los tests automatizados no sustituyen la validación física del teclado, gestos, botón Atrás y menú de compartir. La publicación en Google Play y la firma de distribución son etapas posteriores. La configuración real de Firebase y acceso al Mac debe verificarse antes del uso operativo.
