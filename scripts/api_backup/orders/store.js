/**
 * Almacén centralizado de pedidos en el servidor.
 * Sincroniza automáticamente con Supabase en la nube y respalda a .data/orders.json.
 * Gestiona clientes SSE conectados para notificaciones inmediatas en tiempo real.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { supabase, supabaseAdmin } from '../../lib/supabaseClient';

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
const PURGED_FILE = path.join(DATA_DIR, 'purged-orders.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    // Ignorar si el sistema de archivos no es escribible
  }
}

function loadPurgedFromFile() {
  try {
    if (fs.existsSync(PURGED_FILE)) {
      const raw = fs.readFileSync(PURGED_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch (e) {}
  return new Set();
}

function savePurgedToFile(purgedSet) {
  try {
    ensureDataDir();
    fs.writeFileSync(PURGED_FILE, JSON.stringify(Array.from(purgedSet)), 'utf-8');
  } catch (e) {}
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

/** @type {Set<string>} IDs de pedidos purgados para evitar resurrecciones */
let purgedOrderIds = loadPurgedFromFile();

/** @type {Set<ReadableStreamDefaultController>} Clientes SSE conectados */
const sseClients = new Set();

// ── Sincronización con Google Sheets (Servidor a Hoja de Cálculo) ─────
const GOOGLE_SHEETS_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL || process.env.NEXT_PUBLIC_GOOGLE_SHEETS_WEBHOOK_URL;

async function syncOrderToGoogleSheets(order) {
  if (!GOOGLE_SHEETS_URL || !order) return;
  try {
    const res = await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
    const data = await res.json();
    console.log('[OrderStore] Sincronizado con Google Sheets:', data?.status || 'ok');
  } catch (e) {
    console.warn('[OrderStore] Error sincronizando con Google Sheets:', e?.message);
  }
}

// Inicializar desde disco de forma síncrona/inmediata
let initPromise = null;
export async function ensureInitialized() {
  if (!initPromise) {
    initPromise = Promise.resolve();
  }
  return initPromise;
}

async function persist() {
  saveToFile(ORDERS_FILE, orders);
  saveToFile(AUDIT_FILE, auditOrders);
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

  if (orderWithMeta.id && purgedOrderIds.has(orderWithMeta.id)) {
    purgedOrderIds.delete(orderWithMeta.id);
    savePurgedToFile(purgedOrderIds);
  }

  orders = [orderWithMeta, ...orders];
  auditOrders = [orderWithMeta, ...auditOrders.filter((o) => o.id !== orderWithMeta.id)];

  // 1) Broadcast SSE INMEDIATAMENTE (antes de Supabase) para que Admin/Cocina/Caja lo vean al instante
  broadcast('NEW_ORDER', orderWithMeta);

  // 2) Persistir a disco y enviar a Google Sheets en background (no bloquea la respuesta HTTP)
  persist().catch((e) => console.warn('[OrderStore] persist error:', e?.message));
  syncOrderToGoogleSheets(orderWithMeta).catch((e) => console.warn('[OrderStore] Google Sheets error:', e?.message));

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

  const updated = orders.find((o) => o.id === orderId) || auditOrders.find((o) => o.id === orderId);

  // 1) Broadcast SSE instantáneo a todas las pantallas (0ms de latencia)
  broadcast('ORDER_UPDATED', { orderId, status, extraMeta, order: updated });

  // 2) Persistir a disco y Supabase en segundo plano sin demorar la respuesta
  persist().catch((e) => console.warn('[OrderStore] persist error:', e?.message));

  return updated;
}

export async function deleteOrder(orderId, motivo = 'Anulado por Administrador') {
  orders = orders.filter((o) => o.id !== orderId);
  auditOrders = auditOrders.map((o) =>
    o.id === orderId
      ? { ...o, status: 'anulado_admin', anuladoAt: new Date().toISOString(), anuladoMotivo: motivo, updatedAt: new Date().toISOString() }
      : o
  );

  // 1) Broadcast SSE instantáneo (0ms)
  broadcast('ORDER_DELETED', { orderId, motivo });

  // 2) Persistir en segundo plano
  persist().catch((e) => console.warn('[OrderStore] persist error:', e?.message));
}

export async function purgeOrder(orderId) {
  orders = orders.filter((o) => o.id !== orderId);
  auditOrders = auditOrders.filter((o) => o.id !== orderId);

  if (orderId) {
    purgedOrderIds.add(orderId);
    savePurgedToFile(purgedOrderIds);
  }

  // 1) Broadcast SSE instantáneo (0ms)
  broadcast('ORDER_PURGED', { orderId });

  // 2) Persistir en segundo plano
  persist().catch((e) => console.warn('[OrderStore] persist error:', e?.message));
}

export async function resetAllOrders() {
  orders = [];
  auditOrders = [];
  purgedOrderIds.clear();
  savePurgedToFile(purgedOrderIds);
  broadcast('ORDERS_RESET', {});
  persist().catch((e) => console.warn('[OrderStore] persist error:', e?.message));
}

export async function bulkSyncOrders(newOrders, newAudit, shouldSyncSupabase = true) {
  let changed = false;

  if (Array.isArray(newOrders)) {
    const map = new Map();
    orders.forEach((o) => map.set(o.id, o));

    for (const incoming of newOrders) {
      if (!incoming || !incoming.id) continue;
      // Nunca re-insertar pedidos que fueron purgados definitivamente
      if (purgedOrderIds.has(incoming.id)) continue;
      // Nunca re-insertar pedidos anulados a las comandas activas
      if (incoming.status === 'anulado_admin') continue;
      const inAudit = auditOrders.find((a) => a.id === incoming.id);
      if (inAudit && inAudit.status === 'anulado_admin') continue;

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
      // Nunca re-insertar pedidos que fueron purgados definitivamente
      if (purgedOrderIds.has(incoming.id)) continue;

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
    broadcast('ORDERS_SYNCED', { orders, auditOrders });
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
