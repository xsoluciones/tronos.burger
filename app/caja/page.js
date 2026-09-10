'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useMenu, cleanWhatsAppNumber } from '../context/MenuContext';
import { playLoudBell, unlockAudio } from '../lib/bellSound';
import {
  generateMasterReportHtml,
  printMasterReport,
  downloadMasterReportHtmlFile,
} from '../lib/reportPdfGenerator';
import {
  IconOrders,
  IconTransit,
  IconCheckCircle,
  IconPrinter,
  IconBox,
  IconSales,
  IconFolder,
  IconSun,
  IconMoon,
  IconGlobe,
  IconLogout,
  IconSearch,
  IconX,
} from '../admin/icons';

// Formateador de moneda en pesos colombianos ($ COP)
const formatPrice = (price) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};

export default function CajaPage() {
  const {
    restaurantConfig,
    updateWhatsApp,
    userRole,
    isAdmin,
    isCajero,
    login,
    logout,
    orders = [],
    auditOrders = [],
    addOrder,
    updateOrderStatus,
    markOrderInvoiced,
    deleteOrder,
    resetAllOrdersData,
    menuCategories = [],
    posBackupFolderName,
    updatePosBackupFolderName,
  } = useMenu();

  // ── Estados de Borrado de Datos y Reporte PDF ──────────────────────
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // ── Configuración WhatsApp Domicilios (Asesor de Caja) ───────────
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [cajaWhatsAppInput, setCajaWhatsAppInput] = useState(() => {
    if (restaurantConfig?.whatsapp) return restaurantConfig.whatsapp;
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem('tronos-config') || '{}');
        if (saved?.whatsapp) return saved.whatsapp;
      } catch (e) {}
    }
    return '573007708616';
  });

  useEffect(() => {
    if (restaurantConfig?.whatsapp) {
      setCajaWhatsAppInput(restaurantConfig.whatsapp);
    }
  }, [restaurantConfig?.whatsapp]);

  // ── Historial y Modal de Facturas Descargadas ─────────────────────
  const [showInvoicesModal, setShowInvoicesModal] = useState(false);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [previewInvoiceOrder, setPreviewInvoiceOrder] = useState(null);

  // Unificación de todas las facturas generadas (activas + histórico de auditoría)
  const invoicedOrders = useMemo(() => {
    const map = new Map();
    (auditOrders || []).forEach((o) => {
      if (o.invoiced) map.set(o.id, o);
    });
    (orders || []).forEach((o) => {
      if (o.invoiced) map.set(o.id, o);
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.invoicedAt || b.date || 0) - new Date(a.invoicedAt || a.date || 0)
    );
  }, [orders, auditOrders]);

  const filteredInvoicedOrders = useMemo(() => {
    if (!invoiceSearchQuery.trim()) return invoicedOrders;
    const q = invoiceSearchQuery.toLowerCase();
    return invoicedOrders.filter((order) => {
      return (
        order.id?.toLowerCase().includes(q) ||
        order.customer?.nombre?.toLowerCase().includes(q) ||
        order.customer?.telefono?.toLowerCase().includes(q) ||
        order.customer?.direccion?.toLowerCase().includes(q)
      );
    });
  }, [invoicedOrders, invoiceSearchQuery]);

  // El cajero o el admin pueden ingresar a esta vista
  const isAuthorized = isCajero || isAdmin;

  // ── Estados y Métodos para Crear Comanda Manual en Caja ─────────────
  const [showManualOrderModal, setShowManualOrderModal] = useState(false);
  const [manualCustomer, setManualCustomer] = useState({
    nombre: '',
    telefono: '',
    direccion: '',
    orderType: 'local', // 'local' | 'recoger' | 'domicilio'
    paymentMethod: 'Efectivo',
    notas: '',
  });
  const [manualCart, setManualCart] = useState([]);
  const [manualCategoryFilter, setManualCategoryFilter] = useState('all');
  const [manualProductSearch, setManualProductSearch] = useState('');
  const [manualCustomName, setManualCustomName] = useState('');
  const [manualCustomPrice, setManualCustomPrice] = useState('');

  const allManualProducts = useMemo(() => {
    const list = [];
    (menuCategories || []).forEach((cat) => {
      (cat.items || []).forEach((prod) => {
        list.push({ ...prod, categoryId: cat.id, categoryName: cat.name });
      });
    });
    return list;
  }, [menuCategories]);

  const filteredManualProducts = useMemo(() => {
    return allManualProducts.filter((p) => {
      const matchesCat = manualCategoryFilter === 'all' || p.categoryId === manualCategoryFilter;
      const matchesSearch = !manualProductSearch.trim() || p.name.toLowerCase().includes(manualProductSearch.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [allManualProducts, manualCategoryFilter, manualProductSearch]);

  const handleAddProductToManualCart = (prod) => {
    setManualCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === prod.id && !item.isCustom);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      }
      return [
        ...prev,
        {
          id: prod.id,
          name: prod.name,
          price: prod.price || 0,
          quantity: 1,
          note: '',
          isCustom: false,
        },
      ];
    });
  };

  const handleAddCustomItem = (e) => {
    if (e) e.preventDefault();
    if (!manualCustomName.trim() || !manualCustomPrice) return;
    const priceNum = parseInt(manualCustomPrice, 10);
    if (isNaN(priceNum) || priceNum < 0) return;
    setManualCart((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        name: manualCustomName.trim(),
        price: priceNum,
        quantity: 1,
        note: '',
        isCustom: true,
      },
    ]);
    setManualCustomName('');
    setManualCustomPrice('');
  };

  const handleUpdateManualCartQty = (index, delta) => {
    setManualCart((prev) => {
      const updated = [...prev];
      const newQty = (updated[index].quantity || 1) + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }
      updated[index].quantity = newQty;
      return updated;
    });
  };

  const handleRemoveManualCartItem = (index) => {
    setManualCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateManualOrder = async (invoicingImmediately = false) => {
    if (!manualCustomer.nombre.trim()) {
      showToast('Por favor escribe el nombre del cliente o número de mesa.', 'error');
      return;
    }
    if (manualCart.length === 0) {
      showToast('Debes agregar al menos un producto a la comanda.', 'error');
      return;
    }

    const deliveryFee = manualCustomer.orderType === 'domicilio' ? (restaurantConfig?.deliveryPrice || 4000) : 0;
    const subtotal = manualCart.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
    const total = subtotal + deliveryFee;

    const newOrderId = `TRN-${Date.now().toString().slice(-4)}`;
    const newOrder = {
      id: newOrderId,
      date: new Date().toISOString(),
      status: invoicingImmediately ? 'en_cocina' : 'pendiente',
      orderType: manualCustomer.orderType,
      customer: {
        nombre: manualCustomer.nombre.trim(),
        telefono: manualCustomer.telefono.trim() || 'N/A',
        direccion: manualCustomer.direccion.trim() || (manualCustomer.orderType === 'local' ? 'Consumo en Mesa / Local' : (manualCustomer.orderType === 'domicilio' ? 'Domicilio' : 'Para llevar / Mostrador')),
        descripcion: manualCustomer.notas.trim() || '',
      },
      items: manualCart.map((it) => ({
        id: it.id,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        note: it.note || '',
        selectedExtras: [],
        removedIngredients: [],
      })),
      deliveryFee,
      subtotal,
      total,
      paymentMethod: manualCustomer.paymentMethod || 'Efectivo',
      createdVia: 'caja_manual',
      invoiced: invoicingImmediately,
      invoicedAt: invoicingImmediately ? new Date().toISOString() : null,
      invoicedBy: invoicingImmediately ? 'caja' : null,
    };

    addOrder(newOrder);
    setShowManualOrderModal(false);
    setManualCustomer({
      nombre: '',
      telefono: '',
      direccion: '',
      orderType: 'local',
      paymentMethod: 'Efectivo',
      notas: '',
    });
    setManualCart([]);

    if (invoicingImmediately) {
      showToast(`Comanda #${newOrderId} creada. Generando factura...`);
      await handleFacturarTresCopias(newOrder);
    } else {
      showToast(`Comanda manual #${newOrderId} creada exitosamente.`);
    }
  };

  // ── Modo Tema Claro por Defecto y Único ──
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    try {
      localStorage.setItem('tronos-pos-theme', 'light');
      setTheme('light');
    } catch (e) {}
  }, []);

  const handleSetTheme = () => {
    setTheme('light');
  };

  // ── Reloj en tiempo real ──────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('es-CO', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }) + ' • ' + now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Filtros y Búsqueda de Pedidos ─────────────────────────────────
  const [orderFilter, setOrderFilter] = useState('all'); // 'all' | 'pending' | 'kitchen' | 'transit' | 'delivered' | 'returned'
  const [orderSearch, setOrderSearch] = useState('');
  const [hideDelivered, setHideDelivered] = useState(true); // Oculta comandas entregadas de la vista 'Todos'

  // ── Directorio para Respaldo Local en PC ──────────────────────────
  const [directoryHandle, setDirectoryHandle] = useState(null);

  // ── Notificaciones Toast ──────────────────────────────────────────
  const [toastMessage, setToastMessage] = useState(null);
  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3800);
  };

  // ── Alerta Sonora POS (Campana Doble 6s: 2 campanadas x 3s a máximo volumen) ──
  const [soundEnabled, setSoundEnabled] = useState(true);
  const knownOrderIdsRef = useRef(new Set());
  const isInitialLoadRef = useRef(true);

  // Desbloquear audio en la primera interacción con el panel
  useEffect(() => {
    const handleUnlock = () => {
      unlockAudio();
      window.removeEventListener('click', handleUnlock);
      window.removeEventListener('touchstart', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
    };
    window.addEventListener('click', handleUnlock);
    window.addEventListener('touchstart', handleUnlock);
    window.addEventListener('keydown', handleUnlock);
    return () => {
      window.removeEventListener('click', handleUnlock);
      window.removeEventListener('touchstart', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
    };
  }, []);

  const playOrderChime = useCallback(() => {
    if (!soundEnabled || typeof window === 'undefined') return;
    // Reproduce campana muy duro 2 veces consecutivas (3s cada una = 6s total)
    playLoudBell(1.0);
  }, [soundEnabled]);

  // Detección reactiva de órdenes nuevas (garantiza sonar sin importar la vía de entrada)
  useEffect(() => {
    if (!orders || orders.length === 0) return;
    if (isInitialLoadRef.current) {
      orders.forEach((o) => knownOrderIdsRef.current.add(o.id));
      isInitialLoadRef.current = false;
      return;
    }

    let hasNewOrder = false;
    let newOrderId = '';
    orders.forEach((o) => {
      if (!knownOrderIdsRef.current.has(o.id)) {
        hasNewOrder = true;
        newOrderId = o.id;
        knownOrderIdsRef.current.add(o.id);
      }
    });

    if (hasNewOrder) {
      playOrderChime();
      showToast(`🔔 ¡Nueva comanda #${newOrderId} recibida!`, 'info');
    }
  }, [orders, playOrderChime]);

  // Escuchar alertas en tiempo real por BroadcastChannel
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let channel = null;
    if ('BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('tronos_orders_channel');
        channel.onmessage = (event) => {
          if (event.data?.type === 'NEW_ORDER_ALERT') {
            const orderId = event.data.order?.id;
            if (orderId && !knownOrderIdsRef.current.has(orderId)) {
              knownOrderIdsRef.current.add(orderId);
              playOrderChime();
              showToast(`🔔 ¡Nueva comanda #${orderId} recibida!`, 'info');
            }
          }
        };
      } catch (e) {}
    }
    return () => {
      if (channel) channel.close();
    };
  }, [playOrderChime]);

  // ── Login State para Cajero ───────────────────────────────────────
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState(false);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const result = login(credentials.username, credentials.password);
    if (!result) {
      setLoginError('Usuario o contraseña incorrectos.');
    } else if (result === 'admin') {
      window.location.href = '/admin';
    } else {
      setLoginError(false);
      showToast('Sesión iniciada con éxito.');
    }
  };

  // ── Métricas Operativas de Caja ───────────────────────────────────
  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o) => o.status === 'pendiente').length;
    const kitchenOrders = orders.filter((o) => o.status === 'en_cocina').length;
    const inTransitOrders = orders.filter((o) => o.status === 'en_camino').length;
    const deliveredOrders = orders.filter((o) => o.status === 'entregado').length;
    const returnedOrders = orders.filter((o) => o.status === 'devuelto').length;
    const totalSales = orders
      .filter((o) => o.status === 'entregado')
      .reduce((sum, o) => sum + (o.total || 0), 0);

    return {
      totalOrders,
      pendingOrders,
      kitchenOrders,
      inTransitOrders,
      deliveredOrders,
      returnedOrders,
      totalSales,
    };
  }, [orders]);

  // ── Cantidad de pedidos activos (sin entregados si están ocultos) ─
  const activeOrdersCount = useMemo(() => {
    return orders.filter((o) => !hideDelivered || o.status !== 'entregado').length;
  }, [orders, hideDelivered]);

  // ── Filtrado de Pedidos ───────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchSearch =
        order.id?.toLowerCase().includes(orderSearch.toLowerCase()) ||
        order.customer?.nombre?.toLowerCase().includes(orderSearch.toLowerCase()) ||
        order.customer?.telefono?.toLowerCase().includes(orderSearch.toLowerCase()) ||
        order.customer?.direccion?.toLowerCase().includes(orderSearch.toLowerCase());

      if (!matchSearch) return false;

      if (orderFilter === 'pending') return order.status === 'pendiente';
      if (orderFilter === 'kitchen') return order.status === 'en_cocina';
      if (orderFilter === 'transit') return order.status === 'en_camino';
      if (orderFilter === 'delivered') return order.status === 'entregado';
      if (orderFilter === 'returned') return order.status === 'devuelto';
      
      // Vista 'Todos': ocultar entregados si hideDelivered está activado
      if (hideDelivered && order.status === 'entregado') return false;
      return true;
    });
  }, [orders, orderFilter, orderSearch, hideDelivered]);

  // ── Generador de Factura Electrónica (.html) ───────────────────────
  const generateElectronicInvoiceHtml = (order) => {
    const dateFormatted = new Date(order.date || Date.now()).toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemsHtml = (order.items || [])
      .map((item) => {
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        const extrasHtml = (item.selectedExtras || [])
          .map((e) => `<div style="font-size:11px; color:#4b5563; padding-left:14px; margin-top:2px;">+ ${e.name} x${e.quantity || 1} (${formatPrice((e.price || 0) * (e.quantity || 1))})</div>`)
          .join('');
        const removedHtml = (item.removedIngredients || []).length > 0
          ? `<div style="font-size:11px; color:#000000; font-weight:700; padding-left:14px; margin-top:2px;">[SIN: ${item.removedIngredients.join(', ').toUpperCase()}]</div>`
          : '';
        const noteHtml = item.note ? `<div style="font-size:11px; color:#4b5563; font-style:italic; padding-left:14px; margin-top:2px;">* Nota: ${item.note}</div>` : '';

        return `
          <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:10px 4px; vertical-align:top;">
              <div style="font-weight:800; font-size:13px; color:#000000;">
                <span style="display:inline-block; min-width:24px; font-weight:900;">${item.quantity || 1}x</span>
                ${item.name.toUpperCase()}
              </div>
              ${extrasHtml}
              ${removedHtml}
              ${noteHtml}
            </td>
            <td style="padding:10px 4px; text-align:right; vertical-align:top; font-weight:800; font-size:13px; color:#000000;">
              ${formatPrice(itemTotal)}
            </td>
          </tr>
        `;
      })
      .join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura - ${order.id} - TRONOS PUB & GRILL</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: #f4f4f5;
      color: #000000;
      padding: 30px 10px;
      margin: 0;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
    }
    .invoice-card {
      width: 440px;
      max-width: 95%;
      margin: 0 auto;
      background: #ffffff;
      border: 2px solid #000000;
      padding: 32px 28px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.08);
    }
    .brand-title {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 4px;
      text-transform: uppercase;
      text-align: center;
      margin: 0;
      color: #000000;
    }
    .brand-sub {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 3px;
      text-transform: uppercase;
      text-align: center;
      margin-top: 4px;
    }
    .divider-double {
      border-top: 2px solid #000000;
      border-bottom: 1px solid #000000;
      padding: 8px 0;
      margin: 16px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .meta-grid {
      border: 1px solid #000000;
      padding: 12px 14px;
      margin-bottom: 18px;
      font-size: 11.5px;
      line-height: 1.6;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
    }
    .items-table th {
      border-bottom: 2px solid #000000;
      padding-bottom: 8px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .total-box {
      border: 2px solid #000000;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 14px;
      background: #f8fafc;
    }
    .total-label { font-size: 13px; font-weight: 900; }
    .total-val { font-size: 20px; font-weight: 900; }
    .footer-note {
      text-align: center;
      font-size: 10px;
      color: #444444;
      margin-top: 20px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div style="text-align: center; font-size: 24px; margin-bottom: 4px;">👑</div>
    <h1 class="brand-title">TRONOS</h1>
    <div class="brand-sub">PUB & GRILL</div>

    <div class="divider-double">
      <span>FACTURA ELECTRÓNICA POS</span>
      <span>ORDEN #${order.id}</span>
    </div>

    <div class="meta-grid">
      <div><strong>FECHA:</strong> ${dateFormatted}</div>
      <div><strong>CLIENTE:</strong> ${order.customer?.nombre || 'Consumidor Final'}</div>
      <div><strong>TELÉFONO:</strong> ${order.customer?.telefono || 'N/A'}</div>
      <div><strong>DIRECCIÓN:</strong> ${order.customer?.direccion || 'En local'}</div>
      ${order.customer?.descripcion ? `<div><strong>REFERENCIA:</strong> ${order.customer.descripcion}</div>` : ''}
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="text-align:left;">DESCRIPCIÓN</th>
          <th style="text-align:right;">VALOR</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="total-box">
      <span class="total-label">TOTAL A PAGAR</span>
      <span class="total-val">${formatPrice(order.total || 0)}</span>
    </div>

    <div class="footer-note">
      ¡GRACIAS POR SU PREFERENCIA!<br>
      TRONOS PUB & GRILL • TEL: ${restaurantConfig?.whatsapp || '300 770 8616'}<br>
      DOCUMENTO DE CONTROL INTERNO POS
    </div>
  </div>
</body>
</html>`;
  };

  // ── Guardar Factura Electrónica (Copia 1 Digital) ───────────────────
  const saveElectronicInvoice = async (order) => {
    const htmlContent = generateElectronicInvoiceHtml(order);
    const sanitizedDate = (order.date || new Date().toISOString()).slice(0, 10);
    const fileName = `Factura_${order.id}_${sanitizedDate}.html`;

    let savedInFolder = false;
    if (directoryHandle) {
      try {
        const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(htmlContent);
        await writable.close();
        savedInFolder = true;
      } catch (err) {
        console.warn('Fallback a descarga directa:', err);
      }
    }

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return { success: true, method: savedInFolder ? 'folder' : 'download', fileName, folderName: directoryHandle?.name };
  };

  // ── Conectar Carpeta Local en PC ──────────────────────────────────
  const handleSelectFolder = async () => {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const handle = await window.showDirectoryPicker();
        setDirectoryHandle(handle);
        updatePosBackupFolderName(handle.name);
        showToast(`Carpeta "${handle.name}" vinculada con éxito.`);
      } catch (err) {
        if (err.name !== 'AbortError') {
          showToast('Error al seleccionar carpeta: ' + err.message, 'error');
        }
      }
    } else {
      showToast('Las facturas se guardarán en tu carpeta de Descargas.', 'info');
    }
  };

  // ── Funciones de Respaldo Maestro en PDF y Vaciado de Panel a CERO ──
  const getCustomerFeedbacks = () => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('tronos_customer_feedback');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  // 1. Descargar Reporte PDF Completo (Sin Borrar Datos)
  const handleDownloadFullReportPdf = async () => {
    setIsGeneratingPdf(true);
    showToast('📄 Generando Reporte Maestro en PDF...', 'info');
    try {
      const feedbacks = getCustomerFeedbacks();
      const reportHtml = generateMasterReportHtml({
        orders,
        auditOrders,
        invoicedOrders,
        restaurantConfig,
        menuCategories,
        customerFeedbacks: feedbacks,
        userRole: isAdmin ? 'Administrador' : 'Cajero / Asesor de Caja',
      });

      const fileName = `Reporte_General_Tronos_${new Date().toISOString().slice(0, 10)}.html`;
      downloadMasterReportHtmlFile(reportHtml, fileName);
      await printMasterReport(reportHtml, 'Reporte Maestro Tronos Pub & Grill');
      showToast('✅ Reporte PDF listo para guardar o imprimir.');
    } catch (err) {
      console.error('Error generando reporte:', err);
      showToast('Error al generar el reporte PDF', 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 2. Borrar Datos: Descargar Respaldo PDF Completo y Reiniciar a CERO
  const handleResetAllData = async () => {
    setIsGeneratingPdf(true);
    showToast('📄 Generando respaldo en PDF y limpiando datos a cero...', 'info');
    try {
      // Descargar primero el PDF con toda la información acumulada
      const feedbacks = getCustomerFeedbacks();
      const reportHtml = generateMasterReportHtml({
        orders,
        auditOrders,
        invoicedOrders,
        restaurantConfig,
        menuCategories,
        customerFeedbacks: feedbacks,
        userRole: isAdmin ? 'Administrador' : 'Cajero / Asesor de Caja',
      });

      const fileName = `Respaldo_Previo_Borrado_Tronos_${new Date().toISOString().slice(0, 10)}.html`;
      downloadMasterReportHtmlFile(reportHtml, fileName);
      await printMasterReport(reportHtml, 'Respaldo Previo a Borrado - Tronos Pub & Grill');

      // Limpiar panel dejando todos los datos en cero como nuevo
      resetAllOrdersData();
      setShowResetConfirmModal(false);
      showToast('✅ Panel reiniciado a CERO con éxito. Respaldo guardado.', 'success');
    } catch (err) {
      console.error('Error al reiniciar datos:', err);
      showToast('Error al reiniciar los datos', 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // ── Generador de Tickets Térmicos POS (2 Copias Físicas: Cliente + Cocina) ──
  const generateReceiptHtml = (order) => {
    const dateFormatted = new Date(order.date || Date.now()).toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemsHtml = (order.items || [])
      .map((item) => {
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        const extrasHtml = (item.selectedExtras || [])
          .map((e) => `<div style="font-size:10px; color:#333333; padding-left:12px; margin-top:1px;">+ ${e.name} x${e.quantity || 1} (${formatPrice((e.price || 0) * (e.quantity || 1))})</div>`)
          .join('');
        const removedHtml = (item.removedIngredients || []).length > 0
          ? `<div style="font-size:10px; color:#000000; font-weight:800; padding-left:12px; margin-top:1px;">[SIN: ${item.removedIngredients.join(', ').toUpperCase()}]</div>`
          : '';
        const noteHtml = item.note ? `<div style="font-size:9.5px; color:#444444; font-style:italic; padding-left:12px; margin-top:1px;">* Nota: ${item.note}</div>` : '';

        return `
          <div style="padding:4px 0; border-bottom:1px dashed #cccccc;">
            <div style="display:flex; justify-content:space-between; font-size:11.5px;">
              <span style="font-weight:900;">${item.quantity || 1}x ${item.name.toUpperCase()}</span>
              <span style="font-weight:900;">${formatPrice(itemTotal)}</span>
            </div>
            ${extrasHtml}
            ${removedHtml}
            ${noteHtml}
          </div>
        `;
      })
      .join('');

    const buildTicketHtml = (copyTitle) => `
      <div class="ticket-card">
        <div class="brand-crown">👑</div>
        <div class="brand-title">TRONOS</div>
        <div class="brand-sub">PUB & GRILL</div>
        <div class="brand-contact">Tel / WhatsApp: ${restaurantConfig?.whatsapp || '300 770 8616'}</div>

        <div class="divider-double">
          <span>*** ${copyTitle} ***</span>
          <span>ORDEN #${order.id}</span>
        </div>

        <div class="meta-box">
          <div class="meta-row"><span class="meta-label">Fecha:</span> <span class="meta-val">${dateFormatted}</span></div>
          <div class="meta-row"><span class="meta-label">Cliente:</span> <span class="meta-val">${order.customer?.nombre || 'Consumidor Final'}</span></div>
          <div class="meta-row"><span class="meta-label">Tel:</span> <span class="meta-val">${order.customer?.telefono || 'N/A'}</span></div>
          <div class="meta-row"><span class="meta-label">Dir:</span> <span class="meta-val">${order.customer?.direccion || 'En local'}</span></div>
          ${order.customer?.descripcion ? `<div class="meta-row"><span class="meta-label">Ref:</span> <span class="meta-val">${order.customer.descripcion}</span></div>` : ''}
        </div>

        <div class="items-header">
          <span>CANT / DESCRIPCIÓN</span>
          <span>IMPORTE</span>
        </div>

        <div style="margin-bottom:6px;">
          ${itemsHtml}
        </div>

        <div class="total-box">
          <span class="total-label">TOTAL A PAGAR:</span>
          <span class="total-val">${formatPrice(order.total || 0)}</span>
        </div>

        <div class="footer-note">
          ¡GRACIAS POR SU COMPRA!<br>
          TRONOS PUB & GRILL • DOCUMENTO POS
        </div>
      </div>
    `;

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura_${order.id}</title>
  <style>
    @page {
      size: auto;
      margin: 0 !important;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-sheet {
      width: 100%;
      margin: 0 auto;
      padding: 0;
    }
    .ticket-page {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1mm 0 2mm 0;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .ticket-page-copy2 {
      page-break-before: always !important;
      break-before: page !important;
      margin-top: 0 !important;
    }
    .ticket-card {
      width: 74mm;
      max-width: 95%;
      margin: 0 auto;
      border: 1.5px solid #000000;
      padding: 3mm 2.5mm;
      background: #ffffff;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .brand-crown { text-align: center; font-size: 18px; margin-bottom: 2px; }
    .brand-title { font-size: 19px; font-weight: 900; letter-spacing: 3px; text-align: center; text-transform: uppercase; }
    .brand-sub { font-size: 10px; font-weight: 800; letter-spacing: 2px; text-align: center; text-transform: uppercase; margin-top: 1px; }
    .brand-contact { font-size: 8.5px; text-align: center; color: #555555; margin-top: 2px; }
    .divider-double {
      border-top: 1.5px solid #000000;
      border-bottom: 1px solid #000000;
      padding: 4px 0;
      margin: 6px 0;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .meta-box { border: 1px solid #000000; padding: 6px 7px; margin: 6px 0 8px 0; font-size: 10px; }
    .meta-row { display: flex; margin-bottom: 2px; }
    .meta-label { font-weight: 800; width: 55px; }
    .meta-val { font-weight: 600; flex: 1; }
    .items-header {
      display: flex;
      justify-content: space-between;
      font-weight: 900;
      font-size: 9.5px;
      border-bottom: 1.5px solid #000000;
      padding-bottom: 3px;
      margin-bottom: 4px;
    }
    .total-box {
      border: 1.5px solid #000000;
      padding: 6px 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 6px;
      background: #f4f4f5;
    }
    .total-label { font-size: 11px; font-weight: 900; }
    .total-val { font-size: 15px; font-weight: 900; }
    .footer-note { text-align: center; font-size: 8.5px; color: #333333; margin-top: 7px; }
    @media print {
      @page {
        size: auto;
        margin: 0 !important;
      }
      html, body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      .print-sheet {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .ticket-page {
        padding: 1mm 0 !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .ticket-page-copy2 {
        page-break-before: always !important;
        break-before: page !important;
      }
      .ticket-card {
        width: 74mm !important;
        margin: 0 auto !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-sheet">
    <div class="ticket-page">
      ${buildTicketHtml('COPIA 1 - CLIENTE')}
    </div>
    <div class="ticket-page ticket-page-copy2">
      ${buildTicketHtml('COPIA 2 - COMERCIO / COCINA')}
    </div>
  </div>
</body>
</html>`;
  };

  // Impresión aislada mediante iframe
  const printReceiptIframe = (receiptHtml, docTitle) => {
    return new Promise((resolve) => {
      const oldIframe = document.getElementById('caja-print-iframe');
      if (oldIframe) oldIframe.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'caja-print-iframe';
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
      doc.write(receiptHtml);
      doc.close();

      if (docTitle) doc.title = docTitle;

      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (err) {
          console.error('Error al imprimir:', err);
        }
        setTimeout(() => {
          iframe.remove();
          resolve();
        }, 2500);
      }, 350);
    });
  };

  // ── UN SOLO CLIC: GENERA 3 FACTURAS (1 DIGITAL + 2 TÉRMICAS) ────────
  const handleFacturarTresCopias = async (order) => {
    if (order.status === 'pendiente') {
      updateOrderStatus(order.id, 'en_cocina', {
        invoiced: true,
        invoicedAt: new Date().toISOString(),
        invoicedBy: 'caja',
      });
    } else {
      markOrderInvoiced(order.id, { invoicedBy: 'caja' });
    }

    // 1. Guardar/descargar copia digital (.html)
    try {
      const res = await saveElectronicInvoice(order);
      if (res.method === 'folder') {
        showToast(`Factura guardada en carpeta "${res.folderName}" y enviando a impresora...`);
      } else {
        showToast(`Factura digital descargada y enviando a impresora...`);
      }
    } catch (e) {
      showToast('Error al generar copia digital.', 'error');
    }

    // 2. Enviar a impresora las 2 copias físicas
    const cleanClientName = (order.customer?.nombre || 'Cliente').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    const docTitle = `Factura_${order.id}_${cleanClientName}`;
    const receiptHtml = generateReceiptHtml(order);

    await printReceiptIframe(receiptHtml, docTitle);
  };

  // ── Re-Imprimir Comandas Térmicas (2 Copias) ───────────────────────
  const handleReprintReceipt = async (order) => {
    const cleanClientName = (order.customer?.nombre || 'Cliente').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    const docTitle = `Factura_${order.id}_${cleanClientName}`;
    const receiptHtml = generateReceiptHtml(order);
    showToast(`Reimprimiendo comanda #${order.id}...`);
    await printReceiptIframe(receiptHtml, docTitle);
  };

  // ── REGLA OBLIGATORIA: Para pasar a Cocina se debe Facturar e Imprimir sí o sí ──
  const handleEnviarACocina = async (order) => {
    if (!order.invoiced) {
      showToast(`🧾 Facturación obligatoria: Imprimiendo tickets comanda #${order.id} para enviar a cocina...`, 'info');
      await handleFacturarTresCopias(order);
    } else {
      updateOrderStatus(order.id, 'en_cocina');
      showToast(`Comanda #${order.id} enviada a Cocina.`);
    }
  };

  // ── PANTALLA DE LOGIN DE CAJA ─────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div
        className="min-vh-100 d-flex align-items-center justify-content-center p-3"
        style={{ background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
      >
        <div
          className="p-4 p-md-5 rounded-4 text-center"
          style={{
            maxWidth: '420px',
            width: '100%',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div className="d-flex justify-content-center mb-3">
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: '#141414',
                color: '#d4a843',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              👑
            </div>
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.3px', marginBottom: '4px' }}>
            TRONOS POS
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px', fontWeight: 600 }}>
            Sistema POS & Facturación
          </p>

          {loginError && (
            <div className="p-2.5 mb-3 rounded-3 text-danger text-center" style={{ background: '#fef2f2', border: '1px solid #fecaca', fontSize: '12px', fontWeight: 600 }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="text-center">
            <div className="mb-3 text-center">
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Usuario
              </label>
              <input
                type="text"
                name="username"
                value={credentials.username}
                placeholder="Ingresa tu usuario"
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                className="form-control text-center"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '13.5px',
                  color: '#0f172a',
                }}
                required
              />
            </div>

            <div className="mb-4 text-center">
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                value={credentials.password}
                placeholder="••••••••"
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                className="form-control text-center"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '13.5px',
                  color: '#0f172a',
                }}
                required
              />
            </div>

            <button
              type="submit"
              className="btn w-100 py-2.5 fw-bold text-center d-flex align-items-center justify-content-center"
              style={{
                background: '#141414',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '12px',
                fontSize: '14px',
                letterSpacing: '0.3px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
              }}
            >
              Iniciar Sesión
            </button>
          </form>

          <div className="mt-4 pt-3 border-top text-center" style={{ borderColor: '#e2e8f0' }}>
            <Link href="/" style={{ fontSize: '12px', color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>
              ← Volver a la Carta Web
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── PANEL PRINCIPAL DE CAJERO ─────────────────────────────────────
  return (
    <div
      className="min-vh-100"
      style={{
        background: theme === 'light' ? '#f4f6f8' : '#0f1019',
        color: theme === 'light' ? '#111827' : '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* ── BARRA SUPERIOR DE CAJA ── */}
      <header
        className="px-3 px-md-4 py-2.5 border-bottom sticky-top"
        style={{
          background: theme === 'light' ? '#ffffff' : '#181a28',
          borderColor: theme === 'light' ? '#e2e8f0' : '#262940',
          boxShadow: theme === 'light' ? '0 2px 10px rgba(0, 0, 0, 0.04)' : '0 4px 16px rgba(0, 0, 0, 0.35)',
          zIndex: 100,
        }}
      >
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          {/* Logo y Rol */}
          <div className="d-flex align-items-center gap-3">
            <Image
              src="/images/logo-tronos.webp"
              alt="Tronos Logo"
              width={42}
              height={42}
              unoptimized
              style={{ borderRadius: '10px', border: '1px solid rgba(0, 0, 0, 0.08)' }}
            />
            <div>
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: '17px', fontWeight: 900, color: theme === 'light' ? '#0f172a' : '#ffffff' }}>
                  TRONOS
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: '#15803d',
                    background: '#dcfce7',
                    border: '1px solid #bbf7d0',
                    padding: '2px 8px',
                    borderRadius: '6px',
                  }}
                >
                  CAJA OPERATIVA
                </span>
              </div>
              <div style={{ color: theme === 'light' ? '#64748b' : '#8f94ba', fontSize: '11.5px', fontWeight: 600 }}>
                {currentTime || 'Cargando reloj...'}
              </div>
            </div>
          </div>

          {/* Selector de Carpeta, Timbre y Acciones */}
          <div className="d-flex align-items-center flex-wrap gap-2">
            {/* Botón Timbre de Pedidos y Prueba */}
            <div className="d-flex align-items-center gap-1">
              <button
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  if (next) {
                    playLoudBell(1.0);
                    showToast('🔔 Campana activada (Probando 6 segundos)', 'info');
                  }
                }}
                className="btn btn-sm d-flex align-items-center gap-1.5"
                style={{
                  background: soundEnabled
                    ? (theme === 'light' ? '#f0fdf4' : 'rgba(34, 197, 94, 0.15)')
                    : (theme === 'light' ? '#f1f5f9' : '#141524'),
                  color: soundEnabled ? (theme === 'light' ? '#166534' : '#4ade80') : (theme === 'light' ? '#64748b' : '#8f94ba'),
                  border: `1px solid ${soundEnabled ? (theme === 'light' ? '#bbf7d0' : '#22c55e') : (theme === 'light' ? '#cbd5e1' : '#262940')}`,
                  borderRadius: '8px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
                title="Activar / Desactivar campana de pedidos"
              >
                <span>{soundEnabled ? '🔔 Timbre Activo' : '🔕 Silenciado'}</span>
              </button>
              {soundEnabled && (
                <button
                  onClick={() => {
                    playLoudBell(1.0);
                    showToast('🔔 Probando campana doble (2 veces x 3s = 6s muy duro)...', 'info');
                  }}
                  className="btn btn-sm"
                  style={{
                    background: theme === 'light' ? '#ffffff' : '#141524',
                    color: '#22c55e',
                    border: `1px solid ${theme === 'light' ? '#bbf7d0' : '#262940'}`,
                    borderRadius: '8px',
                    padding: '5px 9px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Probar sonido: suena una campana dos veces con duración de 3 segundos cada una (6s duro)"
                >
                  Probar (6s)
                </button>
              )}
            </div>

            {/* Selector de Carpeta Local PC */}
            <button
              onClick={handleSelectFolder}
              className="btn btn-sm d-flex align-items-center gap-1.5"
              style={{
                background: posBackupFolderName
                  ? (theme === 'light' ? '#ecfdf5' : 'rgba(45, 212, 191, 0.15)')
                  : (theme === 'light' ? '#f8fafc' : '#141524'),
                color: posBackupFolderName
                  ? (theme === 'light' ? '#065f46' : '#2dd4bf')
                  : (theme === 'light' ? '#334155' : '#cbd5e1'),
                border: `1px solid ${posBackupFolderName ? (theme === 'light' ? '#a7f3d0' : '#2dd4bf') : (theme === 'light' ? '#cbd5e1' : '#262940')}`,
                borderRadius: '8px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 700,
              }}
              title="Seleccionar carpeta de la PC para guardar facturas"
            >
              <IconFolder size={15} />
              <span>{posBackupFolderName ? `Carpeta: ${posBackupFolderName}` : 'Carpeta Facturas'}</span>
            </button>

            {/* Ver Carta Web */}
            <Link
              href="/"
              className="btn btn-sm d-flex align-items-center gap-1"
              style={{
                background: theme === 'light' ? '#ffffff' : '#141524',
                color: theme === 'light' ? '#334155' : '#cbd5e1',
                border: `1px solid ${theme === 'light' ? '#cbd5e1' : '#262940'}`,
                borderRadius: '8px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <IconGlobe size={14} /> <span>Menú Web</span>
            </Link>

            {/* Cerrar Sesión */}
            <button
              onClick={logout}
              className="btn btn-sm d-flex align-items-center gap-1"
              style={{
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              <IconLogout size={14} /> <span>Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Toast de Notificación ── */}
      {toastMessage && (
        <div
          className="position-fixed top-0 start-50 translate-middle-x mt-3 px-4 py-2.5 rounded-3 shadow-lg d-flex align-items-center gap-2"
          style={{
            zIndex: 9999,
            background: toastMessage.type === 'error' ? '#ef4444' : '#0f172a',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <span>{toastMessage.type === 'error' ? <IconX size={16} /> : <IconCheckCircle size={16} />}</span>
          <span>{toastMessage.message}</span>
        </div>
      )}

      {/* ── CUERPO DE CAJA ── */}
      <main className="container-fluid px-3 px-md-4 py-4">
        {/* KPI METRICS */}
        <div className="row g-2 g-md-3 mb-4 text-center">
          <div className="col-6 col-md-2">
            <div
              className="p-3 rounded-4 h-100 d-flex flex-column justify-content-center align-items-center"
              style={{
                background: theme === 'light' ? '#ffffff' : '#181a28',
                border: `1px solid ${theme === 'light' ? '#e2e8f0' : '#262940'}`,
                boxShadow: theme === 'light' ? '0 2px 6px rgba(0,0,0,0.02)' : '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              <div className="d-flex align-items-center gap-1.5 mb-1">
                <IconBox size={15} style={{ color: '#ea580c' }} />
                <span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#64748b' : '#8f94ba' }}>
                  Pendientes
                </span>
              </div>
              <span style={{ fontSize: '24px', fontWeight: 900, color: '#dc2626' }}>
                {metrics.pendingOrders}
              </span>
            </div>
          </div>

          <div className="col-6 col-md-2">
            <div
              className="p-3 rounded-4 h-100 d-flex flex-column justify-content-center align-items-center"
              style={{
                background: theme === 'light' ? '#ffffff' : '#181a28',
                border: `1px solid ${theme === 'light' ? '#e2e8f0' : '#262940'}`,
                boxShadow: theme === 'light' ? '0 2px 6px rgba(0,0,0,0.02)' : '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              <div className="d-flex align-items-center gap-1.5 mb-1">
                <span style={{ fontSize: '14px' }}>👨‍🍳</span>
                <span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#64748b' : '#8f94ba' }}>
                  En Cocina
                </span>
              </div>
              <span style={{ fontSize: '24px', fontWeight: 900, color: '#dc2626' }}>
                {metrics.kitchenOrders}
              </span>
            </div>
          </div>

          <div className="col-6 col-md-2">
            <div
              className="p-3 rounded-4 h-100 d-flex flex-column justify-content-center align-items-center"
              style={{
                background: theme === 'light' ? '#ffffff' : '#181a28',
                border: `1px solid ${theme === 'light' ? '#e2e8f0' : '#262940'}`,
                boxShadow: theme === 'light' ? '0 2px 6px rgba(0,0,0,0.02)' : '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              <div className="d-flex align-items-center gap-1.5 mb-1">
                <IconTransit size={15} style={{ color: '#0284c7' }} />
                <span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#64748b' : '#8f94ba' }}>
                  En Camino
                </span>
              </div>
              <span style={{ fontSize: '24px', fontWeight: 900, color: '#dc2626' }}>
                {metrics.inTransitOrders}
              </span>
            </div>
          </div>

          <div className="col-6 col-md-2">
            <div
              className="p-3 rounded-4 h-100 d-flex flex-column justify-content-center align-items-center"
              style={{
                background: theme === 'light' ? '#ffffff' : '#181a28',
                border: `1px solid ${theme === 'light' ? '#e2e8f0' : '#262940'}`,
                boxShadow: theme === 'light' ? '0 2px 6px rgba(0,0,0,0.02)' : '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              <div className="d-flex align-items-center gap-1.5 mb-1">
                <IconCheckCircle size={15} style={{ color: '#16a34a' }} />
                <span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#64748b' : '#8f94ba' }}>
                  Entregados
                </span>
              </div>
              <span style={{ fontSize: '24px', fontWeight: 900, color: '#dc2626' }}>
                {metrics.deliveredOrders}
              </span>
            </div>
          </div>

          <div className="col-6 col-md-2">
            <div
              className="p-3 rounded-4 h-100 d-flex flex-column justify-content-center align-items-center"
              style={{
                background: theme === 'light' ? '#ffffff' : '#181a28',
                border: `1px solid ${theme === 'light' ? '#e2e8f0' : '#262940'}`,
                boxShadow: theme === 'light' ? '0 2px 6px rgba(0,0,0,0.02)' : '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              <div className="d-flex align-items-center gap-1.5 mb-1">
                <span style={{ fontSize: '14px' }}>↩️</span>
                <span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#64748b' : '#8f94ba' }}>
                  Devueltos
                </span>
              </div>
              <span style={{ fontSize: '24px', fontWeight: 900, color: '#dc2626' }}>
                {metrics.returnedOrders}
              </span>
            </div>
          </div>

          <div className="col-6 col-md-2">
            <div
              className="p-3 rounded-4 h-100 d-flex flex-column justify-content-center align-items-center"
              style={{
                background: theme === 'light' ? '#ffffff' : '#181a28',
                border: `1px solid ${theme === 'light' ? '#e2e8f0' : '#262940'}`,
                boxShadow: theme === 'light' ? '0 2px 6px rgba(0,0,0,0.02)' : '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              <div className="d-flex align-items-center gap-1.5 mb-1">
                <IconSales size={15} style={{ color: '#ffd026' }} />
                <span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', color: theme === 'light' ? '#64748b' : '#8f94ba' }}>
                  Recaudado
                </span>
              </div>
              <span style={{ fontSize: '18px', fontWeight: 900, color: theme === 'light' ? '#15803d' : '#ffd026' }}>
                {formatPrice(metrics.totalSales)}
              </span>
            </div>
          </div>
        </div>

        {/* BARRA DE BÚSQUEDA Y FILTROS - COMPACTA, FIJA Y FLOTANTE AL HACER SCROLL */}
        <div
          className="px-3 py-2 mb-3 rounded-3 d-flex flex-wrap justify-content-between align-items-center gap-2"
          style={{
            position: 'sticky',
            top: '58px',
            zIndex: 90,
            background: theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(24, 26, 40, 0.95)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: `1px solid ${theme === 'light' ? '#e2e8f0' : '#262940'}`,
            boxShadow: theme === 'light' ? '0 4px 14px rgba(0, 0, 0, 0.05)' : '0 4px 20px rgba(0, 0, 0, 0.4)',
            transition: 'all 0.2s ease',
          }}
        >
          {/* Filtros reducidos y compactos - Texto en negrilla negro y números en rojo */}
          <div className="d-flex gap-1.5 flex-wrap align-items-center">
            {[
              { key: 'all', name: 'Todos', count: activeOrdersCount },
              { key: 'pending', name: 'Pendientes', count: metrics.pendingOrders },
              { key: 'kitchen', name: 'En Cocina', count: metrics.kitchenOrders },
              { key: 'transit', name: 'En Camino', count: metrics.inTransitOrders },
              { key: 'delivered', name: 'Entregados', count: metrics.deliveredOrders },
              { key: 'returned', name: 'Devueltos', count: metrics.returnedOrders },
            ].map((f) => {
              const isSelected = orderFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setOrderFilter(f.key)}
                  className="btn btn-sm d-inline-flex align-items-center"
                  style={{
                    background: isSelected ? '#f1f5f9' : '#ffffff',
                    border: isSelected ? '2px solid #000000' : '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: isSelected ? '3px 9px' : '4px 10px',
                    lineHeight: '1.2',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontWeight: 800, color: '#000000', fontSize: '11.5px' }}>
                    {f.name}
                  </span>
                  <span style={{ fontWeight: 900, color: '#dc2626', fontSize: '12px', marginLeft: '3px' }}>
                    ({f.count})
                  </span>
                </button>
              );
            })}

            {/* Toggle para Ocultar/Mostrar Entregados */}
            <button
              onClick={() => setHideDelivered(!hideDelivered)}
              className="btn btn-sm d-inline-flex align-items-center gap-1"
              style={{
                background: '#ffffff',
                border: '1.5px dashed #000000',
                borderRadius: '6px',
                padding: '4px 10px',
                lineHeight: '1.2',
                cursor: 'pointer',
              }}
              title="Ocultar o mostrar pedidos ya entregados en la vista principal"
            >
              <span style={{ fontSize: '12px' }}>👁️</span>
              <span style={{ fontWeight: 800, color: '#000000', fontSize: '11.5px' }}>
                {hideDelivered ? 'Entregados ocultos' : 'Entregados visibles'}
              </span>
            </button>

            {/* Botón Destacado: Crear Comanda Manual */}
            <button
              onClick={() => setShowManualOrderModal(true)}
              className="btn btn-sm d-inline-flex align-items-center gap-1.5 fw-bold shadow-sm"
              style={{
                background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 13px',
                fontSize: '12px',
                cursor: 'pointer',
                letterSpacing: '0.2px',
              }}
              title="Crear comanda manualmente para clientes presenciales o por llamada"
            >
              <span style={{ fontSize: '13px' }}>➕</span>
              <span>Crear Comanda Manual</span>
            </button>
          </div>

          {/* Buscador compacto */}
          <div className="position-relative" style={{ maxWidth: '250px', width: '100%' }}>
            <span className="position-absolute start-0 top-50 translate-middle-y ps-2.5 text-muted" style={{ pointerEvents: 'none', display: 'flex' }}>
              <IconSearch size={13} />
            </span>
            <input
              type="text"
              placeholder="Buscar #TRN, cliente..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              className="form-control form-control-sm"
              style={{
                background: theme === 'light' ? '#f8fafc' : '#121320',
                color: theme === 'light' ? '#0f172a' : '#ffffff',
                borderColor: theme === 'light' ? '#cbd5e1' : '#262940',
                borderRadius: '6px',
                fontSize: '11.5px',
                padding: '4px 8px 4px 28px',
                height: '29px',
              }}
            />
          </div>
        </div>

        {/* Notificación informativa cuando hay entregados ocultos en 'Todos' */}
        {orderFilter === 'all' && hideDelivered && metrics.deliveredOrders > 0 && (
          <div
            className="d-flex align-items-center justify-content-between px-3 py-1.5 mb-3 rounded-2"
            style={{
              background: theme === 'light' ? '#f8fafc' : '#141524',
              border: `1px solid ${theme === 'light' ? '#e2e8f0' : '#262940'}`,
              fontSize: '11.5px',
              color: theme === 'light' ? '#64748b' : '#8f94ba',
            }}
          >
            <span>
              📦 <strong>{metrics.deliveredOrders}</strong> {metrics.deliveredOrders === 1 ? 'pedido entregado está oculto' : 'pedidos entregados están ocultos'} de la lista activa para mayor orden.
            </span>
            <button
              onClick={() => setOrderFilter('delivered')}
              className="btn btn-sm p-0 ms-2"
              style={{ fontSize: '11.5px', fontWeight: 700, color: '#7c3aed', textDecoration: 'underline' }}
            >
              Ver pedidos entregados ({metrics.deliveredOrders})
            </button>
          </div>
        )}

        {/* LISTADO DE COMANDAS DE CAJA */}
        {filteredOrders.length === 0 ? (
          <div
            className="text-center py-5 rounded-4"
            style={{
              background: theme === 'light' ? '#ffffff' : '#111827',
              border: `1px solid ${theme === 'light' ? '#e2e8f0' : '#1f2937'}`,
            }}
          >
            <div className="mb-2">
              <IconOrders size={42} style={{ color: '#94a3b8' }} />
            </div>
            <h5 style={{ fontSize: '16px', fontWeight: 800, color: theme === 'light' ? '#334155' : '#f1f5f9' }}>
              No hay pedidos activos en esta sección
            </h5>
            {orderFilter === 'all' && hideDelivered && metrics.deliveredOrders > 0 ? (
              <div className="mt-2">
                <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
                  Todos los pedidos actuales ya fueron entregados y están resguardados en el historial.
                </p>
                <button
                  onClick={() => setOrderFilter('delivered')}
                  className="btn btn-sm mt-2"
                  style={{
                    background: '#7c3aed',
                    color: '#ffffff',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    padding: '5px 12px',
                  }}
                >
                  Ver los {metrics.deliveredOrders} pedidos entregados
                </button>
              </div>
            ) : (
              <p style={{ fontSize: '12.5px', color: '#64748b' }}>
                Los pedidos nuevos aparecerán aquí automáticamente y sonará el timbre de caja.
              </p>
            )}
          </div>
        ) : (
          <div className="row g-2 g-md-2.5">
            {filteredOrders.map((order) => {
              const isPending = order.status === 'pendiente';
              const isKitchen = order.status === 'en_cocina';
              const isTransit = order.status === 'en_camino';
              const isDelivered = order.status === 'entregado';
              const isReturned = order.status === 'devuelto';

              const customerPhone = (order.customer?.telefono || '').replace(/\D/g, '');
              const whatsappLink = customerPhone
                ? `https://wa.me/57${customerPhone}?text=${encodeURIComponent(`Hola ${order.customer?.nombre || ''}, te contactamos de Tronos Pub & Grill sobre tu comanda #${order.id}.`)}`
                : null;

              return (
                <div key={order.id} className="col-12 col-sm-6 col-md-4 col-xl-3">
                  <div
                    className="rounded-3 h-100 d-flex flex-column justify-content-between overflow-hidden shadow-sm"
                    style={{
                      minHeight: '480px',
                      background: theme === 'light' ? '#ffffff' : '#181a28',
                      border: isPending
                        ? '2px solid #ea580c'
                        : isKitchen
                        ? '2px solid #7c3aed'
                        : isTransit
                        ? '1.5px solid #0284c7'
                        : isDelivered
                        ? '1.5px solid #16a34a'
                        : isReturned
                        ? '2px solid #dc2626'
                        : `1px solid ${theme === 'light' ? '#e2e8f0' : '#262940'}`,
                      boxShadow: isKitchen
                        ? '0 2px 10px rgba(124, 58, 237, 0.16)'
                        : isTransit
                        ? '0 2px 10px rgba(2, 132, 199, 0.16)'
                        : isDelivered
                        ? '0 2px 10px rgba(22, 163, 74, 0.16)'
                        : isPending
                        ? '0 2px 10px rgba(234, 88, 12, 0.16)'
                        : '0 2px 10px rgba(220, 38, 38, 0.16)',
                    }}
                  >
                    {/* Header de la tarjeta */}
                    <div
                      className="px-3.5 py-2 border-bottom d-flex justify-content-between align-items-center"
                      style={{
                        background: isPending
                          ? (theme === 'light' ? 'rgba(234, 88, 12, 0.06)' : 'rgba(234, 88, 12, 0.14)')
                          : isKitchen
                          ? (theme === 'light' ? 'rgba(124, 58, 237, 0.06)' : 'rgba(124, 58, 237, 0.14)')
                          : isReturned
                          ? (theme === 'light' ? 'rgba(220, 38, 38, 0.06)' : 'rgba(220, 38, 38, 0.14)')
                          : theme === 'light'
                          ? '#f8fafc'
                          : '#141524',
                        borderColor: theme === 'light' ? '#e2e8f0' : '#262940',
                      }}
                    >
                      <div className="d-flex align-items-center gap-1.5 flex-wrap">
                        <span
                          style={{
                            background: '#0f172a',
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: 900,
                            padding: '2px 7px',
                            borderRadius: '5px',
                            letterSpacing: '0.3px',
                          }}
                        >
                          #{order.id}
                        </span>
                        <span style={{ color: theme === 'light' ? '#64748b' : '#8f94ba', fontSize: '10.5px', fontWeight: 600 }}>
                          {new Date(order.date || Date.now()).toLocaleTimeString('es-CO', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {order.invoiced && (
                          <span
                            style={{
                              background: theme === 'light' ? '#dcfce7' : 'rgba(34, 197, 94, 0.15)',
                              color: theme === 'light' ? '#15803d' : '#4ade80',
                              border: `1px solid ${theme === 'light' ? '#86efac' : 'rgba(34, 197, 94, 0.3)'}`,
                              fontSize: '9.5px',
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                            title={order.invoicedAt ? `Facturado a las ${new Date(order.invoicedAt).toLocaleTimeString('es-CO')}` : 'Factura generada'}
                          >
                            <span>✓ Facturado</span>
                          </span>
                        )}
                      </div>

                      {/* Estado */}
                      <div>
                        {isPending && (
                          <span
                            style={{
                              background: '#ffedd5',
                              color: '#c2410c',
                              border: '1px solid #fed7aa',
                              fontSize: '9.5px',
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: '12px',
                            }}
                          >
                            ● Pendiente
                          </span>
                        )}
                        {isKitchen && (
                          <span
                            style={{
                              background: '#f3e8ff',
                              color: '#7c3aed',
                              border: '1px solid #ddd6fe',
                              fontSize: '9.5px',
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: '12px',
                            }}
                          >
                            👨‍🍳 Cocina
                          </span>
                        )}
                        {isTransit && (
                          <span
                            style={{
                              background: '#e0f2fe',
                              color: '#0369a1',
                              border: '1px solid #bae6fd',
                              fontSize: '9.5px',
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: '12px',
                            }}
                          >
                            🛵 En Camino
                          </span>
                        )}
                        {isDelivered && (
                          <span
                            style={{
                              background: '#dcfce7',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
                              fontSize: '9.5px',
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: '12px',
                            }}
                          >
                            ✓ Entregado
                          </span>
                        )}
                        {isReturned && (
                          <span
                            style={{
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: '1px solid #fca5a5',
                              fontSize: '9.5px',
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: '12px',
                            }}
                          >
                            ↩️ Devuelto
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Datos del Cliente Centrados con texto negro y en negrilla */}
                    <div className="px-3.5 py-2.5 border-bottom text-center" style={{ borderColor: theme === 'light' ? '#f1f5f9' : '#262940' }}>
                      <div className="d-flex align-items-center justify-content-center gap-2 mb-1 flex-wrap">
                        <span style={{ fontSize: '13px', fontWeight: 900, color: '#000000' }}>
                          {order.customer?.nombre || 'Consumidor Final'}
                        </span>
                        {whatsappLink && (
                          <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm d-inline-flex align-items-center gap-1"
                            style={{
                              background: '#dcfce7',
                              color: '#166534',
                              border: '1px solid #86efac',
                              padding: '1px 7px',
                              fontSize: '10.5px',
                              fontWeight: 800,
                              borderRadius: '5px',
                              textDecoration: 'none',
                            }}
                          >
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>

                      <div style={{ fontSize: '11px', color: '#000000', fontWeight: 800, lineHeight: '1.4' }}>
                        <div>📞 {order.customer?.telefono || 'N/A'}</div>
                        <div className="text-truncate">📍 {order.customer?.direccion || 'Consumo en local'}</div>
                        {order.customer?.descripcion && (
                          <div className="text-truncate" style={{ fontStyle: 'italic', marginTop: '1px', color: '#000000', fontWeight: 800 }}>
                            Ref: {order.customer.descripcion}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ítems del Pedido Centrados con texto negro y en negrilla */}
                    <div className="px-3.5 py-2.5 flex-grow-1 text-center" style={{ minHeight: '130px', maxHeight: '175px', overflowY: 'auto' }}>
                      <div style={{ fontSize: '10.5px', fontWeight: 900, color: '#000000', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.4px' }}>
                        Detalle del Pedido
                      </div>

                      {(order.items || []).map((it, idx) => {
                        const itemSubtotal = (it.price || 0) * (it.quantity || 1);
                        return (
                          <div
                            key={idx}
                            className="py-1.5 border-bottom text-center"
                            style={{ borderColor: theme === 'light' ? '#f1f5f9' : '#262940', fontSize: '11.5px' }}
                          >
                            <div className="d-flex justify-content-center align-items-center gap-1.5 flex-wrap">
                              <span style={{ fontWeight: 900, color: '#000000' }}>
                                {it.quantity || 1}x {it.name}
                              </span>
                              <span style={{ fontWeight: 900, color: '#000000' }}>
                                — {formatPrice(itemSubtotal)}
                              </span>
                            </div>

                            {/* Adicionales */}
                            {(it.selectedExtras || []).map((ex, exIdx) => (
                              <div key={exIdx} style={{ fontSize: '10.5px', color: '#000000', fontWeight: 800, marginTop: '2px', textAlign: 'center' }}>
                                + {ex.name} x{ex.quantity || 1} ({formatPrice((ex.price || 0) * (ex.quantity || 1))})
                              </div>
                            ))}

                            {/* Ingredientes removidos */}
                            {(it.removedIngredients || []).length > 0 && (
                              <div style={{ fontSize: '10.5px', color: '#dc2626', fontWeight: 900, marginTop: '2px', textAlign: 'center' }}>
                                [SIN: {it.removedIngredients.join(', ').toUpperCase()}]
                              </div>
                            )}

                            {/* Nota */}
                            {it.note && (
                              <div style={{ fontSize: '10.5px', color: '#000000', fontStyle: 'italic', fontWeight: 800, marginTop: '2px', textAlign: 'center' }}>
                                * Nota: {it.note}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Total y Botones de Acción */}
                    <div
                      className="px-3.5 py-2.5 border-top"
                      style={{
                        background: theme === 'light' ? '#f8fafc' : '#141524',
                        borderColor: theme === 'light' ? '#e2e8f0' : '#262940',
                      }}
                    >
                      {/* Total */}
                      <div className="d-flex justify-content-between align-items-center mb-1.5">
                        <span style={{ fontSize: '11px', fontWeight: 900, color: '#000000' }}>TOTAL:</span>
                        <span style={{ fontSize: '16px', fontWeight: 900, color: '#15803d' }}>
                          {formatPrice(order.total || 0)}
                        </span>
                      </div>

                      {/* Indicador Factura Generada */}
                      {order.invoiced && (
                        <div
                          className="px-2 py-1 mb-1.5 rounded-2 d-flex align-items-center justify-content-between"
                          style={{
                            background: theme === 'light' ? '#f0fdf4' : 'rgba(34, 197, 94, 0.12)',
                            border: `1px solid ${theme === 'light' ? '#86efac' : 'rgba(34, 197, 94, 0.3)'}`,
                            color: theme === 'light' ? '#166534' : '#4ade80',
                          }}
                        >
                          <div className="d-flex align-items-center gap-1" style={{ fontSize: '10px', fontWeight: 700 }}>
                            <span>✓ Factura generada</span>
                            {order.invoicedAt && (
                              <span style={{ fontSize: '9.5px', color: theme === 'light' ? '#15803d' : '#4ade80', fontWeight: 500 }}>
                                ({new Date(order.invoicedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: '9px',
                              color: theme === 'light' ? '#166534' : '#4ade80',
                              fontWeight: 700,
                              background: theme === 'light' ? '#dcfce7' : 'rgba(34, 197, 94, 0.2)',
                              padding: '1px 5px',
                              borderRadius: '3px',
                            }}
                          >
                            3 Copias
                          </span>
                        </div>
                      )}

                      {/* Botón Principal: Generar / Re-imprimir 3 Facturas */}
                      <button
                        onClick={() => handleFacturarTresCopias(order)}
                        className="btn w-100 py-1.5 fw-bold d-flex align-items-center justify-content-center gap-1.5 mb-1.5"
                        style={{
                          background: order.invoiced
                            ? (theme === 'light' ? '#1e293b' : '#121320')
                            : '#0f172a',
                          color: '#ffffff',
                          borderRadius: '7px',
                          fontSize: '11px',
                          border: theme === 'dark' ? '1px solid #262940' : 'none',
                          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.12)',
                        }}
                      >
                        <IconPrinter size={13} />
                        <span>
                          {order.invoiced
                            ? '🧾 Re-Imprimir (3 Copias)'
                            : '🧾 Facturar (3 Copias)'}
                        </span>
                      </button>

                      {/* Progreso de Estados Separados */}
                      <div className="d-flex flex-column gap-1">
                        {isPending && (
                          <>
                            {!order.invoiced && (
                              <div
                                className="p-1 rounded-2 text-center"
                                style={{
                                  background: 'rgba(234, 88, 12, 0.08)',
                                  border: '1px dashed #ea580c',
                                  color: '#c2410c',
                                  fontSize: '9.5px',
                                  fontWeight: 700,
                                }}
                              >
                                🔒 Facturación e impresión obligatoria
                              </div>
                            )}
                            <div className="d-flex gap-1.5">
                              <button
                                onClick={() => handleEnviarACocina(order)}
                                className="btn btn-sm w-100 fw-bold d-flex align-items-center justify-content-center gap-1 py-1"
                                style={{
                                  background: '#7c3aed',
                                  color: '#ffffff',
                                  borderRadius: '6px',
                                  fontSize: '10.5px',
                                  padding: '5px',
                                }}
                                title={order.invoiced ? "Enviar comanda a cocina" : "Obligatorio: Se emitirán e imprimirán las facturas antes de enviar a cocina"}
                              >
                                <span>
                                  {order.invoiced ? '👨‍🍳 A Cocina' : '👨‍🍳 Facturar e Imprimir'}
                                </span>
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`¿Marcar la comanda #${order.id} como devuelta?`)) {
                                    updateOrderStatus(order.id, 'devuelto');
                                    showToast(`Comanda #${order.id} marcada como devuelta.`, 'error');
                                  }
                                }}
                                className="btn btn-sm fw-bold d-flex align-items-center justify-content-center px-2 py-1"
                                style={{
                                  background: '#fee2e2',
                                  color: '#b91c1c',
                                  border: '1px solid #fca5a5',
                                  borderRadius: '6px',
                                  fontSize: '10px',
                                  whiteSpace: 'nowrap',
                                }}
                                title="Marcar Devuelto"
                              >
                                <span>↩️ Devolver</span>
                              </button>
                            </div>
                          </>
                        )}

                        {isKitchen && (
                          <div className="d-flex gap-1.5">
                            <button
                              onClick={() => {
                                updateOrderStatus(order.id, 'en_camino');
                                showToast(`Comanda #${order.id} salió de cocina: ¡En Camino!`);
                              }}
                              className="btn btn-sm w-100 fw-bold d-flex align-items-center justify-content-center gap-1 py-1"
                              style={{
                                background: '#22c55e',
                                color: '#ffffff',
                                borderRadius: '6px',
                                fontSize: '10.5px',
                                padding: '5px',
                              }}
                            >
                              <span>🛵 Despachar</span>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`¿Marcar la comanda #${order.id} como devuelta?`)) {
                                  updateOrderStatus(order.id, 'devuelto');
                                  showToast(`Comanda #${order.id} marcada como devuelta.`, 'error');
                                }
                              }}
                              className="btn btn-sm fw-bold d-flex align-items-center justify-content-center px-2 py-1"
                              style={{
                                background: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #fca5a5',
                                borderRadius: '6px',
                                fontSize: '10px',
                                whiteSpace: 'nowrap',
                              }}
                              title="Marcar Devuelto"
                            >
                              <span>↩️ Devolver</span>
                            </button>
                          </div>
                        )}

                        {isTransit && (
                          <div className="d-flex gap-1.5">
                            <button
                              onClick={() => {
                                updateOrderStatus(order.id, 'entregado');
                                showToast(`Comanda #${order.id} entregada con éxito.`);
                              }}
                              className="btn btn-sm w-100 fw-bold d-flex align-items-center justify-content-center gap-1 py-1"
                              style={{
                                background: '#7c3aed',
                                color: '#ffffff',
                                borderRadius: '6px',
                                fontSize: '10.5px',
                                padding: '5px',
                              }}
                            >
                              <span>✅ Entregado</span>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`¿Marcar la comanda #${order.id} como devuelta?`)) {
                                  updateOrderStatus(order.id, 'devuelto');
                                  showToast(`Comanda #${order.id} marcada como devuelta.`, 'error');
                                }
                              }}
                              className="btn btn-sm fw-bold d-flex align-items-center justify-content-center px-2 py-1"
                              style={{
                                background: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #fca5a5',
                                borderRadius: '6px',
                                fontSize: '10px',
                                whiteSpace: 'nowrap',
                              }}
                              title="Marcar Devuelto"
                            >
                              <span>↩️ Devolver</span>
                            </button>
                          </div>
                        )}

                        {isDelivered && (
                          <button
                            onClick={() => {
                              if (confirm(`¿Marcar la comanda #${order.id} entregada como devuelta?`)) {
                                updateOrderStatus(order.id, 'devuelto');
                                showToast(`Comanda #${order.id} marcada como devuelta.`, 'error');
                              }
                            }}
                            className="btn btn-sm w-100 fw-bold d-flex align-items-center justify-content-center gap-1 py-1"
                            style={{
                              background: 'transparent',
                              color: '#dc2626',
                              border: '1px solid #fca5a5',
                              borderRadius: '6px',
                              fontSize: '10px',
                              padding: '4px',
                            }}
                          >
                            <span>↩️ Marcar Devuelto</span>
                          </button>
                        )}

                        {isReturned && (
                          <button
                            onClick={() => handleEnviarACocina(order)}
                            className="btn btn-sm w-100 fw-bold d-flex align-items-center justify-content-center gap-1 py-1"
                            style={{
                              background: '#7c3aed',
                              color: '#ffffff',
                              borderRadius: '6px',
                              fontSize: '10.5px',
                              padding: '4px',
                            }}
                          >
                            <span>👨‍🍳 Reenviar a Cocina</span>
                          </button>
                        )}
                      </div>

                      {/* Nota de Auditoría Central / Restricción de Seguridad & Eliminar */}
                      <div
                        className="mt-1.5 pt-1 border-top d-flex justify-content-between align-items-center"
                        style={{ borderColor: 'rgba(0,0,0,0.06)', fontSize: '9px', color: '#94a3b8' }}
                      >
                        <span>🔒 Auditoría Central</span>
                        <button
                          onClick={() => {
                            if (confirm(`¿Estás seguro de eliminar la comanda #${order.id}? Se borrará inmediatamente del panel y de Supabase.`)) {
                              deleteOrder(order.id, 'Anulado desde Caja');
                              showToast(`Comanda #${order.id} eliminada permanentemente.`);
                            }
                          }}
                          className="btn btn-link p-0 text-decoration-none"
                          style={{ fontSize: '9.5px', color: '#dc2626', fontWeight: 700 }}
                          title="Eliminar comanda permanentemente"
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── MODAL CONFIGURACIÓN WHATSAPP DOMICILIOS (ASESOR DE CAJA) ── */}
      {showWhatsAppModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 1050,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowWhatsAppModal(false);
          }}
        >
          <div
            className="rounded-4 shadow-lg d-flex flex-column"
            style={{
              maxWidth: '480px',
              width: '100%',
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            {/* Header del Modal */}
            <div
              className="p-3.5 border-bottom d-flex justify-content-between align-items-center"
              style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}
            >
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: '20px' }}>📱</span>
                <div>
                  <h5 className="m-0 fw-black" style={{ fontSize: '15.5px', color: '#0f172a' }}>
                    WhatsApp de Recepción de Domicilios
                  </h5>
                  <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>
                    Asesor de Caja encargado de recibir los pedidos
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="btn btn-sm btn-light border-0 d-flex align-items-center justify-content-center p-1 rounded-circle"
                style={{ width: '30px', height: '30px', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-4">
              <p style={{ fontSize: '12.5px', color: '#475569', lineHeight: '1.5', marginBottom: '14px', fontWeight: 500 }}>
                Este es el número al que se redirigen automáticamente los clientes cuando hacen clic en <strong>Pedir por WhatsApp</strong> desde la carta web.
              </p>

              {/* Tarjeta de Estado Actual */}
              <div
                className="p-3 mb-3 rounded-3 d-flex align-items-center justify-content-between"
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#166534',
                }}
              >
                <div className="d-flex align-items-center gap-2">
                  <span style={{ fontSize: '14px' }}>🟢</span>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Actualmente Vinculado:</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 900, letterSpacing: '0.5px' }}>
                  +{restaurantConfig?.whatsapp || '573007708616'}
                </div>
              </div>

              {/* Campo para cambiar número */}
              <div className="mb-3">
                <label className="fw-bold mb-1.5" style={{ fontSize: '12.5px', color: '#1e293b' }}>
                  Nuevo Número de WhatsApp del Asesor:
                </label>
                <input
                  type="text"
                  className="form-control text-center fw-bold"
                  value={cajaWhatsAppInput}
                  onChange={(e) => setCajaWhatsAppInput(e.target.value)}
                  placeholder="Ej: 3007708616 o 573007708616"
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    fontSize: '15px',
                    padding: '10px',
                    color: '#0f172a',
                  }}
                />
                <div className="mt-2" style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                  💡 <strong>Nota:</strong> Si ingresas un número de 10 dígitos (ej. <code>3007708616</code>), el sistema le antepone automáticamente el código del país (+57).
                </div>
              </div>

              {/* Botón Probar Enlace */}
              <div className="d-flex justify-content-end mb-3">
                <a
                  href={`https://wa.me/${cleanWhatsAppNumber(cajaWhatsAppInput || restaurantConfig?.whatsapp)}?text=${encodeURIComponent('Hola asesor, este es un mensaje de prueba para verificar que el enlace de pedidos por WhatsApp funciona correctamente en Tronos Pub & Grill.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm d-flex align-items-center gap-1.5 fw-bold"
                  style={{
                    background: 'rgba(34, 197, 94, 0.1)',
                    color: '#16a34a',
                    border: '1px solid #86efac',
                    borderRadius: '8px',
                    fontSize: '12px',
                    padding: '6px 14px',
                    textDecoration: 'none',
                  }}
                  title="Abrir WhatsApp en otra pestaña para verificar que el número esté correcto"
                >
                  <span>🔗 Probar Enlace de WhatsApp</span>
                </a>
              </div>
            </div>

            {/* Footer de Acciones */}
            <div
              className="p-3 border-top d-flex justify-content-end align-items-center gap-2"
              style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}
            >
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="btn btn-sm fw-bold px-3"
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                }}
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  if (!cajaWhatsAppInput.trim()) {
                    showToast('⚠️ Por favor ingresa un número de teléfono válido', 'error');
                    return;
                  }
                  const cleaned = updateWhatsApp(cajaWhatsAppInput);
                  setCajaWhatsAppInput(cleaned);
                  showToast(`✅ WhatsApp guardado y vinculado: +${cleaned}`, 'success');
                }}
                className="btn btn-sm fw-bold px-4 d-flex align-items-center gap-1.5"
                style={{
                  background: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)',
                }}
              >
                <span>💾 Guardar y Vincular</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CREAR COMANDA MANUAL (VENTA PRESENCIAL / TELEFÓNICA) ── */}
      {showManualOrderModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-2 p-md-3"
          style={{
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 1100,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowManualOrderModal(false);
          }}
        >
          <div
            className="rounded-4 shadow-2xl d-flex flex-column"
            style={{
              maxWidth: '920px',
              width: '100%',
              maxHeight: '92vh',
              background: '#ffffff',
              color: '#0f172a',
              overflow: 'hidden',
            }}
          >
            {/* Header del Modal */}
            <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center bg-dark text-white">
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: '18px' }}>📝</span>
                <div>
                  <h6 className="mb-0 fw-bold" style={{ fontSize: '15px', letterSpacing: '0.3px' }}>
                    Crear Comanda Manual (Presencial / Mostrador / Domicilio)
                  </h6>
                  <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
                    Registra pedidos directos sin necesidad de pasar por la página web
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowManualOrderModal(false)}
                className="btn btn-sm btn-outline-light d-flex align-items-center justify-content-center rounded-circle"
                style={{ width: '30px', height: '30px', padding: 0 }}
              >
                ✕
              </button>
            </div>

            {/* Cuerpo del Modal: 2 Columnas */}
            <div className="p-3 p-md-4 overflow-auto flex-grow-1">
              <div className="row g-3">
                {/* Columna Izquierda: Datos del Cliente y Selección de Productos */}
                <div className="col-12 col-lg-7">
                  {/* Selector de Tipo de Pedido */}
                  <div className="mb-3">
                    <label className="fw-bold mb-1.5" style={{ fontSize: '11.5px', color: '#475569' }}>
                      TIPO DE PEDIDO:
                    </label>
                    <div className="d-flex gap-2">
                      {[
                        { id: 'local', label: '🍽️ Consumo Local / Mesa' },
                        { id: 'recoger', label: '🛍️ Para Llevar' },
                        { id: 'domicilio', label: `🛵 Domicilio (+${formatPrice(restaurantConfig?.deliveryPrice || 4000)})` },
                      ].map((type) => {
                        const isSelected = manualCustomer.orderType === type.id;
                        return (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setManualCustomer((prev) => ({ ...prev, orderType: type.id }))}
                            className="btn btn-sm flex-fill fw-bold py-1.5 text-center"
                            style={{
                              background: isSelected ? '#ea580c' : '#f1f5f9',
                              color: isSelected ? '#ffffff' : '#334155',
                              border: isSelected ? '1px solid #c2410c' : '1px solid #cbd5e1',
                              borderRadius: '7px',
                              fontSize: '11.5px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {type.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Formulario Datos Cliente */}
                  <div className="p-3 mb-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div className="row g-2">
                      <div className="col-12 col-md-6">
                        <label className="fw-bold" style={{ fontSize: '11px', color: '#334155' }}>
                          Nombre / Identificador Mesa <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Ej: Mesa 4 / Carlos Ruiz"
                          value={manualCustomer.nombre}
                          onChange={(e) => setManualCustomer((p) => ({ ...p, nombre: e.target.value }))}
                          style={{ fontSize: '12px', borderRadius: '6px' }}
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="fw-bold" style={{ fontSize: '11px', color: '#334155' }}>
                          Teléfono del Cliente
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Ej: 3001234567"
                          value={manualCustomer.telefono}
                          onChange={(e) => setManualCustomer((p) => ({ ...p, telefono: e.target.value }))}
                          style={{ fontSize: '12px', borderRadius: '6px' }}
                        />
                      </div>
                      {manualCustomer.orderType === 'domicilio' && (
                        <div className="col-12">
                          <label className="fw-bold" style={{ fontSize: '11px', color: '#ea580c' }}>
                            📍 Dirección de Entrega <span style={{ color: '#dc2626' }}>*</span>
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Ej: Cra 15 # 45-20 Apto 302"
                            value={manualCustomer.direccion}
                            onChange={(e) => setManualCustomer((p) => ({ ...p, direccion: e.target.value }))}
                            style={{ fontSize: '12px', borderRadius: '6px', borderColor: '#fdba74' }}
                          />
                        </div>
                      )}
                      <div className="col-12 col-md-6">
                        <label className="fw-bold" style={{ fontSize: '11px', color: '#334155' }}>
                          Método de Pago
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={manualCustomer.paymentMethod}
                          onChange={(e) => setManualCustomer((p) => ({ ...p, paymentMethod: e.target.value }))}
                          style={{ fontSize: '12px', borderRadius: '6px' }}
                        >
                          <option value="Efectivo">💵 Efectivo</option>
                          <option value="Nequi / Daviplata">📱 Nequi / Daviplata</option>
                          <option value="Tarjeta / Datáfono">💳 Tarjeta / Datáfono</option>
                          <option value="Transferencia">🏦 Transferencia</option>
                        </select>
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="fw-bold" style={{ fontSize: '11px', color: '#334155' }}>
                          Observaciones / Notas
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Ej: Poco picante, servilletas extra"
                          value={manualCustomer.notas}
                          onChange={(e) => setManualCustomer((p) => ({ ...p, notas: e.target.value }))}
                          style={{ fontSize: '12px', borderRadius: '6px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Selector de Menú */}
                  <div className="border rounded-3 p-3" style={{ background: '#ffffff' }}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="fw-bold" style={{ fontSize: '12px', color: '#0f172a' }}>
                        🍔 Seleccionar Productos del Menú:
                      </span>
                      <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={manualProductSearch}
                        onChange={(e) => setManualProductSearch(e.target.value)}
                        className="form-control form-control-sm"
                        style={{ maxWidth: '170px', fontSize: '11px', padding: '3px 8px' }}
                      />
                    </div>

                    {/* Filtros de Categoría */}
                    <div className="d-flex gap-1 overflow-auto pb-1 mb-2" style={{ whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => setManualCategoryFilter('all')}
                        className={`btn btn-sm py-0.5 px-2 ${manualCategoryFilter === 'all' ? 'btn-dark' : 'btn-light border'}`}
                        style={{ fontSize: '11px', borderRadius: '12px' }}
                      >
                        Todos ({allManualProducts.length})
                      </button>
                      {(menuCategories || []).map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setManualCategoryFilter(cat.id)}
                          className={`btn btn-sm py-0.5 px-2 ${manualCategoryFilter === cat.id ? 'btn-dark' : 'btn-light border'}`}
                          style={{ fontSize: '11px', borderRadius: '12px' }}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>

                    {/* Lista rápida de productos para agregar con 1 clic */}
                    <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '6px' }}>
                      {filteredManualProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleAddProductToManualCart(p)}
                          className="btn btn-sm text-start p-2 d-flex flex-column justify-content-between"
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '7px',
                            minHeight: '48px',
                            transition: 'all 0.1s ease',
                          }}
                        >
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', lineHeight: '1.2' }}>
                            + {p.name}
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', marginTop: '3px' }}>
                            {formatPrice(p.price || 0)}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Ítem Personalizado Manual (para ventas fuera de carta) */}
                    <div className="mt-2.5 pt-2 border-top d-flex gap-2 align-items-center">
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>
                        ➕ Otro ítem:
                      </span>
                      <input
                        type="text"
                        placeholder="Descripción o ítem"
                        value={manualCustomName}
                        onChange={(e) => setManualCustomName(e.target.value)}
                        className="form-control form-control-sm"
                        style={{ fontSize: '11px' }}
                      />
                      <input
                        type="number"
                        placeholder="Precio $"
                        value={manualCustomPrice}
                        onChange={(e) => setManualCustomPrice(e.target.value)}
                        className="form-control form-control-sm"
                        style={{ maxWidth: '90px', fontSize: '11px' }}
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomItem}
                        className="btn btn-sm btn-outline-dark fw-bold"
                        style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
                      >
                        Añadir
                      </button>
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Canasta y Totales de la Comanda */}
                <div className="col-12 col-lg-5 d-flex flex-column">
                  <div
                    className="p-3 rounded-3 flex-grow-1 d-flex flex-column"
                    style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1' }}
                  >
                    <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
                      <span className="fw-bold" style={{ fontSize: '13px', color: '#0f172a' }}>
                        🛒 Comanda Actual ({manualCart.reduce((sum, it) => sum + it.quantity, 0)} ítems)
                      </span>
                      {manualCart.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setManualCart([])}
                          className="btn btn-link p-0 text-danger text-decoration-none"
                          style={{ fontSize: '11px', fontWeight: 700 }}
                        >
                          Vaciar
                        </button>
                      )}
                    </div>

                    {/* Lista de Ítems en Carrito */}
                    <div className="flex-grow-1 overflow-auto pe-1" style={{ minHeight: '160px', maxHeight: '250px' }}>
                      {manualCart.length === 0 ? (
                        <div className="h-100 d-flex flex-column align-items-center justify-content-center text-center p-3 text-muted">
                          <span style={{ fontSize: '26px', opacity: 0.5 }}>🍽️</span>
                          <span style={{ fontSize: '12px', fontWeight: 600, marginTop: '6px' }}>
                            No hay productos agregados
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            Haz clic en los productos de la izquierda para incluirlos
                          </span>
                        </div>
                      ) : (
                        manualCart.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-2 mb-1.5 rounded-2 bg-white border"
                            style={{ borderColor: '#e2e8f0', fontSize: '11.5px' }}
                          >
                            <div className="d-flex justify-content-between align-items-center">
                              <div style={{ fontWeight: 800, color: '#0f172a', maxWidth: '160px' }} className="text-truncate">
                                {item.name}
                              </div>
                              <span style={{ fontWeight: 800, color: '#166534' }}>
                                {formatPrice((item.price || 0) * (item.quantity || 1))}
                              </span>
                            </div>

                            <div className="d-flex justify-content-between align-items-center mt-1.5">
                              <div className="d-flex align-items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateManualCartQty(idx, -1)}
                                  className="btn btn-sm btn-light border py-0 px-2 fw-bold"
                                  style={{ fontSize: '11px', lineHeight: '1.4' }}
                                >
                                  -
                                </button>
                                <span className="fw-bold px-1" style={{ fontSize: '12px' }}>
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateManualCartQty(idx, 1)}
                                  className="btn btn-sm btn-light border py-0 px-2 fw-bold"
                                  style={{ fontSize: '11px', lineHeight: '1.4' }}
                                >
                                  +
                                </button>
                              </div>

                              <input
                                type="text"
                                placeholder="Nota (ej. sin cebolla)"
                                value={item.note || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setManualCart((p) => {
                                    const next = [...p];
                                    next[idx].note = val;
                                    return next;
                                  });
                                }}
                                className="form-control form-control-sm py-0 px-1 mx-2"
                                style={{ fontSize: '10.5px', height: '22px' }}
                              />

                              <button
                                type="button"
                                onClick={() => handleRemoveManualCartItem(idx)}
                                className="btn btn-sm btn-link p-0 text-danger"
                                title="Eliminar ítem"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Desglose de Totales */}
                    <div className="border-top pt-2.5 mt-2">
                      <div className="d-flex justify-content-between mb-1" style={{ fontSize: '11.5px', color: '#475569' }}>
                        <span>Subtotal Productos:</span>
                        <span className="fw-bold">
                          {formatPrice(manualCart.reduce((sum, it) => sum + ((it.price || 0) * (it.quantity || 1)), 0))}
                        </span>
                      </div>

                      {manualCustomer.orderType === 'domicilio' && (
                        <div className="d-flex justify-content-between mb-1" style={{ fontSize: '11.5px', color: '#ea580c' }}>
                          <span>🛵 Costo Domicilio:</span>
                          <span className="fw-bold">
                            +{formatPrice(restaurantConfig?.deliveryPrice || 4000)}
                          </span>
                        </div>
                      )}

                      <div className="d-flex justify-content-between align-items-center border-top pt-2 mt-1">
                        <span style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>TOTAL A COBRAR:</span>
                        <span style={{ fontSize: '19px', fontWeight: 900, color: '#15803d' }}>
                          {formatPrice(
                            manualCart.reduce((sum, it) => sum + ((it.price || 0) * (it.quantity || 1)), 0) +
                            (manualCustomer.orderType === 'domicilio' ? (restaurantConfig?.deliveryPrice || 4000) : 0)
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Botones de Finalización */}
                    <div className="d-flex flex-column gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => handleCreateManualOrder(true)}
                        disabled={manualCart.length === 0 || !manualCustomer.nombre.trim()}
                        className="btn btn-dark fw-bold py-2 d-flex align-items-center justify-content-center gap-1.5 shadow-sm"
                        style={{
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          background: '#0f172a',
                          border: 'none',
                        }}
                      >
                        <IconPrinter size={15} />
                        <span>Crear y Facturar Inmediato (3 Copias)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCreateManualOrder(false)}
                        disabled={manualCart.length === 0 || !manualCustomer.nombre.trim()}
                        className="btn btn-primary fw-bold py-2 d-flex align-items-center justify-content-center gap-1.5"
                        style={{
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          background: '#7c3aed',
                          borderColor: '#7c3aed',
                        }}
                      >
                        <span>👨‍🍳 Crear y Enviar a Cocina</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowManualOrderModal(false)}
                        className="btn btn-sm btn-outline-secondary py-1"
                        style={{ fontSize: '11px', borderRadius: '6px' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE VISTA PREVIA DE FACTURA (.HTML) ── */}
      {previewInvoiceOrder && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            zIndex: 1100,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewInvoiceOrder(null);
          }}
        >
          <div
            className="rounded-4 shadow-2xl d-flex flex-column"
            style={{
              maxWidth: '560px',
              width: '100%',
              height: '90vh',
              background: '#ffffff',
              color: '#000000',
              overflow: 'hidden',
            }}
          >
            <div className="px-4 py-2.5 border-bottom d-flex justify-content-between align-items-center bg-light">
              <div className="fw-bold" style={{ fontSize: '13.5px' }}>
                Vista Previa Factura #{previewInvoiceOrder.id}
              </div>
              <div className="d-flex align-items-center gap-2">
                <button
                  onClick={() => saveElectronicInvoice(previewInvoiceOrder)}
                  className="btn btn-sm btn-outline-success fw-bold"
                  style={{ fontSize: '11.5px' }}
                >
                  📥 Descargar .HTML
                </button>
                <button
                  onClick={() => handleReprintReceipt(previewInvoiceOrder)}
                  className="btn btn-sm btn-dark fw-bold"
                  style={{ fontSize: '11.5px' }}
                >
                  🖨️ Imprimir Tickets
                </button>
                <button
                  onClick={() => setPreviewInvoiceOrder(null)}
                  className="btn btn-sm btn-outline-secondary"
                  style={{ fontSize: '11.5px' }}
                >
                  ✕
                </button>
              </div>
            </div>
            <iframe
              srcDoc={generateElectronicInvoiceHtml(previewInvoiceOrder)}
              title="Preview Factura"
              style={{
                width: '100%',
                flex: 1,
                border: 'none',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
