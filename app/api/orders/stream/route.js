/**
 * API Route: /api/orders/stream
 * 
 * SSE (Server-Sent Events) endpoint.
 * Los paneles de admin y caja se conectan aquí para recibir
 * notificaciones en tiempo real cuando hay pedidos nuevos,
 * cambios de estado, etc.
 * 
 * Eventos emitidos:
 *   - NEW_ORDER     → nuevo pedido recibido
 *   - ORDER_UPDATED → estado de un pedido cambió
 *   - ORDER_DELETED → pedido anulado/eliminado
 *   - ORDERS_RESET  → todos los pedidos fueron borrados
 */

import { addSSEClient, removeSSEClient } from '../store.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Registrar este cliente en el store
      addSSEClient(controller);

      // Enviar heartbeat inicial para confirmar conexión
      try {
        controller.enqueue(
          encoder.encode(`event: connected\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`)
        );
      } catch (e) {
        // ignore
      }

      // Heartbeat cada 15 segundos para mantener la conexión viva
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`: heartbeat ${new Date().toISOString()}\n\n`)
          );
        } catch (e) {
          clearInterval(heartbeat);
          removeSSEClient(controller);
        }
      }, 15000);

      // Limpiar cuando se cierre la conexión
      controller._heartbeat = heartbeat;
    },
    cancel(controller) {
      if (controller._heartbeat) {
        clearInterval(controller._heartbeat);
      }
      removeSSEClient(controller);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
