/**
 * API Route: /api/orders
 * 
 * GET  → Devuelve todos los pedidos activos y de auditoría
 * POST → Agrega un nuevo pedido (desde cualquier dispositivo)
 * PUT  → Actualiza estado de un pedido o sincroniza en bulk
 */

import { NextResponse } from 'next/server';
import {
  getOrders,
  getAuditOrders,
  addOrder,
  updateOrderStatus,
  deleteOrder,
  resetAllOrders,
  bulkSyncOrders,
} from './store.js';

// ── GET /api/orders ──────────────────────────────────────────────────
export async function GET() {
  try {
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
    const body = await request.json();
    const { action, order, orders: bulkOrders, auditOrders: bulkAudit } = body;

    // Acción: sincronizar en bulk (desde MenuContext al iniciar)
    if (action === 'bulk_sync') {
      bulkSyncOrders(bulkOrders, bulkAudit);
      return NextResponse.json({ ok: true, orders: getOrders(), auditOrders: getAuditOrders() });
    }

    // Acción: resetear todo
    if (action === 'reset') {
      resetAllOrders();
      return NextResponse.json({ ok: true });
    }

    // Default: agregar pedido nuevo
    if (!order || !order.id) {
      return NextResponse.json({ error: 'Pedido inválido: falta id' }, { status: 400 });
    }

    const saved = addOrder(order);
    return NextResponse.json({ ok: true, order: saved }, { status: 201 });
  } catch (e) {
    console.error('[API/orders] POST error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ── PUT /api/orders ──────────────────────────────────────────────────
export async function PUT(request) {
  try {
    const body = await request.json();
    const { action, orderId, status, extraMeta, motivo } = body;

    if (action === 'delete') {
      deleteOrder(orderId, motivo);
      return NextResponse.json({ ok: true });
    }

    if (!orderId) {
      return NextResponse.json({ error: 'Falta orderId' }, { status: 400 });
    }

    const updated = updateOrderStatus(orderId, status, extraMeta || {});
    return NextResponse.json({ ok: true, order: updated });
  } catch (e) {
    console.error('[API/orders] PUT error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
