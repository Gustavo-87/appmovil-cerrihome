# Cerritos Home

Primera versión funcional de la aplicación de portería y administración del conjunto residencial Cerritos Home. Interfaz en español, adaptable a Android y navegadores de escritorio, desarrollada con React, TypeScript y Vite.

## Funcionalidades

- Inicio con indicadores, agenda semanal y accesos rápidos.
- Reservas del salón social, gimnasio y zona BBQ: residente, vivienda, fecha, horario y observaciones.
- Validación de fechas y horarios, bloqueo de reservas superpuestas por espacio y cancelación con confirmación. Las reservas canceladas conservan su historial y liberan el horario.
- Ingresos de vehículos: placa, conductor, destino, motivo y novedades. Registro de salida, historial y prevención de ingresos activos duplicados.
- Novedades generales o vinculadas a un vehículo, con resolución y reapertura.
- Panel de administración con todas las reservas, búsqueda y exportación CSV del resultado de búsqueda.
- Persistencia local, navegación móvil y formularios accesibles mediante teclado.
- Datos de ejemplo identificados como demostración. Fechas del conjunto en `America/Bogota`.
- Modo claro y oscuro con selector en la barra superior: inicialmente sigue el tema del dispositivo; la elección manual se conserva en `localStorage` bajo `cerritos-theme` y se comparte entre pestañas.
- Tarjetas de colores con efecto liquid glass: transparencias, reflejos, bordes suaves y desenfoque. Incluye superficies opacas cuando el navegador no admite el desenfoque o se solicita reducir la transparencia; respeta la preferencia de movimiento reducido.

Para cambiar de apariencia, pulsa el control **Claro / Oscuro** de la barra superior. Para volver a seguir automáticamente al dispositivo, elimina únicamente la clave `cerritos-theme` del almacenamiento del navegador y recarga; las reservas y demás datos permanecen intactos. Si el navegador bloquea el almacenamiento, el selector sigue funcionando durante la sesión, pero no puede recordar la elección al recargar.

## Desarrollo

Requiere Node.js 22.12 o superior; validado con Node.js 24.19 y npm 11.

```bash
cd /workspace/appmovil-cerrihome
npm ci
npm run dev -- --port 5173
```

En una copia local utiliza la carpeta donde hayas clonado el proyecto. El servidor usa el puerto 5173. Para acceder desde un Android en tu propia red, utiliza la dirección de red del equipo de desarrollo, permitiendo ese puerto en el firewall. El entorno de onboarding no proporciona un enlace público de previsualización.

```bash
npm run build
npm test
npm run preview -- --port 4173
```

`build` valida TypeScript y genera los archivos estáticos en `dist/`. Las fuentes tipográficas se incluyen con la aplicación: no depende de Google Fonts en ejecución. Las dependencias están fijadas en `package-lock.json`.

## Aplicación Android

El proyecto incluye Capacitor y una aplicación instalable para Android. Consulta [la guía de Android](docs/ANDROID.md) para instalar el APK, preparar Android Studio en Mac y probar con un teléfono por USB.

```bash
npm run android:sync   # Compila la interfaz y sincroniza el proyecto nativo
npm run android:open   # Abre Android Studio
npm run android:apk    # Genera un APK de pruebas; requiere JDK 21 y SDK 36
```

El APK se genera en `artifacts/cerritos-home-0.1.0-debug.apk`, acompañado por su SHA256. Incluye la interfaz dentro de la aplicación, icono propio, botón Atrás y exportación mediante el selector nativo de compartir. Los archivos APK y las claves de firma no se suben al repositorio.

## Validación funcional

Con el servidor de desarrollo en ejecución y Chromium instalado:

```bash
BROWSER_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

En otro equipo, instala el navegador con `npx playwright install chromium` y ejecuta `npm run test:e2e` sin `BROWSER_EXECUTABLE_PATH`. Puedes cambiar el servidor con `CERRITOS_TEST_URL`.

La prueba utiliza contextos de navegador aislados con datos ficticios. Comprueba conflictos de horarios, creación, persistencia después de recargar, cancelación, ingreso duplicado, salida, novedad asociada, resolución, búsqueda administrativa y exportación. Revisa además la navegación móvil a 390 px, el tema del dispositivo, el selector mediante teclado, la preferencia guardada después de recargar y errores de ejecución. Los flujos principales se ejecutan en modo oscuro. Guarda capturas de ambos temas y el CSV en `/tmp/cerritos-validation`.

## Alcance de esta versión

Es un prototipo funcional local disponible como web y APK Android con Capacitor. El APK incluye sus recursos para abrir los flujos locales sin un servidor de desarrollo; esa capacidad debe verificarse en el teléfono de prueba. La versión web no implementa caché sin conexión. Aún no hay sistema multiusuario ni distribución por Google Play.

- Los datos están en `localStorage`, bajo `cerritos-home-v1`, dentro de cada navegador o instalación Android. No se comparten entre dispositivos, pestañas o entre Chrome y la app Android; no existe respaldo en servidor.
- El panel administrativo es una vista de demostración; no hay inicio de sesión ni autorización por roles.
- El gimnasio se reserva de manera exclusiva por franja, igual que los otros espacios. Aforo compartido, horarios de apertura, anticipación máxima, aprobación y tarifas requieren definir el reglamento del conjunto.
- No incluye notificaciones push, fotos de vehículos ni lectura de placas.
- Las reservas deben terminar el mismo día. No se permiten fechas anteriores al día actual; las horas transcurridas del día actual aún pueden registrarse.
- Si falla el almacenamiento, aparece un aviso. Si existen datos corruptos, no se sobrescriben y se muestra una demostración temporal.

Para restaurar la demostración, elimina únicamente la clave `cerritos-home-v1` desde las herramientas de almacenamiento del navegador y recarga. Esto elimina los cambios locales de ese navegador.

Antes de usar datos reales con el equipo: conectar una base de datos y un servicio de autenticación, aplicar permisos de guardia/administrador en el servidor, validar conflictos de reservas de forma transaccional, implementar auditoría y copias de seguridad, definir retención de datos personales y desplegar con HTTPS. La interfaz actual sirve como base para esos pasos.

## Estructura

- `src/App.tsx`: pantallas, formularios y navegación.
- `src/domain.ts`: modelos, datos de demostración, validación y lectura del almacenamiento.
- `src/domain.test.ts`: pruebas de las reglas de reservas y vehículos.
- `src/styles.css`: diseño adaptable a móvil y escritorio.
- `src/theme.css`: paleta de ambos temas y efecto liquid glass.
- `src/useTheme.ts`: preferencia de apariencia, cambios del sistema y sincronización entre pestañas.
- `src/native.ts`: botón Atrás de Android y exportación nativa de CSV.
- `src/native.test.ts`: pruebas de exportación nativa con plugins simulados.
- `capacitor.config.ts` y `android/`: configuración y proyecto Android.
- `scripts/build-android.mjs`: compilación del APK de pruebas y cálculo de su SHA256.
- `docs/ANDROID.md`: instalación, desarrollo en Mac y recorrido de pruebas en teléfono.
- `public/theme-init.js`: aplica el tema antes de que se muestre la aplicación.
- `tests/smoke.cjs`: prueba funcional en navegador.
- `public/`: icono y manifiesto web.

Cada tarea en la nube ya se ejecuta en un entorno aislado. Utiliza esta copia del repositorio; no crees un Git worktree salvo petición expresa.
