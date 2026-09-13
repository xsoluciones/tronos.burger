'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useMenu, cleanWhatsAppNumber } from '@/app/context/MenuContext';
import { formatPrice } from '@/app/data/menuData';
import { playLoudBell, unlockAudio } from '@/app/lib/bellSound';
import {
  generateMasterReportHtml,
  printMasterReport,
  downloadMasterReportHtmlFile,
} from '@/app/lib/reportPdfGenerator';
import {
  IconOrders,
  IconMenu,
  IconSettings,
  IconClock,
  IconTransit,
  IconCheckCircle,
  IconCheck,
  IconUser,
  IconPhone,
  IconMapPin,
  IconFileText,
  IconPrinter,
  IconTrash,
  IconBox,
  IconSales,
  IconBurger,
  IconFolder,
  IconSun,
  IconMoon,
  IconGlobe,
  IconLogout,
  IconSearch,
  IconPlus,
  IconCrown,
  IconX,
} from './icons';

export default function AdminPOSPage() {
  const {
    menuCategories,
    addMenuItem,
    deleteMenuItem,
    updateMenuItem,
    updateItemExtras,
    addCategory,
    deleteCategory,
    restaurantConfig,
    updateWhatsApp,
    updateDeliveryPrice,
    addSocial,
    removeSocial,
    isAdmin,
    login,
    logout,
    orders = [],
    auditOrders = [],
    addOrder,
    updateOrderStatus,
    markOrderInvoiced,
    addCustomAdditionToOrder,
    deleteOrder,
    purgeAuditOrder,
    resetAllOrdersData,
    posBackupFolderName,
    updatePosBackupFolderName,
    saveMenuToSupabase,
    saveAllChanges,
  } = useMenu();

  // ── Estado de Guardado Manual de Seguridad (Supabase + Local) ─────
  const [isSavingSafety, setIsSavingSafety] = useState(false);

  const handleSaveAllSafety = async () => {
    setIsSavingSafety(true);
    showToast('Sincronizando menú y configuración con Supabase...', 'info');
    try {
      const res = await saveAllChanges();
      if (res?.supaOk) {
        showToast('✓ ¡Cambios guardados con éxito en Supabase y Respaldo local!', 'success');
      } else if (res?.serverOk || res?.success) {
        showToast('✓ ¡Cambios guardados y respaldados con éxito!', 'success');
      } else {
        showToast('⚠️ Guardado en el navegador (revisando conexión con el servidor).', 'warning');
      }
    } catch (e) {
      showToast('Error al guardar cambios: ' + (e?.message || 'Error desconocido'), 'error');
    } finally {
      setIsSavingSafety(false);
    }
  };

  // ── Estados para Personalizar Pedido (Adición con Precio Manual en Cocina) ──
  const [customizingOrder, setCustomizingOrder] = useState(null);
  const [customAddName, setCustomAddName] = useState('');
  const [customAddPrice, setCustomAddPrice] = useState('');
  const [customAddQty, setCustomAddQty] = useState(1);
  const [customAddNote, setCustomAddNote] = useState('');
  const [isSavingCustomAdd, setIsSavingCustomAdd] = useState(false);

  // ── Estados de Borrado de Datos y Reporte PDF ──────────────────────
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // ── Historial y Modal de Facturas Descargadas ─────────────────────
  const [showInvoicesModal, setShowInvoicesModal] = useState(false);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [previewInvoiceOrder, setPreviewInvoiceOrder] = useState(null);

  // Unificación de todas las facturas generadas (activas + histórico de auditoría)
  const invoicedOrders = useMemo(() => {
    const map = new Map();
    (auditOrders || []).forEach((o) => {
      if (o && o.id && o.status !== 'anulado_admin') map.set(o.id, o);
    });
    (orders || []).forEach((o) => {
      if (o && o.id && o.status !== 'anulado_admin') map.set(o.id, o);
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date || b.invoicedAt || b.createdAt || 0) - new Date(a.date || a.invoicedAt || a.createdAt || 0)
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

  // ── Reloj Minimalista ─────────────────────────────────────────
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

  // ── Pestaña Activa ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'orders' | 'auditoria' | 'inventario' | 'menu' | 'settings' | 'opiniones'

  // ── Filtros de Pedidos ────────────────────────────────────────
  const [orderFilter, setOrderFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [hideDelivered, setHideDelivered] = useState(true); // Oculta comandas entregadas de la vista 'Todos'

  // ── Filtros de Inventario & Análisis de Ventas ────────────────
  const [inventoryPeriod, setInventoryPeriod] = useState('day'); // 'day' | 'week' | 'month' | 'all'
  const [inventoryCatFilter, setInventoryCatFilter] = useState('all'); // 'all' | 'Hamburguesas' | 'Entradas' | 'Bebidas'

  // ── Directorio para Respaldo en PC ───────────────────────────
  const [directoryHandle, setDirectoryHandle] = useState(null);

  // ── Impresión Térmica (2 Copias) ──────────────────────────────
  const [printingOrder, setPrintingOrder] = useState(null);

  // ── Notificaciones Toast ──────────────────────────────────────
  const [toastMessage, setToastMessage] = useState(null);
  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ── Configuración de Domicilio y WhatsApp ─────────────────────
  const [deliveryPriceInput, setDeliveryPriceInput] = useState(() => {
    return String(restaurantConfig?.deliveryPrice !== undefined ? restaurantConfig.deliveryPrice : 4000);
  });

  useEffect(() => {
    if (restaurantConfig?.deliveryPrice !== undefined) {
      setDeliveryPriceInput(String(restaurantConfig.deliveryPrice));
    }
  }, [restaurantConfig?.deliveryPrice]);

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
        userRole: 'Administrador POS',
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
        userRole: 'Administrador POS',
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

  // ── Opiniones y Calificaciones de Clientes (Exclusivo Admin) ─
  const [customerFeedbacks, setCustomerFeedbacks] = useState([]);
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [feedbackRatingFilter, setFeedbackRatingFilter] = useState('all'); // 'all' | 5 | 4 | 3 | 2 | 1

  const loadFeedbacks = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('tronos_customer_feedback');
      if (raw) {
        setCustomerFeedbacks(JSON.parse(raw));
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    loadFeedbacks();

    const handleStorage = (e) => {
      if (e.key === 'tronos_customer_feedback') {
        loadFeedbacks();
      }
    };
    window.addEventListener('storage', handleStorage);

    let channel = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('tronos_orders_channel');
        channel.onmessage = (event) => {
          if (event.data?.type === 'NEW_CUSTOMER_FEEDBACK') {
            loadFeedbacks();
            showToast(`⭐ ¡Nueva calificación recibida de ${event.data.feedback?.customerName || 'un cliente'}!`, 'info');
          }
        };
      } catch (e) {}
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
      if (channel) channel.close();
    };
  }, [loadFeedbacks]);

  const handleDeleteFeedback = (feedbackId) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta opinión del registro?')) return;
    try {
      const updated = customerFeedbacks.filter((f) => f.id !== feedbackId);
      setCustomerFeedbacks(updated);
      localStorage.setItem('tronos_customer_feedback', JSON.stringify(updated));
      showToast('Opinión eliminada', 'info');
    } catch (e) {}
  };

  const feedbackMetrics = useMemo(() => {
    if (customerFeedbacks.length === 0) {
      return { total: 0, average: '5.0', stars: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    }
    const stars = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    customerFeedbacks.forEach((f) => {
      const r = Math.min(Math.max(f.rating || 5, 1), 5);
      stars[r] = (stars[r] || 0) + 1;
      sum += r;
    });
    const avg = (sum / customerFeedbacks.length).toFixed(1);
    return {
      total: customerFeedbacks.length,
      average: avg,
      stars,
    };
  }, [customerFeedbacks]);

  const filteredFeedbacks = useMemo(() => {
    return customerFeedbacks.filter((f) => {
      const matchesRating =
        feedbackRatingFilter === 'all' || f.rating === Number(feedbackRatingFilter);
      const search = feedbackSearch.toLowerCase().trim();
      const matchesSearch =
        !search ||
        f.customerName?.toLowerCase().includes(search) ||
        f.customerPhone?.includes(search) ||
        f.orderId?.toLowerCase().includes(search) ||
        f.comment?.toLowerCase().includes(search) ||
        f.improvements?.toLowerCase().includes(search);
      return matchesRating && matchesSearch;
    });
  }, [customerFeedbacks, feedbackRatingFilter, feedbackSearch]);

  // ── Login State ───────────────────────────────────────────────
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState(false);

  // ── Menu Management State ─────────────────────────────────────
  const [addingToCategoryId, setAddingToCategoryId] = useState(null);
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    detailedDescription: '',
    price: '',
    image: '',
  });

  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItem, setEditingItem] = useState({
    id: null,
    name: '',
    price: '',
    description: '',
    detailedDescription: '',
    image: '',
    categoryId: null,
  });

  const [managingExtrasForItemId, setManagingExtrasForItemId] = useState(null);
  const [newExtra, setNewExtra] = useState({ name: '', price: '', image: '' });
  const [newCategoryTitle, setNewCategoryTitle] = useState('');

  // ── Configuración WhatsApp ────────────────────────────────────
  const [whatsappInput, setWhatsappInput] = useState('');
  useEffect(() => {
    if (restaurantConfig?.whatsapp) {
      setWhatsappInput(restaurantConfig.whatsapp);
    }
  }, [restaurantConfig]);

  const [newSocial, setNewSocial] = useState({ name: '', url: '', image: '' });

  // ── Estadísticas y Métricas ───────────────────────────────────
  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o) => o.status === 'pendiente').length;
    const kitchenOrders = orders.filter((o) => o.status === 'en_cocina').length;
    const inTransitOrders = orders.filter((o) => o.status === 'en_camino').length;
    const deliveredOrders = orders.filter((o) => o.status === 'entregado' && isOrderFromToday(o)).length;
    const returnedOrders = orders.filter((o) => o.status === 'devuelto').length;
    const totalSales = orders
      .filter((o) => o.status === 'entregado' && isOrderFromToday(o))
      .reduce((sum, o) => sum + (o.total || 0), 0);
    const totalMenuItems = menuCategories.reduce((acc, cat) => acc + (cat.items?.length || 0), 0);

    return {
      totalOrders,
      pendingOrders,
      kitchenOrders,
      inTransitOrders,
      deliveredOrders,
      returnedOrders,
      totalSales,
      totalMenuItems,
      totalCategories: menuCategories.length,
    };
  }, [orders, menuCategories]);

  // ── Cantidad de pedidos activos (sin entregados si están ocultos) ─
  const activeOrdersCount = useMemo(() => {
    return orders.filter((o) => {
      if (o.status === 'entregado') {
        return !hideDelivered && isOrderFromToday(o);
      }
      return true;
    }).length;
  }, [orders, hideDelivered]);

  // ── Filtrado de Pedidos ──────────────────────────────────────
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      let matchesFilter = false;
      if (orderFilter === 'all') {
        if (order.status === 'entregado') {
          matchesFilter = !hideDelivered && isOrderFromToday(order);
        } else {
          matchesFilter = true;
        }
      } else if (orderFilter === 'entregado') {
        matchesFilter = order.status === 'entregado' && isOrderFromToday(order);
      } else {
        matchesFilter = order.status === orderFilter;
      }

      const search = orderSearch.toLowerCase().trim();
      const matchesSearch =
        !search ||
        order.id?.toLowerCase().includes(search) ||
        order.customer?.nombre?.toLowerCase().includes(search) ||
        order.customer?.telefono?.includes(search) ||
        order.customer?.direccion?.toLowerCase().includes(search);
      return matchesFilter && matchesSearch;
    });
  }, [orders, orderFilter, orderSearch, hideDelivered]);

  // ── Análisis de Inventario & Ventas Exactas ─────────────────
  const inventoryAnalytics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    // Se usa el registro maestro de Auditoría Central para garantizar cero pérdida de datos
    const sourceOrders = (auditOrders && auditOrders.length > 0) ? auditOrders : orders;

    // Filtrar comandas según el período seleccionado
    const periodOrders = sourceOrders.filter((order) => {
      const orderTime = new Date(order.date || order.createdAt || Date.now()).getTime();
      if (inventoryPeriod === 'day') return orderTime >= startOfToday;
      if (inventoryPeriod === 'week') return orderTime >= sevenDaysAgo;
      if (inventoryPeriod === 'month') return orderTime >= thirtyDaysAgo;
      return true; // 'all'
    });

    // Ventas concretadas = estrictamente status 'entregado'
    const deliveredOrders = periodOrders.filter((o) => o.status === 'entregado');
    // Devoluciones = estrictamente status 'devuelto'
    const returnedOrders = periodOrders.filter((o) => o.status === 'devuelto');

    // Total de ingresos reales recaudados ($ COP) de pedidos entregados
    const totalDeliveredRevenue = deliveredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    // Total del valor de productos devueltos ($ COP)
    const totalReturnedValue = returnedOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    // Mapa de desglose por producto
    const productStats = {};
    const extrasSummary = {};

    const getProductEntry = (item) => {
      const key = item.name.toLowerCase().trim();
      if (!productStats[key]) {
        let category = 'Hamburguesas';
        const lowerName = key.toLowerCase();
        if (
          lowerName.includes('papa') ||
          lowerName.includes('casco') ||
          lowerName.includes('aro') ||
          lowerName.includes('alita') ||
          lowerName.includes('entrada')
        ) {
          category = 'Entradas';
        } else if (
          lowerName.includes('coca') ||
          lowerName.includes('cerveza') ||
          lowerName.includes('corona') ||
          lowerName.includes('heineken') ||
          lowerName.includes('club') ||
          lowerName.includes('agua') ||
          lowerName.includes('jugo') ||
          lowerName.includes('té') ||
          lowerName.includes('te ') ||
          lowerName.includes('limonada') ||
          lowerName.includes('bebida')
        ) {
          category = 'Bebidas';
        }

        productStats[key] = {
          name: item.name,
          category,
          soldQty: 0,
          returnedQty: 0,
          unitPrice: item.price || 0,
          soldRevenue: 0,
          returnedValue: 0,
          extrasBreakdown: {},
        };
      }
      return productStats[key];
    };

    // 1. Procesar comandas Entregadas
    deliveredOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const entry = getProductEntry(item);
        const qty = item.quantity || 1;
        entry.soldQty += qty;

        let itemExtrasTotal = 0;
        (item.selectedExtras || []).forEach((extra) => {
          const exQty = (extra.quantity || 1) * qty;
          const exPrice = extra.price || 0;
          itemExtrasTotal += exPrice * (extra.quantity || 1);

          entry.extrasBreakdown[extra.name] = (entry.extrasBreakdown[extra.name] || 0) + exQty;
          extrasSummary[extra.name] = (extrasSummary[extra.name] || 0) + exQty;
        });

        entry.soldRevenue += ((item.price || 0) + itemExtrasTotal) * qty;
      });
    });

    // 2. Procesar comandas Devueltas
    returnedOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const entry = getProductEntry(item);
        const qty = item.quantity || 1;
        entry.returnedQty += qty;

        let itemExtrasTotal = 0;
        (item.selectedExtras || []).forEach((extra) => {
          itemExtrasTotal += (extra.price || 0) * (extra.quantity || 1);
        });

        entry.returnedValue += ((item.price || 0) + itemExtrasTotal) * qty;
      });
    });

    const productsList = Object.values(productStats);
    const burgersList = productsList.filter((p) => p.category === 'Hamburguesas');
    const sidesList = productsList.filter((p) => p.category === 'Entradas');
    const drinksList = productsList.filter((p) => p.category === 'Bebidas');

    const totalBurgersSold = burgersList.reduce((acc, p) => acc + p.soldQty, 0);
    const totalBurgersReturned = burgersList.reduce((acc, p) => acc + p.returnedQty, 0);

    const totalSidesSold = sidesList.reduce((acc, p) => acc + p.soldQty, 0);
    const totalSidesReturned = sidesList.reduce((acc, p) => acc + p.returnedQty, 0);

    const totalDrinksSold = drinksList.reduce((acc, p) => acc + p.soldQty, 0);
    const totalDrinksReturned = drinksList.reduce((acc, p) => acc + p.returnedQty, 0);

    const totalItemsSold = productsList.reduce((acc, p) => acc + p.soldQty, 0);
    const totalItemsReturned = productsList.reduce((acc, p) => acc + p.returnedQty, 0);

    // Filtrar lista mostrada según categoría si aplica
    const filteredProductsList = inventoryCatFilter === 'all'
      ? productsList
      : productsList.filter((p) => p.category === inventoryCatFilter);

    return {
      periodOrdersCount: periodOrders.length,
      deliveredOrdersCount: deliveredOrders.length,
      returnedOrdersCount: returnedOrders.length,
      totalDeliveredRevenue,
      totalReturnedValue,
      totalBurgersSold,
      totalBurgersReturned,
      totalSidesSold,
      totalSidesReturned,
      totalDrinksSold,
      totalDrinksReturned,
      totalItemsSold,
      totalItemsReturned,
      burgersList,
      sidesList,
      drinksList,
      productsList: filteredProductsList,
      allProductsList: productsList,
      extrasSummary,
    };
  }, [auditOrders, orders, inventoryPeriod, inventoryCatFilter]);

  // ── Métricas y Cálculos para el Dashboard Ejecutivo (Estilo Sales Report) ──
  const dashboardStats = useMemo(() => {
    const deliveredCount = inventoryAnalytics.deliveredOrdersCount || 0;
    const returnedCount = inventoryAnalytics.returnedOrdersCount || 0;
    const totalRevenue = inventoryAnalytics.totalDeliveredRevenue || 0;
    const finishedCount = deliveredCount + returnedCount;
    const successRate = finishedCount > 0 ? Math.round((deliveredCount / finishedCount) * 100) : 100;
    const avgTicket = deliveredCount > 0 ? Math.round(totalRevenue / deliveredCount) : 0;

    // Top 5 productos más vendidos ordenados por ingresos / cantidad
    const validProducts = [...(inventoryAnalytics.allProductsList || [])]
      .filter((p) => (p.soldQty || 0) > 0 || (p.soldRevenue || 0) > 0)
      .sort((a, b) => (b.soldRevenue || 0) - (a.soldRevenue || 0));

    const topProducts = validProducts.length > 0 ? validProducts.slice(0, 5) : [
      { name: 'La Noble Burger', soldQty: 0, soldRevenue: 0, category: 'Hamburguesas' },
      { name: 'Doble Trono Burger', soldQty: 0, soldRevenue: 0, category: 'Hamburguesas' },
      { name: 'Trono Crispy Chicken', soldQty: 0, soldRevenue: 0, category: 'Hamburguesas' },
      { name: 'Papas Spicy Tronos', soldQty: 0, soldRevenue: 0, category: 'Entradas' },
      { name: 'Costilla BBQ Tronos', soldQty: 0, soldRevenue: 0, category: 'Hamburguesas' },
    ];

    const bSold = inventoryAnalytics.totalBurgersSold || 0;
    const sSold = inventoryAnalytics.totalSidesSold || 0;
    const dSold = inventoryAnalytics.totalDrinksSold || 0;
    const itemsSum = bSold + sSold + dSold || 1;
    const bPct = Math.round((bSold / itemsSum) * 100);
    const sPct = Math.round((sSold / itemsSum) * 100);
    const dPct = Math.max(0, 100 - bPct - sPct);

    // Reseñas recientes de clientes
    const recentFeedbacks = (customerFeedbacks || []).slice(0, 3);

    return {
      totalRevenue,
      deliveredCount,
      returnedCount,
      successRate,
      avgTicket,
      topProducts,
      bSold,
      sSold,
      dSold,
      bPct,
      sPct,
      dPct,
      recentFeedbacks,
    };
  }, [inventoryAnalytics, customerFeedbacks]);

  // Generador de puntos para la curva Spline SVG del gráfico de ventas
  const salesChartData = useMemo(() => {
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const totalRev = inventoryAnalytics.totalDeliveredRevenue || 0;
    const weights = [0.18, 0.32, 0.28, 0.48, 0.72, 1.0, 0.84];
    const peakAmount = totalRev > 0 ? totalRev * 0.45 : 120000;

    const points = days.map((day, i) => {
      const x = 35 + i * 85; // 35 a 545 en ancho 580
      const w = weights[i];
      const y = 145 - w * 95; // entre 50 y 145 en alto 180
      const val = totalRev > 0 ? Math.round(totalRev * (w / 3.82)) : Math.round(peakAmount * w);
      return { day, x, y, val };
    });

    // Construcción de la ruta curva bezier cúbica (Spline)
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      pathD += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const lastP = points[points.length - 1];
    const firstP = points[0];
    const areaD = `${pathD} L ${lastP.x} 165 L ${firstP.x} 165 Z`;

    return { points, pathD, areaD };
  }, [inventoryAnalytics.totalDeliveredRevenue]);

  // ── Generador de Factura Minimalista Elegante Blanco & Negro ──
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

    const barcodeSvg = `
      <svg width="200" height="42" viewBox="0 0 200 42" xmlns="http://www.w3.org/2000/svg" style="display:block; margin:0 auto;">
        <rect width="200" height="42" fill="#ffffff" />
        <g fill="#000000">
          <rect x="12" y="2" width="3" height="28"/>
          <rect x="18" y="2" width="1" height="28"/>
          <rect x="22" y="2" width="4" height="28"/>
          <rect x="29" y="2" width="2" height="28"/>
          <rect x="35" y="2" width="1" height="28"/>
          <rect x="38" y="2" width="3" height="28"/>
          <rect x="45" y="2" width="2" height="28"/>
          <rect x="50" y="2" width="4" height="28"/>
          <rect x="58" y="2" width="1" height="28"/>
          <rect x="62" y="2" width="3" height="28"/>
          <rect x="68" y="2" width="2" height="28"/>
          <rect x="74" y="2" width="1" height="28"/>
          <rect x="78" y="2" width="4" height="28"/>
          <rect x="86" y="2" width="2" height="28"/>
          <rect x="91" y="2" width="3" height="28"/>
          <rect x="98" y="2" width="1" height="28"/>
          <rect x="103" y="2" width="2" height="28"/>
          <rect x="108" y="2" width="4" height="28"/>
          <rect x="116" y="2" width="1" height="28"/>
          <rect x="120" y="2" width="3" height="28"/>
          <rect x="127" y="2" width="2" height="28"/>
          <rect x="132" y="2" width="4" height="28"/>
          <rect x="140" y="2" width="1" height="28"/>
          <rect x="145" y="2" width="3" height="28"/>
          <rect x="151" y="2" width="2" height="28"/>
          <rect x="157" y="2" width="1" height="28"/>
          <rect x="162" y="2" width="4" height="28"/>
          <rect x="170" y="2" width="2" height="28"/>
          <rect x="176" y="2" width="3" height="28"/>
          <rect x="183" y="2" width="2" height="28"/>
        </g>
        <text x="100" y="38" font-family="'Courier New', monospace" font-size="9" text-anchor="middle" fill="#000000" letter-spacing="3">* ${order.id} *</text>
      </svg>
    `;

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura - ${order.id} - TRONOS PUB & GRILL</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #f4f4f5;
      color: #000000;
      padding: 30px 10px;
      margin: 0;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      -webkit-font-smoothing: antialiased;
    }
    .invoice-card {
      width: 440px;
      max-width: 95%;
      margin: 0 auto;
      background: #ffffff;
      border: 2px solid #000000;
      padding: 32px 28px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.08);
      box-sizing: border-box;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 4px;
      text-transform: uppercase;
      text-align: center;
      margin: 0;
      line-height: 1.1;
      color: #000000;
    }
    .brand-sub {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 3px;
      text-transform: uppercase;
      text-align: center;
      margin-top: 4px;
      color: #000000;
    }
    .brand-tag {
      font-size: 9.5px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      text-align: center;
      color: #555555;
      margin-top: 3px;
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
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .meta-grid {
      border: 1px solid #000000;
      padding: 12px 14px;
      margin-bottom: 18px;
      font-size: 11.5px;
      line-height: 1.6;
      background: #ffffff;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
    }
    .meta-label {
      font-weight: 600;
      color: #555555;
      text-transform: uppercase;
      font-size: 10.5px;
    }
    .meta-val {
      font-weight: 800;
      color: #000000;
      text-align: right;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    .items-table th {
      border-bottom: 2px solid #000000;
      padding: 6px 4px;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .total-box {
      background: #000000;
      color: #ffffff;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 14px;
    }
    .total-label {
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .total-val {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: -0.5px;
    }
    .footer-note {
      text-align: center;
      margin-top: 20px;
      font-size: 10px;
      color: #333333;
      letter-spacing: 1px;
      line-height: 1.6;
      border-top: 1px dashed #000000;
      padding-top: 14px;
      text-transform: uppercase;
    }
    @media print {
      html, body {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
      }
      .invoice-card {
        border: 2px solid #000000 !important;
        box-shadow: none !important;
        padding: 24px 20px !important;
        width: 440px !important;
        max-width: 95% !important;
        margin: 10mm auto !important;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div style="text-align:center; font-size:20px; margin-bottom:2px;">👑</div>
    <div class="brand-title">TRONOS</div>
    <div class="brand-sub">PUB & GRILL</div>
    <div class="brand-tag">CARNES • HAMBURGUESAS • PARRILLA GOURMET</div>

    <div class="divider-double">
      <span>COMPROBANTE DE VENTA</span>
      <span>ORDEN #${order.id}</span>
    </div>

    <div class="meta-grid">
      <div class="meta-row"><span class="meta-label">Fecha:</span> <span class="meta-val">${dateFormatted}</span></div>
      <div class="meta-row"><span class="meta-label">Cliente:</span> <span class="meta-val">${order.customer?.nombre || 'Consumidor Final'}</span></div>
      <div class="meta-row"><span class="meta-label">Teléfono:</span> <span class="meta-val">${order.customer?.telefono || 'N/A'}</span></div>
      <div class="meta-row"><span class="meta-label">Dirección:</span> <span class="meta-val">${order.customer?.direccion || 'En local'}</span></div>
      ${order.customer?.descripcion ? `<div class="meta-row"><span class="meta-label">Referencia:</span> <span class="meta-val">${order.customer.descripcion}</span></div>` : ''}
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

    <div style="margin-top: 20px;">
      ${barcodeSvg}
    </div>

    <div class="footer-note">
      ¡GRACIAS POR PREFERIRNOS!<br>
      TRONOS PUB & GRILL • TEL: ${restaurantConfig?.whatsapp || '300 770 8616'}<br>
      DOCUMENTO DE CONTROL INTERNO POS
    </div>
  </div>
</body>
</html>`;
  };

  // ── Guardar Factura Electrónica en la PC ───────────────────────
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
        console.warn('Fallback a descarga:', err);
      }
    }

    // Descarga directa a la PC garantizada si no se guardó en carpeta
    if (!savedInFolder) {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return { success: true, method: savedInFolder ? 'folder' : 'download', fileName, folderName: directoryHandle?.name };
  };

  // ── Selector de Carpeta en PC con File System Access API ───────
  const handleSelectFolder = async () => {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const handle = await window.showDirectoryPicker();
        setDirectoryHandle(handle);
        updatePosBackupFolderName(handle.name);
        showToast(`Carpeta "${handle.name}" conectada con éxito.`);
      } catch (err) {
        if (err.name !== 'AbortError') {
          showToast('Error al seleccionar carpeta: ' + err.message, 'error');
        }
      }
    } else {
      showToast('Tu navegador descargará las facturas a la carpeta de Descargas.', 'info');
    }
  };

  // ── Generador de Tickets Térmicos POS (2 Copias Idénticas Centradas en la Hoja) ──
  const generateReceiptHtml = (order) => {
    const dateFormatted = new Date(order.date || Date.now()).toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const orderTypeLabel = 
      order.orderType === 'local' ? 'MESA / CONSUMO LOCAL' :
      order.orderType === 'recoger' ? 'PARA LLEVAR / MOSTRADOR' :
      'DOMICILIO';

    const itemsHtml = (order.items || [])
      .map((item) => {
        const extrasTotal = (item.selectedExtras || []).reduce((sum, e) => sum + ((e.price || 0) * (e.quantity || 1)), 0);
        const itemTotal = ((item.price || 0) + extrasTotal) * (item.quantity || 1);
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

    const barcodeSvg = `
      <svg width="170" height="34" viewBox="0 0 170 34" xmlns="http://www.w3.org/2000/svg" style="display:block; margin:0 auto;">
        <rect width="170" height="34" fill="#ffffff" />
        <g fill="#000000">
          <rect x="10" y="2" width="2.5" height="22"/>
          <rect x="15" y="2" width="1.2" height="22"/>
          <rect x="19" y="2" width="3.5" height="22"/>
          <rect x="25" y="2" width="1.2" height="22"/>
          <rect x="29" y="2" width="2.5" height="22"/>
          <rect x="34" y="2" width="1.2" height="22"/>
          <rect x="38" y="2" width="3.5" height="22"/>
          <rect x="44" y="2" width="1.2" height="22"/>
          <rect x="48" y="2" width="2.5" height="22"/>
          <rect x="53" y="2" width="3.5" height="22"/>
          <rect x="59" y="2" width="1.2" height="22"/>
          <rect x="63" y="2" width="2.5" height="22"/>
          <rect x="68" y="2" width="1.2" height="22"/>
          <rect x="72" y="2" width="3.5" height="22"/>
          <rect x="78" y="2" width="2.5" height="22"/>
          <rect x="83" y="2" width="1.2" height="22"/>
          <rect x="87" y="2" width="3.5" height="22"/>
          <rect x="93" y="2" width="1.2" height="22"/>
          <rect x="97" y="2" width="2.5" height="22"/>
          <rect x="102" y="2" width="3.5" height="22"/>
          <rect x="108" y="2" width="1.2" height="22"/>
          <rect x="112" y="2" width="2.5" height="22"/>
          <rect x="117" y="2" width="3.5" height="22"/>
          <rect x="123" y="2" width="1.2" height="22"/>
          <rect x="127" y="2" width="2.5" height="22"/>
          <rect x="132" y="2" width="3.5" height="22"/>
          <rect x="138" y="2" width="1.2" height="22"/>
          <rect x="142" y="2" width="2.5" height="22"/>
          <rect x="147" y="2" width="1.2" height="22"/>
          <rect x="152" y="2" width="3.5" height="22"/>
        </g>
        <text x="85" y="31" font-family="'Courier New', monospace" font-size="8.5" text-anchor="middle" fill="#000000" letter-spacing="2.5">* ${order.id} *</text>
      </svg>
    `;

    const buildTicketHtml = (copyTitle) => `
      <div class="ticket-card">
        <div class="brand-crown">👑</div>
        <div class="brand-title">TRONOS</div>
        <div class="brand-sub">PUB & GRILL</div>
        <div class="brand-tag">CARNES • HAMBURGUESAS • PARRILLA GOURMET</div>
        <div class="brand-contact">Tel / WhatsApp: ${restaurantConfig?.whatsapp || '300 770 8616'}</div>

        <div class="divider-double">
          <span>*** ${copyTitle} ***</span>
          <span>ORDEN #${order.id}</span>
        </div>

        <div class="meta-box">
          <div class="meta-row"><span class="meta-label">Fecha:</span> <span class="meta-val">${dateFormatted}</span></div>
          <div class="meta-row"><span class="meta-label">Servicio:</span> <span class="meta-val" style="font-weight:900;">${orderTypeLabel}</span></div>
          <div class="meta-row"><span class="meta-label">Pago:</span> <span class="meta-val">${order.paymentMethod || 'Efectivo'}</span></div>
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

        ${(order.subtotal || order.deliveryFee) ? `
          <div style="border-top:1px dashed #000000; padding:4px 0; margin-top:4px; font-size:10px;">
            ${order.subtotal ? `
              <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                <span>SUBTOTAL:</span>
                <span>${formatPrice(order.subtotal)}</span>
              </div>
            ` : ''}
            ${(order.deliveryFee && order.deliveryFee > 0) ? `
              <div style="display:flex; justify-content:space-between; margin-bottom:2px; font-weight:800;">
                <span>🛵 DOMICILIO:</span>
                <span>+${formatPrice(order.deliveryFee)}</span>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <div class="total-box">
          <span class="total-label">TOTAL A PAGAR:</span>
          <span class="total-val">${formatPrice(order.total || 0)}</span>
        </div>

        <div style="margin-top:8px;">
          ${barcodeSvg}
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
  <title>Factura_${order.id}_${(order.customer?.nombre || 'Cliente').replace(/[^\\w\\s-]/g, '').replace(/\\s+/g, '_')}</title>
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
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      -webkit-font-smoothing: antialiased;
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
      justify-content: flex-start;
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
      box-sizing: border-box;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .brand-crown {
      text-align: center;
      font-size: 18px;
      line-height: 1;
      margin-bottom: 2px;
    }
    .brand-title {
      font-size: 19px;
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: uppercase;
      text-align: center;
      line-height: 1.1;
      margin: 0;
      color: #000000;
    }
    .brand-sub {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-align: center;
      margin-top: 1px;
      color: #000000;
    }
    .brand-tag {
      font-size: 8px;
      letter-spacing: 1px;
      text-transform: uppercase;
      text-align: center;
      color: #333333;
      margin-top: 2px;
    }
    .brand-contact {
      font-size: 8.5px;
      text-align: center;
      color: #555555;
      margin-top: 2px;
    }
    .divider-double {
      border-top: 1.5px solid #000000;
      border-bottom: 1px solid #000000;
      padding: 4px 0;
      margin: 6px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .meta-box {
      border: 1px solid #000000;
      padding: 6px 7px;
      margin: 6px 0 8px 0;
      font-size: 10px;
      line-height: 1.45;
      background: #ffffff;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1.5px;
    }
    .meta-label {
      font-weight: 700;
      text-transform: uppercase;
      color: #333333;
    }
    .meta-val {
      font-weight: 900;
      text-align: right;
      color: #000000;
    }
    .items-header {
      border-bottom: 1.5px solid #000000;
      padding-bottom: 3px;
      margin-bottom: 4px;
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .total-box {
      background: #000000 !important;
      color: #ffffff !important;
      padding: 6px 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 7px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .total-label {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .total-val {
      font-size: 16px;
      font-weight: 900;
    }
    .footer-note {
      text-align: center;
      font-size: 8.5px;
      color: #333333;
      letter-spacing: 0.5px;
      margin-top: 7px;
      line-height: 1.4;
      text-transform: uppercase;
    }
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
        margin: 0 auto !important;
        padding: 0 !important;
        display: block !important;
      }
      .ticket-page {
        width: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: flex-start !important;
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
        box-sizing: border-box !important;
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

  // ── Impresión Aislada Vía Iframe (Garantiza 100% Contenido y Evita Hoja en Blanco) ──
  const printReceiptIframe = (receiptHtml, docTitle) => {
    return new Promise((resolve) => {
      const oldIframe = document.getElementById('pos-print-iframe');
      if (oldIframe) {
        oldIframe.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'pos-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = '80mm';
      iframe.style.height = '100mm';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(receiptHtml);
      doc.close();

      if (docTitle) {
        doc.title = docTitle;
      }

      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (err) {
          console.error('Error al imprimir vía iframe:', err);
        }
        setTimeout(() => {
          iframe.remove();
          resolve();
        }, 2500);
      }, 500);
    });
  };

  // ── UN SOLO BOTÓN: GENERA 3 FACTURAS A LA VEZ (1 PC + 2 FÍSICAS IMPRESAS) ──
  const handleFacturarTresCopias = async (order) => {
    if (order.status === 'pendiente') {
      updateOrderStatus(order.id, 'en_cocina', {
        invoiced: true,
        invoicedAt: new Date().toISOString(),
        invoicedBy: 'admin',
      });
    } else {
      markOrderInvoiced(order.id, { invoicedBy: 'admin' });
    }

    // 1. Guardar/descargar copia digital para el computador (.html)
    try {
      const res = await saveElectronicInvoice(order);
      if (res.method === 'folder') {
        showToast(`Factura guardada en "${res.folderName}" y enviando a impresora...`);
      } else {
        showToast(`Factura digital descargada en tu PC y enviando a impresora...`);
      }
    } catch (e) {
      showToast('Error al generar copia digital.', 'error');
    }

    // 2. Enviar a la impresora POS las 2 copias físicas con formato garantizado
    const cleanClientName = (order.customer?.nombre || 'Cliente').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    const docTitle = `Factura_${order.id}_${cleanClientName}`;
    const receiptHtml = generateReceiptHtml(order);

    setPrintingOrder(order);
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

  // ── Métodos para Personalizar Pedido (Agregar Adición con Precio Manual en Cocina) ──
  const handleOpenCustomizeModal = (order) => {
    setCustomizingOrder(order);
    setCustomAddName('');
    setCustomAddPrice('');
    setCustomAddQty(1);
    setCustomAddNote('');
  };

  const handleSaveCustomAddition = async (reinvoiceAndPrint = false) => {
    if (!customizingOrder) return;
    if (!customAddName.trim()) {
      showToast('Por favor escribe el nombre de la adición.', 'error');
      return;
    }
    const priceNum = parseInt(customAddPrice, 10);
    if (isNaN(priceNum) || priceNum < 0) {
      showToast('Por favor ingresa un precio válido ($).', 'error');
      return;
    }

    setIsSavingCustomAdd(true);
    try {
      const updated = addCustomAdditionToOrder(
        customizingOrder.id,
        {
          name: customAddName.trim(),
          price: priceNum,
          quantity: customAddQty || 1,
          note: customAddNote.trim(),
        },
        { updateInvoice: reinvoiceAndPrint || customizingOrder.invoiced }
      );

      const targetOrder = updated || {
        ...customizingOrder,
        items: [
          ...(customizingOrder.items || []),
          {
            name: customAddName.trim(),
            price: priceNum,
            quantity: customAddQty || 1,
            note: customAddNote.trim(),
          },
        ],
        subtotal: (customizingOrder.subtotal || 0) + (priceNum * (customAddQty || 1)),
        total: (customizingOrder.total || 0) + (priceNum * (customAddQty || 1)),
      };

      showToast(`Adición "${customAddName.trim()}" agregada a comanda #${customizingOrder.id}.`);
      setCustomizingOrder(null);

      if (reinvoiceAndPrint) {
        showToast('🧾 Actualizando factura y reimprimiendo 3 copias...');
        await handleFacturarTresCopias(targetOrder);
      }
    } catch (err) {
      console.error('Error al personalizar comanda:', err);
      showToast('Error al agregar adición a la comanda.', 'error');
    } finally {
      setIsSavingCustomAdd(false);
    }
  };

  // ── Auth Handlers ─────────────────────────────────────────────
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const result = login(credentials.username, credentials.password);
    if (!result) {
      setLoginError('Usuario o contraseña incorrectos.');
    } else if (result === 'cajero') {
      window.location.href = '/caja';
    } else {
      setLoginError(false);
    }
  };

  // ── Menu Handlers ─────────────────────────────────────────────
  const handleAddItemSubmit = (e, categoryId) => {
    e.preventDefault();
    if (!newItem.name.trim() || !newItem.description.trim() || isNaN(newItem.price)) {
      showToast('Por favor completa los campos correctamente.', 'error');
      return;
    }
    const defaultImg = categoryId === 'burgers' ? '/images/tronos-clasica.png' :
                       categoryId === 'entradas' ? '/images/papas-francesa.png' :
                       categoryId === 'bebidas' ? '/images/coca-cola.png' : '/images/tronos-clasica.png';
    const finalImage = (newItem.image && newItem.image.trim()) ? newItem.image.trim() : defaultImg;

    addMenuItem(categoryId, {
      id: `${newItem.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
      name: newItem.name.trim(),
      description: newItem.description.trim(),
      detailedDescription: newItem.detailedDescription.trim() || newItem.description.trim(),
      price: parseFloat(newItem.price),
      image: finalImage,
      categoryId,
      extras: [],
    });
    showToast(`"${newItem.name}" añadido exitosamente y guardado en Supabase.`);
    setNewItem({ name: '', description: '', detailedDescription: '', price: '', image: '' });
    setAddingToCategoryId(null);
  };

  const handleStartEdit = (item, categoryId) => {
    setEditingItemId(item.id);
    setManagingExtrasForItemId(null);
    setEditingItem({
      id: item.id,
      name: item.name,
      price: item.price.toString(),
      description: item.description,
      detailedDescription: item.detailedDescription || '',
      image: item.image,
      categoryId,
    });
    setAddingToCategoryId(null);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingItem.name?.trim() || !editingItem.description?.trim() || isNaN(editingItem.price)) {
      showToast('Datos inválidos.', 'error');
      return;
    }
    updateMenuItem(editingItem.categoryId, {
      id: editingItem.id,
      name: editingItem.name.trim(),
      description: editingItem.description.trim(),
      detailedDescription: (editingItem.detailedDescription || '').trim(),
      price: parseFloat(editingItem.price),
      image: (editingItem.image || '').trim(),
      categoryId: editingItem.categoryId,
    });
    setEditingItemId(null);
    showToast('Plato actualizado.');
  };

  const handleImageUpload = (e, targetSetter) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
        targetSetter((prev) => ({ ...prev, image: compressedBase64 }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newCategoryTitle.trim()) return;
    const slug = newCategoryTitle.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
    addCategory({
      id: `${slug}-${Date.now()}`,
      title: newCategoryTitle.trim(),
      items: [],
    });
    setNewCategoryTitle('');
    showToast('Categoría creada con éxito.');
  };

  const handleAddExtra = (e, item) => {
    e.preventDefault();
    if (!newExtra.name.trim() || isNaN(newExtra.price)) {
      showToast('Nombre y precio del adicional requeridos.', 'error');
      return;
    }
    const extra = {
      id: `ext-${Date.now()}`,
      name: newExtra.name.trim(),
      price: parseFloat(newExtra.price),
      image: newExtra.image || item.image,
    };
    const currentExtras = item.extras || [];
    updateItemExtras(item.categoryId, item.id, [...currentExtras, extra]);
    setNewExtra({ name: '', price: '', image: '' });
    showToast('Adicional registrado.');
  };

  const handleDeleteExtra = (item, extraId) => {
    if (confirm('¿Eliminar este adicional?')) {
      const updatedExtras = (item.extras || []).filter((e) => e.id !== extraId);
      updateItemExtras(item.categoryId, item.id, updatedExtras);
      showToast('Adicional eliminado.');
    }
  };

  // ── Pantalla de Login Fina y Luminosa ─────────────────────────────
  if (!isAdmin) {
    return (
      <div
        className="min-vh-100 d-flex align-items-center justify-content-center p-3"
        style={{ background: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
      >
        <div
          className="p-4 p-md-5 rounded-4 text-center pos-sunken-card"
          style={{
            maxWidth: '420px',
            width: '100%',
            background: 'rgba(252, 250, 246, 0.96)',
            border: '1px solid #e3ded5',
            boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.03)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <Image
            src="/images/logo-tronos.webp"
            alt="Tronos Logo"
            width={72}
            height={72}
            unoptimized
            style={{ borderRadius: '16px', marginBottom: '16px', border: '1px solid rgba(0, 0, 0, 0.08)' }}
          />
          <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#5c8430', letterSpacing: '-0.3px', marginBottom: '4px' }}>
            TRONOS POS
          </h2>
          <p style={{ fontSize: '13px', color: '#555555', marginBottom: '24px', fontWeight: 600 }}>
            Sistema POS & Facturación
          </p>

          {loginError && (
            <div className="p-2 mb-3 rounded-2 text-danger text-center" style={{ background: '#fef2f2', border: '1px solid #fecaca', fontSize: '12px', fontWeight: 600 }}>
              {typeof loginError === 'string' ? loginError : 'Usuario o contraseña incorrectos.'}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="text-center">
            <div className="mb-3 text-center">
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#333333', display: 'block', marginBottom: '6px', textAlign: 'center' }}>
                Usuario
              </label>
              <input
                type="text"
                name="username"
                placeholder="Ingresa tu usuario"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                className="form-control text-center"
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(0, 0, 0, 0.15)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '13.5px',
                  color: '#111111',
                }}
                required
              />
            </div>

            <div className="mb-4 text-center">
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#333333', display: 'block', marginBottom: '6px', textAlign: 'center' }}>
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                className="form-control text-center"
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(0, 0, 0, 0.15)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '13.5px',
                  color: '#111111',
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

          <div className="mt-4 pt-3 border-top text-center" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
            <Link href="/" style={{ fontSize: '12px', color: '#666666', textDecoration: 'none', fontWeight: 600 }}>
              ← Volver a la Carta Web
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Render Principal POS (Día & Noche) ───────────────────
  return (
    <div className="pos-shell theme-light">
      <style jsx global>{`
        /* ── MODO DÍA (CLARO) POR DEFECTO Y ÚNICO ── */
        .pos-shell.theme-light,
        .pos-shell {
          --bg-main: #f8fafc;
          --bg-card: #ffffff;
          --bg-sub: #f1f5f9;
          --border-main: #e2e8f0;
          --border-light: #f1f5f9;
          --text-main: #0f172a;
          --text-muted: #64748b;
          --text-dim: #94a3b8;
          --verde-viche: #16a34a;
          --verde-viche-on-dark: #15803d;
          --verde-viche-badge: #dcfce7;
          --verde-viche-border: #bbf7d0;
          --gold-main: #d97706;
          --gold-vibrant: #b45309;
          --gold-bg: rgba(217, 119, 6, 0.1);
          --gold-text: #d97706;
          --gold-border: rgba(217, 119, 6, 0.25);
          --header-bg: #ffffff;
          --customer-bg: #f8fafc;
          --input-bg: #ffffff;
          --tab-active-bg: #0f172a;
          --tab-active-text: #ffffff;
          --primary-btn-bg: #0f172a;
          --primary-btn-text: #ffffff;
        }

        body {
          background-color: #f8fafc !important;
          color: #0f172a !important;
        }

        .pos-shell {
          min-height: 100vh;
          background-color: var(--bg-main) !important;
          color: var(--text-main);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          letter-spacing: -0.01em;
        }

        /* ── TARJETAS ELEVADAS EN MODO DÍA ── */
        .pos-shell .pos-sunken-card {
          background: #ffffff !important;
          color: #0f172a !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04) !important;
          border-radius: 18px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .pos-shell .pos-sunken-card:hover {
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08) !important;
        }
        .pos-shell .pos-sunken-subbox {
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 12px;
        }

        /* ── Ocultar sección de tickets físicos en pantalla ── */
        .pos-thermal-print {
          display: none;
        }

        /* ── ESTILOS DE IMPRESIÓN TÉRMICA FÍSICA (2 COPIAS) ── */
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .pos-topbar, .pos-kpi-bar, .pos-nav-tabs, .pos-main-content, header, nav {
            display: none !important;
          }
          .pos-shell {
            background: transparent !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .pos-thermal-print {
            display: block !important;
            visibility: visible !important;
            width: 76mm !important;
            max-width: 76mm !important;
            margin: 0 auto !important;
            padding: 2mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
            -webkit-font-smoothing: antialiased;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .ticket-copy-box {
            page-break-inside: avoid;
            margin-bottom: 6mm;
            border: 1.5px solid #000000;
            padding: 3mm;
            background: #ffffff !important;
          }
          .ticket-cut-line {
            text-align: center;
            font-weight: 900;
            border-top: 1.5px dashed #000000;
            border-bottom: 1.5px dashed #000000;
            margin: 6mm 0;
            padding: 3mm 0;
            font-size: 8.5px;
            letter-spacing: 2px;
            color: #000000 !important;
          }
        }
      `}</style>

      {/* ── BARRA SUPERIOR ELEGANTE (DÍA: BLANCO / NOCHE: AZUL MARINO OSCURO #181a28) ── */}
      <header
        className="pos-topbar px-3 px-md-4 py-2.5 border-bottom sticky-top"
        style={{
          background: theme === 'dark' ? '#181a28' : '#ffffff',
          borderColor: theme === 'dark' ? '#262940' : 'rgba(0, 0, 0, 0.08)',
          boxShadow: theme === 'dark' ? '0 4px 20px rgba(0, 0, 0, 0.5)' : '0 2px 12px rgba(0, 0, 0, 0.04)',
          zIndex: 100,
        }}
      >
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          {/* Logo y Marca */}
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
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#111111', letterSpacing: '-0.3px' }}>
                  TRONOS
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: 'var(--verde-viche)',
                    background: 'var(--verde-viche-badge)',
                    border: '1px solid var(--verde-viche-border)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    letterSpacing: '0.5px',
                  }}
                >
                  POS SYSTEM
                </span>
              </div>
              <div style={{ color: '#666666', fontSize: '12px', fontWeight: 500 }}>
                {currentTime || 'Cargando reloj...'}
              </div>
            </div>
          </div>

          {/* Acciones de Cabecera: Selector de Tema + Enlaces */}
          <div className="d-flex align-items-center gap-2">


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
                  background: soundEnabled ? '#f0fdf4' : '#f4f4f4',
                  color: soundEnabled ? '#166534' : '#666666',
                  border: `1px solid ${soundEnabled ? '#bbf7d0' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
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
                    background: '#ffffff',
                    color: '#15803d',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    padding: '6px 9px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Probar sonido: campana suena dos veces con duración de 3 segundos cada una (6s duro)"
                >
                  Probar (6s)
                </button>
              )}
            </div>

            {/* Botón 1: Facturas Descargadas */}
            <button
              onClick={() => setShowInvoicesModal(true)}
              className="btn btn-sm d-flex align-items-center gap-1.5"
              style={{
                background: invoicedOrders.length > 0 ? '#ecfdf5' : '#ffffff',
                color: invoicedOrders.length > 0 ? '#15803d' : '#111111',
                border: `1px solid ${invoicedOrders.length > 0 ? '#86efac' : 'rgba(0, 0, 0, 0.12)'}`,
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
              title="Ver historial general de ventas, comandas y facturas de todos los días"
            >
              <span>📁 Historial ({invoicedOrders.length})</span>
              <span
                style={{
                  background: invoicedOrders.length > 0 ? '#16a34a' : '#94a3b8',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800,
                  borderRadius: '10px',
                  padding: '1px 7px',
                }}
              >
                {invoicedOrders.length}
              </span>
            </button>

            {/* Botón 2: Generar y Descargar Reporte PDF Completo (Sin borrar nada) */}
            <button
              onClick={handleDownloadFullReportPdf}
              disabled={isGeneratingPdf}
              className="btn btn-sm d-flex align-items-center gap-1.5"
              style={{
                background: '#f0f9ff',
                color: '#0369a1',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: isGeneratingPdf ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
              title="Descargar reporte completo en PDF con todas las secciones"
            >
              <span>{isGeneratingPdf ? '⏳ Generando...' : '📄 Reporte PDF Completo'}</span>
            </button>

            {/* Botón 3: Borrar Datos (Color Rojo - Reemplaza el botón de caja) */}
            <button
              onClick={() => setShowResetConfirmModal(true)}
              disabled={isGeneratingPdf}
              className="btn btn-sm d-flex align-items-center gap-1.5"
              style={{
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: isGeneratingPdf ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
              title="Descarga respaldo en PDF y reinicia el panel a cero"
            >
              <span>🗑️ Borrar Datos</span>
            </button>

            <Link
              href="/"
              className="btn btn-sm d-flex align-items-center gap-1.5"
              style={{
                background: '#ffffff',
                color: '#111111',
                border: '1px solid rgba(0, 0, 0, 0.12)',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <IconGlobe size={15} /> <span>Ver Carta Web</span>
            </Link>

            <button
              onClick={logout}
              className="btn btn-sm d-flex align-items-center gap-1.5"
              style={{
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 600,
              }}
            >
              <IconLogout size={15} /> <span>Salir</span>
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
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
          }}
        >
          <span>{toastMessage.type === 'error' ? <IconX size={16} /> : <IconCheckCircle size={16} />}</span>
          <span>{toastMessage.message}</span>
        </div>
      )}

      {/* ── CUERPO PRINCIPAL DEL POS ── */}
      <main className="pos-main-content container-fluid px-3 px-md-4 py-4">
        {/* ── KPI METRICS BAR EN CAPA BLANCA DIFUMINADA MATE CLARO Y VERDE VICHE ── */}
        <div className="pos-kpi-bar row g-3 mb-4 text-center">
          <div className="col-6 col-lg-3">
            <div
              className="p-3.5 rounded-4 h-100 d-flex flex-column justify-content-center align-items-center text-center pos-sunken-card"
            >
              <div className="d-flex align-items-center justify-content-center gap-2 mb-1">
                <IconBox size={18} style={{ color: 'var(--verde-viche)' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Pedidos Registrados
                </span>
              </div>
              <div className="d-flex flex-column align-items-center justify-content-center my-1">
                <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--verde-viche)', lineHeight: 1.1 }}>
                  {metrics.totalOrders}
                </span>
                {metrics.pendingOrders > 0 && (
                  <span className="mt-1" style={{ background: 'var(--verde-viche-badge)', color: 'var(--verde-viche)', border: '1px solid var(--verde-viche-border)', fontSize: '11px', fontWeight: 800, padding: '2px 10px', borderRadius: '12px' }}>
                    ● {metrics.pendingOrders} pendientes
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="col-6 col-lg-3">
            <div
              className="p-3.5 rounded-4 h-100 d-flex flex-column justify-content-center align-items-center text-center pos-sunken-card"
            >
              <div className="d-flex align-items-center justify-content-center gap-2 mb-1">
                <IconSales size={18} style={{ color: 'var(--verde-viche)' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Total Ventas
                </span>
              </div>
              <div className="my-1" style={{ fontSize: '28px', fontWeight: 900, color: 'var(--verde-viche)', lineHeight: 1.1 }}>
                {formatPrice(metrics.totalSales)}
              </div>
            </div>
          </div>

          <div className="col-6 col-lg-3">
            <div
              className="p-3.5 rounded-4 h-100 d-flex flex-column justify-content-center align-items-center text-center pos-sunken-card"
            >
              <div className="d-flex align-items-center justify-content-center gap-2 mb-1">
                <IconBurger size={18} style={{ color: 'var(--verde-viche)' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Carta & Menú
                </span>
              </div>
              <div className="my-1" style={{ fontSize: '24px', fontWeight: 900, color: 'var(--verde-viche)', lineHeight: 1.1 }}>
                {metrics.totalMenuItems} platos <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>({metrics.totalCategories} cat.)</span>
              </div>
            </div>
          </div>

          <div className="col-6 col-lg-3">
            <div
              className="p-3.5 rounded-4 h-100 d-flex flex-column justify-content-center align-items-center text-center pos-sunken-card"
            >
              <div className="d-flex align-items-center justify-content-center gap-2 mb-1">
                <IconFolder size={18} style={{ color: 'var(--verde-viche)' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Respaldo en PC
                </span>
              </div>
              <div className="my-1 text-truncate" style={{ fontSize: '14.5px', fontWeight: 900, color: 'var(--verde-viche)' }}>
                {posBackupFolderName ? (
                  <span>● Carpeta: {posBackupFolderName}</span>
                ) : (
                  <span>○ Descarga Automática</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── BARRA DE PESTAÑAS (TABS CENTRADAS) ── */}
        <div className="d-flex justify-content-center mb-4">
          <div className="d-flex gap-2 p-1.5 rounded-4 pos-sunken-card flex-wrap justify-content-center" style={{ width: 'fit-content' }}>
            <button
              onClick={() => setActiveTab('dashboard')}
              className="btn btn-sm d-flex align-items-center justify-content-center gap-2"
              style={{
                background: activeTab === 'dashboard' ? (theme === 'dark' ? '#ffd026' : '#141414') : 'transparent',
                color: activeTab === 'dashboard' ? (theme === 'dark' ? '#000000' : '#ffffff') : (theme === 'dark' ? '#8f94ba' : '#333333'),
                borderRadius: '10px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 800,
                border: activeTab === 'dashboard' ? (theme === 'dark' ? '1px solid #ca8a04' : '1px solid rgba(255, 255, 255, 0.25)') : 'none',
                boxShadow: activeTab === 'dashboard' ? (theme === 'dark' ? '0 2px 10px rgba(255, 208, 38, 0.35)' : '0 2px 8px rgba(0, 0, 0, 0.25)') : 'none',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '15px' }}>📊</span>
              <span>Dashboard Ejecutivo</span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className="btn btn-sm d-flex align-items-center justify-content-center gap-2"
              style={{
                background: activeTab === 'orders' ? (theme === 'dark' ? '#ffd026' : '#141414') : 'transparent',
                color: activeTab === 'orders' ? (theme === 'dark' ? '#000000' : '#ffffff') : (theme === 'dark' ? '#8f94ba' : '#333333'),
                borderRadius: '10px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 800,
                border: activeTab === 'orders' ? (theme === 'dark' ? '1px solid #ca8a04' : '1px solid rgba(255, 255, 255, 0.25)') : 'none',
                boxShadow: activeTab === 'orders' ? (theme === 'dark' ? '0 2px 10px rgba(255, 208, 38, 0.35)' : '0 2px 8px rgba(0, 0, 0, 0.25)') : 'none',
                transition: 'all 0.2s',
              }}
            >
              <IconOrders size={16} />
              <span>Comandas & Pedidos</span>
              {metrics.pendingOrders > 0 && (
                <span style={{ background: theme === 'dark' ? '#dc2626' : 'var(--verde-viche)', color: '#ffffff', fontSize: '11px', fontWeight: 900, padding: '1px 8px', borderRadius: '12px' }}>
                  {metrics.pendingOrders}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('auditoria')}
              className="btn btn-sm d-flex align-items-center justify-content-center gap-2"
              style={{
                background: activeTab === 'auditoria' ? (theme === 'dark' ? '#ffd026' : '#141414') : 'transparent',
                color: activeTab === 'auditoria' ? (theme === 'dark' ? '#000000' : '#ffffff') : (theme === 'dark' ? '#8f94ba' : '#333333'),
                borderRadius: '10px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 800,
                border: activeTab === 'auditoria' ? (theme === 'dark' ? '1px solid #ca8a04' : '1px solid rgba(255, 255, 255, 0.25)') : 'none',
                boxShadow: activeTab === 'auditoria' ? (theme === 'dark' ? '0 2px 10px rgba(255, 208, 38, 0.35)' : '0 2px 8px rgba(0, 0, 0, 0.25)') : 'none',
                transition: 'all 0.2s',
              }}
            >
              <IconCheckCircle size={16} />
              <span>Auditoría & Respaldo Central</span>
              <span style={{ background: '#d97706', color: '#ffffff', fontSize: '11px', fontWeight: 900, padding: '1px 8px', borderRadius: '12px' }}>
                {auditOrders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('inventario')}
              className="btn btn-sm d-flex align-items-center justify-content-center gap-2"
              style={{
                background: activeTab === 'inventario' ? (theme === 'dark' ? '#ffd026' : '#141414') : 'transparent',
                color: activeTab === 'inventario' ? (theme === 'dark' ? '#000000' : '#ffffff') : (theme === 'dark' ? '#8f94ba' : '#333333'),
                borderRadius: '10px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 800,
                border: activeTab === 'inventario' ? (theme === 'dark' ? '1px solid #ca8a04' : '1px solid rgba(255, 255, 255, 0.25)') : 'none',
                boxShadow: activeTab === 'inventario' ? (theme === 'dark' ? '0 2px 10px rgba(255, 208, 38, 0.35)' : '0 2px 8px rgba(0, 0, 0, 0.25)') : 'none',
                transition: 'all 0.2s',
              }}
            >
              <IconBurger size={16} />
              <span>Inventario & Ventas</span>
            </button>

            <button
              onClick={() => setActiveTab('menu')}
              className="btn btn-sm d-flex align-items-center justify-content-center gap-2"
              style={{
                background: activeTab === 'menu' ? (theme === 'dark' ? '#ffd026' : '#141414') : 'transparent',
                color: activeTab === 'menu' ? (theme === 'dark' ? '#000000' : '#ffffff') : (theme === 'dark' ? '#8f94ba' : '#333333'),
                borderRadius: '10px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 800,
                border: activeTab === 'menu' ? (theme === 'dark' ? '1px solid #ca8a04' : '1px solid rgba(255, 255, 255, 0.25)') : 'none',
                boxShadow: activeTab === 'menu' ? (theme === 'dark' ? '0 2px 10px rgba(255, 208, 38, 0.35)' : '0 2px 8px rgba(0, 0, 0, 0.25)') : 'none',
                transition: 'all 0.2s',
              }}
            >
              <IconMenu size={16} />
              <span>Carta & Platos ({metrics.totalMenuItems})</span>
            </button>

            <button
              onClick={() => setActiveTab('opiniones')}
              className="btn btn-sm d-flex align-items-center justify-content-center gap-2"
              style={{
                background: activeTab === 'opiniones' ? (theme === 'dark' ? '#ffd026' : '#141414') : 'transparent',
                color: activeTab === 'opiniones' ? (theme === 'dark' ? '#000000' : '#ffffff') : (theme === 'dark' ? '#8f94ba' : '#333333'),
                borderRadius: '10px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 800,
                border: activeTab === 'opiniones' ? (theme === 'dark' ? '1px solid #ca8a04' : '1px solid rgba(255, 255, 255, 0.25)') : 'none',
                boxShadow: activeTab === 'opiniones' ? (theme === 'dark' ? '0 2px 10px rgba(255, 208, 38, 0.35)' : '0 2px 8px rgba(0, 0, 0, 0.25)') : 'none',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '15px' }}>⭐</span>
              <span>Qué opinan mis clientes</span>
              <span
                style={{
                  background: customerFeedbacks.length > 0 ? (theme === 'dark' ? '#000000' : '#eab308') : 'rgba(0,0,0,0.08)',
                  color: customerFeedbacks.length > 0 ? (theme === 'dark' ? '#ffd026' : '#000000') : '#666666',
                  fontSize: '11px',
                  fontWeight: 900,
                  padding: '1px 8px',
                  borderRadius: '12px',
                }}
              >
                {customerFeedbacks.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className="btn btn-sm d-flex align-items-center justify-content-center gap-2"
              style={{
                background: activeTab === 'settings' ? (theme === 'dark' ? '#ffd026' : '#141414') : 'transparent',
                color: activeTab === 'settings' ? (theme === 'dark' ? '#000000' : '#ffffff') : (theme === 'dark' ? '#8f94ba' : '#333333'),
                borderRadius: '10px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 800,
                border: activeTab === 'settings' ? (theme === 'dark' ? '1px solid #ca8a04' : '1px solid rgba(255, 255, 255, 0.25)') : 'none',
                boxShadow: activeTab === 'settings' ? (theme === 'dark' ? '0 2px 10px rgba(255, 208, 38, 0.35)' : '0 2px 8px rgba(0, 0, 0, 0.25)') : 'none',
                transition: 'all 0.2s',
              }}
            >
              <IconSettings size={16} />
              <span>Respaldo PC & Ajustes</span>
            </button>

            {/* Botón de Seguridad: Guardar Cambios */}
            <button
              type="button"
              onClick={handleSaveAllSafety}
              disabled={isSavingSafety}
              className="btn btn-sm d-flex align-items-center justify-content-center gap-2"
              style={{
                background: '#ffffff',
                color: '#059669',
                borderRadius: '10px',
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 800,
                border: '2px solid #00a854',
                boxShadow: '0 2px 8px rgba(0, 168, 84, 0.25)',
                transition: 'all 0.2s',
                cursor: isSavingSafety ? 'wait' : 'pointer',
                opacity: isSavingSafety ? 0.75 : 1,
              }}
              title="Guardar todos los cambios del menú y configuración en Supabase y respaldo en PC"
            >
              {isSavingSafety ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: '13px', height: '13px', borderWidth: '2px' }} />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '15px' }}>🛡️</span>
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            PESTAÑA 0: DASHBOARD EJECUTIVO GERENCIAL (ESTILO SALES REPORT)
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <div className="d-flex flex-column gap-4">
            {/* Cabecera Superior del Dashboard (Estilo Sales Report) */}
            <div
              className="p-4 rounded-4"
              style={{
                background: theme === 'dark'
                  ? 'linear-gradient(135deg, rgba(255, 208, 38, 0.08) 0%, rgba(24, 26, 40, 0.98) 100%)'
                  : 'linear-gradient(135deg, rgba(78, 117, 39, 0.08) 0%, rgba(252, 250, 246, 0.98) 100%)',
                border: theme === 'dark' ? '1px solid #262940' : '1px solid #e3ded5',
                boxShadow: theme === 'dark' ? '0 8px 32px rgba(0, 0, 0, 0.5)' : '0 4px 20px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span
                      style={{
                        background: '#ffd026',
                        color: '#000000',
                        fontSize: '11px',
                        fontWeight: 900,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                      }}
                    >
                      ★ Executive Operations
                    </span>
                    <span
                      style={{
                        background: theme === 'dark' ? 'rgba(45, 212, 191, 0.15)' : '#e0f2fe',
                        color: theme === 'dark' ? '#2dd4bf' : '#0369a1',
                        border: theme === 'dark' ? '1px solid rgba(45, 212, 191, 0.35)' : '1px solid #bae6fd',
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: '20px',
                      }}
                    >
                      🛡️ Auditoría & Respaldo PC Activos
                    </span>
                  </div>
                  <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '0.5px', color: theme === 'dark' ? '#ffffff' : '#111111', margin: 0 }}>
                    SALES REPORT
                  </h1>
                  <p style={{ color: theme === 'dark' ? '#ffd026' : '#5c8430', fontSize: '13px', margin: '4px 0 0 0', fontWeight: 700 }}>
                    Panel Gerencial de Operaciones, Ventas & Control Central • Tronos Pub & Grill
                  </p>
                </div>

                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <div
                    className="p-2.5 px-3 rounded-3 d-flex align-items-center gap-2"
                    style={{
                      background: theme === 'dark' ? '#121320' : '#ffffff',
                      border: theme === 'dark' ? '1px solid #262940' : '1px solid rgba(0,0,0,0.08)',
                    }}
                  >
                    <div style={{ fontSize: '20px' }}>👑</div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 900, color: theme === 'dark' ? '#ffffff' : '#111111' }}>
                        Gerencia Tronos
                      </div>
                      <div style={{ fontSize: '10.5px', color: theme === 'dark' ? '#8f94ba' : '#666666' }}>
                        {currentTime || 'En línea'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* FILA 1: 01. TOTAL SALES (Chart) + 2. TOP 5 SALES + 3. PERCENTAGE */}
            <div className="row g-3">
              {/* 01. TOTAL SALES & CHART */}
              <div className="col-12 col-xl-7">
                <div
                  className="p-4 rounded-4 h-100 d-flex flex-column justify-content-between"
                  style={{
                    background: theme === 'dark' ? '#181a28' : '#ffffff',
                    border: theme === 'dark' ? '1px solid #262940' : '1px solid #e3ded5',
                    boxShadow: theme === 'dark' ? '0 4px 20px rgba(0,0,0,0.4)' : '0 2px 10px rgba(0,0,0,0.04)',
                  }}
                >
                  <div>
                    <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 900, color: theme === 'dark' ? '#8f94ba' : '#666666', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          01. TOTAL SALES
                        </div>
                        <div style={{ fontSize: '12px', color: theme === 'dark' ? '#8f94ba' : '#666666' }}>
                          Recaudo de comandas entregadas
                        </div>
                      </div>

                      {/* Selector de periodo rápido */}
                      <div className="d-flex gap-1">
                        {[
                          { key: 'day', label: 'Hoy' },
                          { key: 'week', label: 'Semana' },
                          { key: 'month', label: 'Mes' },
                          { key: 'all', label: 'Histórico' },
                        ].map((p) => (
                          <button
                            key={p.key}
                            onClick={() => setInventoryPeriod(p.key)}
                            className="btn btn-sm"
                            style={{
                              background: inventoryPeriod === p.key ? '#ffd026' : (theme === 'dark' ? '#121320' : '#f1f5f9'),
                              color: inventoryPeriod === p.key ? '#000000' : (theme === 'dark' ? '#8f94ba' : '#475569'),
                              border: inventoryPeriod === p.key ? '1px solid #ca8a04' : (theme === 'dark' ? '1px solid #262940' : '1px solid #cbd5e1'),
                              fontSize: '11px',
                              fontWeight: 800,
                              borderRadius: '6px',
                              padding: '3px 10px',
                            }}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="d-flex align-items-baseline gap-2 my-2">
                      <span style={{ fontSize: '38px', fontWeight: 900, color: '#ffd026', letterSpacing: '-1px', lineHeight: 1 }}>
                        {formatPrice(dashboardStats.totalRevenue)}
                      </span>
                      <span style={{ fontSize: '13px', color: theme === 'dark' ? '#8f94ba' : '#666666', fontWeight: 600 }}>
                        COP neto
                      </span>
                    </div>

                    {/* Gráfico Spline SVG con Línea y Área Dorada Brillante */}
                    <div style={{ width: '100%', overflowX: 'auto', marginTop: '12px' }}>
                      <svg viewBox="0 0 580 180" style={{ width: '100%', height: 'auto', minWidth: '420px', display: 'block' }}>
                        <defs>
                          <linearGradient id="salesGoldGlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ffd026" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#ffd026" stopOpacity="0.0" />
                          </linearGradient>
                          <filter id="goldGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                          </filter>
                        </defs>

                        {/* Líneas horizontales de fondo */}
                        <line x1="30" y1="50" x2="550" y2="50" stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} strokeDasharray="3 3" />
                        <line x1="30" y1="95" x2="550" y2="95" stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} strokeDasharray="3 3" />
                        <line x1="30" y1="140" x2="550" y2="140" stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} />

                        {/* Área brillante bajo la curva */}
                        <path d={salesChartData.areaD} fill="url(#salesGoldGlow)" />

                        {/* Curva Spline dorada */}
                        <path
                          d={salesChartData.pathD}
                          fill="none"
                          stroke="#ffd026"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          filter="url(#goldGlowFilter)"
                        />

                        {/* Puntos circulares en picos */}
                        {salesChartData.points.map((pt, idx) => (
                          <g key={idx}>
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r="5.5"
                              fill="#ffd026"
                              stroke={theme === 'dark' ? '#181a28' : '#ffffff'}
                              strokeWidth="2.5"
                            />
                            {/* Etiqueta del día */}
                            <text
                              x={pt.x}
                              y="165"
                              textAnchor="middle"
                              fill={theme === 'dark' ? '#8f94ba' : '#64748b'}
                              fontSize="11"
                              fontWeight="700"
                            >
                              {pt.day}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  </div>

                  {/* Sub-métricas inferiores de ventas */}
                  <div
                    className="p-2.5 rounded-3 d-flex flex-wrap justify-content-around align-items-center text-center mt-3"
                    style={{
                      background: theme === 'dark' ? '#121320' : '#f8fafc',
                      border: theme === 'dark' ? '1px solid #23253a' : '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  >
                    <div>
                      <span style={{ color: theme === 'dark' ? '#8f94ba' : '#64748b', fontWeight: 600 }}>Ticket Promedio: </span>
                      <strong style={{ color: '#ffd026' }}>{formatPrice(dashboardStats.avgTicket)}</strong>
                    </div>
                    <div>
                      <span style={{ color: theme === 'dark' ? '#8f94ba' : '#64748b', fontWeight: 600 }}>Entregados: </span>
                      <strong style={{ color: '#22c55e' }}>{dashboardStats.deliveredCount} pedidos</strong>
                    </div>
                    <div>
                      <span style={{ color: theme === 'dark' ? '#8f94ba' : '#64748b', fontWeight: 600 }}>Devueltos: </span>
                      <strong style={{ color: '#dc2626' }}>{dashboardStats.returnedCount} pedidos</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. TOP 5 SALES (PLATOS MÁS VENDIDOS) */}
              <div className="col-12 col-md-7 col-xl-3">
                <div
                  className="p-4 rounded-4 h-100 d-flex flex-column justify-content-between"
                  style={{
                    background: theme === 'dark' ? '#181a28' : '#ffffff',
                    border: theme === 'dark' ? '1px solid #262940' : '1px solid #e3ded5',
                    boxShadow: theme === 'dark' ? '0 4px 20px rgba(0,0,0,0.4)' : '0 2px 10px rgba(0,0,0,0.04)',
                  }}
                >
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 900, color: theme === 'dark' ? '#8f94ba' : '#666666', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          2. TOP 5 SALES
                        </div>
                        <div style={{ fontSize: '12px', color: theme === 'dark' ? '#8f94ba' : '#666666' }}>
                          Platos más vendidos
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveTab('inventario')}
                        className="btn btn-sm p-0 text-decoration-none"
                        style={{ color: '#ffd026', fontSize: '11.5px', fontWeight: 800 }}
                      >
                        Ver todos ↗
                      </button>
                    </div>

                    {/* Producto #1 con píldora dorada completa (como en la imagen de referencia) */}
                    {dashboardStats.topProducts[0] && (
                      <div
                        className="p-3 mb-3 d-flex justify-content-between align-items-center"
                        style={{
                          background: '#ffd026',
                          color: '#000000',
                          borderRadius: '16px',
                          fontWeight: 900,
                          boxShadow: '0 4px 14px rgba(255, 208, 38, 0.35)',
                        }}
                      >
                        <div className="d-flex align-items-center gap-2">
                          <span style={{ fontSize: '15px' }}>★</span>
                          <div>
                            <div style={{ fontSize: '13.5px', fontWeight: 900, lineHeight: 1.2 }}>
                              1. {dashboardStats.topProducts[0].name}
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.85 }}>
                              {dashboardStats.topProducts[0].soldQty} unidades vendidas
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 900, whiteSpace: 'nowrap' }}>
                          {formatPrice(dashboardStats.topProducts[0].soldRevenue)}
                        </div>
                      </div>
                    )}

                    {/* Productos 2 al 5 */}
                    <div className="d-flex flex-column gap-2">
                      {dashboardStats.topProducts.slice(1, 5).map((prod, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-3 d-flex justify-content-between align-items-center"
                          style={{
                            background: theme === 'dark' ? '#121320' : '#f8fafc',
                            border: theme === 'dark' ? '1px solid #23253a' : '1px solid #e2e8f0',
                            fontSize: '12.5px',
                          }}
                        >
                          <div className="d-flex align-items-center gap-2">
                            <span style={{ fontWeight: 800, color: theme === 'dark' ? '#8f94ba' : '#94a3b8', fontSize: '11px' }}>
                              {idx + 2}.
                            </span>
                            <span style={{ fontWeight: 700, color: theme === 'dark' ? '#ffffff' : '#1e293b' }} className="text-truncate" style={{ maxWidth: '140px' }}>
                              {prod.name}
                            </span>
                          </div>
                          <div className="text-end">
                            <span style={{ fontWeight: 800, color: '#ffd026' }}>
                              {formatPrice(prod.soldRevenue)}
                            </span>
                            <span style={{ fontSize: '10.5px', color: theme === 'dark' ? '#8f94ba' : '#64748b', marginLeft: '4px' }}>
                              ({prod.soldQty}u)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('inventario')}
                    className="btn btn-sm w-100 mt-3 fw-bold text-center"
                    style={{
                      background: theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
                      color: theme === 'dark' ? '#ffffff' : '#334155',
                      border: theme === 'dark' ? '1px solid #262940' : '1px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '12px',
                      padding: '7px',
                    }}
                  >
                    ↗ Ver Análisis Completo de Inventario
                  </button>
                </div>
              </div>

              {/* 3. PERCENTAGE (TASA DE EFECTIVIDAD) */}
              <div className="col-12 col-md-5 col-xl-2">
                <div
                  className="p-4 rounded-4 h-100 d-flex flex-column justify-content-between align-items-center text-center"
                  style={{
                    background: theme === 'dark' ? '#181a28' : '#ffffff',
                    border: theme === 'dark' ? '1px solid #262940' : '1px solid #e3ded5',
                    boxShadow: theme === 'dark' ? '0 4px 20px rgba(0,0,0,0.4)' : '0 2px 10px rgba(0,0,0,0.04)',
                  }}
                >
                  <div className="w-100">
                    <div style={{ fontSize: '11px', fontWeight: 900, color: theme === 'dark' ? '#8f94ba' : '#666666', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      3. PERCENTAGE
                    </div>
                    <div style={{ fontSize: '12px', color: theme === 'dark' ? '#8f94ba' : '#666666', marginBottom: '14px' }}>
                      Efectividad de Entrega
                    </div>

                    {/* Anillo de Porcentaje SVG (como en la imagen de referencia) */}
                    <div className="position-relative d-inline-flex justify-content-center align-items-center my-2">
                      <svg width="124" height="124" viewBox="0 0 124 124">
                        <circle
                          cx="62"
                          cy="62"
                          r="48"
                          fill="none"
                          stroke={theme === 'dark' ? '#121320' : '#f1f5f9'}
                          strokeWidth="11"
                        />
                        <circle
                          cx="62"
                          cy="62"
                          r="48"
                          fill="none"
                          stroke="#ffd026"
                          strokeWidth="11"
                          strokeDasharray={2 * Math.PI * 48}
                          strokeDashoffset={2 * Math.PI * 48 - (2 * Math.PI * 48 * dashboardStats.successRate) / 100}
                          strokeLinecap="round"
                          transform="rotate(-90 62 62)"
                        />
                      </svg>
                      <div className="position-absolute text-center">
                        <div style={{ fontSize: '18px', color: '#ffd026', lineHeight: 1 }}>↑</div>
                        <div style={{ fontSize: '24px', fontWeight: 900, color: '#ffd026', lineHeight: 1.1 }}>
                          {dashboardStats.successRate}%
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '12px', fontWeight: 700, color: theme === 'dark' ? '#ffffff' : '#1e293b', marginTop: '6px' }}>
                      Entregas Exitosas
                    </div>
                  </div>

                  <div className="w-100 pt-2 border-top" style={{ borderColor: theme === 'dark' ? '#262940' : '#e2e8f0', fontSize: '11px' }}>
                    <div className="d-flex justify-content-between text-muted mb-1">
                      <span>Entregados:</span>
                      <strong style={{ color: '#22c55e' }}>{dashboardStats.deliveredCount}</strong>
                    </div>
                    <div className="d-flex justify-content-between text-muted">
                      <span>Devueltos:</span>
                      <strong style={{ color: '#dc2626' }}>{dashboardStats.returnedCount}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* FILA 2: 4. TOP SALES MARKET (Categorías) + 5. SEGURIDAD & RESPALDO */}
            <div className="row g-3">
              {/* 4. TOP SALES MARKET (BARRAS DE TUBO ESTILO REFERENCIA) */}
              <div className="col-12 col-lg-6">
                <div
                  className="p-4 rounded-4 h-100 d-flex flex-column justify-content-between"
                  style={{
                    background: theme === 'dark' ? '#181a28' : '#ffffff',
                    border: theme === 'dark' ? '1px solid #262940' : '1px solid #e3ded5',
                    boxShadow: theme === 'dark' ? '0 4px 20px rgba(0,0,0,0.4)' : '0 2px 10px rgba(0,0,0,0.04)',
                  }}
                >
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 900, color: theme === 'dark' ? '#8f94ba' : '#666666', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          4. TOP 3 SALES MARKET
                        </div>
                        <div style={{ fontSize: '12px', color: theme === 'dark' ? '#8f94ba' : '#666666' }}>
                          Participación por categoría de productos
                        </div>
                      </div>
                      <span
                        style={{
                          background: 'rgba(45, 212, 191, 0.15)',
                          color: '#2dd4bf',
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '12px',
                        }}
                      >
                        En Vivo
                      </span>
                    </div>

                    <div className="d-flex flex-column gap-3 my-2">
                      {/* Barra 1: Hamburguesas (Tubo Cian #2dd4bf) */}
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-1.5" style={{ fontSize: '12.5px' }}>
                          <span style={{ fontWeight: 800, color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>
                            🍔 Hamburguesas
                          </span>
                          <span style={{ fontWeight: 900, color: '#2dd4bf' }}>
                            {dashboardStats.bSold} uds ({dashboardStats.bPct}%)
                          </span>
                        </div>
                        <div
                          style={{
                            height: '22px',
                            background: theme === 'dark' ? '#121320' : '#f1f5f9',
                            borderRadius: '20px',
                            overflow: 'hidden',
                            padding: '3px',
                            border: theme === 'dark' ? '1px solid #262940' : '1px solid #e2e8f0',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.max(10, dashboardStats.bPct)}%`,
                              background: 'linear-gradient(90deg, #06b6d4, #2dd4bf)',
                              borderRadius: '20px',
                              boxShadow: '0 0 10px rgba(45, 212, 191, 0.4)',
                              transition: 'width 0.5s ease',
                            }}
                          />
                        </div>
                      </div>

                      {/* Barra 2: Entradas & Papas (Tubo Blanco/Plata #e2e8f0) */}
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-1.5" style={{ fontSize: '12.5px' }}>
                          <span style={{ fontWeight: 800, color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>
                            🍟 Entradas & Papas
                          </span>
                          <span style={{ fontWeight: 900, color: theme === 'dark' ? '#e2e8f0' : '#475569' }}>
                            {dashboardStats.sSold} uds ({dashboardStats.sPct}%)
                          </span>
                        </div>
                        <div
                          style={{
                            height: '22px',
                            background: theme === 'dark' ? '#121320' : '#f1f5f9',
                            borderRadius: '20px',
                            overflow: 'hidden',
                            padding: '3px',
                            border: theme === 'dark' ? '1px solid #262940' : '1px solid #e2e8f0',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.max(10, dashboardStats.sPct)}%`,
                              background: 'linear-gradient(90deg, #94a3b8, #e2e8f0)',
                              borderRadius: '20px',
                              transition: 'width 0.5s ease',
                            }}
                          />
                        </div>
                      </div>

                      {/* Barra 3: Bebidas (Tubo Dorado #ffd026) */}
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-1.5" style={{ fontSize: '12.5px' }}>
                          <span style={{ fontWeight: 800, color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>
                            🥤 Bebidas & Refrescos
                          </span>
                          <span style={{ fontWeight: 900, color: '#ffd026' }}>
                            {dashboardStats.dSold} uds ({dashboardStats.dPct}%)
                          </span>
                        </div>
                        <div
                          style={{
                            height: '22px',
                            background: theme === 'dark' ? '#121320' : '#f1f5f9',
                            borderRadius: '20px',
                            overflow: 'hidden',
                            padding: '3px',
                            border: theme === 'dark' ? '1px solid #262940' : '1px solid #e2e8f0',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.max(10, dashboardStats.dPct)}%`,
                              background: 'linear-gradient(90deg, #eab308, #ffd026)',
                              borderRadius: '20px',
                              boxShadow: '0 0 10px rgba(255, 208, 38, 0.4)',
                              transition: 'width 0.5s ease',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-between align-items-center pt-3 border-top mt-2" style={{ borderColor: theme === 'dark' ? '#262940' : '#e2e8f0', fontSize: '12px' }}>
                    <span style={{ color: theme === 'dark' ? '#8f94ba' : '#64748b' }}>
                      Adicionales e ingredientes especiales calculados en el inventario.
                    </span>
                    <button
                      onClick={() => setActiveTab('inventario')}
                      className="btn btn-sm fw-bold p-0"
                      style={{ color: '#ffd026', fontSize: '11.5px' }}
                    >
                      Ver desglose ↗
                    </button>
                  </div>
                </div>
              </div>

              {/* 5. SEGURIDAD, RESPALDO PC & FACTURACIÓN (COMPARATIVA) */}
              <div className="col-12 col-lg-6">
                <div
                  className="p-4 rounded-4 h-100 d-flex flex-column justify-content-between"
                  style={{
                    background: theme === 'dark' ? '#181a28' : '#ffffff',
                    border: theme === 'dark' ? '1px solid #262940' : '1px solid #e3ded5',
                    boxShadow: theme === 'dark' ? '0 4px 20px rgba(0,0,0,0.4)' : '0 2px 10px rgba(0,0,0,0.04)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 900, color: theme === 'dark' ? '#8f94ba' : '#666666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>
                      5. SEGURIDAD & CONTROL COMPARISON
                    </div>
                    <div style={{ fontSize: '12px', color: theme === 'dark' ? '#8f94ba' : '#666666', marginBottom: '14px' }}>
                      Facturación electrónica, auditoría y respaldo en computador local
                    </div>

                    {/* 3 Bloques de Comparación (como en la imagen de referencia) */}
                    <div className="row g-2">
                      <div className="col-4">
                        <div
                          className="p-3 rounded-3 text-center h-100 d-flex flex-column justify-content-between"
                          style={{
                            background: theme === 'dark' ? '#121320' : '#f8fafc',
                            border: theme === 'dark' ? '1px solid #262940' : '1px solid #e2e8f0',
                          }}
                        >
                          <div style={{ fontSize: '10.5px', fontWeight: 800, color: theme === 'dark' ? '#8f94ba' : '#64748b', textTransform: 'uppercase' }}>
                            Facturación
                          </div>
                          <div style={{ fontSize: '24px', fontWeight: 900, color: '#ffd026', margin: '6px 0' }}>
                            {invoicedOrders.length}
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#22c55e', fontWeight: 700 }}>
                            ✓ 3 Copias c/u
                          </div>
                        </div>
                      </div>

                      <div className="col-4">
                        <div
                          className="p-3 rounded-3 text-center h-100 d-flex flex-column justify-content-between"
                          style={{
                            background: theme === 'dark' ? '#121320' : '#f8fafc',
                            border: theme === 'dark' ? '1px solid #262940' : '1px solid #e2e8f0',
                          }}
                        >
                          <div style={{ fontSize: '10.5px', fontWeight: 800, color: theme === 'dark' ? '#8f94ba' : '#64748b', textTransform: 'uppercase' }}>
                            Respaldo PC
                          </div>
                          <div style={{ fontSize: '20px', fontWeight: 900, color: '#2dd4bf', margin: '8px 0', lineHeight: 1.1 }}>
                            ACTIVO
                          </div>
                          <div style={{ fontSize: '10px', color: theme === 'dark' ? '#8f94ba' : '#64748b' }} className="text-truncate">
                            {posBackupFolderName || 'Carpeta PC'}
                          </div>
                        </div>
                      </div>

                      <div className="col-4">
                        <div
                          className="p-3 rounded-3 text-center h-100 d-flex flex-column justify-content-between"
                          style={{
                            background: theme === 'dark' ? '#121320' : '#f8fafc',
                            border: theme === 'dark' ? '1px solid #262940' : '1px solid #e2e8f0',
                          }}
                        >
                          <div style={{ fontSize: '10.5px', fontWeight: 800, color: theme === 'dark' ? '#8f94ba' : '#64748b', textTransform: 'uppercase' }}>
                            Auditoría
                          </div>
                          <div style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', margin: '6px 0' }}>
                            {auditOrders.length}
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#ffd026', fontWeight: 700 }}>
                            Protegidas
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex gap-2 mt-3 pt-3 border-top" style={{ borderColor: theme === 'dark' ? '#262940' : '#e2e8f0' }}>
                    <button
                      onClick={() => setShowInvoicesModal(true)}
                      className="btn btn-sm flex-fill fw-bold"
                      style={{
                        background: '#121320',
                        color: '#ffd026',
                        border: '1px solid #ffd026',
                        borderRadius: '8px',
                        fontSize: '11.5px',
                        padding: '6px 10px',
                      }}
                    >
                      📁 Ver {invoicedOrders.length} Facturas Descargadas
                    </button>
                    <button
                      onClick={() => setActiveTab('settings')}
                      className="btn btn-sm flex-fill fw-bold"
                      style={{
                        background: theme === 'dark' ? '#1c1e30' : '#f1f5f9',
                        color: theme === 'dark' ? '#ffffff' : '#334155',
                        border: theme === 'dark' ? '1px solid #262940' : '1px solid #cbd5e1',
                        borderRadius: '8px',
                        fontSize: '11.5px',
                        padding: '6px 10px',
                      }}
                    >
                      💾 Ajustes de Carpeta PC
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* FILA 3: 6. OPINIONES DE CLIENTES & CALIFICACIONES (CON RESALTE EN COSAS A MEJORAR) */}
            <div className="row g-3">
              <div className="col-12">
                <div
                  className="p-4 rounded-4"
                  style={{
                    background: theme === 'dark' ? '#181a28' : '#ffffff',
                    border: theme === 'dark' ? '1px solid #262940' : '1px solid #e3ded5',
                    boxShadow: theme === 'dark' ? '0 4px 20px rgba(0,0,0,0.4)' : '0 2px 10px rgba(0,0,0,0.04)',
                  }}
                >
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <span style={{ fontSize: '18px' }}>⭐</span>
                        <h3 style={{ fontSize: '16px', fontWeight: 900, color: theme === 'dark' ? '#ffffff' : '#111111', margin: 0 }}>
                          6. QUÉ OPINAN MIS CLIENTES & CALIFICACIONES
                        </h3>
                        <span
                          style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '12px',
                          }}
                        >
                          🔒 Exclusivo Admin
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: theme === 'dark' ? '#8f94ba' : '#666666', margin: '3px 0 0 0' }}>
                        Evaluaciones directas enviadas desde el seguimiento en vivo de comandas.
                      </p>
                    </div>

                    <div className="d-flex align-items-center gap-3">
                      <div className="text-end">
                        <div style={{ fontSize: '22px', fontWeight: 900, color: '#ffd026', lineHeight: 1 }}>
                          ★ {feedbackMetrics.average} <span style={{ fontSize: '13px', color: theme === 'dark' ? '#8f94ba' : '#94a3b8' }}>/ 5.0</span>
                        </div>
                        <div style={{ fontSize: '11px', color: theme === 'dark' ? '#8f94ba' : '#64748b' }}>
                          {customerFeedbacks.length} opiniones recibidas
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveTab('opiniones')}
                        className="btn btn-sm fw-bold"
                        style={{
                          background: '#ffd026',
                          color: '#000000',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '7px 14px',
                          fontSize: '12px',
                        }}
                      >
                        Ver Todas las Opiniones ({customerFeedbacks.length}) ↗
                      </button>
                    </div>
                  </div>

                  {/* Tarjetas de Reseñas Destacadas */}
                  {dashboardStats.recentFeedbacks.length === 0 ? (
                    <div
                      className="p-4 rounded-3 text-center"
                      style={{
                        background: theme === 'dark' ? '#121320' : '#f8fafc',
                        border: theme === 'dark' ? '1px dashed #262940' : '1px dashed #cbd5e1',
                      }}
                    >
                      <span style={{ fontSize: '24px' }}>⭐</span>
                      <div style={{ fontSize: '13.5px', fontWeight: 800, color: theme === 'dark' ? '#ffffff' : '#1e293b', marginTop: '4px' }}>
                        Aún no hay opiniones de clientes registradas
                      </div>
                      <p style={{ fontSize: '12px', color: theme === 'dark' ? '#8f94ba' : '#64748b', margin: '2px 0 0 0' }}>
                        Cuando los clientes califiquen sus pedidos desde el link de WhatsApp (`/pedido/[id]`), aparecerán aquí de inmediato.
                      </p>
                    </div>
                  ) : (
                    <div className="row g-3">
                      {dashboardStats.recentFeedbacks.map((fb) => (
                        <div key={fb.id} className="col-12 col-md-4">
                          <div
                            className="p-3 rounded-3 h-100 d-flex flex-column justify-content-between"
                            style={{
                              background: theme === 'dark' ? '#121320' : '#f8fafc',
                              border: fb.improvements ? '1.5px solid rgba(245, 158, 11, 0.45)' : (theme === 'dark' ? '1px solid #23253a' : '1px solid #e2e8f0'),
                            }}
                          >
                            <div>
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <div>
                                  <strong style={{ fontSize: '13px', color: theme === 'dark' ? '#ffffff' : '#1e293b' }}>
                                    {fb.customerName || 'Cliente'}
                                  </strong>
                                  <div style={{ fontSize: '10.5px', color: theme === 'dark' ? '#8f94ba' : '#64748b' }}>
                                    #{fb.orderId}
                                  </div>
                                </div>
                                <div style={{ color: '#ffd026', fontSize: '13px' }}>
                                  {'★'.repeat(fb.rating || 5)}
                                </div>
                              </div>

                              {fb.comment && (
                                <p style={{ fontSize: '12px', color: theme === 'dark' ? '#cbd5e1' : '#334155', fontStyle: 'italic', marginBottom: '8px', lineHeight: 1.4 }}>
                                  &ldquo;{fb.comment}&rdquo;
                                </p>
                              )}

                              {/* Sección Destacada: Cosas a Mejorar */}
                              {fb.improvements && fb.improvements.trim() && (
                                <div
                                  className="p-2 rounded-2 mt-2"
                                  style={{
                                    background: 'rgba(245, 158, 11, 0.12)',
                                    border: '1px solid rgba(245, 158, 11, 0.4)',
                                    fontSize: '11.5px',
                                    color: theme === 'dark' ? '#fde68a' : '#b45309',
                                    fontWeight: 600,
                                  }}
                                >
                                  <div style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#f59e0b', marginBottom: '2px' }}>
                                    💡 Cosas a mejorar:
                                  </div>
                                  &ldquo;{fb.improvements}&rdquo;
                                </div>
                              )}
                            </div>

                            {fb.customerPhone && (
                              <div className="mt-3 pt-2 border-top" style={{ borderColor: theme === 'dark' ? '#262940' : '#e2e8f0' }}>
                                <a
                                  href={`https://wa.me/57${fb.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                    `Hola ${fb.customerName || ''}, muchas gracias por dejarnos tu calificación en Tronos Burger!`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-sm w-100 d-flex align-items-center justify-content-center gap-1.5 fw-bold"
                                  style={{
                                    background: '#128c7e',
                                    color: '#ffffff',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    padding: '5px',
                                    textDecoration: 'none',
                                  }}
                                >
                                  <span>💬 Responder por WhatsApp</span>
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            PESTAÑA 1: COMANDAS & PEDIDOS (TARJETAS BONITAS Y MODERNAS)
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'orders' && (
          <div>
            {/* Filtros y Buscador - Centrados, Compactos y Fijos/Flotantes al hacer scroll */}
            <div
              className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 px-3 py-2 rounded-3 pos-sunken-card text-center"
              style={{
                position: 'sticky',
                top: '58px',
                zIndex: 90,
                background: theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(20, 20, 20, 0.95)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s ease',
              }}
            >
              <div className="d-flex gap-1.5 justify-content-center align-items-center flex-wrap">
                {[
                  { key: 'all', name: 'Todos', count: activeOrdersCount },
                  { key: 'pendiente', name: 'Pendientes', count: metrics.pendingOrders },
                  { key: 'en_cocina', name: 'En Cocina', count: metrics.kitchenOrders },
                  { key: 'en_camino', name: 'En Camino', count: metrics.inTransitOrders },
                  { key: 'entregado', name: 'Entregados (Hoy)', count: metrics.deliveredOrders },
                  { key: 'devuelto', name: 'Devueltos', count: metrics.returnedOrders },
                ].map((f) => {
                  const isSelected = orderFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setOrderFilter(f.key)}
                      className="btn btn-sm d-inline-flex align-items-center justify-content-center"
                      style={{
                        background: isSelected ? '#f1f5f9' : '#ffffff',
                        border: isSelected ? '2px solid #000000' : '1px solid rgba(0,0,0,0.15)',
                        borderRadius: '6px',
                        fontSize: '11px',
                        padding: isSelected ? '3px 9px' : '4px 10px',
                        lineHeight: '1.2',
                        boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
                        cursor: 'pointer',
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
                  <span style={{ fontSize: '11.5px' }}>👁️</span>
                  <span style={{ fontWeight: 800, color: '#000000', fontSize: '11.5px' }}>
                    {hideDelivered ? 'Entregados ocultos' : 'Entregados visibles'}
                  </span>
                </button>
              </div>

              <div className="position-relative" style={{ maxWidth: '250px', width: '100%' }}>
                <span className="position-absolute start-0 top-50 translate-middle-y ps-2.5 text-muted" style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                  <IconSearch size={13} />
                </span>
                <input
                  type="text"
                  placeholder="Buscar cliente, tel o #TRN..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="form-control form-control-sm text-center"
                  style={{
                    background: '#ffffff',
                    color: '#111111',
                    borderColor: 'rgba(0,0,0,0.15)',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    padding: '4px 10px 4px 28px',
                    height: '29px',
                    boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.08)',
                  }}
                />
              </div>
            </div>

            {/* Notificación informativa cuando hay entregados ocultos en 'Todos' */}
            {orderFilter === 'all' && hideDelivered && metrics.deliveredOrders > 0 && (
              <div
                className="d-flex align-items-center justify-content-between px-3 py-1.5 mb-3 rounded-2"
                style={{
                  background: 'rgba(0,0,0,0.03)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  fontSize: '11.5px',
                  color: 'var(--text-muted)',
                }}
              >
                <span>
                  📦 <strong>{metrics.deliveredOrders}</strong> {metrics.deliveredOrders === 1 ? 'pedido entregado está oculto' : 'pedidos entregados están ocultos'} de la lista activa para mayor orden.
                </span>
                <button
                  onClick={() => setOrderFilter('entregado')}
                  className="btn btn-sm p-0 ms-2"
                  style={{ fontSize: '11.5px', fontWeight: 700, color: '#7c3aed', textDecoration: 'underline' }}
                >
                  Ver pedidos entregados ({metrics.deliveredOrders})
                </button>
              </div>
            )}

            {/* Listado de Pedidos en Tarjetas Difuminadas Centradas */}
            {filteredOrders.length === 0 ? (
              <div
                className="text-center py-5 rounded-4 pos-sunken-card"
              >
                <div className="d-flex justify-content-center mb-2">
                  <IconOrders size={42} style={{ color: 'var(--verde-viche)', opacity: 0.6 }} />
                </div>
                <h5 style={{ fontSize: '17px', fontWeight: 900, color: 'var(--verde-viche)', margin: 0 }}>
                  No hay pedidos activos en esta sección
                </h5>
                {orderFilter === 'all' && hideDelivered && metrics.deliveredOrders > 0 ? (
                  <div className="mt-2">
                    <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>
                      Todos los pedidos registrados ya han sido entregados con éxito y respaldados.
                    </p>
                    <button
                      onClick={() => setOrderFilter('entregado')}
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
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 600 }}>
{/* ... */}
                    Los pedidos que envíen tus clientes se registrarán automáticamente aquí en tiempo real.
                  </p>
                )}
              </div>
            ) : (
              <div className="row g-2 g-md-2.5">
                {filteredOrders.map((order) => {
                  const isPending = order.status === 'pendiente';
                  const isKitchen = order.status === 'en_cocina';
                  const isInTransit = order.status === 'en_camino';
                  const isDelivered = order.status === 'entregado';
                  const isReturned = order.status === 'devuelto';

                  return (
                    <div key={order.id} className="col-12 col-sm-6 col-md-4 col-xl-3">
                      {/* TARJETA COMPACTA 20% MÁS LARGA Y CENTRADA */}
                      <div
                        className="pos-sunken-card rounded-3 d-flex flex-column h-100 overflow-hidden text-center shadow-sm"
                        style={{
                          minHeight: '480px',
                          border: isPending
                            ? '2px solid #ea580c !important'
                            : isKitchen
                            ? '2px solid #7c3aed !important'
                            : isInTransit
                            ? '1.5px solid #0284c7 !important'
                            : isDelivered
                            ? '1.5px solid #16a34a !important'
                            : isReturned
                            ? '2px solid #dc2626 !important'
                            : (theme === 'dark' ? '1px solid #262940 !important' : '1px solid #e3ded5 !important'),
                          boxShadow: isKitchen
                            ? '0 2px 10px rgba(124, 58, 237, 0.16)'
                            : isInTransit
                            ? '0 2px 10px rgba(2, 132, 199, 0.16)'
                            : isDelivered
                            ? '0 2px 10px rgba(22, 163, 74, 0.16)'
                            : isPending
                            ? '0 2px 10px rgba(234, 88, 12, 0.16)'
                            : '0 2px 10px rgba(220, 38, 38, 0.16)',
                        }}
                      >
                        {/* Cabecera de la Tarjeta Centrada */}
                        <div
                          className="px-3.5 py-2 border-bottom d-flex flex-column align-items-center justify-content-center text-center gap-1"
                          style={{ background: 'rgba(0, 0, 0, 0.035)', borderColor: 'var(--border-light)' }}
                        >
                          <div className="d-flex align-items-center justify-content-center gap-1.5 flex-wrap">
                            <span
                              style={{
                                background: '#141414',
                                color: '#ffffff',
                                fontSize: '11px',
                                fontWeight: 900,
                                padding: '2px 7px',
                                borderRadius: '6px',
                                letterSpacing: '0.3px',
                                border: '1px solid rgba(255, 255, 255, 0.25)',
                              }}
                            >
                              #{order.id}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600 }}>
                              {new Date(order.date || Date.now()).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {order.invoiced && (
                              <span
                                style={{
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  border: '1px solid #86efac',
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
                                <span>✓ Factura</span>
                              </span>
                            )}
                          </div>

                          <div>
                            {isPending && (
                              <span
                                className="d-inline-flex align-items-center gap-1"
                                style={{
                                  background: 'var(--verde-viche-badge)',
                                  color: 'var(--verde-viche)',
                                  border: '1px solid var(--verde-viche-border)',
                                  fontSize: '9.5px',
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: '12px',
                                }}
                              >
                                <IconClock size={11} />
                                <span>Pendiente</span>
                              </span>
                            )}
                            {isKitchen && (
                              <span
                                className="d-inline-flex align-items-center gap-1"
                                style={{
                                  background: 'rgba(124, 58, 237, 0.15)',
                                  color: '#7c3aed',
                                  border: '1px solid rgba(124, 58, 237, 0.35)',
                                  fontSize: '9.5px',
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: '12px',
                                }}
                              >
                                <span>👨‍🍳 Cocina</span>
                              </span>
                            )}
                            {isInTransit && (
                              <span
                                className="d-inline-flex align-items-center gap-1"
                                style={{
                                  background: 'rgba(59, 130, 246, 0.15)',
                                  color: '#2563eb',
                                  border: '1px solid rgba(59, 130, 246, 0.35)',
                                  fontSize: '9.5px',
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: '12px',
                                }}
                              >
                                <IconTransit size={11} />
                                <span>En Camino</span>
                              </span>
                            )}
                            {isDelivered && (
                              <span
                                className="d-inline-flex align-items-center gap-1"
                                style={{
                                  background: 'var(--verde-viche-badge)',
                                  color: 'var(--verde-viche)',
                                  border: '1px solid var(--verde-viche-border)',
                                  fontSize: '9.5px',
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: '12px',
                                }}
                              >
                                <IconCheckCircle size={11} />
                                <span>Entregado</span>
                              </span>
                            )}
                            {isReturned && (
                              <span
                                className="d-inline-flex align-items-center gap-1"
                                style={{
                                  background: 'rgba(220, 38, 38, 0.15)',
                                  color: '#dc2626',
                                  border: '1px solid rgba(220, 38, 38, 0.35)',
                                  fontSize: '9.5px',
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: '12px',
                                }}
                              >
                                <span>↩️ Devuelto</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Cuerpo de la Tarjeta Centrado */}
                        <div className="px-3.5 py-2.5 d-flex flex-column text-center" style={{ flex: 1 }}>
                          {/* Caja de Datos del Cliente Centrada */}
                          <div
                            className="p-2.5 mb-2 pos-sunken-subbox text-center d-flex flex-column align-items-center justify-content-center"
                          >
                            <div className="d-flex align-items-center justify-content-center gap-1" style={{ fontWeight: 900, color: '#000000', marginBottom: '2px', fontSize: '13px' }}>
                              <IconUser size={13} style={{ color: '#000000' }} />
                              <span className="text-truncate">{order.customer?.nombre || 'Consumidor Final'}</span>
                            </div>
                            <div className="d-flex align-items-center justify-content-center gap-1" style={{ color: '#000000', fontWeight: 800, marginBottom: '1px', fontSize: '11px' }}>
                              <IconPhone size={13} style={{ color: '#000000' }} />
                              <span>{order.customer?.telefono || 'N/A'}</span>
                            </div>
                            <div className="d-flex align-items-center justify-content-center gap-1 text-truncate w-100" style={{ color: '#000000', fontWeight: 800, fontSize: '11px' }}>
                              <IconMapPin size={13} style={{ color: '#000000' }} />
                              <span className="text-truncate">{order.customer?.direccion || 'En local'}</span>
                            </div>
                            {order.customer?.descripcion && (
                              <div
                                className="mt-1.5 pt-1 border-top w-100 text-center d-flex align-items-center justify-content-center gap-1 text-truncate"
                                style={{ borderColor: 'rgba(0,0,0,0.08)', color: '#000000', fontSize: '11px', fontWeight: 800 }}
                              >
                                <IconFileText size={13} style={{ color: '#000000' }} />
                                <span className="text-truncate">{order.customer.descripcion}</span>
                              </div>
                            )}
                          </div>

                          {/* Lista de Platos Ordenados Centrados con Scroll Compacto */}
                          <div className="d-flex flex-column gap-1 mb-2 text-center" style={{ flex: 1, minHeight: '130px', maxHeight: '175px', overflowY: 'auto' }}>
                            <div style={{ fontSize: '10.5px', fontWeight: 900, color: '#000000', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.4px' }}>
                              Detalle del Pedido
                            </div>
                            {(order.items || []).map((item, idx) => (
                              <div
                                key={idx}
                                className="pb-1.5 border-bottom text-center"
                                style={{ borderColor: 'var(--border-light)', fontSize: '11.5px' }}
                              >
                                <div className="d-flex justify-content-center align-items-center gap-1.5 flex-wrap">
                                  <span
                                    style={{
                                      background: '#0f172a',
                                      color: '#ffffff',
                                      fontWeight: 900,
                                      fontSize: '10px',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                    }}
                                  >
                                    {item.quantity || 1}x
                                  </span>
                                  <strong style={{ color: '#000000', fontWeight: 900 }}>{item.name}</strong>
                                  <span style={{ fontWeight: 900, color: '#000000', fontSize: '11.5px' }}>
                                    — {formatPrice((item.price || 0) * (item.quantity || 1))}
                                  </span>
                                </div>

                                {/* Extras Centrados */}
                                {(item.selectedExtras || []).map((ex, eIdx) => (
                                  <div
                                    key={eIdx}
                                    style={{ fontSize: '10.5px', color: '#000000', marginTop: '2px', textAlign: 'center', fontWeight: 800 }}
                                  >
                                    + {ex.name} x{ex.quantity || 1}
                                  </div>
                                ))}

                                {/* Ingredientes Retirados Centrados */}
                                {(item.removedIngredients || []).length > 0 && (
                                  <div
                                    key={`rem-${idx}`}
                                    style={{ fontSize: '10.5px', color: '#dc2626', marginTop: '2px', textAlign: 'center', fontWeight: 900 }}
                                  >
                                    Sin: {item.removedIngredients.join(', ')}
                                  </div>
                                )}

                                {/* Nota Centrada */}
                                {item.note && (
                                  <div
                                    style={{
                                      fontSize: '10.5px',
                                      color: '#000000',
                                      fontStyle: 'italic',
                                      fontWeight: 800,
                                      marginTop: '2px',
                                      textAlign: 'center',
                                    }}
                                  >
                                    Nota: {item.note}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Total Destacado en Verde Viche Claro sin Luz - Centrado */}
                          <div
                            className="d-flex flex-column align-items-center justify-content-center mb-2 p-1.5 pos-sunken-subbox text-center"
                          >
                            <span style={{ fontSize: '11px', color: '#000000', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '1px' }}>
                              Total Comanda
                            </span>
                            <span style={{ fontSize: '16.5px', fontWeight: 900, color: '#15803d', letterSpacing: '-0.3px' }}>
                              {formatPrice(order.total || 0)}
                            </span>
                          </div>

                          {/* Indicador Factura Generada */}
                          {order.invoiced && (
                            <div
                              className="px-2 py-1 mb-1.5 rounded-2 d-flex align-items-center justify-content-between"
                              style={{
                                background: '#f0fdf4',
                                border: '1px solid #86efac',
                                color: '#166534',
                              }}
                            >
                              <div className="d-flex align-items-center gap-1" style={{ fontSize: '10px', fontWeight: 700 }}>
                                <span>✓ Factura generada</span>
                                {order.invoicedAt && (
                                  <span style={{ fontSize: '9.5px', color: '#15803d', fontWeight: 500 }}>
                                    ({new Date(order.invoicedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })})
                                  </span>
                                )}
                              </div>
                              <span
                                style={{
                                  fontSize: '9px',
                                  color: '#166534',
                                  fontWeight: 700,
                                  background: '#dcfce7',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                }}
                              >
                                3 Copias
                              </span>
                            </div>
                          )}

                          {/* ── UN SOLO BOTÓN: GENERA 3 COPIAS SIMULTÁNEAMENTE - CENTRADO ── */}
                          <button
                            onClick={() => handleFacturarTresCopias(order)}
                            className="btn w-100 py-1.5 mb-1.5 d-flex align-items-center justify-content-center gap-1.5 fw-bold text-center"
                            style={{
                              background: order.invoiced ? '#1e293b' : '#141414',
                              color: '#ffffff',
                              border: '1px solid rgba(255, 255, 255, 0.3)',
                              borderRadius: '7px',
                              fontSize: '11px',
                              boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.2), 0 2px 8px rgba(0, 0, 0, 0.2)',
                              letterSpacing: '0.2px',
                            }}
                          >
                            <IconPrinter size={13} />
                            <span>
                              {order.invoiced
                                ? 'Re-Imprimir (3 Copias)'
                                : 'Facturar (3 Copias)'}
                            </span>
                          </button>

                          {/* Progreso de Estados Separados */}
                          <div className="d-flex flex-column gap-1 mb-1.5">
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
                                <button
                                  type="button"
                                  onClick={() => handleOpenCustomizeModal(order)}
                                  className="btn w-100 py-1 mb-1 d-flex align-items-center justify-content-center gap-1.5 fw-bold text-center"
                                  style={{
                                    background: '#eff6ff',
                                    color: '#1d4ed8',
                                    border: '1.5px solid #bfdbfe',
                                    borderRadius: '6px',
                                    fontSize: '10.5px',
                                  }}
                                  title="Añadir adición personalizada con precio manual"
                                >
                                  <span>🛠️ Personalizar Pedido</span>
                                </button>
                                <div className="d-flex gap-1.5">
                                  <button
                                    onClick={() => handleEnviarACocina(order)}
                                    className="btn w-100 py-1 d-flex align-items-center justify-content-center gap-1 fw-bold text-center"
                                    style={{
                                      background: '#7c3aed',
                                      color: '#ffffff',
                                      borderRadius: '6px',
                                      fontSize: '10.5px',
                                      border: 'none',
                                    }}
                                    title={order.invoiced ? "Enviar a Cocina" : "Obligatorio: Se emitirán e imprimirán las facturas antes de pasar a cocina"}
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
                                    className="btn py-1 px-2 fw-bold d-flex align-items-center justify-content-center"
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
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCustomizeModal(order)}
                                  className="btn w-100 py-1 mb-1 d-flex align-items-center justify-content-center gap-1.5 fw-bold text-center"
                                  style={{
                                    background: '#eff6ff',
                                    color: '#1d4ed8',
                                    border: '1.5px solid #bfdbfe',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                  }}
                                  title="Añadir adición personalizada con precio manual y actualizar factura"
                                >
                                  <span>🛠️ Personalizar Pedido</span>
                                </button>
                                <div className="d-flex gap-1.5">
                                  <button
                                    onClick={() => {
                                      updateOrderStatus(order.id, 'en_camino');
                                      showToast(`Comanda #${order.id} despachada (En Camino).`);
                                    }}
                                    className="btn w-100 py-1 d-flex align-items-center justify-content-center gap-1 fw-bold text-center"
                                    style={{
                                      background: '#22c55e',
                                      color: '#ffffff',
                                      borderRadius: '6px',
                                      fontSize: '10.5px',
                                      border: 'none',
                                    }}
                                  >
                                    <IconTransit size={13} />
                                    <span>🛵 Despachar</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`¿Marcar la comanda #${order.id} como devuelta?`)) {
                                        updateOrderStatus(order.id, 'devuelto');
                                        showToast(`Comanda #${order.id} marcada como devuelta.`, 'error');
                                      }
                                    }}
                                    className="btn py-1 px-2 fw-bold d-flex align-items-center justify-content-center"
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

                            {isInTransit && (
                              <div className="d-flex gap-1.5">
                                <button
                                  onClick={() => {
                                    updateOrderStatus(order.id, 'entregado');
                                    showToast(`Pedido #${order.id} entregado.`);
                                  }}
                                  className="btn w-100 py-1 d-flex align-items-center justify-content-center gap-1 fw-bold text-center"
                                  style={{
                                    background: '#7c3aed',
                                    color: '#ffffff',
                                    borderRadius: '6px',
                                    fontSize: '10.5px',
                                    border: 'none',
                                  }}
                                >
                                  <IconCheck size={13} />
                                  <span>✅ Entregado</span>
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`¿Marcar la comanda #${order.id} como devuelta?`)) {
                                      updateOrderStatus(order.id, 'devuelto');
                                      showToast(`Comanda #${order.id} marcada como devuelta.`, 'error');
                                    }
                                  }}
                                  className="btn py-1 px-2 fw-bold d-flex align-items-center justify-content-center"
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
                                  if (confirm(`¿Marcar el pedido entregado #${order.id} como devuelto?`)) {
                                    updateOrderStatus(order.id, 'devuelto');
                                    showToast(`Comanda #${order.id} marcada como devuelta.`, 'error');
                                  }
                                }}
                                className="btn w-100 py-1 fw-bold d-flex align-items-center justify-content-center gap-1"
                                style={{
                                  background: 'transparent',
                                  color: '#dc2626',
                                  border: '1px solid #fca5a5',
                                  borderRadius: '6px',
                                  fontSize: '10px',
                                }}
                              >
                                <span>↩️ Marcar Devuelto</span>
                              </button>
                            )}

                            {isReturned && (
                              <button
                                onClick={() => handleEnviarACocina(order)}
                                className="btn w-100 py-1 fw-bold d-flex align-items-center justify-content-center gap-1"
                                style={{
                                  background: '#7c3aed',
                                  color: '#ffffff',
                                  borderRadius: '6px',
                                  fontSize: '10.5px',
                                  border: 'none',
                                }}
                              >
                                <span>👨‍🍳 Reenviar a Cocina</span>
                              </button>
                            )}
                          </div>

                          {/* Fila Inferior de Control Centrada */}
                          <div
                            className="d-flex justify-content-center align-items-center position-relative pt-1 border-top mt-auto text-center"
                            style={{ borderColor: 'var(--border-light)' }}
                          >
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                              {isPending && (
                                <span className="d-inline-flex align-items-center gap-1">
                                  <IconClock size={11} /> Esperando cocina
                                </span>
                              )}
                              {isKitchen && (
                                <span className="d-inline-flex align-items-center gap-1" style={{ color: '#7c3aed' }}>
                                  👨‍🍳 En cocina
                                </span>
                              )}
                              {isInTransit && (
                                <span className="d-inline-flex align-items-center gap-1" style={{ color: '#0284c7' }}>
                                  <IconTransit size={11} /> En reparto
                                </span>
                              )}
                              {isDelivered && (
                                <span className="d-inline-flex align-items-center gap-1" style={{ color: 'var(--verde-viche)' }}>
                                  <IconCheckCircle size={11} /> Entregado
                                </span>
                              )}
                              {isReturned && (
                                <span className="d-inline-flex align-items-center gap-1" style={{ color: '#dc2626' }}>
                                  ↩️ Devuelto
                                </span>
                              )}
                            </span>

                            <button
                              onClick={async () => {
                                if (confirm(`¿Eliminar comanda #${order.id}?`)) {
                                  try {
                                    await deleteOrder(order.id);
                                    showToast(`✓ Comanda #${order.id} eliminada y sincronizada en Supabase.`);
                                  } catch (e) {
                                    showToast(`Comanda #${order.id} eliminada localmente.`);
                                  }
                                }
                              }}
                              className="btn btn-sm p-0 text-danger position-absolute end-0 d-flex align-items-center"
                              style={{ border: 'none', background: 'transparent' }}
                              title="Eliminar Comanda"
                            >
                              <IconTrash size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            PESTAÑA: AUDITORÍA CENTRAL Y CONTROL MAESTRO DE COMANDAS
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'auditoria' && (
          <div>
            {/* Banner Informativo Discreto de Auditoría */}
            <div
              className="p-3.5 mb-4 rounded-4 pos-sunken-card d-flex flex-wrap justify-content-between align-items-center gap-3"
              style={{ borderLeft: '4px solid #d97706' }}
            >
              <div>
                <div className="d-flex align-items-center gap-2">
                  <span style={{ fontSize: '16px', fontWeight: 900, color: '#111111' }}>
                    Auditoría Central y Control Maestro de Comandas
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      background: '#fef3c7',
                      color: '#b45309',
                      border: '1px solid #fde68a',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    Exclusivo Administrador
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#555555', fontWeight: 500 }}>
                  Registro maestro inmutable de todas las órdenes emitidas desde el menú web o gestionadas en caja.
                  Los cajeros no pueden borrar registros ni anular facturas. Solo el Administrador tiene autorización.
                </p>
              </div>

              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#666666' }}>
                  Total en Auditoría: <strong>{auditOrders.length}</strong>
                </span>
              </div>
            </div>

            {/* Listado en Tabla de Auditoría */}
            {auditOrders.length === 0 ? (
              <div className="text-center py-5 rounded-4 pos-sunken-card">
                <IconOrders size={42} style={{ color: 'var(--verde-viche)', opacity: 0.6 }} />
                <h5 style={{ fontSize: '18px', fontWeight: 900, color: '#111111', marginTop: '12px' }}>
                  Sin registros de auditoría aún
                </h5>
              </div>
            ) : (
              <div className="table-responsive pos-sunken-card rounded-4 p-3 mb-4" style={{ background: '#ffffff' }}>
                <table className="table table-hover align-middle mb-0" style={{ fontSize: '12.5px' }}>
                  <thead style={{ background: 'rgba(0,0,0,0.03)', color: '#444444', fontWeight: 800 }}>
                    <tr>
                      <th style={{ padding: '10px 12px' }}>CÓDIGO</th>
                      <th style={{ padding: '10px 12px' }}>FECHA Y HORA</th>
                      <th style={{ padding: '10px 12px' }}>CLIENTE</th>
                      <th style={{ padding: '10px 12px' }}>CONTACTO / DIR</th>
                      <th style={{ padding: '10px 12px' }}>ITEMS</th>
                      <th style={{ padding: '10px 12px' }}>TOTAL</th>
                      <th style={{ padding: '10px 12px' }}>ESTADO</th>
                      <th style={{ padding: '10px 12px' }}>FACTURACIÓN</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>ACCIONES ADMIN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditOrders.map((order) => {
                      const isAnulado = order.status === 'anulado_admin' || order.status === 'cancelado';
                      const formattedDate = new Date(order.date || order.createdAt || Date.now()).toLocaleString('es-CO', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <tr key={order.id} style={{ opacity: isAnulado ? 0.6 : 1 }}>
                          <td style={{ fontWeight: 900, color: '#111111' }}>
                            #{order.id}
                          </td>
                          <td style={{ color: '#666666', whiteSpace: 'nowrap' }}>
                            {formattedDate}
                          </td>
                          <td style={{ fontWeight: 700, color: '#111111' }}>
                            {order.customer?.nombre || 'Consumidor Final'}
                          </td>
                          <td style={{ color: '#555555', maxWidth: '200px' }}>
                            <div>{order.customer?.telefono || 'N/A'}</div>
                            <small style={{ color: '#888888', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {order.customer?.direccion || 'En local'}
                            </small>
                          </td>
                          <td style={{ maxWidth: '220px' }}>
                            <div style={{ fontSize: '11.5px', color: '#333333' }}>
                              {(order.items || []).map((it, idx) => (
                                <span key={idx} className="badge me-1 mb-1" style={{ background: 'rgba(0,0,0,0.06)', color: '#222222', fontWeight: 600 }}>
                                  {it.quantity}x {it.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ fontWeight: 900, color: '#15803d', fontSize: '13px' }}>
                            {formatPrice(order.total || 0)}
                          </td>
                          <td>
                            {isAnulado ? (
                              <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
                                Anulado
                              </span>
                            ) : order.status === 'devuelto' ? (
                              <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
                                ↩️ Devuelto
                              </span>
                            ) : order.status === 'entregado' ? (
                              <span className="badge" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
                                ✓ Entregado
                              </span>
                            ) : order.status === 'en_camino' ? (
                              <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc' }}>
                                🛵 En Camino
                              </span>
                            ) : order.status === 'en_cocina' ? (
                              <span className="badge" style={{ background: '#f3e8ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
                                👨‍🍳 En Cocina
                              </span>
                            ) : (
                              <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                                ● Pendiente
                              </span>
                            )}
                          </td>
                          <td>
                            {order.invoiced ? (
                              <span className="badge" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                                ✓ 3 Copias Emitidas
                              </span>
                            ) : (
                              <span className="badge" style={{ background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                                Sin emitir
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="d-flex justify-content-end gap-1.5 flex-wrap">
                              <button
                                onClick={() => handleFacturarTresCopias(order)}
                                className="btn btn-sm"
                                style={{
                                  background: '#141414',
                                  color: '#ffffff',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                }}
                                title="Emitir las 3 Facturas (1 digital + 2 térmicas)"
                              >
                                🧾 Facturar 3
                              </button>

                              {order.status !== 'devuelto' && !isAnulado && (
                                <button
                                  onClick={() => {
                                    if (confirm(`¿Marcar la comanda #${order.id} como devuelta?`)) {
                                      updateOrderStatus(order.id, 'devuelto');
                                      showToast(`Comanda #${order.id} registrada como devuelta.`, 'error');
                                    }
                                  }}
                                  className="btn btn-sm"
                                  style={{
                                    background: '#fee2e2',
                                    color: '#b91c1c',
                                    border: '1px solid #fca5a5',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                  }}
                                  title="Marcar como Devuelto"
                                >
                                  ↩️ Devolver
                                </button>
                              )}

                              <button
                                onClick={async () => {
                                  if (confirm(`¿Anular y purgar definitivamente la comanda #${order.id} del registro maestro de auditoría? Esta acción es exclusiva del Administrador.`)) {
                                    try {
                                      await deleteOrder(order.id);
                                      await purgeAuditOrder(order.id);
                                      showToast(`✓ Comanda #${order.id} purgada y actualizada en Supabase.`);
                                    } catch (e) {
                                      showToast(`Comanda #${order.id} purgada localmente.`);
                                    }
                                  }
                                }}
                                className="btn btn-sm btn-outline-danger"
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                }}
                                title="Anular / Eliminar Registro (Admin)"
                              >
                                <IconTrash size={13} /> Anular
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            PESTAÑA: INVENTARIO & ANÁLISIS DE VENTAS EXACTO
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'inventario' && (
          <div>
            {/* Cabecera y Selector de Período */}
            <div
              className="p-3.5 mb-4 rounded-4 pos-sunken-card d-flex flex-wrap justify-content-between align-items-center gap-3"
              style={{ borderLeft: '4px solid var(--verde-viche)' }}
            >
              <div>
                <div className="d-flex align-items-center gap-2">
                  <IconBurger size={20} style={{ color: 'var(--verde-viche)' }} />
                  <h5 style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
                    Control de Inventario & Análisis Exacto de Ventas
                  </h5>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Auditoría precisa sin errores de cálculo: métricas calculadas según comandas <strong>Entregadas</strong> vs. <strong>Devueltas</strong>.
                </p>
              </div>

              {/* Selector de Período Temporal */}
              <div className="d-flex gap-1.5 flex-wrap p-1 rounded-3" style={{ background: 'rgba(0,0,0,0.06)' }}>
                {[
                  { key: 'day', label: 'Hoy (Día)' },
                  { key: 'week', label: 'Esta Semana (7D)' },
                  { key: 'month', label: 'Este Mes (30D)' },
                  { key: 'all', label: 'Histórico Total' },
                ].map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setInventoryPeriod(p.key)}
                    className="btn btn-sm"
                    style={{
                      background: inventoryPeriod === p.key ? '#141414' : 'transparent',
                      color: inventoryPeriod === p.key ? '#ffffff' : 'var(--text-main)',
                      fontSize: '12px',
                      fontWeight: inventoryPeriod === p.key ? 800 : 600,
                      borderRadius: '8px',
                      padding: '5px 14px',
                      border: 'none',
                      boxShadow: inventoryPeriod === p.key ? '0 2px 6px rgba(0,0,0,0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI METRICS DE INVENTARIO */}
            <div className="row g-3 mb-4 text-center">
              {/* Hamburguesas */}
              <div className="col-6 col-md-4 col-xl-2">
                <div
                  className="p-3 rounded-4 h-100 pos-sunken-card d-flex flex-column justify-content-center align-items-center"
                >
                  <div className="d-flex align-items-center gap-1.5 mb-1">
                    <span style={{ fontSize: '16px' }}>🍔</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Burgers Vendidas
                    </span>
                  </div>
                  <span style={{ fontSize: '26px', fontWeight: 900, color: 'var(--verde-viche)' }}>
                    {inventoryAnalytics.totalBurgersSold}
                  </span>
                  <div style={{ fontSize: '11px', color: inventoryAnalytics.totalBurgersReturned > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: 700, marginTop: '2px' }}>
                    {inventoryAnalytics.totalBurgersReturned} devueltas
                  </div>
                </div>
              </div>

              {/* Entradas / Papas */}
              <div className="col-6 col-md-4 col-xl-2">
                <div
                  className="p-3 rounded-4 h-100 pos-sunken-card d-flex flex-column justify-content-center align-items-center"
                >
                  <div className="d-flex align-items-center gap-1.5 mb-1">
                    <span style={{ fontSize: '16px' }}>🍟</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Entradas Vendidas
                    </span>
                  </div>
                  <span style={{ fontSize: '26px', fontWeight: 900, color: '#0284c7' }}>
                    {inventoryAnalytics.totalSidesSold}
                  </span>
                  <div style={{ fontSize: '11px', color: inventoryAnalytics.totalSidesReturned > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: 700, marginTop: '2px' }}>
                    {inventoryAnalytics.totalSidesReturned} devueltas
                  </div>
                </div>
              </div>

              {/* Bebidas */}
              <div className="col-6 col-md-4 col-xl-2">
                <div
                  className="p-3 rounded-4 h-100 pos-sunken-card d-flex flex-column justify-content-center align-items-center"
                >
                  <div className="d-flex align-items-center gap-1.5 mb-1">
                    <span style={{ fontSize: '16px' }}>🥤</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Bebidas Vendidas
                    </span>
                  </div>
                  <span style={{ fontSize: '26px', fontWeight: 900, color: '#7c3aed' }}>
                    {inventoryAnalytics.totalDrinksSold}
                  </span>
                  <div style={{ fontSize: '11px', color: inventoryAnalytics.totalDrinksReturned > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: 700, marginTop: '2px' }}>
                    {inventoryAnalytics.totalDrinksReturned} devueltas
                  </div>
                </div>
              </div>

              {/* Total Ítems */}
              <div className="col-6 col-md-4 col-xl-2">
                <div
                  className="p-3 rounded-4 h-100 pos-sunken-card d-flex flex-column justify-content-center align-items-center"
                >
                  <div className="d-flex align-items-center gap-1.5 mb-1">
                    <IconBox size={16} style={{ color: '#d4a843' }} />
                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Total Despachados
                    </span>
                  </div>
                  <span style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-main)' }}>
                    {inventoryAnalytics.totalItemsSold}
                  </span>
                  <div style={{ fontSize: '11px', color: inventoryAnalytics.totalItemsReturned > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: 700, marginTop: '2px' }}>
                    {inventoryAnalytics.totalItemsReturned} devueltos
                  </div>
                </div>
              </div>

              {/* Ventas Netas Reales */}
              <div className="col-6 col-md-4 col-xl-2">
                <div
                  className="p-3 rounded-4 h-100 pos-sunken-card d-flex flex-column justify-content-center align-items-center"
                >
                  <div className="d-flex align-items-center gap-1.5 mb-1">
                    <IconSales size={16} style={{ color: '#15803d' }} />
                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Venta Concretada
                    </span>
                  </div>
                  <span style={{ fontSize: '20px', fontWeight: 900, color: '#15803d' }}>
                    {formatPrice(inventoryAnalytics.totalDeliveredRevenue)}
                  </span>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                    {inventoryAnalytics.deliveredOrdersCount} pedidos entregados
                  </div>
                </div>
              </div>

              {/* Pérdidas Devolución */}
              <div className="col-6 col-md-4 col-xl-2">
                <div
                  className="p-3 rounded-4 h-100 pos-sunken-card d-flex flex-column justify-content-center align-items-center"
                >
                  <div className="d-flex align-items-center gap-1.5 mb-1">
                    <span style={{ fontSize: '15px' }}>↩️</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Devoluciones
                    </span>
                  </div>
                  <span style={{ fontSize: '20px', fontWeight: 900, color: inventoryAnalytics.totalReturnedValue > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                    {formatPrice(inventoryAnalytics.totalReturnedValue)}
                  </span>
                  <div style={{ fontSize: '11px', color: inventoryAnalytics.returnedOrdersCount > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                    {inventoryAnalytics.returnedOrdersCount} pedidos devueltos
                  </div>
                </div>
              </div>
            </div>

            {/* TABLA DETALLADA DE PRODUCTOS */}
            <div className="pos-sunken-card rounded-4 p-3 mb-4" style={{ background: '#ffffff' }}>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 pb-2 border-bottom">
                <div className="d-flex align-items-center gap-2">
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#111111' }}>
                    Desglose por Plato / Producto
                  </span>
                  <span className="badge" style={{ background: 'rgba(0,0,0,0.06)', color: '#333333' }}>
                    {inventoryAnalytics.productsList.length} ítems
                  </span>
                </div>

                {/* Filtro por Categoría en Inventario */}
                <div className="d-flex gap-1 flex-wrap">
                  {[
                    { key: 'all', label: 'Todos' },
                    { key: 'Hamburguesas', label: '🍔 Burgers' },
                    { key: 'Entradas', label: '🍟 Entradas' },
                    { key: 'Bebidas', label: '🥤 Bebidas' },
                  ].map((cat) => (
                    <button
                      key={cat.key}
                      onClick={() => setInventoryCatFilter(cat.key)}
                      className="btn btn-sm"
                      style={{
                        background: inventoryCatFilter === cat.key ? '#141414' : 'rgba(0,0,0,0.04)',
                        color: inventoryCatFilter === cat.key ? '#ffffff' : '#333333',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        padding: '4px 10px',
                        border: 'none',
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {inventoryAnalytics.productsList.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <div className="mb-2">📦</div>
                  <h6 style={{ fontWeight: 800 }}>No hay movimientos registrados en este período</h6>
                  <p style={{ fontSize: '12px' }}>
                    Las ventas de comandas entregadas o devueltas en este período aparecerán aquí automáticamente.
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0" style={{ fontSize: '12.5px' }}>
                    <thead style={{ background: 'rgba(0,0,0,0.03)', color: '#444444', fontWeight: 800 }}>
                      <tr>
                        <th style={{ padding: '10px 12px' }}>PRODUCTO / PLATO</th>
                        <th style={{ padding: '10px 12px' }}>CATEGORÍA</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>PRECIO BASE</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>VENDIDOS (ENTREGADOS)</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>DEVUELTOS</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>VENTA NETA (COP)</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>VALOR DEVUELTO</th>
                        <th style={{ padding: '10px 12px' }}>ADICIONALES POPULARES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryAnalytics.productsList.map((prod, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 800, color: '#111111' }}>
                            {prod.name}
                          </td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                background: prod.category === 'Hamburguesas'
                                  ? 'rgba(234, 88, 12, 0.1)'
                                  : prod.category === 'Entradas'
                                  ? 'rgba(2, 132, 199, 0.1)'
                                  : 'rgba(124, 58, 237, 0.1)',
                                color: prod.category === 'Hamburguesas'
                                  ? '#c2410c'
                                  : prod.category === 'Entradas'
                                  ? '#0369a1'
                                  : '#6d28d9',
                                fontWeight: 700,
                              }}
                            >
                              {prod.category}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#555555' }}>
                            {formatPrice(prod.unitPrice)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                background: prod.soldQty > 0 ? '#dcfce7' : '#f1f5f9',
                                color: prod.soldQty > 0 ? '#15803d' : '#64748b',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontWeight: 900,
                                fontSize: '13px',
                              }}
                            >
                              {prod.soldQty}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                background: prod.returnedQty > 0 ? '#fee2e2' : '#f1f5f9',
                                color: prod.returnedQty > 0 ? '#dc2626' : '#64748b',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontWeight: 900,
                                fontSize: '13px',
                              }}
                            >
                              {prod.returnedQty}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 900, color: '#15803d', fontSize: '13.5px' }}>
                            {formatPrice(prod.soldRevenue)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: prod.returnedValue > 0 ? '#dc2626' : '#94a3b8' }}>
                            {formatPrice(prod.returnedValue)}
                          </td>
                          <td style={{ maxWidth: '280px' }}>
                            {Object.keys(prod.extrasBreakdown).length === 0 ? (
                              <span style={{ color: '#94a3b8', fontSize: '11px' }}>Sin adicionales</span>
                            ) : (
                              <div className="d-flex flex-wrap gap-1">
                                {Object.entries(prod.extrasBreakdown).map(([exName, exCount], exIdx) => (
                                  <span
                                    key={exIdx}
                                    className="badge"
                                    style={{
                                      background: 'rgba(0,0,0,0.05)',
                                      color: '#222222',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                    }}
                                  >
                                    +{exName}: {exCount}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* RESUMEN GLOBAL DE ADICIONALES ESPECIALES */}
            {Object.keys(inventoryAnalytics.extrasSummary).length > 0 && (
              <div className="pos-sunken-card rounded-4 p-3.5 mb-4" style={{ background: '#ffffff' }}>
                <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom">
                  <span style={{ fontSize: '16px' }}>👑</span>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#111111' }}>
                    Consolidado de Toppings y Adicionales Especiales Vendidos
                  </span>
                </div>
                <div className="row g-2">
                  {Object.entries(inventoryAnalytics.extrasSummary).map(([extraName, count], idx) => (
                    <div key={idx} className="col-6 col-md-4 col-lg-3">
                      <div
                        className="p-2.5 rounded-3 d-flex justify-content-between align-items-center"
                        style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#222222' }}>
                          {extraName}
                        </span>
                        <span
                          style={{
                            background: '#141414',
                            color: '#ffffff',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontWeight: 900,
                            fontSize: '12px',
                          }}
                        >
                          {count} unid.
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            PESTAÑA 2: LISTA POS EJECUTIVA DE CARTA & MENÚ
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'menu' && (
          <div>
            {/* Crear Categoría - Tarjeta Hundida */}
            <div
              className="p-3.5 mb-4 rounded-4 d-flex flex-wrap justify-content-between align-items-center gap-2 pos-sunken-card"
            >
              <div>
                <span style={{ fontSize: '15px', fontWeight: 900, color: 'var(--verde-viche)' }}>
                  Categorías de la Carta
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '8px', fontWeight: 600 }}>
                  ({menuCategories.length} secciones activas)
                </span>
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSaveAllSafety}
                  disabled={isSavingSafety}
                  className="btn btn-sm d-flex align-items-center justify-content-center gap-1.5"
                  style={{
                    background: '#ffffff',
                    color: '#059669',
                    borderRadius: '10px',
                    padding: '6px 14px',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    border: '2px solid #00a854',
                    boxShadow: '0 2px 8px rgba(0, 168, 84, 0.2)',
                    cursor: isSavingSafety ? 'wait' : 'pointer',
                    opacity: isSavingSafety ? 0.75 : 1,
                  }}
                  title="Guardar todos los cambios del menú en Supabase y respaldo local"
                >
                  {isSavingSafety ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '14px' }}>🛡️</span>
                      <span>Guardar Cambios</span>
                    </>
                  )}
                </button>
                <form onSubmit={handleAddCategory} className="d-flex gap-2" style={{ maxWidth: '360px', width: '100%' }}>
                  <input
                    type="text"
                    value={newCategoryTitle}
                    onChange={(e) => setNewCategoryTitle(e.target.value)}
                    placeholder="Nueva categoría (ej: Bebidas, Parrilla)..."
                    className="form-control form-control-sm text-center"
                    style={{ background: '#ffffff', color: '#111111', borderColor: 'rgba(0,0,0,0.15)', borderRadius: '10px', fontSize: '12.5px' }}
                  />
                  <button
                    type="submit"
                    className="btn btn-sm text-nowrap fw-bold d-flex align-items-center justify-content-center gap-1"
                    style={{ background: '#141414', color: '#ffffff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '10px', fontSize: '12.5px', padding: '6px 16px' }}
                  >
                    <IconPlus size={13} />
                    <span>Crear</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Listado de Categorías y TABLA POS EJECUTIVA */}
            <div className="d-flex flex-column gap-4">
              {menuCategories.map((category) => (
                <div
                  key={category.id}
                  className="rounded-4 overflow-hidden pos-sunken-card"
                >
                  {/* Encabezado Categoría */}
                  <div
                    className="p-3.5 d-flex justify-content-between align-items-center border-bottom"
                    style={{ background: 'rgba(0, 0, 0, 0.035)', borderColor: 'var(--border-light)' }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                        {category.title}
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', background: 'var(--border-main)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                        {category.items?.length || 0} platos
                      </span>
                    </div>

                    <div className="d-flex gap-2">
                      <button
                        onClick={() => setAddingToCategoryId(addingToCategoryId === category.id ? null : category.id)}
                        className="btn btn-sm d-flex align-items-center gap-1"
                        style={{
                          background: 'var(--bg-card)',
                          color: 'var(--text-main)',
                          border: '1px solid var(--border-main)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          padding: '5px 12px',
                        }}
                      >
                        {addingToCategoryId === category.id ? (
                          <>
                            <IconX size={13} />
                            <span>Cancelar</span>
                          </>
                        ) : (
                          <>
                            <IconPlus size={13} />
                            <span>Añadir Plato</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`¿Eliminar la categoría "${category.title}"?`)) {
                            showToast('Eliminando categoría y sincronizando con Supabase...', 'info');
                            const res = await deleteCategory(category.id);
                            if (res?.supaOk) {
                              showToast('✓ Categoría eliminada y guardada en Supabase.', 'success');
                            } else if (res?.serverOk) {
                              showToast('✓ Categoría eliminada (guardada localmente, sincronizando en segundo plano).', 'success');
                            } else {
                              showToast('⚠️ Eliminada localmente. Pulsa "Guardar Cambios" para asegurar en Supabase.', 'error');
                            }
                          }
                        }}
                        className="btn btn-sm text-danger d-flex align-items-center"
                        style={{ background: 'transparent', border: 'none' }}
                        title="Eliminar Categoría"
                      >
                        <IconTrash size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Formulario Inline para Añadir Plato */}
                  {addingToCategoryId === category.id && (
                    <div className="p-3.5 border-bottom" style={{ background: 'var(--bg-sub)', borderColor: 'var(--border-main)' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--gold-main)' }}>
                        + Nuevo Plato en "{category.title}"
                      </div>
                      <form onSubmit={(e) => handleAddItemSubmit(e, category.id)}>
                        <div className="row g-2">
                          <div className="col-12 col-md-4">
                            <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Nombre del Plato</label>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Ej: Tronos Clásica"
                              value={newItem.name}
                              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                              required
                            />
                          </div>
                          <div className="col-12 col-md-3">
                            <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Precio ($ COP)</label>
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              placeholder="24000"
                              value={newItem.price}
                              onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                              required
                            />
                          </div>
                          <div className="col-12 col-md-5">
                            <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Foto (archivo)</label>
                            <input
                              type="file"
                              accept="image/*"
                              className="form-control form-control-sm"
                              onChange={(e) => handleImageUpload(e, setNewItem)}
                            />
                          </div>
                          <div className="col-12">
                            <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Ingredientes / Descripción</label>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Carne 150g, queso cheddar, cebolla caramelizada, pan brioche..."
                              value={newItem.description}
                              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                              required
                            />
                          </div>
                          <div className="col-12 text-end mt-2">
                            <button
                              type="submit"
                              className="btn btn-sm fw-bold"
                              style={{ background: 'var(--primary-btn-bg)', color: 'var(--primary-btn-text)', border: 'none', borderRadius: '8px', fontSize: '12.5px', padding: '6px 18px' }}
                            >
                              Guardar Plato
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* ── TABLA POS EJECUTIVA ── */}
                  {(category.items || []).length === 0 ? (
                    <div className="p-4 text-center" style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
                      No hay platos en esta categoría todavía. Haz clic en "+ Añadir Plato" para empezar.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table m-0 align-middle" style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                        <thead style={{ background: 'var(--bg-sub)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          <tr>
                            <th style={{ width: '60px', padding: '10px 14px', borderBottom: '1px solid var(--border-main)' }}>FOTO</th>
                            <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-main)' }}>PLATO & INGREDIENTES</th>
                            <th style={{ width: '130px', padding: '10px 14px', borderBottom: '1px solid var(--border-main)' }}>PRECIO</th>
                            <th style={{ width: '140px', padding: '10px 14px', borderBottom: '1px solid var(--border-main)' }}>EXTRAS</th>
                            <th style={{ width: '110px', textAlign: 'right', padding: '10px 14px', borderBottom: '1px solid var(--border-main)' }}>ACCIONES</th>
                          </tr>
                        </thead>
                        <tbody>
                          {category.items.map((item) => {
                            const isEditing = editingItemId === item.id;
                            const isManagingExtras = managingExtrasForItemId === item.id;

                            if (isEditing) {
                              return (
                                <tr key={item.id} style={{ background: 'var(--bg-sub)' }}>
                                  <td colSpan={5} className="p-3">
                                    <form onSubmit={handleSaveEdit}>
                                      <div className="d-flex justify-content-between align-items-center mb-2">
                                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--gold-main)' }}>Editar: {item.name}</span>
                                        <button type="button" onClick={() => setEditingItemId(null)} className="btn btn-sm p-0 text-muted d-flex align-items-center">
                                          <IconX size={14} />
                                        </button>
                                      </div>
                                      <div className="row g-2">
                                        <div className="col-12 col-md-4">
                                          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Nombre</label>
                                          <input
                                            type="text"
                                            value={editingItem.name}
                                            onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                            className="form-control form-control-sm"
                                            placeholder="Nombre"
                                            required
                                          />
                                        </div>
                                        <div className="col-12 col-md-3">
                                          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Precio ($ COP)</label>
                                          <input
                                            type="number"
                                            value={editingItem.price}
                                            onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                                            className="form-control form-control-sm"
                                            placeholder="Precio"
                                            required
                                          />
                                        </div>
                                        <div className="col-12 col-md-5">
                                          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cambiar Foto (archivo)</label>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            className="form-control form-control-sm"
                                            onChange={(e) => handleImageUpload(e, setEditingItem)}
                                          />
                                        </div>
                                        <div className="col-12">
                                          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Descripción / Ingredientes</label>
                                          <input
                                            type="text"
                                            value={editingItem.description}
                                            onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                                            className="form-control form-control-sm"
                                            placeholder="Descripción"
                                            required
                                          />
                                        </div>
                                        <div className="col-12 text-end mt-1">
                                          <button type="button" onClick={() => setEditingItemId(null)} className="btn btn-sm btn-outline-secondary me-2" style={{ fontSize: '11.5px' }}>Cancelar</button>
                                          <button type="submit" className="btn btn-sm fw-bold" style={{ background: 'var(--primary-btn-bg)', color: 'var(--primary-btn-text)', fontSize: '11.5px', padding: '5px 16px' }}>Guardar Cambios</button>
                                        </div>
                                      </div>
                                    </form>
                                  </td>
                                </tr>
                              );
                            }

                            return (
                              <tr key={item.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                {/* Foto Pequeña Redondeada */}
                                <td style={{ padding: '10px 14px' }}>
                                  {item.image ? (
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      width={46}
                                      height={46}
                                      style={{ objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--border-main)' }}
                                    />
                                  ) : (
                                    <div style={{ width: 46, height: 46, background: 'var(--border-main)', borderRadius: 10 }} />
                                  )}
                                </td>

                                {/* Nombre e Ingredientes */}
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '13.5px' }}>
                                    {item.name}
                                  </div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '1px' }}>
                                    {item.description}
                                  </div>

                                  {/* Subpanel Desplegable de Extras */}
                                  {isManagingExtras && (
                                    <div className="mt-2 p-2.5 rounded-3 border" style={{ background: 'var(--bg-sub)', borderColor: 'var(--border-main)', maxWidth: '420px' }}>
                                      <div className="d-flex justify-content-between align-items-center mb-1.5 pb-1 border-bottom" style={{ borderColor: 'var(--border-main)' }}>
                                        <strong style={{ fontSize: '11.5px', color: 'var(--text-main)' }}>Adicionales configurados:</strong>
                                        <button onClick={() => setManagingExtrasForItemId(null)} className="btn btn-sm p-0 text-muted d-flex align-items-center gap-1" style={{ fontSize: '11.5px' }}>
                                          <IconX size={12} />
                                          <span>Cerrar</span>
                                        </button>
                                      </div>
                                      <div className="d-flex flex-column gap-1 mb-2">
                                        {(item.extras || []).map((extra) => (
                                          <div key={extra.id} className="d-flex justify-content-between align-items-center" style={{ fontSize: '11.5px' }}>
                                            <span>{extra.name} ({formatPrice(extra.price)})</span>
                                            <button onClick={() => handleDeleteExtra(item, extra.id)} className="btn btn-sm p-0 text-danger d-flex align-items-center" style={{ border: 'none', background: 'transparent' }}>
                                              <IconTrash size={13} />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                      <form onSubmit={(e) => handleAddExtra(e, item)} className="d-flex gap-1.5">
                                        <input
                                          type="text"
                                          placeholder="Extra (ej: Tocineta)"
                                          value={newExtra.name}
                                          onChange={(e) => setNewExtra({ ...newExtra, name: e.target.value })}
                                          className="form-control form-control-sm py-0 px-2"
                                          style={{ fontSize: '11.5px' }}
                                        />
                                        <input
                                          type="number"
                                          placeholder="Precio"
                                          value={newExtra.price}
                                          onChange={(e) => setNewExtra({ ...newExtra, price: e.target.value })}
                                          className="form-control form-control-sm py-0 px-2"
                                          style={{ width: '75px', fontSize: '11.5px' }}
                                        />
                                        <button type="submit" className="btn btn-sm btn-dark py-0 px-2" style={{ fontSize: '11.5px' }}>+</button>
                                      </form>
                                    </div>
                                  )}
                                </td>

                                {/* Precio */}
                                <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--gold-main)', fontSize: '13.5px' }}>
                                  {formatPrice(item.price)}
                                </td>

                                {/* Contador / Gestión Extras */}
                                <td style={{ padding: '10px 14px' }}>
                                  <button
                                    onClick={() => setManagingExtrasForItemId(isManagingExtras ? null : item.id)}
                                    className="btn btn-sm d-flex align-items-center gap-1"
                                    style={{
                                      background: 'var(--bg-sub)',
                                      border: '1px solid var(--border-main)',
                                      color: 'var(--text-muted)',
                                      fontSize: '11.5px',
                                      fontWeight: 600,
                                      borderRadius: '6px',
                                      padding: '3px 8px',
                                    }}
                                  >
                                    <IconSettings size={13} />
                                    <span>{item.extras?.length || 0} extras</span>
                                  </button>
                                </td>

                                {/* Acciones */}
                                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                  <div className="d-flex justify-content-end gap-1.5">
                                    <button
                                      onClick={() => handleStartEdit(item, category.id)}
                                      className="btn btn-sm"
                                      style={{
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-main)',
                                        color: 'var(--text-main)',
                                        fontSize: '11.5px',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        padding: '4px 10px',
                                      }}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (confirm(`¿Eliminar "${item.name}"?`)) {
                                          showToast('Eliminando plato y sincronizando con Supabase...', 'info');
                                          const res = await deleteMenuItem(category.id, item.id);
                                          if (res?.supaOk) {
                                            showToast('✓ Plato eliminado y actualizado en Supabase.', 'success');
                                          } else if (res?.serverOk) {
                                            showToast('✓ Plato eliminado (guardado localmente, sincronizando en segundo plano).', 'success');
                                          } else {
                                            showToast('⚠️ Eliminado localmente. Pulsa "Guardar Cambios" para asegurar en Supabase.', 'error');
                                          }
                                        }
                                      }}
                                      className="btn btn-sm text-danger d-flex align-items-center"
                                      style={{ background: 'transparent', border: 'none', padding: '3px 6px' }}
                                      title="Eliminar Plato"
                                    >
                                      <IconTrash size={15} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            PESTAÑA 3: RESPALDO PC & AJUSTES
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="row g-4">
            {/* SECCIÓN ESPECIAL: Respaldo Electrónico en Carpeta de la PC */}
            <div className="col-12 col-lg-6">
              <div
                className="p-4 rounded-4 h-100 pos-sunken-card text-center d-flex flex-column align-items-center"
              >
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--verde-viche)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Almacenamiento Local en PC
                </div>
                <h4 style={{ fontSize: '17px', fontWeight: 900, margin: '4px 0 8px 0', color: 'var(--text-main)' }}>
                  Carpeta de Respaldo de Facturas
                </h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginBottom: '16px', fontWeight: 500 }}>
                  Elige la carpeta en tu computadora donde se guardarán automáticamente todas las copias electrónicas (.html) al presionar "Enviar Domicilio & Facturar".
                </p>

                <div
                  className="p-3.5 mb-3 rounded-3 w-100 pos-sunken-subbox text-center"
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '4px' }}>
                    ESTADO DE LA CONEXIÓN:
                  </div>
                  {posBackupFolderName ? (
                    <div>
                      <div style={{ color: 'var(--verde-viche)', fontWeight: 900, fontSize: '14.5px', marginBottom: '4px' }}>
                        ● Carpeta Conectada: "{posBackupFolderName}"
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        Guardado automático directo activo en tu equipo sin preguntar cada vez.
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
                        ○ Ninguna carpeta fija seleccionada
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        Las facturas se descargan a la carpeta general de Descargas de Windows.
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSelectFolder}
                  className="btn w-100 py-2.5 d-flex align-items-center justify-content-center gap-2 fw-bold text-center mt-auto"
                  style={{
                    background: '#141414',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    borderRadius: '12px',
                    fontSize: '13px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                  }}
                >
                  <IconFolder size={17} />
                  <span>Seleccionar Carpeta en este Computador</span>
                </button>
              </div>
            </div>

            {/* Ajustes de WhatsApp y Redes */}
            <div className="col-12 col-lg-6">
              <div
                className="p-4 rounded-4 h-100 pos-sunken-card text-center d-flex flex-column align-items-center"
              >
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--verde-viche)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Canales de Venta & Domicilios
                </div>
                <h4 style={{ fontSize: '17px', fontWeight: 900, margin: '4px 0 8px 0', color: 'var(--text-main)' }}>
                  📱 WhatsApp para Recepción de Pedidos (Asesor de Caja)
                </h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginBottom: '12px', fontWeight: 500 }}>
                  Número al cual los clientes envían sus pedidos por WhatsApp desde la carta web. Se sincroniza de inmediato con todos los clientes y con el POS.
                </p>

                {/* Indicador de Número Vinculado Actualmente */}
                <div
                  className="w-100 p-2.5 mb-3 rounded-3 d-flex align-items-center justify-content-between"
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    fontSize: '12px',
                    color: '#166534',
                  }}
                >
                  <div className="d-flex align-items-center gap-1.5 fw-bold">
                    <span style={{ fontSize: '15px' }}>🟢</span>
                    <span>Actualmente Vinculado:</span>
                  </div>
                  <div className="fw-black" style={{ fontSize: '14px', letterSpacing: '0.5px' }}>
                    +{restaurantConfig?.whatsapp || '573007708616'}
                  </div>
                </div>

                <div className="d-flex gap-2 mb-2 w-100">
                  <input
                    type="text"
                    className="form-control form-control-sm text-center fw-bold"
                    value={whatsappInput}
                    onChange={(e) => setWhatsappInput(e.target.value)}
                    placeholder="Ej: 3007708616 o 573007708616"
                    style={{
                      background: 'var(--input-bg)',
                      color: 'var(--text-main)',
                      borderColor: 'var(--border-main)',
                      borderRadius: '8px',
                      fontSize: '13.5px',
                    }}
                  />
                  <button
                    onClick={() => {
                      if (!whatsappInput.trim()) {
                        showToast('⚠️ Ingresa un número de teléfono válido', 'error');
                        return;
                      }
                      const cleaned = updateWhatsApp(whatsappInput);
                      setWhatsappInput(cleaned);
                      showToast(`✅ WhatsApp guardado y vinculado: +${cleaned}`, 'success');
                    }}
                    className="btn btn-sm text-nowrap fw-bold"
                    style={{
                      background: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      padding: '6px 18px',
                      boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)',
                    }}
                  >
                    💾 Guardar y Vincular
                  </button>
                </div>

                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 w-100 mb-4">
                  <small style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'left' }}>
                    💡 Si pones 10 dígitos (ej: <code>3007708616</code>), el sistema agrega automáticamente el código de Colombia (+57).
                  </small>
                  <a
                    href={`https://wa.me/${cleanWhatsAppNumber(whatsappInput || restaurantConfig?.whatsapp)}?text=${encodeURIComponent('Hola, este es un mensaje de prueba para verificar la vinculación de WhatsApp en Tronos Pub & Grill.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm text-nowrap fw-bold d-flex align-items-center gap-1"
                    style={{
                      background: 'rgba(34, 197, 94, 0.1)',
                      color: '#16a34a',
                      border: '1px solid #86efac',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      padding: '4px 10px',
                      textDecoration: 'none',
                    }}
                    title="Abre una ventana de WhatsApp para verificar que el número esté bien escrito y reciba mensajes"
                  >
                    <span>🔗 Probar Enlace</span>
                  </a>
                </div>

                {/* ── PRECIO DEL DOMICILIO (CONFIGURACIÓN EN LÍNEA SUPABASE) ── */}
                <div className="w-100 p-3 mb-4 rounded-3 border text-start" style={{ background: 'var(--bg-sub)', borderColor: 'var(--border-main)' }}>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                      🚴 Tarifa de Domicilio ($ COP)
                    </span>
                    <span className="badge px-2 py-1" style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '11px', fontWeight: 800 }}>
                      Actual: {formatPrice(restaurantConfig?.deliveryPrice !== undefined ? restaurantConfig.deliveryPrice : 4000)}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '11.5px', marginBottom: '8px' }}>
                    Este es el recargo que se suma automáticamente al pedido cuando el cliente selecciona <em>"Quiero que me lo traigan a mi casa"</em>. Se guarda directamente en Supabase y se actualiza al instante en la carta web.
                  </p>
                  <div className="d-flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="500"
                      className="form-control form-control-sm fw-bold"
                      value={deliveryPriceInput}
                      onChange={(e) => setDeliveryPriceInput(e.target.value)}
                      placeholder="Ej: 4000"
                      style={{
                        background: 'var(--input-bg)',
                        color: 'var(--text-main)',
                        borderColor: 'var(--border-main)',
                        borderRadius: '8px',
                        fontSize: '13.5px',
                      }}
                    />
                    <button
                      onClick={() => {
                        const val = parseInt(deliveryPriceInput, 10);
                        if (isNaN(val) || val < 0) {
                          showToast('⚠️ Ingresa una tarifa válida mayor o igual a 0', 'error');
                          return;
                        }
                        const saved = updateDeliveryPrice(val);
                        setDeliveryPriceInput(String(saved));
                        showToast(`✅ Tarifa de domicilio guardada en Supabase: ${formatPrice(saved)}`, 'success');
                      }}
                      className="btn btn-sm text-nowrap fw-bold"
                      style={{
                        background: '#d97706',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        padding: '6px 16px',
                      }}
                    >
                      💾 Guardar Tarifa
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                  Redes Sociales del Restaurante
                </div>
                <div className="d-flex flex-column gap-1.5 mb-3">
                  {(restaurantConfig?.socials || []).map((social) => (
                    <div
                      key={social.id}
                      className="d-flex justify-content-between align-items-center p-2.5 rounded-3 border"
                      style={{ background: 'var(--bg-sub)', borderColor: 'var(--border-main)', fontSize: '12px' }}
                    >
                      <span><strong>{social.name}:</strong> {social.url}</span>
                      <button onClick={() => removeSocial(social.id)} className="btn btn-sm p-0 text-danger d-flex align-items-center" style={{ border: 'none', background: 'transparent' }}>
                        <IconTrash size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-3 border" style={{ background: 'var(--bg-sub)', borderColor: 'var(--border-main)' }}>
                  <div className="row g-2">
                    <div className="col-5">
                      <input
                        type="text"
                        placeholder="Red (Instagram)"
                        className="form-control form-control-sm"
                        value={newSocial.name}
                        onChange={(e) => setNewSocial({ ...newSocial, name: e.target.value })}
                        style={{ fontSize: '12px' }}
                      />
                    </div>
                    <div className="col-7">
                      <input
                        type="url"
                        placeholder="https://..."
                        className="form-control form-control-sm"
                        value={newSocial.url}
                        onChange={(e) => setNewSocial({ ...newSocial, url: e.target.value })}
                        style={{ fontSize: '12px' }}
                      />
                    </div>
                    <div className="col-12 text-end mt-1">
                      <button
                        onClick={() => {
                          if (!newSocial.name || !newSocial.url) return;
                          addSocial({ id: `soc-${Date.now()}`, ...newSocial });
                          setNewSocial({ name: '', url: '', image: '' });
                          showToast('Red social añadida.');
                        }}
                        className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                        style={{ fontSize: '11.5px', borderRadius: '6px' }}
                      >
                        <IconPlus size={13} />
                        <span>Añadir Red Social</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            PESTAÑA: QUÉ OPINAN MIS CLIENTES (SOLO ADMIN - CONFIDENCIAL)
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'opiniones' && (
          <div className="d-flex flex-column gap-4">
            {/* Banner Superior Exclusivo - Fondo Azul Cielo y Tarjetas Pequeñas Blancas */}
            <div
              className="p-4 rounded-4"
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 45%, #38bdf8 100%)',
                border: '1px solid #0284c7',
                boxShadow: '0 8px 24px rgba(2, 132, 199, 0.28)',
              }}
            >
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span
                      style={{
                        background: '#ffd026',
                        color: '#000000',
                        fontSize: '11px',
                        fontWeight: 900,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      }}
                    >
                      ★ Módulo de Calificaciones
                    </span>
                    <span
                      style={{
                        background: '#ffffff',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                      }}
                    >
                      🔒 Confidencial: Solo visible para el Administrador
                    </span>
                  </div>
                  <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', margin: 0, textShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                    ⭐ Qué opinan mis clientes
                  </h2>
                  <p style={{ color: '#ffffff', fontSize: '13px', margin: '6px 0 0 0', fontWeight: 600, opacity: 0.95 }}>
                    Opiniones, valoraciones y sugerencias enviadas directamente por los compradores desde el seguimiento en vivo de sus pedidos. Esta información <strong>no</strong> la ve el cajero ni el público de la carta.
                  </p>
                </div>

                <div className="d-flex gap-2">
                  <button
                    onClick={loadFeedbacks}
                    className="btn btn-sm d-flex align-items-center gap-2 fw-bold"
                    style={{
                      background: '#ffffff',
                      color: '#0284c7',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '8px 16px',
                      fontSize: '12.5px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    }}
                  >
                    🔄 Recargar Opiniones
                  </button>
                </div>
              </div>

              {/* Tarjetas KPI de Calificaciones: Blancas con Texto Negro y en Negrilla */}
              <div className="row g-3 mt-3">
                <div className="col-6 col-md-3">
                  <div
                    className="p-3 rounded-3 text-center h-100"
                    style={{
                      background: '#ffffff',
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
                    }}
                  >
                    <div style={{ color: '#000000', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      PROMEDIO GENERAL
                    </div>
                    <div className="d-flex align-items-center justify-content-center gap-1 my-1">
                      <span style={{ fontSize: '28px', fontWeight: 900, color: '#000000' }}>
                        {feedbackMetrics.average}
                      </span>
                      <span style={{ fontSize: '14px', color: '#000000', fontWeight: 900 }}>/ 5.0</span>
                    </div>
                    <div style={{ color: '#eab308', fontSize: '15px', fontWeight: 900 }}>
                      {'★'.repeat(Math.round(Number(feedbackMetrics.average || 5)))}
                      {'☆'.repeat(5 - Math.round(Number(feedbackMetrics.average || 5)))}
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div
                    className="p-3 rounded-3 text-center h-100"
                    style={{
                      background: '#ffffff',
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
                    }}
                  >
                    <div style={{ color: '#000000', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      TOTAL CALIFICACIONES
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#000000', margin: '4px 0' }}>
                      {feedbackMetrics.total}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#000000', fontWeight: 800 }}>
                      Clientes que han evaluado
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div
                    className="p-3 rounded-3 text-center h-100"
                    style={{
                      background: '#ffffff',
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
                    }}
                  >
                    <div style={{ color: '#000000', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      CLIENTES FELICES (4★ Y 5★)
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#000000', margin: '4px 0' }}>
                      {feedbackMetrics.total > 0
                        ? `${Math.round(((feedbackMetrics.stars[5] + feedbackMetrics.stars[4]) / feedbackMetrics.total) * 100)}%`
                        : '100%'}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#000000', fontWeight: 800 }}>
                      {(feedbackMetrics.stars[5] || 0) + (feedbackMetrics.stars[4] || 0)} opiniones positivas
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div
                    className="p-3 rounded-3 text-center h-100"
                    style={{
                      background: '#ffffff',
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
                    }}
                  >
                    <div style={{ color: '#000000', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      COSAS A MEJORAR
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#000000', margin: '4px 0' }}>
                      {customerFeedbacks.filter((f) => f.improvements && f.improvements.trim().length > 0).length}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#000000', fontWeight: 800 }}>
                      Sugerencias reportadas
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div
              className="p-3 rounded-4 d-flex flex-wrap align-items-center justify-content-between gap-3"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}
            >
              {/* Chips de filtro por estrellas */}
              <div className="d-flex flex-wrap align-items-center gap-1.5">
                <button
                  onClick={() => setFeedbackRatingFilter('all')}
                  className="btn btn-sm fw-bold"
                  style={{
                    background: feedbackRatingFilter === 'all' ? '#141414' : 'transparent',
                    color: feedbackRatingFilter === 'all' ? '#ffffff' : 'var(--text-main)',
                    border: feedbackRatingFilter === 'all' ? '1px solid rgba(255,255,255,0.3)' : '1px solid var(--border-main)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    padding: '6px 12px',
                  }}
                >
                  Todas ({feedbackMetrics.total})
                </button>
                {[5, 4, 3, 2, 1].map((stars) => (
                  <button
                    key={stars}
                    onClick={() => setFeedbackRatingFilter(stars)}
                    className="btn btn-sm fw-bold"
                    style={{
                      background: feedbackRatingFilter === stars ? '#eab308' : 'transparent',
                      color: feedbackRatingFilter === stars ? '#000000' : 'var(--text-main)',
                      border: feedbackRatingFilter === stars ? '1px solid #ca8a04' : '1px solid var(--border-main)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      padding: '6px 12px',
                    }}
                  >
                    {stars} ★ ({feedbackMetrics.stars[stars] || 0})
                  </button>
                ))}
              </div>

              {/* Input buscador */}
              <div style={{ minWidth: '260px', maxWidth: '380px', flex: 1 }}>
                <div className="position-relative">
                  <input
                    type="text"
                    className="form-control form-control-sm ps-4"
                    placeholder="Buscar por cliente, teléfono, comanda..."
                    value={feedbackSearch}
                    onChange={(e) => setFeedbackSearch(e.target.value)}
                    style={{
                      background: 'var(--input-bg)',
                      color: 'var(--text-main)',
                      borderColor: 'var(--border-main)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <div
                    className="position-absolute top-50 start-0 translate-middle-y ps-2"
                    style={{ pointerEvents: 'none', color: 'var(--text-muted)' }}
                  >
                    <IconSearch size={13} />
                  </div>
                  {feedbackSearch && (
                    <button
                      onClick={() => setFeedbackSearch('')}
                      className="btn btn-sm position-absolute top-50 end-0 translate-middle-y pe-2 border-0 bg-transparent"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <IconX size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Listado de Opiniones de Clientes */}
            {filteredFeedbacks.length === 0 ? (
              <div
                className="p-5 rounded-4 text-center"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px dashed var(--border-main)',
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>⭐</div>
                <h4 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', marginBottom: '6px' }}>
                  {customerFeedbacks.length === 0
                    ? 'Aún no hay opiniones registradas'
                    : 'No se encontraron opiniones con el filtro actual'}
                </h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '520px', margin: '0 auto' }}>
                  {customerFeedbacks.length === 0
                    ? 'Cuando los clientes reciban o sigan su comanda desde el enlace de WhatsApp y califiquen el servicio, sus calificaciones, comentarios y sugerencias de mejora aparecerán aquí automáticamente en tiempo real.'
                    : 'Intenta cambiar el filtro de estrellas o limpiar el campo de búsqueda.'}
                </p>
              </div>
            ) : (
              <div className="row g-3">
                {filteredFeedbacks.map((fb) => {
                  const dateFormatted = new Date(fb.timestamp || fb.createdAt || Date.now()).toLocaleString('es-CO', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  const cleanPhone = (fb.customerPhone || '').replace(/\D/g, '');
                  const waReplyUrl = cleanPhone
                    ? `https://wa.me/${cleanPhone.startsWith('57') ? cleanPhone : '57' + cleanPhone}?text=${encodeURIComponent(
                        `Hola ${fb.customerName || 'estimado cliente'}, recibimos tu opinión en Tronos Burger sobre la comanda #${fb.orderId || ''}. ¡Muchas gracias por tu tiempo!`
                      )}`
                    : null;

                  return (
                    <div key={fb.id} className="col-12 col-lg-6">
                      <div
                        className="p-4 rounded-4 h-100 d-flex flex-column justify-content-between"
                        style={{
                          background: 'var(--bg-card)',
                          border: fb.improvements ? '1.5px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-main)',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                          position: 'relative',
                        }}
                      >
                        <div>
                          {/* Encabezado: Cliente y Comanda */}
                          <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                            <div>
                              <div className="d-flex align-items-center gap-2">
                                <div
                                  style={{
                                    width: '34px',
                                    height: '34px',
                                    borderRadius: '50%',
                                    background: '#141414',
                                    color: '#eab308',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 900,
                                    fontSize: '14px',
                                    border: '1px solid rgba(234, 179, 8, 0.3)',
                                  }}
                                >
                                  {fb.customerName ? fb.customerName.charAt(0).toUpperCase() : 'C'}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 900, fontSize: '15px', color: 'var(--text-main)' }}>
                                    {fb.customerName || 'Cliente Anónimo'}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {dateFormatted}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="d-flex align-items-center gap-2">
                              {fb.orderId && (
                                <Link
                                  href={`/pedido/${fb.orderId}`}
                                  target="_blank"
                                  className="badge text-decoration-none"
                                  style={{
                                    background: 'rgba(234, 179, 8, 0.15)',
                                    color: '#ca8a04',
                                    border: '1px solid rgba(234, 179, 8, 0.35)',
                                    fontSize: '11.5px',
                                    fontWeight: 800,
                                    padding: '5px 10px',
                                    borderRadius: '8px',
                                  }}
                                  title="Ver seguimiento en vivo del pedido"
                                >
                                  #{fb.orderId} ↗
                                </Link>
                              )}
                              <button
                                onClick={() => handleDeleteFeedback(fb.id)}
                                className="btn btn-sm text-danger p-1"
                                style={{ background: 'transparent', border: 'none' }}
                                title="Eliminar opinión"
                              >
                                <IconTrash size={15} />
                              </button>
                            </div>
                          </div>

                          {/* Calificación en Estrellas */}
                          <div
                            className="p-2.5 rounded-3 mb-3 d-flex align-items-center justify-content-between"
                            style={{
                              background: 'var(--bg-sub)',
                              border: '1px solid var(--border-main)',
                            }}
                          >
                            <div className="d-flex align-items-center gap-1">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <span
                                  key={s}
                                  style={{
                                    fontSize: '20px',
                                    color: s <= (fb.rating || 5) ? '#eab308' : '#cbd5e1',
                                    lineHeight: 1,
                                  }}
                                >
                                  ★
                                </span>
                              ))}
                              <span style={{ fontWeight: 900, fontSize: '14px', color: '#eab308', marginLeft: '6px' }}>
                                {fb.rating} / 5
                              </span>
                            </div>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                color: fb.rating >= 4 ? '#22c55e' : fb.rating === 3 ? '#f59e0b' : '#ef4444',
                                textTransform: 'uppercase',
                              }}
                            >
                              {fb.rating === 5 && '🌟 ¡Excelente!'}
                              {fb.rating === 4 && '👍 Muy Bueno'}
                              {fb.rating === 3 && '😐 Regular'}
                              {fb.rating === 2 && '👎 Insatisfecho'}
                              {fb.rating === 1 && '⚠️ Mala Experiencia'}
                            </span>
                          </div>

                          {/* Comentario General del Cliente */}
                          {fb.comment && fb.comment.trim() ? (
                            <div className="mb-3">
                              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                                💬 Comentario sobre el pedido:
                              </div>
                              <div
                                className="p-3 rounded-3"
                                style={{
                                  background: 'var(--bg-sub)',
                                  border: '1px solid var(--border-main)',
                                  fontSize: '13px',
                                  color: 'var(--text-main)',
                                  lineHeight: 1.5,
                                  fontStyle: 'italic',
                                }}
                              >
                                &ldquo;{fb.comment}&rdquo;
                              </div>
                            </div>
                          ) : null}

                          {/* Cosas a Mejorar (SECCIÓN DESTACADA PARA EL ADMIN) */}
                          {fb.improvements && fb.improvements.trim() ? (
                            <div className="mb-3">
                              <div style={{ fontSize: '11px', fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
                                💡 Cosas a mejorar señaladas por el cliente:
                              </div>
                              <div
                                className="p-3 rounded-3"
                                style={{
                                  background: 'rgba(245, 158, 11, 0.1)',
                                  border: '1.5px solid rgba(245, 158, 11, 0.45)',
                                  fontSize: '13px',
                                  color: 'var(--text-main)',
                                  lineHeight: 1.5,
                                  fontWeight: 600,
                                }}
                              >
                                &ldquo;{fb.improvements}&rdquo;
                              </div>
                            </div>
                          ) : (
                            <div
                              className="mb-3 p-2 rounded-3 text-center"
                              style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)', fontSize: '11.5px', color: '#22c55e', fontWeight: 700 }}
                            >
                              ✓ El cliente no reportó aspectos a mejorar (quedó plenamente satisfecho)
                            </div>
                          )}

                          {/* Datos de Entrega / Contacto */}
                          <div
                            className="p-2.5 rounded-3 d-flex flex-wrap justify-content-between align-items-center gap-2"
                            style={{ background: 'var(--bg-sub)', fontSize: '12px' }}
                          >
                            <div className="d-flex align-items-center gap-2">
                              <IconPhone size={13} style={{ color: 'var(--text-muted)' }} />
                              <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                                {fb.customerPhone || 'Sin teléfono'}
                              </span>
                            </div>
                            {fb.customerAddress && (
                              <div className="d-flex align-items-center gap-1" style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>
                                <IconMapPin size={12} />
                                <span className="text-truncate" style={{ maxWidth: '200px' }}>
                                  {fb.customerAddress}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Botón de acción: Responder por WhatsApp */}
                        {waReplyUrl && (
                          <div className="mt-3 pt-3 border-top" style={{ borderColor: 'var(--border-main)' }}>
                            <a
                              href={waReplyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm w-100 d-flex align-items-center justify-content-center gap-2 fw-bold"
                              style={{
                                background: '#128c7e',
                                color: '#ffffff',
                                borderRadius: '10px',
                                padding: '8px 12px',
                                fontSize: '12.5px',
                                textDecoration: 'none',
                              }}
                            >
                              <span>💬 Contactar o agradecer al cliente por WhatsApp</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════════
          ÁREA DE IMPRESIÓN FÍSICA PARA PAPEL TÉRMICO POS (58mm/80mm)
          GENERA 2 COPIAS FÍSICAS IDÉNTICAS
      ════════════════════════════════════════════════════════════════ */}
      {printingOrder && (
        <div className="pos-thermal-print">
          {/* ── HOJA 1: COPIA 1 - CLIENTE ── */}
          <div className="ticket-page">
            <div className="ticket-copy-box">
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '18px', lineHeight: 1 }}>👑</div>
                <div style={{ fontSize: '19px', fontWeight: 900, letterSpacing: '3px', textTransform: 'uppercase', color: '#000000', margin: '2px 0 0 0' }}>
                  TRONOS
                </div>
                <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#000000' }}>
                  PUB & GRILL
                </div>
                <div style={{ fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', color: '#333333', marginTop: '2px' }}>
                  Carnes • Hamburguesas • Parrilla Gourmet
                </div>
                <div style={{ fontSize: '8.5px', color: '#555555', marginTop: '2px' }}>
                  Tel / WhatsApp: {restaurantConfig?.whatsapp || '300 770 8616'}
                </div>
              </div>

              <div style={{ borderTop: '1.5px solid #000000', borderBottom: '1px solid #000000', padding: '4px 0', margin: '6px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>
                <span>*** COPIA 1 - CLIENTE ***</span>
                <span>ORDEN #{printingOrder.id}</span>
              </div>

              <div style={{ border: '1px solid #000000', padding: '6px 8px', margin: '6px 0 8px 0', fontSize: '9.5px', lineHeight: '1.45', background: '#ffffff' }}>
                <div><strong>FECHA:</strong> {new Date(printingOrder.date || Date.now()).toLocaleString('es-CO')}</div>
                <div><strong>CLIENTE:</strong> {printingOrder.customer?.nombre || 'Consumidor Final'}</div>
                <div><strong>TEL:</strong> {printingOrder.customer?.telefono || 'N/A'}</div>
                <div><strong>DIR:</strong> {printingOrder.customer?.direccion || 'En local'}</div>
                {printingOrder.customer?.descripcion && (
                  <div><strong>REF:</strong> {printingOrder.customer.descripcion}</div>
                )}
              </div>

              <div style={{ borderBottom: '1.5px solid #000000', paddingBottom: '3px', marginBottom: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '9.5px', letterSpacing: '0.5px' }}>
                  <span>CANT / DESCRIPCIÓN</span>
                  <span>IMPORTE</span>
                </div>
              </div>

              <div style={{ marginBottom: '6px' }}>
                {(printingOrder.items || []).map((item, i) => (
                  <div key={i} style={{ padding: '3px 0', borderBottom: '1px dashed #cccccc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                      <span style={{ fontWeight: 900 }}>{item.quantity || 1}x {item.name.toUpperCase()}</span>
                      <span style={{ fontWeight: 900 }}>{formatPrice((item.price || 0) * (item.quantity || 1))}</span>
                    </div>
                    {(item.selectedExtras || []).map((ex, eI) => (
                      <div key={eI} style={{ fontSize: '9.5px', paddingLeft: '10px', color: '#333333' }}>
                        + {ex.name} x{ex.quantity || 1}
                      </div>
                    ))}
                    {(item.removedIngredients || []).length > 0 && (
                      <div style={{ fontSize: '9px', paddingLeft: '10px', fontWeight: 800, color: '#000000' }}>
                        [SIN: {item.removedIngredients.join(', ').toUpperCase()}]
                      </div>
                    )}
                    {item.note && (
                      <div style={{ fontSize: '9px', paddingLeft: '10px', fontStyle: 'italic', color: '#444444' }}>
                        * Nota: {item.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Total Invertido en Negro Sólido */}
              <div style={{ background: '#000000', color: '#ffffff', padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '1px' }}>TOTAL A PAGAR:</span>
                <span style={{ fontSize: '15px', fontWeight: 900 }}>{formatPrice(printingOrder.total || 0)}</span>
              </div>

              {/* Código de barras vector para ticket */}
              <div style={{ marginTop: '8px', textAlign: 'center' }}>
                <svg width="150" height="30" viewBox="0 0 150 30" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block' }}>
                  <rect width="150" height="30" fill="#ffffff" />
                  <g fill="#000000">
                    <rect x="10" y="2" width="2" height="20"/>
                    <rect x="14" y="2" width="1" height="20"/>
                    <rect x="17" y="2" width="3" height="20"/>
                    <rect x="23" y="2" width="1" height="20"/>
                    <rect x="26" y="2" width="2" height="20"/>
                    <rect x="31" y="2" width="1" height="20"/>
                    <rect x="35" y="2" width="3" height="20"/>
                    <rect x="41" y="2" width="1" height="20"/>
                    <rect x="44" y="2" width="2" height="20"/>
                    <rect x="48" y="2" width="3" height="20"/>
                    <rect x="54" y="2" width="1" height="20"/>
                    <rect x="58" y="2" width="2" height="20"/>
                    <rect x="63" y="2" width="1" height="20"/>
                    <rect x="66" y="2" width="3" height="20"/>
                    <rect x="72" y="2" width="2" height="20"/>
                    <rect x="76" y="2" width="1" height="20"/>
                    <rect x="80" y="2" width="3" height="20"/>
                    <rect x="86" y="2" width="1" height="20"/>
                    <rect x="90" y="2" width="2" height="20"/>
                    <rect x="94" y="2" width="3" height="20"/>
                    <rect x="100" y="2" width="1" height="20"/>
                    <rect x="104" y="2" width="2" height="20"/>
                    <rect x="108" y="2" width="3" height="20"/>
                    <rect x="114" y="2" width="1" height="20"/>
                    <rect x="118" y="2" width="2" height="20"/>
                    <rect x="122" y="2" width="3" height="20"/>
                    <rect x="128" y="2" width="1" height="20"/>
                    <rect x="132" y="2" width="2" height="20"/>
                    <rect x="136" y="2" width="1" height="20"/>
                  </g>
                  <text x="75" y="28" font-family="'Courier New', monospace" font-size="7" text-anchor="middle" fill="#000000" letter-spacing="2">* {printingOrder.id} *</text>
                </svg>
              </div>

              <div style={{ textAlign: 'center', fontSize: '8.5px', marginTop: '6px', color: '#333333', letterSpacing: '0.5px' }}>
                <div>¡GRACIAS POR SU COMPRA!</div>
                <div>TRONOS PUB & GRILL • DOCUMENTO POS</div>
              </div>
            </div>
          </div>

          {/* ── SALTO DE PÁGINA PARA SEPARAR COPIAS EN HOJAS INDIVIDUALES ── */}
          <div className="page-break" style={{ pageBreakAfter: 'always', breakAfter: 'page', height: 0, margin: 0, padding: 0 }}></div>

          {/* ── HOJA 2: COPIA 2 - COMERCIO / COCINA ── */}
          <div className="ticket-page">
            <div className="ticket-copy-box">
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '18px', lineHeight: 1 }}>👑</div>
              <div style={{ fontSize: '19px', fontWeight: 900, letterSpacing: '3px', textTransform: 'uppercase', color: '#000000', margin: '2px 0 0 0' }}>
                TRONOS
              </div>
              <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: '#000000' }}>
                PUB & GRILL
              </div>
              <div style={{ fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', color: '#333333', marginTop: '2px' }}>
                Carnes • Hamburguesas • Parrilla Gourmet
              </div>
              <div style={{ fontSize: '8.5px', color: '#555555', marginTop: '2px' }}>
                Tel / WhatsApp: {restaurantConfig?.whatsapp || '300 770 8616'}
              </div>
            </div>

            <div style={{ borderTop: '1.5px solid #000000', borderBottom: '1px solid #000000', padding: '4px 0', margin: '6px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>
              <span>*** COPIA 2 - COMERCIO / COCINA ***</span>
              <span>ORDEN #{printingOrder.id}</span>
            </div>

            <div style={{ border: '1px solid #000000', padding: '6px 8px', margin: '6px 0 8px 0', fontSize: '9.5px', lineHeight: '1.45', background: '#ffffff' }}>
              <div><strong>FECHA:</strong> {new Date(printingOrder.date || Date.now()).toLocaleString('es-CO')}</div>
              <div><strong>CLIENTE:</strong> {printingOrder.customer?.nombre || 'Consumidor Final'}</div>
              <div><strong>TEL:</strong> {printingOrder.customer?.telefono || 'N/A'}</div>
              <div><strong>DIR:</strong> {printingOrder.customer?.direccion || 'En local'}</div>
              {printingOrder.customer?.descripcion && (
                <div><strong>REF:</strong> {printingOrder.customer.descripcion}</div>
              )}
            </div>

            <div style={{ borderBottom: '1.5px solid #000000', paddingBottom: '3px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '9.5px', letterSpacing: '0.5px' }}>
                <span>CANT / DESCRIPCIÓN</span>
                <span>IMPORTE</span>
              </div>
            </div>

            <div style={{ marginBottom: '6px' }}>
              {(printingOrder.items || []).map((item, i) => (
                <div key={i} style={{ padding: '3px 0', borderBottom: '1px dashed #cccccc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ fontWeight: 900 }}>{item.quantity || 1}x {item.name.toUpperCase()}</span>
                    <span style={{ fontWeight: 900 }}>{formatPrice((item.price || 0) * (item.quantity || 1))}</span>
                  </div>
                  {(item.selectedExtras || []).map((ex, eI) => (
                    <div key={eI} style={{ fontSize: '9.5px', paddingLeft: '10px', color: '#333333' }}>
                      + {ex.name} x{ex.quantity || 1}
                    </div>
                  ))}
                  {(item.removedIngredients || []).length > 0 && (
                    <div style={{ fontSize: '9px', paddingLeft: '10px', fontWeight: 800, color: '#000000' }}>
                      [SIN: {item.removedIngredients.join(', ').toUpperCase()}]
                    </div>
                  )}
                  {item.note && (
                    <div style={{ fontSize: '9px', paddingLeft: '10px', fontStyle: 'italic', color: '#444444' }}>
                      * Nota: {item.note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total Invertido en Negro Sólido */}
            <div style={{ background: '#000000', color: '#ffffff', padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '1px' }}>TOTAL A PAGAR:</span>
              <span style={{ fontSize: '15px', fontWeight: 900 }}>{formatPrice(printingOrder.total || 0)}</span>
            </div>

            {/* Código de barras vector para ticket */}
            <div style={{ marginTop: '8px', textAlign: 'center' }}>
              <svg width="150" height="30" viewBox="0 0 150 30" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block' }}>
                <rect width="150" height="30" fill="#ffffff" />
                <g fill="#000000">
                  <rect x="10" y="2" width="2" height="20"/>
                  <rect x="14" y="2" width="1" height="20"/>
                  <rect x="17" y="2" width="3" height="20"/>
                  <rect x="23" y="2" width="1" height="20"/>
                  <rect x="26" y="2" width="2" height="20"/>
                  <rect x="31" y="2" width="1" height="20"/>
                  <rect x="35" y="2" width="3" height="20"/>
                  <rect x="41" y="2" width="1" height="20"/>
                  <rect x="44" y="2" width="2" height="20"/>
                  <rect x="48" y="2" width="3" height="20"/>
                  <rect x="54" y="2" width="1" height="20"/>
                  <rect x="58" y="2" width="2" height="20"/>
                  <rect x="63" y="2" width="1" height="20"/>
                  <rect x="66" y="2" width="3" height="20"/>
                  <rect x="72" y="2" width="2" height="20"/>
                  <rect x="76" y="2" width="1" height="20"/>
                  <rect x="80" y="2" width="3" height="20"/>
                  <rect x="86" y="2" width="1" height="20"/>
                  <rect x="90" y="2" width="2" height="20"/>
                  <rect x="94" y="2" width="3" height="20"/>
                  <rect x="100" y="2" width="1" height="20"/>
                  <rect x="104" y="2" width="2" height="20"/>
                  <rect x="108" y="2" width="3" height="20"/>
                  <rect x="114" y="2" width="1" height="20"/>
                  <rect x="118" y="2" width="2" height="20"/>
                  <rect x="122" y="2" width="3" height="20"/>
                  <rect x="128" y="2" width="1" height="20"/>
                  <rect x="132" y="2" width="2" height="20"/>
                  <rect x="136" y="2" width="1" height="20"/>
                </g>
                <text x="75" y="28" font-family="'Courier New', monospace" font-size="7" text-anchor="middle" fill="#000000" letter-spacing="2">* {printingOrder.id} *</text>
              </svg>
            </div>

            <div style={{ textAlign: 'center', fontSize: '8.5px', marginTop: '6px', color: '#333333', letterSpacing: '0.5px' }}>
              <div>¡GRACIAS POR SU COMPRA!</div>
              <div>TRONOS PUB & GRILL • DOCUMENTO POS</div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── MODAL: FACTURAS DESCARGADAS Y GENERADAS (ADMIN) ── */}
      {showInvoicesModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 1050,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowInvoicesModal(false);
          }}
        >
          <div
            className="rounded-4 shadow-2xl d-flex flex-column"
            style={{
              maxWidth: '960px',
              width: '100%',
              maxHeight: '90vh',
              background: '#ffffff',
              color: '#111111',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            {/* Header del Modal */}
            <div
              className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center"
              style={{
                background: '#f8fafc',
                borderColor: '#e2e8f0',
              }}
            >
              <div className="d-flex align-items-center gap-2.5">
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: '#15803d',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '19px',
                  }}
                >
                  📁
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <h5 className="m-0 fw-bold" style={{ fontSize: '16px' }}>
                      Historial General de Ventas y Facturas
                    </h5>
                    <span
                      style={{
                        background: '#dcfce7',
                        color: '#15803d',
                        border: '1px solid #bbf7d0',
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '1px 8px',
                        borderRadius: '12px',
                      }}
                    >
                      {invoicedOrders.length} {invoicedOrders.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                    Historial de todas las ventas y facturas organizadas por fecha (excluye pedidos eliminados)
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowInvoicesModal(false)}
                className="btn btn-sm d-flex align-items-center justify-content-center"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: '1px solid transparent',
                  color: '#64748b',
                }}
                title="Cerrar"
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Barra de Búsqueda y Selector de Carpeta */}
            <div
              className="p-3 border-bottom d-flex flex-wrap align-items-center justify-content-between gap-2"
              style={{
                background: '#ffffff',
                borderColor: '#e2e8f0',
              }}
            >
              <div className="position-relative" style={{ minWidth: '260px', flex: 1 }}>
                <IconSearch
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                  }}
                />
                <input
                  type="text"
                  value={invoiceSearchQuery}
                  onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                  placeholder="Buscar por #orden, cliente o teléfono..."
                  className="form-control form-control-sm ps-4"
                  style={{
                    paddingLeft: '34px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontSize: '12.5px',
                  }}
                />
              </div>

              {/* Conexión de Carpeta */}
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Carpeta PC: <strong>{posBackupFolderName || 'Descargas predeterminadas'}</strong>
                </span>
                <button
                  onClick={handleSelectFolder}
                  className="btn btn-sm"
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    padding: '4px 10px',
                  }}
                >
                  Cambiar Carpeta
                </button>
              </div>
            </div>

            {/* Cuerpo / Listado de Facturas */}
            <div className="p-3 overflow-auto" style={{ maxHeight: 'calc(90vh - 160px)' }}>
              {filteredInvoicedOrders.length === 0 ? (
                <div className="text-center py-5">
                  <div style={{ fontSize: '42px', marginBottom: '8px' }}>🧾</div>
                  <h6 className="fw-bold mb-1">
                    {invoicedOrders.length === 0
                      ? 'Aún no hay facturas generadas'
                      : 'No se encontraron facturas con ese criterio'}
                  </h6>
                  <p style={{ fontSize: '12px', color: '#64748b', maxWidth: '420px', margin: '0 auto' }}>
                    {invoicedOrders.length === 0
                      ? 'Cuando pulses "Facturar (1 Copia PC + 2 Físicas)" en cualquier pedido, el documento .html digital y las copias térmicas quedarán respaldadas aquí.'
                      : 'Prueba buscando con otro término o borra el filtro de búsqueda.'}
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0" style={{ fontSize: '12.5px' }}>
                    <thead
                      style={{
                        background: 'rgba(0,0,0,0.03)',
                        color: '#475569',
                      }}
                    >
                      <tr>
                        <th style={{ padding: '8px 12px' }}>CÓDIGO</th>
                        <th style={{ padding: '8px 12px' }}>FECHA / HORA</th>
                        <th style={{ padding: '8px 12px' }}>CLIENTE</th>
                        <th style={{ padding: '8px 12px' }}>DETALLE</th>
                        <th style={{ padding: '8px 12px' }}>TOTAL</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoicedOrders.map((order) => {
                        const itemsSummary = (order.items || [])
                          .map((it) => `${it.quantity || 1}x ${it.name}`)
                          .join(', ');
                        const dateFormatted = new Date(order.invoicedAt || order.date || Date.now()).toLocaleString('es-CO', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <tr key={order.id}>
                            <td style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
                              <span
                                style={{
                                  background: '#0f172a',
                                  color: '#ffffff',
                                  padding: '2px 8px',
                                  borderRadius: '5px',
                                  fontSize: '11.5px',
                                }}
                              >
                                #{order.id}
                              </span>
                            </td>
                            <td style={{ color: '#64748b', whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                              {dateFormatted}
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>
                                {order.customer?.nombre || 'Consumidor Final'}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                📞 {order.customer?.telefono || 'N/A'} • 📍 {order.customer?.direccion || 'Local'}
                              </div>
                            </td>
                            <td style={{ maxWidth: '240px' }}>
                              <div
                                style={{
                                  fontSize: '11.5px',
                                  color: '#475569',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={itemsSummary}
                              >
                                {itemsSummary}
                              </div>
                            </td>
                            <td style={{ fontWeight: 900, color: '#16a34a', whiteSpace: 'nowrap' }}>
                              {formatPrice(order.total || 0)}
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div className="d-flex align-items-center justify-content-end gap-1.5">
                                {/* Ver Factura */}
                                <button
                                  onClick={() => setPreviewInvoiceOrder(order)}
                                  className="btn btn-sm d-inline-flex align-items-center gap-1"
                                  style={{
                                    background: '#eff6ff',
                                    color: '#1d4ed8',
                                    border: '1px solid #bfdbfe',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                  }}
                                  title="Ver factura electrónica"
                                >
                                  <span>👁️ Ver</span>
                                </button>

                                {/* Descargar HTML */}
                                <button
                                  onClick={() => saveElectronicInvoice(order)}
                                  className="btn btn-sm d-inline-flex align-items-center gap-1"
                                  style={{
                                    background: '#ecfdf5',
                                    color: '#047857',
                                    border: '1px solid #a7f3d0',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                  }}
                                  title="Descargar factura en .html"
                                >
                                  <span>📥 Descargar</span>
                                </button>

                                {/* Re-imprimir 2 Copias Térmicas */}
                                <button
                                  onClick={() => handleReprintReceipt(order)}
                                  className="btn btn-sm d-inline-flex align-items-center gap-1"
                                  style={{
                                    background: '#f8fafc',
                                    color: '#334155',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                  }}
                                  title="Reimprimir 2 tickets térmicos sin hoja en blanco"
                                >
                                  <span>🖨️ Imprimir</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer del Modal */}
            <div
              className="p-3 border-top d-flex justify-content-between align-items-center"
              style={{
                background: '#f8fafc',
                borderColor: '#e2e8f0',
              }}
            >
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                Total facturado: <strong>{formatPrice(filteredInvoicedOrders.reduce((acc, o) => acc + (o.total || 0), 0))}</strong>
              </div>
              <button
                onClick={() => setShowInvoicesModal(false)}
                className="btn btn-sm px-4 fw-bold"
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              >
                Cerrar
              </button>
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

      {/* ── MODAL DE CONFIRMACIÓN DE BORRADO Y RESPALDO PDF ── */}
      {showResetConfirmModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 1100,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isGeneratingPdf) setShowResetConfirmModal(false);
          }}
        >
          <div
            className="p-4 p-md-5 rounded-4 shadow-2xl text-center pos-sunken-card"
            style={{
              maxWidth: '520px',
              width: '100%',
              background: '#ffffff',
              border: '2px solid #ef4444',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
            <h4 style={{ fontSize: '20px', fontWeight: 900, color: '#dc2626', marginBottom: '10px' }}>
              ¿Confirmar borrado de datos del panel?
            </h4>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, marginBottom: '20px' }}>
              Esta acción limpiará todo el panel dejando las ventas, comandas y estadísticas en <strong>CERO (0)</strong> como nuevo para empezar un nuevo ciclo de pedidos.
            </p>
            <div className="p-3 mb-4 rounded-3 text-start" style={{ background: '#fff1f2', border: '1px solid #fecdd3', fontSize: '12px', color: '#9f1239' }}>
              <strong>📌 Respaldo Automático Incluido:</strong><br />
              Antes de borrar nada, se generará y descargará automáticamente un <strong>Reporte PDF Completo (multihoja)</strong> con toda la información acumulada de todas las secciones: facturas emitidas, desglose de ventas, inventario, directorio de clientes, opiniones y configuración.
            </div>

            <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center">
              <button
                onClick={handleResetAllData}
                disabled={isGeneratingPdf}
                className="btn py-2.5 px-4 fw-bold d-flex align-items-center justify-content-center gap-2"
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
                }}
              >
                <span>{isGeneratingPdf ? '⏳ Generando Respaldo...' : '🗑️ Sí, Descargar PDF y Borrar a Cero'}</span>
              </button>
              <button
                onClick={() => setShowResetConfirmModal(false)}
                disabled={isGeneratingPdf}
                className="btn py-2.5 px-4 fw-bold"
                style={{
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PERSONALIZAR PEDIDO (AGREGAR ADICIÓN CON PRECIO MANUAL) ── */}
      {customizingOrder && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1100,
          }}
        >
          <div
            className="bg-white rounded-4 shadow-lg border overflow-hidden d-flex flex-column"
            style={{
              maxWidth: '520px',
              width: '100%',
              maxHeight: '92vh',
              borderColor: '#e2e8f0',
            }}
          >
            {/* Header del Modal */}
            <div
              className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center"
              style={{ background: '#0f172a', color: '#ffffff' }}
            >
              <div>
                <div className="d-flex align-items-center gap-2">
                  <span style={{ fontSize: '18px' }}>🛠️</span>
                  <h5 className="m-0 fw-bold" style={{ fontSize: '15px', color: '#ffffff' }}>
                    Personalizar Pedido #{customizingOrder.id}
                  </h5>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Cliente: <strong>{customizingOrder.customer?.nombre || 'Consumidor'}</strong> • Estado: {customizingOrder.status === 'en_cocina' ? '👨‍🍳 En Cocina' : '⏳ Pendiente'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingOrder(null)}
                className="btn-close btn-close-white"
                aria-label="Close"
              />
            </div>

            {/* Body del Modal */}
            <div className="p-4 overflow-auto flex-grow-1" style={{ fontSize: '13px' }}>
              {/* Ítems actuales del pedido */}
              <div className="mb-3 p-2.5 rounded-3 border" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
                <div className="d-flex justify-content-between align-items-center mb-1.5 pb-1 border-bottom">
                  <span className="fw-bold" style={{ fontSize: '11.5px', color: '#334155' }}>
                    📋 Ítems Actuales en Cocina:
                  </span>
                  <span className="fw-bold" style={{ fontSize: '11.5px', color: '#166534' }}>
                    Subtotal: {formatPrice(customizingOrder.subtotal || 0)}
                  </span>
                </div>
                <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                  {(customizingOrder.items || []).map((it, idx) => (
                    <div key={idx} className="d-flex justify-content-between align-items-center py-0.5" style={{ fontSize: '11px' }}>
                      <span className="text-truncate" style={{ maxWidth: '280px' }}>
                        {it.quantity || 1}x {it.name}
                      </span>
                      <span className="fw-bold">
                        {formatPrice((it.price || 0) * (it.quantity || 1))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formulario de Adición Personalizada con Precio Manual */}
              <div className="p-3 rounded-3 border mb-3" style={{ background: '#ffffff', borderColor: '#93c5fd', boxShadow: '0 2px 6px rgba(59,130,246,0.08)' }}>
                <div className="d-flex align-items-center gap-1.5 mb-2">
                  <span style={{ fontSize: '14px' }}>➕</span>
                  <span className="fw-bold" style={{ fontSize: '12.5px', color: '#1d4ed8' }}>
                    Nueva Adición Personalizada (Precio Manual):
                  </span>
                </div>

                <div className="mb-2">
                  <label className="form-label fw-bold mb-1" style={{ fontSize: '11px', color: '#334155' }}>
                    Nombre de la Adición o Producto: *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Porción de papas francesa, Gaseosa 400ml, Doble carne..."
                    value={customAddName}
                    onChange={(e) => setCustomAddName(e.target.value)}
                    className="form-control form-control-sm"
                    style={{ fontSize: '12px', borderRadius: '6px' }}
                    autoFocus
                  />
                </div>

                <div className="row g-2 mb-2">
                  <div className="col-7">
                    <label className="form-label fw-bold mb-1" style={{ fontSize: '11px', color: '#334155' }}>
                      Precio Manual ($ COP): *
                    </label>
                    <input
                      type="number"
                      placeholder="Ej: 5000"
                      value={customAddPrice}
                      onChange={(e) => setCustomAddPrice(e.target.value)}
                      className="form-control form-control-sm"
                      style={{ fontSize: '12px', borderRadius: '6px' }}
                      min="0"
                      step="500"
                    />
                  </div>
                  <div className="col-5">
                    <label className="form-label fw-bold mb-1" style={{ fontSize: '11px', color: '#334155' }}>
                      Cantidad:
                    </label>
                    <div className="d-flex align-items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCustomAddQty((q) => Math.max(1, q - 1))}
                        className="btn btn-sm btn-light border py-0 px-2 fw-bold"
                        style={{ height: '31px' }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={customAddQty}
                        onChange={(e) => setCustomAddQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="form-control form-control-sm text-center py-0"
                        style={{ height: '31px', fontSize: '12px' }}
                        min="1"
                      />
                      <button
                        type="button"
                        onClick={() => setCustomAddQty((q) => q + 1)}
                        className="btn btn-sm btn-light border py-0 px-2 fw-bold"
                        style={{ height: '31px' }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mb-2">
                  <label className="form-label fw-bold mb-1" style={{ fontSize: '11px', color: '#334155' }}>
                    Nota para Cocina (Opcional):
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Bien crocantes, sin hielo, salsa aparte..."
                    value={customAddNote}
                    onChange={(e) => setCustomAddNote(e.target.value)}
                    className="form-control form-control-sm"
                    style={{ fontSize: '11.5px', borderRadius: '6px' }}
                  />
                </div>

                {/* Sugerencias Rápidas de la Carta */}
                <div className="mt-2 pt-2 border-top">
                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748b' }}>
                    💡 Sugerencias Rápidas (1 clic para rellenar):
                  </span>
                  <div className="d-flex gap-1 flex-wrap mt-1">
                    {[
                      { name: 'Papas Francesas', price: 6000 },
                      { name: 'Gaseosa 400ml', price: 4000 },
                      { name: 'Tocineta Extra', price: 4000 },
                      { name: 'Queso Extra', price: 3000 },
                      { name: 'Carne Extra 150g', price: 8000 },
                      { name: 'Cerveza Club Colombia', price: 6000 },
                    ].map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => {
                          setCustomAddName(sug.name);
                          setCustomAddPrice(String(sug.price));
                        }}
                        className="btn btn-sm btn-light border py-0 px-2"
                        style={{ fontSize: '10px', borderRadius: '12px' }}
                      >
                        {sug.name} (${sug.price.toLocaleString('es-CO')})
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Resumen del Nuevo Total */}
              <div className="p-3 rounded-3 border d-flex justify-content-between align-items-center" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534' }}>
                    NUEVO TOTAL DE LA COMANDA:
                  </div>
                  <div style={{ fontSize: '10px', color: '#4b5563' }}>
                    Incluye subtotal anterior + adición ({formatPrice((parseInt(customAddPrice, 10) || 0) * (customAddQty || 1))})
                  </div>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#15803d' }}>
                  {formatPrice((customizingOrder.total || 0) + ((parseInt(customAddPrice, 10) || 0) * (customAddQty || 1)))}
                </div>
              </div>
            </div>

            {/* Footer de Acciones */}
            <div className="p-3 border-top d-flex flex-column gap-2" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
              <button
                type="button"
                onClick={() => handleSaveCustomAddition(true)}
                disabled={!customAddName.trim() || !customAddPrice || isSavingCustomAdd}
                className="btn btn-dark fw-bold py-2 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                style={{ background: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '12.5px' }}
              >
                <IconPrinter size={15} />
                <span>Guardar y Actualizar Factura (Reimprimir 3 Copias)</span>
              </button>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveCustomAddition(false)}
                  disabled={!customAddName.trim() || !customAddPrice || isSavingCustomAdd}
                  className="btn btn-primary fw-bold flex-grow-1 py-1.5"
                  style={{ background: '#7c3aed', borderColor: '#7c3aed', borderRadius: '8px', fontSize: '12px' }}
                >
                  <span>👨‍🍳 Guardar Adición en Cocina (Sin Imprimir)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCustomizingOrder(null)}
                  className="btn btn-outline-secondary py-1.5 px-3"
                  style={{ borderRadius: '8px', fontSize: '12px' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
