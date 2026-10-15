# Actualizaciones mediante GitHub Releases

## Estado de recuperación

Base: `firebase-golfito-0.3.0`, `e80d9fd`, versión 0.5.0, Android versionCode 8.
En este entorno no existen la APK 0.5.0, `/tmp/cerritos-android-user/debug.keystore`
ni los objetos locales `0492f6f` y `34ce9ea`. La automatización se reconstruye aquí.
Los certificados extraídos del bloque v2 de las APK 0.4.0–0.4.3 coinciden:

```text
SHA256 6baa3ed2d319aec08aeae5a4a701bf2a0a303d5b59a07e8fd385a7cb1b64bd23
```

Es una huella de certificado, no el hash del archivo APK. La extracción no sustituye
la verificación criptográfica con `apksigner verify --verbose --print-certs`.
Antes de distribuir, compara también la firma de la APK instalada o de la 0.5.0 anterior.
El certificado público no permite recuperar la clave privada.

## Servidor y Release

1. Ejecuta `npm ci`, `npm test`, compila con configuración de prueba y ejecuta
   `npm run test:server` y `node --test tests/release.cjs`.
2. Confirma los cambios y ejecuta `node scripts/package-release.mjs` con árbol limpio.
   Para ensayos permite `--allow-dirty`: el paquete queda marcado `testOnly` y
   el actualizador lo rechaza.
3. La versión `vX.Y.Z` debe coincidir con package.json. El disparador manual
   permite seleccionar el commit o rama fuente y comprueba que pertenece a
   `firebase-golfito-0.3.0`. El workflow completa el **borrador** existente
   (o crea uno) con servidor, actualizador y sus SHA256. No genera ni adjunta APK.
   Después vuelve a descargar los cuatro assets y compara sus bytes y checksums.
4. Revisa los archivos antes de publicar el borrador. No reutilices una etiqueta
   publicada ni reemplaces sus assets: crea una nueva versión.

El paquete contiene fuentes y package-lock.json, no node_modules, APK, dist,
credenciales ni configuración local. La compilación real ocurre en el Mac usando
su configuración Firebase; la compilación del workflow solo comprueba el código.
El checksum comprueba integridad; la confianza proviene del acceso HTTPS y del
control de la cuenta y de las Releases de este repositorio.

## Preparar el Mac una sola vez

Requiere Node 24, npm, curl, tar y shasum. Usa una carpeta nueva, por ejemplo
`/Users/USUARIO/CerritosHome`, sin alterar la instalación anterior:

```text
CerritosHome/
  config/.env.local
  config/.server.env
  releases/vX.Y.Z/
  current -> releases/vX.Y.Z
```

Copia los dos archivos de configuración a `config/` con permisos 600. La ruta de
`GOOGLE_APPLICATION_CREDENTIALS` debe ser absoluta y permanecer fuera de releases.
Conserva los respaldos y la instalación antigua. No copies credenciales al chat.
Descarga el actualizador y su SHA256 desde la misma Release, verifica el checksum
con `shasum -a 256 -c NOMBRE.sha256`, revisa el script y ejecútalo:

```bash
bash cerritos-home-X.Y.Z-update-mac.sh vX.Y.Z /Users/USUARIO/CerritosHome --no-restart
```

El primer arranque requiere configurar el LaunchAgent `com.cerritoshome.web`:
`ProgramArguments` debe usar la ruta absoluta de Node y
`/Users/USUARIO/CerritosHome/current/scripts/serve.mjs`, `WorkingDirectory` debe
apuntar a `current`, PORT debe ser 4173 y los logs deben quedar fuera de releases.
El generador antiguo `prepare:mac` no realiza esta migración. Instala el agente
manualmente después de detener el anterior y comprueba el acceso web y Firebase.

Las siguientes actualizaciones usan el mismo comando sin `--no-restart`.
Descargan una versión explícita, verifican SHA256 y versión, instalan dependencias,
compilan y cambian `current` mediante rename atómico. Si el servicio no responde,
restauran el enlace anterior y solicitan su reinicio. Las carpetas anteriores se
conservan; un fallo de compilación deja intacto `current`. El chequeo HTTP solo
valida el servidor web, no las credenciales ni operaciones reales de Firebase.
`--no-restart` cambia el enlace pero deja el proceso actual en ejecución.
No hay migraciones de Firestore automáticas ni borrado de datos de teléfonos.

