# APK 0.5.0 para teléfono nuevo

**Instalación para teléfono nuevo; incompatible como actualización de las APK anteriores.**

La autorización actual permite una firma permanente nueva. No se necesita recuperar
la clave anterior para esta entrega. Se conserva applicationId `com.cerritoshome.app`,
versionName `0.5.0`, versionCode `8`, Firebase `app-cerritoshome`, las cuentas y
la URL `https://mac-mini.tail653cc7.ts.net` que ya figuran en `.env.example`.
No se crean proyectos, cuentas ni migraciones de datos. El servidor debe seguir
accesible desde el teléfono (Tailscale o la publicación ya configurada con Funnel).

## Firma y respaldo recuperable

La integración de esta sesión devuelve HTTP 403 para Actions Secrets, incluida
la lectura de su clave pública. No se ha generado una clave para dejarla sin
respaldo seguro. El propietario debe ejecutar una sola vez el siguiente bloque
en el Mac, con Python 3, GitHub CLI autenticado con acceso a Secrets y JDK 21
(o Android Studio). Se usa una copia separada, sin alterar la instalación activa:

```bash
set -euo pipefail
umask 077
signing_review=$(mktemp -d "$HOME/cerritos-signing-review.XXXXXX")
gh repo clone Gustavo-87/appmovil-cerrihome "$signing_review/repo" \
  -- --branch firebase-golfito-0.3.0 --single-branch
python3 "$signing_review/repo/scripts/setup-android-signing.py"
```

El script comprueba permisos antes de generar nada y crea una clave RSA 4096
PKCS12 con validez de 10.000 días, una sola vez, fuera del repositorio. Las
ejecuciones posteriores reutilizan el respaldo. No imprime contraseñas ni claves.
Guarda la contraseña de recuperación en el Llavero de macOS bajo
`com.cerritoshome.android.permanent.v1.recovery`. Cifra el keystore y sus
credenciales con AES-256-CBC y PBKDF2 (600.000 iteraciones). El descifrado y la
restauración del certificado se prueban antes de registrar los secretos o publicar.
Compara la huella SHA256 después de recuperar para detectar un respaldo incorrecto.

Archivos privados con permisos restringidos:

- Clave local y respaldo: `~/.config/cerritos-home/android-signing-v1/`.
- Segunda copia cifrada: `~/Documents/CerritosHome-firma/permanent-signing-backup.enc`.

Copia ese archivo cifrado a un dispositivo independiente. Conserva la contraseña
de recuperación del Llavero en tu gestor de contraseñas: perder simultáneamente
el Llavero y esa contraseña impide recuperar el respaldo. No la envíes al chat.
Para inspeccionar o recuperar la clave, usa Acceso a Llaveros y un entorno local
privado. Los Secrets de GitHub no se pueden volver a descargar: no sustituyen este respaldo.

Los seis Secrets se registran mediante stdin, sin valores en argumentos o logs:
`CERRITOS_ANDROID_KEYSTORE_BASE64`, `CERRITOS_ANDROID_STORE_PASSWORD`,
`CERRITOS_ANDROID_KEY_PASSWORD`, `CERRITOS_ANDROID_KEY_ALIAS`,
`CERRITOS_ANDROID_CERT_SHA256`, `CERRITOS_ANDROID_BACKUP_VERIFIED`.
El script confirma sus nombres y ejecuta el workflow `android-new-phone.yml` con
`publish=true`. Mientras no existan, solo puede comprobarse la compilación sin firma.

El workflow exige el respaldo verificado, recupera el keystore en una carpeta
temporal, compila en modo release y comprueba con apksigner y aapt: firma válida,
certificado esperado distinto del anterior, versión, applicationId y ausencia de
modo debuggable. Adjunta APK, SHA256 e informe de verificación; vuelve a descargar
los tres archivos y compara sus bytes. Solo después publica el borrador 0.5.0.
No publica APK sin firma, claves, respaldos ni credenciales como artifacts.

## Descargar e instalar cuando termine la publicación

1. Abre [GitHub Release v0.5.0](https://github.com/Gustavo-87/appmovil-cerrihome/releases/tag/v0.5.0).
2. Descarga `cerritos-home-0.5.0-new-phone.apk`, su `.sha256` y, si quieres,
   `.verification.json` para revisar versión y certificado público.
3. Instala únicamente en el teléfono nuevo. Android puede pedir que permitas
   instalar aplicaciones desconocidas para el navegador o la aplicación Archivos.
4. Abre Cerritos Home e ingresa con tu cuenta actual. El primer acceso requiere
   conexión a Firebase y el acceso configurado al Mac para sincronizar.
5. Comprueba consultas, registros y sincronización antes de usarlo operativamente.

SHA256 desde el Mac, con ambos archivos descargados en la misma carpeta:

```bash
shasum -a 256 -c cerritos-home-0.5.0-new-phone.apk.sha256
```

No desinstales, no borres almacenamiento ni intentes instalar encima de la APK del
teléfono anterior. Sus datos locales pendientes permanecen en ese teléfono y no
se transfieren con esta instalación. Las futuras APK para el nuevo teléfono deben
conservar esta clave y aumentar versionCode cuando corresponda.
