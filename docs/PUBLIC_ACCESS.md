# Android sin Tailscale

Tailscale Serve es privado. Tailscale Funnel publica por HTTPS el mismo servidor del Mac; Android necesita únicamente Internet. El Mac conserva Tailscale encendido, el servidor activo y conexión a Internet. Firebase y los roles siguen controlando el acceso a los datos; publicar la página de acceso no otorga permisos.

## Activar en el Mac

Confirma primero que http://127.0.0.1:4173 abre. En `.server.env`, conserva los orígenes existentes e incluye `https://localhost` para Android:

```dotenv
ALLOWED_ORIGINS=http://localhost:4173,http://127.0.0.1:4173,https://mac-mini.tail653cc7.ts.net,https://localhost
```

Reinicia el servidor después de modificar su configuración:

```bash
launchctl kickstart -k "gui/$(id -u)/com.cerritoshome.web"
tailscale funnel --bg http://127.0.0.1:4173
tailscale funnel status
```

La CLI puede solicitar habilitar Funnel mediante un enlace de tu cuenta. Completa ese paso y repite el comando. Debe indicar acceso público, no `tailnet only`. Si informa que el puerto ya está configurado por Serve, detén únicamente esa ruta y activa Funnel:

```bash
tailscale serve --https=443 off
tailscale funnel --bg http://127.0.0.1:4173
```

Comprueba https://mac-mini.tail653cc7.ts.net desde el teléfono con Wi-Fi apagado, datos móviles encendidos y Tailscale desconectado. Si no abre, comparte el resultado de `tailscale funnel status`; no cambies Firebase ni borres datos locales.

## Sincronizar

La APK mantiene la misma URL. Instala la actualización sobre la app existente, sin desinstalar ni borrar datos. Abre la app, conserva la misma cuenta y pulsa «Sincronizar ahora». Comprueba que el registro aparece en otro dispositivo. El primer acceso necesita Internet; registrar sin conexión sigue disponible con una sesión preparada. No cierres sesión con pendientes.

Si cambias el nombre del Mac o su tailnet, la URL puede cambiar: recompila Android con `VITE_API_ORIGIN` actualizado. Funnel tiene límites de transferencia y su disponibilidad depende del Mac y de su conexión.
