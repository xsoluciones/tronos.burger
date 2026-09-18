const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', '.data');
const ordersPath = path.join(dataDir, 'orders.json');
const auditPath = path.join(dataDir, 'audit-orders.json');
const menuPath = path.join(dataDir, 'menu.json');

const orders = fs.existsSync(ordersPath) ? JSON.parse(fs.readFileSync(ordersPath, 'utf8') || '[]') : [];
const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8') || '[]') : [];
const menu = fs.existsSync(menuPath) ? JSON.parse(fs.readFileSync(menuPath, 'utf8') || '[]') : [];

// Consolidar todos los pedidos únicos sin perder ninguno
const ordersMap = new Map();
[...audit, ...orders].forEach(o => {
  if (o && o.id) {
    const existing = ordersMap.get(o.id);
    if (!existing || new Date(o.updatedAt || o.date || 0) >= new Date(existing.updatedAt || existing.date || 0)) {
      ordersMap.set(o.id, o);
    }
  }
});

const sortedOrders = Array.from(ordersMap.values()).sort(
  (a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0)
);

function esc(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return '"' + str + '"';
}

// ── 1. GENERAR CSV DE PEDIDOS COMPLETO ──
const ordersHeaders = [
  'ID Pedido',
  'Fecha y Hora',
  'Estado',
  'Facturado (SI/NO)',
  'Nombre Cliente',
  'Telefono / WhatsApp',
  'Direccion Entrega',
  'Detalle / Barrio / Nota',
  'Productos (Resumen)',
  'Detalle de Items y Extras',
  'Costo Domicilio ($ COP)',
  'Total Pedido ($ COP)',
  'Tipo de Pedido',
  'Fecha Facturacion'
];

const ordersCsvRows = [ordersHeaders.map(esc).join(',')];

sortedOrders.forEach(o => {
  const cust = o.customer || {};
  const items = Array.isArray(o.items) ? o.items : [];

  const itemsSummary = items
    .map(it => `${it.quantity || 1}x ${it.name || it.id}`)
    .join('; ');

  const itemsDetailed = items
    .map(it => {
      let desc = `${it.quantity || 1}x ${it.name || it.id} ($${it.price || 0})`;
      if (it.selectedExtras && it.selectedExtras.length > 0) {
        desc += ' [Extras: ' + it.selectedExtras.map(e => `${e.quantity || 1}x ${e.name || e.id}`).join(', ') + ']';
      }
      if (it.removedIngredients && it.removedIngredients.length > 0) {
        desc += ' [Sin: ' + it.removedIngredients.join(', ') + ']';
      }
      if (it.note) desc += ` (Nota: ${it.note})`;
      return desc;
    })
    .join(' | ');

  const dateFormatted = (o.date || o.createdAt)
    ? new Date(o.date || o.createdAt).toLocaleString('es-CO')
    : '';
  const invoicedDate = o.invoicedAt
    ? new Date(o.invoicedAt).toLocaleString('es-CO')
    : '';

  ordersCsvRows.push([
    esc(o.id),
    esc(dateFormatted),
    esc(o.status || 'pendiente'),
    esc(o.invoiced ? 'SI' : 'NO'),
    esc(cust.nombre || ''),
    esc(cust.telefono || ''),
    esc(cust.direccion || ''),
    esc(cust.descripcion || cust.nota || ''),
    esc(itemsSummary),
    esc(itemsDetailed),
    esc(o.deliveryFee || 0),
    esc(o.total || 0),
    esc(o.orderType || 'domicilio'),
    esc(invoicedDate)
  ].join(','));
});

// UTF-8 BOM para compatibilidad automática con Excel y Google Sheets
const bom = '\uFEFF';
const ordersCsvPath = path.join(__dirname, '..', 'RESPALDO_PEDIDOS_TRONOS.csv');
fs.writeFileSync(ordersCsvPath, bom + ordersCsvRows.join('\r\n'), 'utf8');
console.log(`[OK] Generado: RESPALDO_PEDIDOS_TRONOS.csv (${sortedOrders.length} pedidos)`);

// ── 2. GENERAR CSV DE CLIENTES ÚNICOS ──
const clientsMap = new Map();
sortedOrders.forEach(o => {
  const cust = o.customer || {};
  const phone = (cust.telefono || '').trim();
  const name = (cust.nombre || '').trim();
  const key = phone || name;
  if (!key) return;

  if (!clientsMap.has(key)) {
    clientsMap.set(key, {
      nombre: name,
      telefono: phone,
      direccion: cust.direccion || '',
      detalle: cust.descripcion || cust.nota || '',
      totalPedidos: 0,
      totalGastado: 0,
      ultimoPedido: o.date || o.createdAt
    });
  }

  const client = clientsMap.get(key);
  client.totalPedidos += 1;
  client.totalGastado += (Number(o.total) || 0);
  if (cust.direccion && !client.direccion) client.direccion = cust.direccion;
  if (new Date(o.date || o.createdAt || 0) > new Date(client.ultimoPedido || 0)) {
    client.ultimoPedido = o.date || o.createdAt;
  }
});

const clientsHeaders = [
  'Nombre Cliente',
  'Telefono / WhatsApp',
  'Ultima Direccion Registrada',
  'Barrio / Detalle Entrega',
  'Total Pedidos Realizados',
  'Total Comprado ($ COP)',
  'Fecha Ultimo Pedido'
];

const clientsCsvRows = [clientsHeaders.map(esc).join(',')];
Array.from(clientsMap.values())
  .sort((a, b) => b.totalPedidos - a.totalPedidos)
  .forEach(c => {
    clientsCsvRows.push([
      esc(c.nombre),
      esc(c.telefono),
      esc(c.direccion),
      esc(c.detalle),
      esc(c.totalPedidos),
      esc(c.totalGastado),
      esc(c.ultimoPedido ? new Date(c.ultimoPedido).toLocaleString('es-CO') : '')
    ].join(','));
  });

const clientsCsvPath = path.join(__dirname, '..', 'RESPALDO_CLIENTES_TRONOS.csv');
fs.writeFileSync(clientsCsvPath, bom + clientsCsvRows.join('\r\n'), 'utf8');
console.log(`[OK] Generado: RESPALDO_CLIENTES_TRONOS.csv (${clientsMap.size} clientes fidelizados)`);

// ── 3. RESPALDO MAESTRO JSON (COMPLETO PARA IMPORTACIÓN TÉCNICA) ──
const fullBackup = {
  fecha_respaldo: new Date().toISOString(),
  total_pedidos: sortedOrders.length,
  total_clientes_unicos: clientsMap.size,
  pedidos: sortedOrders,
  clientes: Array.from(clientsMap.values()),
  menu: menu
};

const fullBackupPath = path.join(__dirname, '..', 'RESPALDO_COMPLETO_SISTEMA.json');
fs.writeFileSync(fullBackupPath, JSON.stringify(fullBackup, null, 2), 'utf8');
console.log(`[OK] Generado: RESPALDO_COMPLETO_SISTEMA.json`);
