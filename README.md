# Tronos Pub & Grill - Plataforma Gastronómica

Sistema web integral de carta digital interactiva, seguimiento de pedidos en tiempo real, punto de venta (POS) de caja/administración y módulo de cocina para Tronos Pub & Grill.

## 🚀 Arquitectura Tecnológica

- **Frontend & App Core**: [Next.js](https://nextjs.org/) (React 19, Turbopack, App Router).
- **Base de Datos en Tiempo Real**: [Google Firebase Realtime Database](https://firebase.google.com/) (WebSockets de baja latencia para sincronización instantánea de pedidos, menú y calificaciones).
- **Despliegue & CDN Global**: [Cloudflare Pages](https://pages.cloudflare.com/) conectado al repositorio GitHub.
- **Canal de Pedidos**: Integración nativa a WhatsApp con formato enriquecido y enlace de seguimiento en vivo.

## 🛠️ Desarrollo Local

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 📦 Compilación para Producción

```bash
npm run build
```
