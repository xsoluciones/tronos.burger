/**
 * Almacén centralizado de pedidos en memoria del servidor.
 * Respalda automáticamente a un archivo JSON para sobrevivir reinicios.
 * Gestiona la lista de clientes SSE conectados para notificaciones en tiempo real.
 */

import fs from 'fs';
import path from 'path';

// ── Ruta del archivo de respaldo ──────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), '.data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-orders.json');

// ── Asegurar que el directorio .data exista ──────────────────────────
function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    console.error('[OrderStore] Error creando directorio .data:', e);
  }
}

// ── Cargar datos desde archivo ────────────────────────────────────────
function loadFromFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error(`[OrderStore] Error leyendo ${filePath}:`, e);
  }
  return [];
}

// ── Guardar datos a archivo (async, no bloquea) ──────────────────────
function saveToFile(filePath, data) {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`[OrderStore] Error escribiendo ${filePath}:`, e);
  }
}

// ── Estado en memoria (singleton del proceso Node) ───────────────────
ensureDataDir();

/** @type {Array} Pedidos activos */
let orders = loadFromFile(ORDERS_FILE);

/** @type {Array} Pedidos de auditoría (historial completo) */
let auditOrders = loadFromFile(AUDIT_FILE);

/** @type {Set<ReadableStreamDefaultController>} Clientes SSE conectados */
const sseClients = new Set();

// ── Persistir cambios y notificar a todos los clientes SSE ───────────
function persist() {
  saveToFile(ORDERS_FILE, orders);
  saveToFile(AUDIT_FILE, auditOrders);
}

function broadcast(eventType, payload) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const controller of sseClients) {
    try {
      controller.enqueue(new TextEncoder().encode(message));
    } catch (e) {
      // Cliente desconectado, se limpiará en el close handler
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

export function addOrder(newOrder) {
  const orderWithMeta = {
    ...newOrder,
    createdAt: newOrder.date || new Date().toISOString(),
    invoiced: false,
    auditFlag: 'registrado',
  };

  // Evitar duplicados
  if (orders.some(o => o.id === orderWithMeta.id)) {
    return orderWithMeta;
  }

  orders = [orderWithMeta, ...orders];
  auditOrders = [orderWithMeta, ...auditOrders.filter(o => o.id !== orderWithMeta.id)];
  persist();
  broadcast('NEW_ORDER', orderWithMeta);
  return orderWithMeta;
}

export function updateOrderStatus(orderId, status, extraMeta = {}) {
  const updateFn = (o) =>
    o.id === orderId
      ? { ...o, ...(status ? { status } : {}), ...extraMeta, updatedAt: new Date().toISOString() }
      : o;

  orders = orders.map(updateFn);
  auditOrders = auditOrders.map(updateFn);
  persist();

  const updated = orders.find(o => o.id === orderId) || auditOrders.find(o => o.id === orderId);
  broadcast('ORDER_UPDATED', { orderId, status, extraMeta, order: updated });
  return updated;
}

export function deleteOrder(orderId, motivo = 'Anulado por Administrador') {
  orders = orders.filter(o => o.id !== orderId);
  auditOrders = auditOrders.map(o =>
    o.id === orderId
      ? { ...o, status: 'anulado_admin', anuladoAt: new Date().toISOString(), anuladoMotivo: motivo }
      : o
  );
  persist();
  broadcast('ORDER_DELETED', { orderId, motivo });
}

export function resetAllOrders() {
  orders = [];
  auditOrders = [];
  persist();
  broadcast('ORDERS_RESET', {});
}

export function bulkSyncOrders(newOrders, newAudit) {
  if (Array.isArray(newOrders)) {
    // Merge: agregar pedidos que no existan en el servidor
    const existingIds = new Set(orders.map(o => o.id));
    const newOnes = newOrders.filter(o => !existingIds.has(o.id));
    if (newOnes.length > 0) {
      orders = [...newOnes, ...orders];
    }
    // Actualizar estados de los que ya existen
    for (const incoming of newOrders) {
      const idx = orders.findIndex(o => o.id === incoming.id);
      if (idx !== -1 && incoming.updatedAt && incoming.updatedAt > (orders[idx].updatedAt || '')) {
        orders[idx] = incoming;
      }
    }
  }
  if (Array.isArray(newAudit)) {
    const existingAuditIds = new Set(auditOrders.map(o => o.id));
    const newAuditOnes = newAudit.filter(o => !existingAuditIds.has(o.id));
    if (newAuditOnes.length > 0) {
      auditOrders = [...newAuditOnes, ...auditOrders];
    }
    for (const incoming of newAudit) {
      const idx = auditOrders.findIndex(o => o.id === incoming.id);
      if (idx !== -1 && incoming.updatedAt && incoming.updatedAt > (auditOrders[idx].updatedAt || '')) {
        auditOrders[idx] = incoming;
      }
    }
  }
  persist();
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