## Probar el borrador 0.5.0 sin tocar el servicio instalado

Los enlaces públicos de descarga no sirven para un borrador. Usa GitHub CLI
autenticado como colaborador (`gh auth status`). Con Node 24 y los dos archivos
existentes en tu instalación actual, ejecuta este bloque en Bash. Solo se leen
`.env.local` y `.server.env` de la carpeta activa; no se modifica ni reinicia:

```bash
set -euo pipefail
umask 077
active="/Users/gustavopiedrahita/DEVELOPER/Proyectos/appmovil-cerrihome-firebase-golfito-0.3.0"
test -f "$active/.env.local"
test -f "$active/.server.env"
review=$(mktemp -d "$HOME/cerritos-review-0.5.0.XXXXXX")
gh repo clone Gustavo-87/appmovil-cerrihome "$review/repo" -- --branch firebase-golfito-0.3.0 --single-branch
mkdir "$review/assets"
gh release download v0.5.0 --repo Gustavo-87/appmovil-cerrihome --dir "$review/assets"
(cd "$review/assets" && shasum -a 256 -c cerritos-home-0.5.0-server.tar.gz.sha256 && shasum -a 256 -c cerritos-home-0.5.0-update-mac.sh.sha256)
mkdir -p "$review/installation/config"
cp "$active/.env.local" "$review/installation/config/"
cp "$active/.server.env" "$review/installation/config/"
chmod 600 "$review/installation/config/.env.local" "$review/installation/config/.server.env"
bash "$review/assets/cerritos-home-0.5.0-update-mac.sh" v0.5.0 "$review/installation" --no-restart "$review/assets"
readlink "$review/installation/current"
# La credencial privada Firebase debe usar una ruta absoluta válida en este Mac.
node --test "$review/repo/tests/release.cjs"
printf 'Prueba conservada en: %s\n' "$review"
```

El último comando prueba la reversión con un reinicio fallido **simulado**, en
carpetas temporales: comprueba que `current` vuelve a la versión anterior.
No reinicia launchd ni cambia el servicio instalado. La instalación de prueba
compila con tu configuración, pero no arranca el servidor ni valida Firebase.
La reversión real con launchd requiere una ventana de prueba en el Mac después
de migrar el LaunchAgent a la estructura `current` descrita arriba.

## Android: entrega separada para teléfono nuevo

La autorización actual permite una firma permanente nueva. Sigue
[ANDROID-NEW-PHONE.md](ANDROID-NEW-PHONE.md) para respaldarla, registrarla
y publicar. La recuperación de la clave anterior solo afecta a las actualizaciones
de los teléfonos antiguos. Lo siguiente describe esa restricción histórica.

### Restricción de actualización de APK anteriores

No ejecutes `keytool -genkey`, no reemplaces debug.keystore y no desinstales la app.
Gradle y el script de compilación exigen una clave existente mediante
`CERRITOS_ANDROID_KEYSTORE`, `CERRITOS_ANDROID_STORE_PASSWORD`,
`CERRITOS_ANDROID_KEY_ALIAS` y `CERRITOS_ANDROID_KEY_PASSWORD`.
El script `build-android.mjs` compara además el certificado con la huella anterior.
La ejecución directa de Gradle exige la clave pero no realiza esa comparación.
Verifica su certificado con
`keytool -list -v` usando la contraseña desde una variable con `-storepass:env`,
y compara la huella con una APK instalada, verificada con apksigner.

Cuando se recupere y verifique, conserva una copia cifrada y restringida fuera del
repositorio. Para CI se pueden usar GitHub Actions Secrets: keystore codificado
en base64 y contraseñas separadas. Base64 no es cifrado. Ingiere el archivo por
stdin con `gh secret set`, sin imprimirlo ni ponerlo en argumentos o logs.
Este workflow todavía no consume esos secretos ni compila Android.

Antes de adjuntar una APK a la Release: verifica firma criptográfica, applicationId
`com.cerritoshome.app`, versionName de la Release y versionCode compatible con los
dispositivos instalados (incrementarlo para nuevas versiones; 0.5.0 usa 8).
Genera su SHA256, instala con `adb install -r` sobre un teléfono de prueba y
comprueba sesión, datos locales pendientes y sincronización sin desinstalar.
Con la clave ausente, el servidor y el actualizador pueden publicarse por separado;
la APK queda explícitamente pendiente.
