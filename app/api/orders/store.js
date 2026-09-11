/**
 * Almacén centralizado de pedidos en el servidor.
 * Sincroniza automáticamente con Supabase en la nube y respalda a .data/orders.json.
 * Gestiona clientes SSE conectados para notificaciones inmediatas en tiempo real.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { supabase } from '../../lib/supabaseClient';

// ── Ruta del archivo de respaldo local ─────────────────────────────────
// En Vercel (Serverless), /var/task es read-only; usamos os.tmpdir() (/tmp)
const isVercel = Boolean(
  process.env.VERCEL ||
  process.env.NEXT_PUBLIC_VERCEL_ENV ||
  process.env.AWS_LAMBDA_FUNCTION_NAME
);
const DATA_DIR = isVercel
  ? path.join(os.tmpdir(), '.data')
  : path.join(process.cwd(), '.data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-orders.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    // Ignorar si el sistema de archivos no es escribible
  }
}

function loadFromFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    // Continuar con memoria
  }
  return [];
}

function saveToFile(filePath, data) {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    // Silencioso en entornos serverless sin permisos de disco
  }
}

ensureDataDir();

/** @type {Array} Pedidos activos */
let orders = loadFromFile(ORDERS_FILE);

/** @type {Array} Pedidos de auditoría */
let auditOrders = loadFromFile(AUDIT_FILE);

/** @type {Set<ReadableStreamDefaultController>} Clientes SSE conectados */
const sseClients = new Set();

// ── Sincronización con Supabase (Servidor a Nube) ─────────────────────
let isSyncingToSupabase = false;
let pendingSupabaseSync = false;

async function syncToSupabase() {
  if (isSyncingToSupabase) {
    pendingSupabaseSync = true;
    return;
  }
  isSyncingToSupabase = true;
  pendingSupabaseSync = false;

  try {
    const { error } = await supabase
      .from('app_state')
      .update({
        orders_data: orders,
        audit_orders_data: auditOrders,
      })
      .eq('id', 'tronos');

    if (error) {
      console.warn('[OrderStore] Supabase update warning:', error.message);
    }
  } catch (e) {
    console.error('[OrderStore] Error guardando pedidos en Supabase:', e);
  } finally {
    isSyncingToSupabase = false;
    if (pendingSupabaseSync) {
      setTimeout(syncToSupabase, 150);
    }
  }
}

// Inicializar desde Supabase si hay datos en la nube más recientes
let initPromise = null;
export async function ensureInitialized() {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('app_state')
          .select('orders_data, audit_orders_data')
          .eq('id', 'tronos')
          .single();

        if (!error && data) {
          let remoteOrders = data.orders_data;
          if (typeof remoteOrders === 'string') {
            try { remoteOrders = JSON.parse(remoteOrders); } catch (e) {}
          }
          let remoteAudit = data.audit_orders_data;
          if (typeof remoteAudit === 'string') {
            try { remoteAudit = JSON.parse(remoteAudit); } catch (e) {}
          }

          if (Array.isArray(remoteOrders) && remoteOrders.length > 0) {
            await bulkSyncOrders(remoteOrders, Array.isArray(remoteAudit) ? remoteAudit : [], false);
          }
        }
      } catch (e) {
        // Continuar con los datos en memoria/archivo
      }
    })();
  }
  return initPromise;
}

// Disparar sincronización inicial en background al cargar el módulo
ensureInitialized();

async function persist(shouldSyncSupabase = true) {
  saveToFile(ORDERS_FILE, orders);
  saveToFile(AUDIT_FILE, auditOrders);
  if (shouldSyncSupabase) {
    await syncToSupabase();
  }
}

function broadcast(eventType, payload) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const controller of sseClients) {
    try {
      controller.enqueue(new TextEncoder().encode(message));
    } catch (e) {
      sseClients.delete(controller);
    }
  }
}

// ── API Pública del Store ────────────────────────────────────────────

