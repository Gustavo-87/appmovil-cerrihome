# Pruebas de Cerritos Home en Android

La aplicación Android incluye los archivos web dentro del APK: no necesita mantener encendido el Mac ni ejecutar Vite para abrirse. Es un prototipo local, con reservas, vehículos, novedades y modo oscuro. Aún no comparte información entre teléfonos y no incluye cuentas de usuarios.

## Instalar el APK de pruebas

1. Descarga el archivo `cerritos-home-0.1.0-debug.apk` generado en `artifacts/` y transfiérelo al teléfono por USB, o descárgalo directamente desde el teléfono si tienes acceso al archivo.
2. Abre el archivo en Android. Cuando el sistema lo solicite, permite **Instalar aplicaciones desconocidas** únicamente para la aplicación que estás utilizando para abrirlo (por ejemplo, Archivos).
3. Instala y abre **Cerritos Home**. Puedes desactivar ese permiso después de la instalación.
4. Prueba con datos ficticios. Cada instalación tiene su propio almacenamiento y empieza con una demostración.

El APK es de depuración, firmado automáticamente con una clave de desarrollo. No es una versión publicada en Google Play ni una firma de producción. El archivo `.sha256` permite comprobar que el APK no cambió durante la transferencia.

Una actualización mantiene los datos únicamente si conserva el mismo identificador de aplicación, una versión compatible y la misma firma. Si Android muestra un conflicto de firma al cambiar entre APK generado aquí y APK generado en tu Mac, ambas máquinas usan claves de desarrollo diferentes. No desinstales una versión con datos que necesites conservar: desinstalar borra el almacenamiento local. La exportación CSV solo contiene las reservas, no es una copia completa de vehículos y novedades.

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

Si Android Studio solicita una ubicación de SDK o JDK, configura la que acabas de instalar. En **Settings → Build, Execution, Deployment → Build Tools → Gradle**, revisa **Gradle JDK**. No es necesario añadir claves de Firebase ni configurar servicios de Google para esta versión.

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

- `artifacts/cerritos-home-0.1.0-debug.apk`
- `artifacts/cerritos-home-0.1.0-debug.apk.sha256`
- Original de Gradle: `android/app/build/outputs/apk/debug/app-debug.apk`

Para instalar por USB desde Terminal, con el teléfono autorizado:

```bash
"$ANDROID_HOME/platform-tools/adb" devices
"$ANDROID_HOME/platform-tools/adb" install -r artifacts/cerritos-home-0.1.0-debug.apk
```

`-r` solicita una actualización conservando datos cuando la firma y la versión son compatibles. Si falla, lee el error antes de intentar una desinstalación.

## Recorrido de prueba

1. **Reservas:** crea una reserva, intenta otra en la misma zona y horario, confirma que se rechaza el cruce, cancela y comprueba que libera la franja.
2. **Vehículos:** registra una placa, comprueba que no admite un segundo ingreso activo y registra la salida.
3. **Novedades:** registra una observación ligada a la placa y márcala como resuelta.
4. **Administración:** busca un residente y exporta las reservas. Android abre el menú del sistema para compartir el CSV. Cancelar ese menú no debe mostrarse como una exportación exitosa.
5. **Persistencia:** cambia el tema, cierra la aplicación y ábrela otra vez; verifica los datos y la apariencia seleccionada.
6. **Botón Atrás:** cierra primero un formulario o el menú, regresa a Inicio desde otra sección y minimiza la app si ya está en Inicio.
7. **Pantalla y teclado:** prueba un teléfono pequeño, ambos temas, orientación horizontal, formularios con teclado abierto y navegación por gestos. Revisa que los controles no queden detrás de las barras del sistema.
8. **Sin conexión:** activa modo avión después de instalarla y verifica los flujos locales. Esto no demuestra sincronización; esa capacidad aún no existe.

Registrar modelo de teléfono, versión de Android y de Android System WebView al reportar un problema. Usa un WebView actualizado. El mínimo configurado es Android 7/API 24, aunque se recomienda probar primero en Android 10 o posterior.

## Configuración técnica

- Capacitor 8.5.2; aplicación `com.cerritoshome.app`.
- `versionName`: `0.1.0`; `versionCode`: `1`.
- SDK de compilación/objetivo: 36; mínimo: 24.
- Gradle 8.14.3 con SHA256 oficial fijado; Android Gradle Plugin 8.13.0.
- Los plugins `App`, `Filesystem` y `Share` gestionan el botón Atrás y el CSV nativo. `SystemBars`, incluido en Capacitor, adapta las barras del sistema al tema y los márgenes seguros.
- CSV temporal en caché privada y acceso compartido únicamente al directorio de reportes. No se solicitan permisos generales de archivos, cámara ni ubicación.
- Copias automáticas de Android desactivadas para este prototipo. Los datos locales no sustituyen una base de datos ni un respaldo.
- APK, cachés, archivos `local.properties` y claves de firma no se versionan. No se configura `server.url`: el APK contiene su propia interfaz.

Las pruebas de navegador y los tests automatizados no sustituyen la validación física del teclado, gestos, botón Atrás y menú de compartir. La publicación en Google Play y la conexión del backend son etapas posteriores.
