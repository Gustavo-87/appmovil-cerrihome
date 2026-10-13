# APK Android de pruebas

`cerritos-home-0.4.0-debug.apk`: Cerritos Home con interfaz incluida, caché Firestore persistente y registros locales pendientes de sincronización. Android mínimo 7/API 24; se recomienda un dispositivo moderno con WebView actualizado.

Antes de usarla, sigue [la guía sin conexión](../docs/OFFLINE.md). Actualiza el servidor del Mac y permite el origen `https://localhost`. El primer ingreso requiere Internet y una cuenta autorizada. Después verifica modo avión, cierre/reapertura y sincronización al reconectar.

Es una APK firmada para pruebas, no una publicación de Google Play. El archivo `.sha256` permite comprobar su integridad. No borres datos ni desinstales si hay registros pendientes. No contiene credenciales privadas del servidor.
