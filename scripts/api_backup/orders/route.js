/**
 * API Route: /api/orders
 * 
 * GET  → Devuelve todos los pedidos activos y de auditoría
 * POST → Agrega un nuevo pedido (desde cualquier dispositivo)
 * PUT  → Actualiza estado de un pedido o sincroniza en bulk
 */

import { NextResponse } from 'next/server';
import {
  ensureInitialized,
  getOrders,
  getAuditOrders,
  addOrder,
  updateOrderStatus,
  deleteOrder,
  purgeOrder,
  resetAllOrders,
  bulkSyncOrders,
} from './store.js';

export const dynamic = 'force-dynamic';

// ── GET /api/orders ──────────────────────────────────────────────────
export async function GET() {
  try {
    await ensureInitialized();
    return NextResponse.json({
      orders: getOrders(),
      auditOrders: getAuditOrders(),
    });
  } catch (e) {
    console.error('[API/orders] GET error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ── POST /api/orders ─────────────────────────────────────────────────
export async function POST(request) {
  try {
    await ensureInitialized();
    const body = await request.json();
    const { action, order, orders: bulkOrders, auditOrders: bulkAudit } = body;

    // Acción: sincronizar en bulk (desde MenuContext al iniciar)
    if (action === 'bulk_sync') {
      await bulkSyncOrders(bulkOrders, bulkAudit);
      return NextResponse.json({ ok: true, orders: getOrders(), auditOrders: getAuditOrders() });
    }

    // Acción: resetear todo
    if (action === 'reset') {
      await resetAllOrders();
      return NextResponse.json({ ok: true });
    }

    // Default: agregar pedido nuevo
    if (!order || !order.id) {
      return NextResponse.json({ error: 'Pedido inválido: falta id' }, { status: 400 });
    }

    const saved = await addOrder(order);
    return NextResponse.json({ ok: true, order: saved }, { status: 201 });
  } catch (e) {
    console.error('[API/orders] POST error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ── PUT /api/orders ──────────────────────────────────────────────────
export async function PUT(request) {
  try {
    await ensureInitialized();
    const body = await request.json();
    const { action, orderId, status, extraMeta, motivo } = body;

    if (action === 'delete') {
      await deleteOrder(orderId, motivo);
      return NextResponse.json({ ok: true });
    }

    if (action === 'purge') {
      await purgeOrder(orderId);
      return NextResponse.json({ ok: true });
    }

    if (!orderId) {
      return NextResponse.json({ error: 'Falta orderId' }, { status: 400 });
    }

    const updated = await updateOrderStatus(orderId, status, extraMeta || {});
    return NextResponse.json({ ok: true, order: updated });
  } catch (e) {
    console.error('[API/orders] PUT error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
