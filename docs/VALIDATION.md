# Verificación 0.4.0 — 13 de octubre de 2026

Implementación de Android sin conexión y sincronización preparada. El APK se compiló; queda pendiente la prueba física con las cuentas del conjunto.

- `npm test`: 49 pruebas aprobadas. Incluye cola IndexedDB con almacenamiento simulado, aislamiento por usuario, orden de registros locales, reintentos, conflictos, autenticación simulada y autorización del servidor.
- Chromium con IndexedDB real: registro con red desactivada, cierre/reapertura del navegador y recuperación del pendiente aprobados. El envío al servidor se simuló; no se usaron credenciales reales.
- Pruebas de idempotencia: un reintento no duplica el vehículo, la novedad asociada ni la auditoría; conserva las horas del dispositivo. No permite sobrescribir un registro mediante el identificador de otro usuario.
- `android:sync`: TypeScript, Vite y sincronización Capacitor aprobados, con origen API HTTPS configurado.
- Android Gradle 8.14.3 y JDK 21: `assembleDebug` aprobado. APK `com.cerritoshome.app`, versión 0.4.0, código 4, SDK mínimo 24 y objetivo 36.
- `apksigner verify`: firma v2 aprobada. Es una APK de depuración, no una distribución de Google Play.
- Recursos APK: se verificó que contiene la interfaz, la cola offline y el origen `https://mac-mini.tail653cc7.ts.net`.
- `npm audit`: cero vulnerabilidades reportadas en la revisión. Esto no acredita seguridad completa del despliegue.
- `git diff --check`: aprobado.

No se ha verificado esta APK en un teléfono físico. Tampoco se usó una cuenta real para verificar la caché Firestore en modo avión ni la sincronización con el Mac del usuario. Las reglas Firestore y las transacciones en el emulador siguen pendientes de esa prueba: su descarga estuvo bloqueada en este entorno. Las reglas existentes no requieren cambios para la cola local; todas las escrituras de sincronización siguen pasando por la API.

Sigue [OFFLINE.md](OFFLINE.md): actualiza y reinicia primero el servidor del Mac, habilita el origen Android y verifica un teléfono en modo avión antes de usar datos reales. No borres almacenamiento ni desinstales mientras existan pendientes.

## Logo 0.4.1

Compilación de producción y APK debug verificadas. Chromium carga el logo claro y oscuro según la preferencia persistida. Los recursos Android incluyen variantes nocturnas y margen para el icono adaptativo. No se ha comprobado el lanzador en un teléfono físico.

## Sincronización y acceso público 0.4.2

51 pruebas pasan, incluyendo el resultado visible de sincronización cuando el servidor no es accesible y cuando no quedan pendientes. La APK conserva el identificador de aplicación, IndexedDB y URL existente. Funnel requiere activación en el Mac del usuario: no se ha verificado un acceso público real desde este entorno.