export function getOrders() {
  return orders;
}

export function getAuditOrders() {
  return auditOrders;
}

export async function addOrder(newOrder) {
  const orderWithMeta = {
    ...newOrder,
    createdAt: newOrder.date || new Date().toISOString(),
    invoiced: false,
    auditFlag: 'registrado',
    updatedAt: new Date().toISOString(),
  };

  const existingIdx = orders.findIndex((o) => o.id === orderWithMeta.id);
  if (existingIdx !== -1) {
    return orders[existingIdx];
  }

  orders = [orderWithMeta, ...orders];
  auditOrders = [orderWithMeta, ...auditOrders.filter((o) => o.id !== orderWithMeta.id)];
  await persist();
  broadcast('NEW_ORDER', orderWithMeta);
  return orderWithMeta;
}

export async function updateOrderStatus(orderId, status, extraMeta = {}) {
  const now = new Date().toISOString();
  const updateFn = (o) =>
    o.id === orderId
      ? { ...o, ...(status ? { status } : {}), ...extraMeta, updatedAt: now }
      : o;

  orders = orders.map(updateFn);
  auditOrders = auditOrders.map(updateFn);
  await persist();

  const updated = orders.find((o) => o.id === orderId) || auditOrders.find((o) => o.id === orderId);
  broadcast('ORDER_UPDATED', { orderId, status, extraMeta, order: updated });
  return updated;
}

export async function deleteOrder(orderId, motivo = 'Anulado por Administrador') {
  orders = orders.filter((o) => o.id !== orderId);
  auditOrders = auditOrders.map((o) =>
    o.id === orderId
      ? { ...o, status: 'anulado_admin', anuladoAt: new Date().toISOString(), anuladoMotivo: motivo }
      : o
  );
  await persist();
  broadcast('ORDER_DELETED', { orderId, motivo });
}

export async function resetAllOrders() {
  orders = [];
  auditOrders = [];
  await persist();
  broadcast('ORDERS_RESET', {});
}

export async function bulkSyncOrders(newOrders, newAudit, shouldSyncSupabase = true) {
  let changed = false;

  if (Array.isArray(newOrders)) {
    const map = new Map();
    orders.forEach((o) => map.set(o.id, o));

    for (const incoming of newOrders) {
      if (!incoming || !incoming.id) continue;
      const existing = map.get(incoming.id);
      if (!existing) {
        map.set(incoming.id, incoming);
        changed = true;
      } else {
        const inTime = incoming.updatedAt || incoming.date || '';
        const exTime = existing.updatedAt || existing.date || '';
        if (inTime > exTime) {
          map.set(incoming.id, { ...existing, ...incoming });
          changed = true;
        }
      }
    }
    if (changed) {
      orders = Array.from(map.values()).sort(
        (a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0)
      );
    }
  }

  if (Array.isArray(newAudit)) {
    const map = new Map();
    auditOrders.forEach((o) => map.set(o.id, o));

    for (const incoming of newAudit) {
      if (!incoming || !incoming.id) continue;
      const existing = map.get(incoming.id);
      if (!existing) {
        map.set(incoming.id, incoming);
        changed = true;
      } else {
        const inTime = incoming.updatedAt || incoming.date || '';
        const exTime = existing.updatedAt || existing.date || '';
        if (inTime > exTime) {
          map.set(incoming.id, { ...existing, ...incoming });
          changed = true;
        }
      }
    }
    if (changed) {
      auditOrders = Array.from(map.values()).sort(
        (a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0)
      );
    }
  }

  if (changed) {
    await persist(shouldSyncSupabase);
  }
}

// ── SSE Client Management ────────────────────────────────────────────

export function addSSEClient(controller) {
  sseClients.add(controller);
}

export function removeSSEClient(controller) {
  sseClients.delete(controller);
}

export function getSSEClientCount() {
  return sseClients.size;
}
