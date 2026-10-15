#!/bin/bash
set -euo pipefail
umask 077

# Layout: ROOT/config/{.env.local,.server.env}, ROOT/releases/, ROOT/current.
tag=${1:?Uso: update-mac.sh vX.Y.Z /ruta/instalacion [--no-restart]}
root=${2:?Indica la carpeta de instalación gestionada}
mode=${3:-}
assets=${4:-}
[[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Etiqueta inválida' >&2; exit 1; }
[[ -z "$mode" || "$mode" == --no-restart ]] || exit 1
if [[ "$mode" != --no-restart && "$(uname)" != Darwin ]]; then
  echo 'El reinicio con launchctl requiere macOS.' >&2; exit 1
fi
[[ "$(node -p 'process.versions.node.split(".")[0]')" == 24 ]] || { echo 'Se necesita Node 24' >&2; exit 1; }
mkdir -p "$root/releases"
root=$(cd "$root" && pwd)
[[ ! -e "$root/current" || -L "$root/current" ]] || { echo 'current debe ser un enlace simbólico' >&2; exit 1; }
[[ -f "$root/config/.env.local" && -f "$root/config/.server.env" ]] || { echo 'Falta configuración privada en config/' >&2; exit 1; }
mkdir "$root/.update-lock" 2>/dev/null || { echo 'Otra actualización está en curso' >&2; exit 1; }
temporary=$(mktemp -d "$root/releases/.staging.XXXXXX")
trap 'rm -rf "$temporary"; rmdir "$root/.update-lock"' EXIT
name="cerritos-home-${tag#v}-server.tar.gz"
base="https://github.com/Gustavo-87/appmovil-cerrihome/releases/download/$tag"
if [[ -n "$assets" ]]; then
  # Draft assets must be downloaded with authenticated gh release download first.
  cp "$assets/$name" "$temporary/$name"
  cp "$assets/$name.sha256" "$temporary/checksum"
else
  curl --fail --location --silent --show-error "$base/$name" -o "$temporary/$name"
  curl --fail --location --silent --show-error "$base/$name.sha256" -o "$temporary/checksum"
fi
# Accept only the checksum for the requested asset, never paths supplied by a remote file.
expected=$(awk -v name="$name" 'NF == 2 && $2 == name {print $1}' "$temporary/checksum")
[[ "$expected" =~ ^[a-f0-9]{64}$ ]] || { echo 'SHA256 inválido' >&2; exit 1; }
actual=$(shasum -a 256 "$temporary/$name" | awk '{print $1}')
[[ "$actual" == "$expected" ]] || { echo 'SHA256 no coincide' >&2; exit 1; }
mkdir "$temporary/app"
tar -xzf "$temporary/$name" -C "$temporary/app"
app="$temporary/app"
node -e 'const fs=require("fs");const r=JSON.parse(fs.readFileSync(process.argv[1]+"/release.json"));const p=JSON.parse(fs.readFileSync(process.argv[1]+"/package.json"));if(r.testOnly||r.version!==process.argv[2]||p.version!==r.version||!/^[a-f0-9]{40}$/.test(r.commit))process.exit(1)' "$app" "${tag#v}"
cp "$root/config/.env.local" "$app/.env.local"
cp "$root/config/.server.env" "$app/.server.env"
(cd "$app" && npm ci && npm run build:production && npm prune --omit=dev)
destination="$root/releases/$tag"
[[ ! -e "$destination" ]] || { echo 'Esta versión ya existe; no se sobrescribe' >&2; exit 1; }
mv "$app" "$destination"
previous=$(readlink "$root/current" || true)
ln -s "$destination" "$root/.current-next"
node -e 'require("fs").renameSync(process.argv[1],process.argv[2])' "$root/.current-next" "$root/current"
restart() { launchctl kickstart -k "gui/$(id -u)/com.cerritoshome.web"; }
if [[ "$mode" != --no-restart ]]; then
  healthy=false
  if restart; then
    for attempt in {1..15}; do
      if curl --fail --silent http://127.0.0.1:4173/ >/dev/null; then healthy=true; break; fi
      sleep 1
    done
  fi
  if [[ "$healthy" != true ]]; then
    if [[ -n "$previous" ]]; then
      ln -s "$previous" "$root/.current-next"
      node -e 'require("fs").renameSync(process.argv[1],process.argv[2])' "$root/.current-next" "$root/current"
      restart || true
    else
      rm "$root/current"
    fi
    echo 'El servidor no respondió; se restauró el enlace anterior.' >&2; exit 1
  fi
fi
echo "Instalada $tag. Versión anterior conservada: ${previous:-ninguna}."
