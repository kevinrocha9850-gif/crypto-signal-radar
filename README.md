# Crypto Signal Radar V8.3.5.5 — Vercel Clean

Esta versión está preparada para Vercel como **sitio estático + funciones serverless en `/api`**.

## Importante
- `index.html` es la página principal estática.
- Las funciones de backend están únicamente dentro de `/api`.
- No hay `server.js` en esta versión para evitar que un servidor Node local sea interpretado como backend del deployment.
- No se declara ningún `runtime` manual en `vercel.json`.
- Node 22 se usa para las funciones.

## Vercel
Framework Preset: **Other** (o detección automática).
Build Command: dejar vacío.
Output Directory: dejar vacío.
Install Command: dejar automático.

Las variables de Telegram son opcionales:
`TELEGRAM_BOT_TOKEN`
`TELEGRAM_CHAT_ID`
