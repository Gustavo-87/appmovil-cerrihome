# Verificación 0.3.0 — 13 de octubre de 2026

Implementación local preparada para Firebase Spark y Golfito. **El proyecto real aún no existe y no se ha desplegado.**

- `npm test`: 37 pruebas aprobadas. Dominio, conversión de reservas locales BBQ → Golfito, roles, configuración, transacciones del servidor con almacén atómico simulado, autorización HTTP y acceso por contraseña con Firebase simulado.
- `npm run test:e2e`: recorrido de demostración en Chromium aprobado, incluido Golfito, cruces, cancelación, vehículos, novedades, exportación y navegación móvil.
- `npm run build:production`: TypeScript y Vite aprobados con configuración pública ficticia, únicamente para verificar la compilación y el servidor.
- Compilación real servida en Chromium: muestra correo/contraseña de Firebase, sin navegación operativa antes del ingreso y sin errores de ejecución.
- `npm run test:server`: web, assets, cabeceras, bloqueo de configuración y métodos HTTP aprobados.
- `npm audit --omit=dev`: ninguna vulnerabilidad reportada en dependencias de ejecución durante esta revisión. Se fija una versión corregida de `@grpc/grpc-js` mediante `overrides`.
- `git diff --check`: aprobado.

Se preparó `npm run test:firebase` para verificar las reglas reales y conflictos concurrentes contra el emulador. **No pudo ejecutarse aquí:** falló la descarga del JAR de Firestore desde Google. Las 37 pruebas locales no sustituyen esa verificación de Firestore real.

Pendiente: crear Firebase, publicar reglas, configurar credencial privada en el Mac, comprobar envío del enlace de contraseña y autenticar cuentas reales, ejecutar la prueba de emulador, validar Tailscale y probar dos dispositivos. El APK 0.3.0 no se compiló ni se probó en un teléfono físico.

Sigue [PRODUCTION.md](PRODUCTION.md) antes de utilizar datos reales. No se usa Cloud Functions ni SMTP propio y no se habilitó facturación Blaze.
