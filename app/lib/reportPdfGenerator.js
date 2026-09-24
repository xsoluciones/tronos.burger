/**
 * Generador de Reporte Maestro y Auditoría General en PDF para Tronos Pub & Grill.
 * Diseñado con soporte multihoja (@page A4), estilos vectoriales limpios y desgloses
 * completos de Facturas, Ventas, Inventario, Clientes, Opiniones y Configuración.
 */

// Formateador de moneda en pesos colombianos ($ COP)
const formatMoney = (amount) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

export const generateMasterReportHtml = ({
  orders = [],
  auditOrders = [],
  invoicedOrders = [],
  restaurantConfig = {},
  menuCategories = [],
  customerFeedbacks = [],
  userRole = 'Caja Operativa / Admin',
}) => {
  const now = new Date();
  const reportDateFormatted = now.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const reportTimeFormatted = now.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Unificación de todas las órdenes (activas + histórico de auditoría) sin duplicados
  const ordersMap = new Map();
  (auditOrders || []).forEach((o) => {
    if (o?.id) ordersMap.set(o.id, o);
  });
  (orders || []).forEach((o) => {
    if (o?.id) ordersMap.set(o.id, o);
  });
  const allOrdersList = Array.from(ordersMap.values()).sort(
    (a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0)
  );

  // Cálculos Financieros y de Ventas
  const totalOrdersCount = allOrdersList.length;
  const deliveredOrders = allOrdersList.filter((o) => o.status === 'entregado');
  const kitchenOrders = allOrdersList.filter((o) => o.status === 'en_cocina');
  const transitOrders = allOrdersList.filter((o) => o.status === 'en_camino');
  const pendingOrders = allOrdersList.filter((o) => o.status === 'pendiente');
  const returnedOrders = allOrdersList.filter((o) => o.status === 'devuelto' || o.status === 'anulado_admin');

  const totalDeliveredSales = deliveredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalAllSales = allOrdersList.reduce((sum, o) => sum + (o.total || 0), 0);
  const averageTicket = deliveredOrders.length > 0 ? totalDeliveredSales / deliveredOrders.length : 0;

  // Facturas emitidas
  const totalInvoicedCount = invoicedOrders.length;
  const totalInvoicedSales = invoicedOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  // Inventario y Ventas por Producto
  const productSalesMap = new Map();
  allOrdersList.forEach((order) => {
    (order.items || []).forEach((item) => {
      const key = item.id || item.name;
      const current = productSalesMap.get(key) || {
        id: key,
        name: item.name || 'Producto',
        category: item.categoryId || 'Platos',
        unitPrice: item.price || 0,
        quantity: 0,
        totalSales: 0,
      };
      current.quantity += item.quantity || 1;
      current.totalSales += (item.price || 0) * (item.quantity || 1);
      productSalesMap.set(key, current);
    });
  });
  const productsSoldList = Array.from(productSalesMap.values()).sort((a, b) => b.quantity - a.quantity);

  // Directorio Único de Clientes
  const clientsMap = new Map();
  allOrdersList.forEach((order) => {
    const phone = (order.customer?.telefono || '').trim();
    const name = (order.customer?.nombre || '').trim() || 'Consumidor';
    const key = phone || name;
    if (key) {
      const current = clientsMap.get(key) || {
        name,
        phone: phone || 'N/A',
        address: order.customer?.direccion || 'En local',
        reference: order.customer?.descripcion || '',
        orderCount: 0,
        totalSpent: 0,
        lastOrderDate: order.date,
      };
      current.orderCount += 1;
      current.totalSpent += order.total || 0;
      if (new Date(order.date || 0) > new Date(current.lastOrderDate || 0)) {
        current.lastOrderDate = order.date;
      }
      clientsMap.set(key, current);
    }
  });
  const clientsList = Array.from(clientsMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte_Maestro_Tronos_${now.toISOString().slice(0, 10)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #ffffff;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .page-container {
      width: 100%;
      max-width: 820px;
      margin: 0 auto;
      padding: 8px 10px;
    }
    .page-break {
      page-break-before: always !important;
      break-before: page !important;
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1.5px dashed #cbd5e1;
    }
    .no-break {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .header-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .brand-sub {
      font-size: 11px;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .badge-report {
      background: #0f172a;
      color: #ffffff;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 18px;
      font-size: 11px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 22px;
    }
    .kpi-card {
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px 12px;
      text-align: center;
    }
    .kpi-card.highlight {
      background: #f0fdf4;
      border-color: #86efac;
    }
    .kpi-title {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 4px;
    }
    .kpi-val {
      font-size: 17px;
      font-weight: 900;
      color: #0f172a;
    }
    .kpi-card.highlight .kpi-val {
      color: #16a34a;
    }
    .section-heading {
      font-size: 13.5px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      border-left: 4px solid #16a34a;
      padding-left: 8px;
      margin: 18px 0 10px 0;
      letter-spacing: 0.5px;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 10.5px;
    }
    table.data-table th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      padding: 6px 8px;
      text-align: left;
      border: 1px solid #0f172a;
    }
    table.data-table td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }
    table.data-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    .badge-status {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .status-entregado { background: #dcfce7; color: #166534; }
    .status-en_cocina { background: #ffedd5; color: #9a3412; }
    .status-en_camino { background: #e0f2fe; color: #075985; }
    .status-pendiente { background: #f3e8ff; color: #6b21a8; }
    .status-devuelto { background: #fee2e2; color: #991b1b; }
    .order-box {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 12px;
      margin-bottom: 8px;
      page-break-inside: avoid;
    }
    .order-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 6px;
      font-weight: 800;
    }
    .footer-stamp {
      text-align: center;
      padding: 14px 0;
      margin-top: 24px;
      border-top: 1px solid #cbd5e1;
      color: #64748b;
      font-size: 10px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="page-container">
    <!-- ── HOJA 1: PORTADA & RESUMEN EJECUTIVO ── -->
    <div class="header-banner">
      <div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:24px;">👑</span>
          <div>
            <div class="brand-title">TRONOS PUB & GRILL</div>
            <div class="brand-sub">Sistema POS • Facturación & Control Operativo</div>
          </div>
        </div>
      </div>
      <div style="text-align:right;">
        <span class="badge-report">Reporte Maestro Oficial</span>
        <div style="font-size:10px; color:#64748b; margin-top:4px;">Documento de Respaldo y Auditoría</div>
      </div>
    </div>

    <div class="meta-grid">
      <div><strong>Fecha de Emisión:</strong><br>${reportDateFormatted}</div>
      <div><strong>Hora Exacta:</strong><br>${reportTimeFormatted}</div>
      <div><strong>Generado Por:</strong><br>${userRole}</div>
      <div><strong>WhatsApp de Domicilios:</strong><br>+${restaurantConfig?.whatsapp || '573007708616'}</div>
      <div><strong>Total Comandas Históricas:</strong><br>${totalOrdersCount} órdenes</div>
      <div><strong>Total Facturas Generadas:</strong><br>${totalInvoicedCount} facturas</div>
    </div>

    <div class="section-heading">📊 Resumen Financiero y Métricas Clave</div>
    <div class="kpi-grid">
      <div class="kpi-card highlight">
        <div class="kpi-title">Ventas Entregadas</div>
        <div class="kpi-val">${formatMoney(totalDeliveredSales)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Total Facturado</div>
        <div class="kpi-val">${formatMoney(totalInvoicedSales)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Ticket Promedio</div>
        <div class="kpi-val">${formatMoney(averageTicket)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Ventas Totales Brutas</div>
        <div class="kpi-val">${formatMoney(totalAllSales)}</div>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns: repeat(5, 1fr);">
      <div class="kpi-card">
        <div class="kpi-title">✅ Entregados</div>
        <div class="kpi-val" style="font-size:15px; color:#16a34a;">${deliveredOrders.length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">👨‍🍳 En Cocina</div>
        <div class="kpi-val" style="font-size:15px; color:#ea580c;">${kitchenOrders.length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">🛵 En Camino</div>
        <div class="kpi-val" style="font-size:15px; color:#0284c7;">${transitOrders.length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">📋 Pendientes</div>
        <div class="kpi-val" style="font-size:15px; color:#7c3aed;">${pendingOrders.length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">⚠️ Anulados/Dev.</div>
        <div class="kpi-val" style="font-size:15px; color:#dc2626;">${returnedOrders.length}</div>
      </div>
    </div>

    <!-- ── HOJA 2: FACTURACIÓN Y VENTAS ── -->
    <div class="page-break"></div>
    <div class="section-heading">🧾 Detalle de Facturas Emitidas y Descargadas (${invoicedOrders.length})</div>
    ${
      invoicedOrders.length === 0
        ? '<p style="color:#64748b; font-style:italic; margin-bottom:15px;">No se registraron facturas generadas en este período.</p>'
        : `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:14%;">Factura #</th>
            <th style="width:20%;">Fecha / Hora</th>
            <th style="width:26%;">Cliente & Teléfono</th>
            <th style="width:22%;">Dirección</th>
            <th style="width:18%; text-align:right;">Total Pagado</th>
          </tr>
        </thead>
        <tbody>
          ${invoicedOrders
            .map(
              (inv) => `
            <tr>
              <td><strong>#${inv.id}</strong></td>
              <td>${new Date(inv.invoicedAt || inv.date || Date.now()).toLocaleString('es-CO')}</td>
              <td><strong>${inv.customer?.nombre || 'Consumidor'}</strong><br><span style="color:#64748b;">${inv.customer?.telefono || 'N/A'}</span></td>
              <td>${inv.customer?.direccion || 'En local'}</td>
              <td style="text-align:right; font-weight:800; color:#16a34a;">${formatMoney(inv.total || 0)}</td>
            </tr>
          `
            )
            .join('')}
          <tr style="background:#f1f5f9; font-weight:900;">
            <td colspan="4" style="text-align:right; font-size:11px;">TOTAL ACUMULADO FACTURAS:</td>
            <td style="text-align:right; font-size:12px; color:#16a34a;">${formatMoney(totalInvoicedSales)}</td>
          </tr>
        </tbody>
      </table>
    `
    }

    <!-- ── HOJA 3: INVENTARIO Y PRODUCTOS VENDIDOS ── -->
    <div class="page-break"></div>
    <div class="section-heading">🍔 Inventario & Ventas por Producto (${productsSoldList.length} ítems vendidos)</div>
    ${
      productsSoldList.length === 0
        ? '<p style="color:#64748b; font-style:italic;">No hay registro de productos vendidos.</p>'
        : `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:40%;">Producto</th>
            <th style="width:20%; text-align:right;">Precio Unitario</th>
            <th style="width:18%; text-align:center;">Cant. Vendida</th>
            <th style="width:22%; text-align:right;">Total Recaudado</th>
          </tr>
        </thead>
        <tbody>
          ${productsSoldList
            .map(
              (p) => `
            <tr>
              <td><strong>${p.name}</strong></td>
              <td style="text-align:right;">${formatMoney(p.unitPrice)}</td>
              <td style="text-align:center; font-weight:800;">${p.quantity}</td>
              <td style="text-align:right; font-weight:800; color:#16a34a;">${formatMoney(p.totalSales)}</td>
            </tr>
          `
            )
            .join('')}
          <tr style="background:#f1f5f9; font-weight:900;">
            <td colspan="2" style="text-align:right;">TOTAL UNIDADES & VENTA:</td>
            <td style="text-align:center;">${productsSoldList.reduce((acc, p) => acc + p.quantity, 0)} uds</td>
            <td style="text-align:right; color:#16a34a;">${formatMoney(productsSoldList.reduce((acc, p) => acc + p.totalSales, 0))}</td>
          </tr>
        </tbody>
      </table>
    `
    }

    <!-- ── HOJA 4: HISTORIAL ÍNTEGRO DE COMANDAS ── -->
    <div class="page-break"></div>
    <div class="section-heading">📋 Historial Completo de Comandas (${allOrdersList.length} pedidos)</div>
    ${
      allOrdersList.length === 0
        ? '<p style="color:#64748b; font-style:italic;">No hay pedidos registrados en el historial.</p>'
        : allOrdersList
            .map((o) => {
              const dateStr = new Date(o.date || Date.now()).toLocaleString('es-CO');
              const itemsDetailed = (o.items || [])
                .map((it) => {
                  const extrasStr = (it.selectedExtras || [])
                    .map((ex) => `+ ${ex.name} x${ex.quantity} (${formatMoney((ex.price || 0) * (ex.quantity || 1))})`)
                    .join(', ');
                  const removedStr = (it.removedIngredients || []).length > 0 ? ` [SIN: ${it.removedIngredients.join(', ')}]` : '';
                  const noteStr = it.note ? ` (Nota: ${it.note})` : '';
                  return `• ${it.quantity}x <strong>${it.name}</strong> (${formatMoney((it.price || 0) * (it.quantity || 1))})${extrasStr ? '<br>&nbsp;&nbsp;' + extrasStr : ''}${removedStr ? '<br>&nbsp;&nbsp;<span style="color:#dc2626;">' + removedStr + '</span>' : ''}${noteStr ? '<br>&nbsp;&nbsp;<span style="color:#d97706;">' + noteStr + '</span>' : ''}`;
                })
                .join('<br>');

              return `
          <div class="order-box no-break">
            <div class="order-header">
              <div>
                <span>COMANDA #${o.id}</span> • <span style="color:#64748b; font-size:10px;">${dateStr}</span>
              </div>
              <div>
                <span class="badge-status status-${o.status || 'pendiente'}">${o.status || 'pendiente'}</span>
                ${o.invoiced ? '<span style="background:#16a34a; color:#fff; font-size:9px; padding:1px 5px; border-radius:3px; margin-left:4px;">FACTURADO</span>' : ''}
              </div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:10.5px; margin-bottom:6px;">
              <div><strong>Cliente:</strong> ${o.customer?.nombre || 'Consumidor'} (${o.customer?.telefono || 'Sin tel'})</div>
              <div><strong>Dirección:</strong> ${o.customer?.direccion || 'En local'} ${o.customer?.descripcion ? `(${o.customer.descripcion})` : ''}</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 8px; font-size:10.5px; margin-bottom:4px;">
              ${itemsDetailed || 'Sin detalle de productos'}
            </div>
            <div style="text-align:right; font-weight:900; font-size:12px; color:#16a34a;">
              Total Comanda: ${formatMoney(o.total || 0)}
            </div>
          </div>
        `;
            })
            .join('')
    }

    <!-- ── HOJA 5: DIRECTORIO DE CLIENTES ── -->
    <div class="page-break"></div>
    <div class="section-heading">👥 Directorio de Clientes Registrados (${clientsList.length} clientes)</div>
    ${
      clientsList.length === 0
        ? '<p style="color:#64748b; font-style:italic;">No hay registro de clientes.</p>'
        : `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:28%;">Nombre del Cliente</th>
            <th style="width:20%;">Teléfono</th>
            <th style="width:30%;">Dirección Principal</th>
            <th style="width:10%; text-align:center;">Órdenes</th>
            <th style="width:12%; text-align:right;">Total Compras</th>
          </tr>
        </thead>
        <tbody>
          ${clientsList
            .map(
              (c) => `
            <tr>
              <td><strong>${c.name}</strong></td>
              <td>${c.phone}</td>
              <td>${c.address}</td>
              <td style="text-align:center; font-weight:800;">${c.orderCount}</td>
              <td style="text-align:right; font-weight:800; color:#16a34a;">${formatMoney(c.totalSpent)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `
    }

    <!-- ── HOJA 6: OPINIONES Y CALIFICACIONES DE CLIENTES ── -->
    ${
      customerFeedbacks.length > 0
        ? `
      <div class="page-break"></div>
      <div class="section-heading">⭐ Opiniones y Calificaciones de Clientes (${customerFeedbacks.length} valoraciones)</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:16%;">Fecha</th>
            <th style="width:20%;">Cliente & Orden</th>
            <th style="width:12%; text-align:center;">Estrellas</th>
            <th style="width:26%;">Comentario</th>
            <th style="width:26%;">Cosas a Mejorar</th>
          </tr>
        </thead>
        <tbody>
          ${customerFeedbacks
            .map(
              (f) => `
            <tr>
              <td>${new Date(f.createdAt || Date.now()).toLocaleDateString('es-CO')}</td>
              <td><strong>${f.customerName || 'Cliente'}</strong><br><span style="color:#64748b;">${f.orderId || ''}</span></td>
              <td style="text-align:center; font-size:13px; color:#eab308;">${'★'.repeat(f.rating || 5)}</td>
              <td>${f.comment || '<span style="color:#94a3b8;">Sin comentario</span>'}</td>
              <td style="color:#d97706;">${f.improvements || '<span style="color:#94a3b8;">Ninguna</span>'}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `
        : ''
    }

    <!-- ── HOJA 7: CONFIGURACIÓN DEL SISTEMA ── -->
    <div class="page-break"></div>
    <div class="section-heading">⚙️ Configuración del Negocio y Canales de Venta</div>
    <table class="data-table" style="width:100%;">
      <tbody>
        <tr>
          <td style="width:35%; font-weight:800; background:#f8fafc;">WhatsApp de Recepción de Domicilios</td>
          <td>+${restaurantConfig?.whatsapp || '573007708616'}</td>
        </tr>
        <tr>
          <td style="font-weight:800; background:#f8fafc;">Redes Sociales Vinculadas</td>
          <td>${(restaurantConfig?.socials || []).map((s) => `${s.name}: ${s.url}`).join(' | ') || 'Instagram Oficial'}</td>
        </tr>
        <tr>
          <td style="font-weight:800; background:#f8fafc;">Total de Categorías en Menú Web</td>
          <td>${menuCategories.length} categorías activas</td>
        </tr>
        <tr>
          <td style="font-weight:800; background:#f8fafc;">Total de Productos en Carta</td>
          <td>${menuCategories.reduce((acc, c) => acc + (c.items?.length || 0), 0)} productos registrados</td>
        </tr>
      </tbody>
    </table>

    <div class="footer-stamp">
      TRONOS PUB & GRILL • DOCUMENTO DE RESPALDO Y AUDITORÍA MAESTRA<br>
      Generado automáticamente el ${reportDateFormatted} a las ${reportTimeFormatted} • Sistema POS & Facturación
    </div>
  </div>
</body>
</html>`;
};

/**
 * Imprime el reporte multihélice directamente llamando al diálogo de Guardar como PDF / Impresión.
 */
export const printMasterReport = (reportHtml, title = 'Reporte_Maestro_Tronos') => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve();

    const oldIframe = document.getElementById('tronos-report-print-iframe');
    if (oldIframe) oldIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'tronos-report-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(reportHtml);
    doc.close();

    if (title) doc.title = title;

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error('Error al imprimir reporte maestro:', err);
      }
      setTimeout(() => {
        iframe.remove();
        resolve();
      }, 2500);
    }, 450);
  });
};

/**
 * Descarga el archivo autónomo (.html) de respaldo en la computadora del usuario.
 */
export const downloadMasterReportHtmlFile = (reportHtml, fileName = 'Reporte_Maestro_Tronos.html') => {
  if (typeof window === 'undefined') return;
  const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
