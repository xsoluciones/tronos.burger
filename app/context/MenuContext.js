'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { defaultMenuData } from '../data/menuData';
import { supabase } from '../lib/supabaseClient';

const MenuContext = createContext(undefined);

const STORAGE_KEY_MENU = 'tronos-menu';
const STORAGE_KEY_AUTH = 'tronos-admin-auth';
const STORAGE_KEY_AUTH_ROLE = 'tronos-auth-role';
const STORAGE_KEY_CONFIG = 'tronos-config';
const STORAGE_KEY_ORDERS = 'tronos-orders';
const STORAGE_KEY_AUDIT_ORDERS = 'tronos-audit-backup';
const STORAGE_KEY_POS_FOLDER = 'tronos-pos-folder-name';

const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'Tronos2027*'
};

const CAJERO_CREDENTIALS = {
  username: 'caja',
  password: 'caja2026+1'
};

const defaultDemoOrders = [
  {
    id: 'TRN-1001',
    date: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    customer: {
      nombre: 'Carlos Pérez',
      telefono: '3104567890',
      direccion: 'Calle 45 # 12-34 Apto 302',
      descripcion: 'Edificio Los Pinos, timbre 302'
    },
    items: [
      {
        id: 'tronos-clasica',
        name: 'Tronos Clásica',
        price: 24000,
        quantity: 2,
        selectedExtras: [{ name: 'Tocineta Ahumada', price: 4000, quantity: 2 }],
        removedIngredients: ['Cebolla'],
        note: 'Carne término 3/4 por favor'
      },
      {
        id: 'papas-rusticas',
        name: 'Papas Rústicas Tronos',
        price: 9000,
        quantity: 1,
        selectedExtras: [],
        removedIngredients: [],
        note: 'Salsa tártara aparte'
      }
    ],
    total: 61000,
    status: 'pendiente',
    invoiced: false,
    auditFlag: 'registrado'
  }
];

export const cleanWhatsAppNumber = (phone) => {
  if (!phone) return '573007708616';
  let cleaned = String(phone).replace(/\D/g, '');
  // Si el usuario ingresó un celular colombiano de 10 dígitos (ej. 3007708616), anteponer el prefijo 57
  if (cleaned.length === 10 && cleaned.startsWith('3')) {
    cleaned = `57${cleaned}`;
  }
  return cleaned || '573007708616';
};

const defaultRestaurantConfig = {
  whatsapp: '573007708616',
  deliveryPrice: 4000,
  socials: [
    { id: 'soc-1', name: 'Instagram', url: 'https://instagram.com', icon: '📸' }
  ]
};

/**
 * Proveedor de contexto para el menú de Tronos Pub & Grill.
 * Gestiona las categorías, ítems, el carrito de compras y la autenticación.
 */
export function MenuProvider({ children }) {
  // ── Estado del menú (ahora un arreglo de categorías) ─────────────────
  const [menuCategories, setMenuCategories] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_MENU);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (e) {}
    }
    return defaultMenuData;
  });
  const [menuLoaded, setMenuLoaded] = useState(false);

  // Guardar categorías de menú en localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && menuCategories?.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY_MENU, JSON.stringify(menuCategories));
      } catch (e) {}
    }
  }, [menuCategories]);

  // ── Estado del carrito ───────────────────────────────────────────────
  const [cart, setCart] = useState([]);

  // ── Estado de Roles y Autenticación ──────────────────────────────────
  const [userRole, setUserRole] = useState(null); // 'admin' | 'cajero' | null
  const isAdmin = userRole === 'admin';
  const isCajero = userRole === 'cajero';

  // ── Configuración General (Cargada y respaldada en localStorage) ──────
  const [restaurantConfig, setRestaurantConfig] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            return {
              ...defaultRestaurantConfig,
              ...parsed,
              whatsapp: cleanWhatsAppNumber(parsed.whatsapp || defaultRestaurantConfig.whatsapp),
            };
          }
        }
      } catch (e) {}
    }
    return defaultRestaurantConfig;
  });

  // Guardar configuración automáticamente en localStorage ante cualquier cambio
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(restaurantConfig));
      } catch (e) {}
    }
  }, [restaurantConfig]);

  // ── Estado de ver más expandido (mutuamente excluyente) ──────────────
  const [expandedItemId, setExpandedItemId] = useState(null);

  // ── Estado de Pedidos / Comandas Activas ─────────────────────────────
  const [orders, setOrders] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_ORDERS);
        if (saved !== null) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  // ── Estado de Auditoría Central / Respaldo Maestro ───────────────────
  const [auditOrders, setAuditOrders] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_AUDIT_ORDERS);
        if (saved !== null) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  // Guardar pedidos activos en localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
      } catch (e) {}
    }
  }, [orders]);

  // Guardar pedidos de auditoría en localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(auditOrders));
      } catch (e) {}
    }
  }, [auditOrders]);

  // ── Sincronización en Tiempo Real entre Pestañas ────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY_ORDERS && e.newValue) {
        try {
          setOrders(JSON.parse(e.newValue));
        } catch (err) {}
      }
      if (e.key === STORAGE_KEY_MENU && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMenuCategories(parsed);
          }
        } catch (err) {}
      }
      if (e.key === STORAGE_KEY_AUDIT_ORDERS && e.newValue) {
        try {
          setAuditOrders(JSON.parse(e.newValue));
        } catch (err) {}
      }
      if (e.key === STORAGE_KEY_CONFIG && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            setRestaurantConfig(prev => ({
              ...prev,
              ...parsed,
              whatsapp: cleanWhatsAppNumber(parsed.whatsapp || prev.whatsapp),
            }));
          }
        } catch (err) {}
      }
    };

    window.addEventListener('storage', handleStorageChange);

    let channel = null;
    if ('BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('tronos_orders_channel');
        channel.onmessage = (event) => {
          const { type, data } = event.data || {};
          if (type === 'SYNC_MENU' && Array.isArray(data)) {
            setMenuCategories(data);
          }
          if (type === 'SYNC_ORDERS' && Array.isArray(data)) {
            setOrders(data);
          }
          if (type === 'SYNC_AUDIT' && Array.isArray(data)) {
            setAuditOrders(data);
          }
          if (type === 'SYNC_CONFIG' && data) {
            setRestaurantConfig(prev => ({
              ...prev,
              ...data,
              whatsapp: cleanWhatsAppNumber(data.whatsapp || prev.whatsapp),
            }));
          }
        };
      } catch (err) {}
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (channel) channel.close();
    };
  }, []);

  // ── Estado de carpeta de respaldo POS ────────────────────────────────
  const [posBackupFolderName, setPosBackupFolderName] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(STORAGE_KEY_POS_FOLDER) || '';
      } catch (e) {}
    }
    return '';
  });

  const updatePosBackupFolderName = useCallback((folderName) => {
    setPosBackupFolderName(folderName);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_POS_FOLDER, folderName);
      } catch (e) {}
    }
  }, []);

  // ── Guard para evitar sobreescrituras de cambios locales recientes ──
  const recentLocalUpdatesRef = useRef(new Map());
  const recentMenuUpdateRef = useRef(0);
  const deletedOrderIdsRef = useRef(new Set());

  // Smart merge que respeta la versión más reciente por updatedAt y respeta el guard de actualización local
  const smartMergeOrders = useCallback((currentList, incomingList, isAudit = false) => {
    if (!Array.isArray(incomingList)) return currentList;
    if (!Array.isArray(currentList) || currentList.length === 0) {
      if (isAudit) return incomingList.filter(o => !deletedOrderIdsRef.current.has(o?.id));
      return incomingList.filter(o => o && o.status !== 'anulado_admin' && !deletedOrderIdsRef.current.has(o.id));
    }

    const now = Date.now();
    const map = new Map();
    currentList.forEach((o) => {
      if (o && o.id) map.set(o.id, o);
    });

    let hasChanges = false;

    incomingList.forEach((incoming) => {
      if (!incoming || !incoming.id) return;

      // Descartar pedidos que fueron anulados o eliminados si estamos en la lista de activas
      if (!isAudit && (incoming.status === 'anulado_admin' || deletedOrderIdsRef.current.has(incoming.id))) {
        if (map.has(incoming.id)) {
          map.delete(incoming.id);
          hasChanges = true;
        }
        return;
      }

      // Si fue purgado por el Administrador, descartarlo de auditoría también
      if (isAudit && deletedOrderIdsRef.current.has(incoming.id)) {
        if (map.has(incoming.id)) {
          map.delete(incoming.id);
          hasChanges = true;
        }
        return;
      }

      const current = map.get(incoming.id);

      if (!current) {
        map.set(incoming.id, incoming);
        hasChanges = true;
        return;
      }

      // Si el pedido fue actualizado localmente en los últimos 30s, protegerlo de sobrescritura
      const protectUntil = recentLocalUpdatesRef.current?.get(incoming.id) || 0;
      if (protectUntil > now) {
        return;
      }

      const inTime = incoming.updatedAt || incoming.date || incoming.createdAt || '';
      const curTime = current.updatedAt || current.date || current.createdAt || '';

      if (inTime > curTime) {
        map.set(incoming.id, { ...current, ...incoming });
        hasChanges = true;
      } else if (inTime === curTime) {
        if (
          incoming.status !== current.status ||
          incoming.invoiced !== current.invoiced ||
          incoming.deliveryFee !== current.deliveryFee ||
          incoming.total !== current.total
        ) {
          map.set(incoming.id, { ...current, ...incoming });
          hasChanges = true;
        }
      }
    });

    if (!hasChanges && map.size === currentList.length) {
      return currentList; // Misma referencia para evitar parpadeos y re-renders innecesarios
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0)
    );
  }, []);

  // ── Sincronizar pedidos con Supabase y el Servidor (Acceso Multi-Computador) ──────
  const saveOrdersToSupabase = useCallback(async (ordersList, auditList) => {
    // Filtrar pedidos activos para asegurar que nunca se sincronicen anulados en la lista activa
    const cleanActiveOrders = (ordersList || []).filter(
      (o) => o && o.status !== 'anulado_admin' && !deletedOrderIdsRef.current.has(o.id)
    );
    const cleanAuditOrders = (auditList || []).filter(
      (o) => o && (!deletedOrderIdsRef.current.has(o.id) || o.status === 'anulado_admin')
    );

    // 1) Enviar al servidor local (/api/orders) que sincroniza en disco y con Supabase server-side
    if (typeof window !== 'undefined') {
      try {
        fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'bulk_sync', orders: cleanActiveOrders, auditOrders: cleanAuditOrders }),
        }).catch((e) => console.warn('[MenuContext] Sync diferido con /api/orders:', e));
      } catch (e) {}
    }

    // 2) Sincronizar directo con Supabase con timeout de seguridad
    try {
      const supaPromise = supabase
        .from('app_state')
        .update({
          orders_data: cleanActiveOrders,
          audit_orders_data: cleanAuditOrders,
        })
        .eq('id', 'tronos');

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout Supabase Orders (5s)')), 5000)
      );

      await Promise.race([supaPromise, timeoutPromise]);
    } catch (e) {
      console.warn('[MenuContext] Error guardando pedidos en Supabase:', e?.message);
    }
  }, []);

  const addOrder = useCallback((newOrder) => {
    if (!newOrder || !newOrder.id) return;

    // Evitar procesar pedidos duplicados si ya existen con el mismo ID
    deletedOrderIdsRef.current.delete(newOrder.id);

    const now = new Date().toISOString();
    const orderWithMeta = {
      ...newOrder,
      createdAt: newOrder.date || now,
      updatedAt: now,
      invoiced: Boolean(newOrder.invoiced),
      auditFlag: 'registrado',
    };

    recentLocalUpdatesRef.current.set(orderWithMeta.id, Date.now() + 30000);

    const currentOrders = Array.isArray(orders) ? orders : [];
    const currentAudit = Array.isArray(auditOrders) ? auditOrders : [];

    const filteredOrders = currentOrders.filter((o) => o && o.id !== orderWithMeta.id);
    const nextOrders = [orderWithMeta, ...filteredOrders];

    const filteredAudit = currentAudit.filter((o) => o && o.id !== orderWithMeta.id);
    const nextAudit = [orderWithMeta, ...filteredAudit];

    // 1) INSTANTÁNEO: Actualizar React state + localStorage + BroadcastChannel (sin demora)
    setOrders(nextOrders);
    setAuditOrders(nextAudit);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(nextOrders));
        localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(nextAudit));
      } catch (e) {}

      if ('BroadcastChannel' in window) {
        try {
          const channel = new BroadcastChannel('tronos_orders_channel');
          channel.postMessage({ type: 'NEW_ORDER_ALERT', order: orderWithMeta });
          channel.close();
        } catch (e) {}
      }
    }

    // 2) BACKGROUND (fire-and-forget): Enviar a /api/orders → SSE broadcast en tiempo real
    if (typeof window !== 'undefined') {
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: orderWithMeta }),
      }).catch((err) => console.warn('[MenuContext] Error enviando a /api/orders:', err));
    }

    // 3) BACKGROUND (fire-and-forget): Sincronizar con Supabase
    saveOrdersToSupabase(nextOrders, nextAudit);

    return orderWithMeta;
  }, [orders, auditOrders, saveOrdersToSupabase]);

  const updateOrderStatus = useCallback((orderId, status, extraMeta = {}) => {
    const now = new Date().toISOString();
    recentLocalUpdatesRef.current.set(orderId, Date.now() + 15000);

    const currentOrders = Array.isArray(orders) ? orders : [];
    const currentAudit = Array.isArray(auditOrders) ? auditOrders : [];

    const nextOrders = currentOrders.map((o) =>
      o && o.id === orderId
        ? { ...o, ...(status ? { status } : {}), ...extraMeta, updatedAt: now }
        : o
    );

    const nextAudit = currentAudit.map((o) =>
      o && o.id === orderId
        ? { ...o, ...(status ? { status } : {}), ...extraMeta, updatedAt: now }
        : o
    );

    setOrders(nextOrders);
    setAuditOrders(nextAudit);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(nextOrders));
        localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(nextAudit));
      } catch (e) {}

      if ('BroadcastChannel' in window) {
        try {
          const channel = new BroadcastChannel('tronos_orders_channel');
          channel.postMessage({ type: 'STATUS_UPDATED', orderId, status });
          channel.close();
        } catch (e) {}
      }

      fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status, extraMeta }),
      }).catch((e) => console.error('[MenuContext] Error actualizando pedido en servidor:', e));
    }

    saveOrdersToSupabase(nextOrders, nextAudit);
  }, [orders, auditOrders, saveOrdersToSupabase]);

  const markOrderInvoiced = useCallback((orderId, invoiceDetails = {}) => {
    updateOrderStatus(orderId, undefined, {
      invoiced: true,
      invoicedAt: new Date().toISOString(),
      ...invoiceDetails,
    });
  }, [updateOrderStatus]);

  // ── Personalizar Pedido (Agregar Adición con Precio Manual en Cocina / Caja) ──
  const addCustomAdditionToOrder = useCallback((orderId, customAddition, options = {}) => {
    const { updateInvoice = true } = options;
    const now = new Date().toISOString();
    recentLocalUpdatesRef.current.set(orderId, Date.now() + 15000);

    const priceNum = Math.max(0, parseInt(customAddition.price, 10) || 0);
    const qtyNum = Math.max(1, parseInt(customAddition.quantity, 10) || 1);
    const newItem = {
      id: `custom-add-${Date.now()}`,
      name: (customAddition.name || 'Adición personalizada').trim(),
      price: priceNum,
      quantity: qtyNum,
      note: (customAddition.note || '').trim(),
      isCustom: true,
      selectedExtras: [],
      removedIngredients: [],
    };

    let updatedOrder = null;
    const applyAddition = (o) => {
      if (!o || o.id !== orderId) return o;
      const newItems = [...(o.items || []), newItem];
      const newSubtotal = newItems.reduce((sum, it) => {
        const extrasTotal = (it.selectedExtras || []).reduce((s, e) => s + ((e.price || 0) * (e.quantity || 1)), 0);
        return sum + (((it.price || 0) + extrasTotal) * (it.quantity || 1));
      }, 0);
      const deliveryFee = o.deliveryFee || 0;
      const newTotal = newSubtotal + deliveryFee;

      const mod = {
        ...o,
        items: newItems,
        subtotal: newSubtotal,
        total: newTotal,
        updatedAt: now,
        ...(updateInvoice ? { invoicedAt: now } : {}),
      };
      updatedOrder = mod;
      return mod;
    };

    const currentOrders = Array.isArray(orders) ? orders : [];
    const currentAudit = Array.isArray(auditOrders) ? auditOrders : [];

    const nextOrders = currentOrders.map(applyAddition);
    const nextAudit = currentAudit.map(applyAddition);

    setOrders(nextOrders);
    setAuditOrders(nextAudit);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(nextOrders));
        localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(nextAudit));
      } catch (e) {}

      if ('BroadcastChannel' in window) {
        try {
          const channel = new BroadcastChannel('tronos_orders_channel');
          channel.postMessage({ type: 'ORDER_CUSTOMIZED', orderId, order: updatedOrder });
          channel.close();
        } catch (e) {}
      }

      fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          extraMeta: {
            items: updatedOrder?.items,
            subtotal: updatedOrder?.subtotal,
            total: updatedOrder?.total,
            invoicedAt: updatedOrder?.invoicedAt,
          },
        }),
      }).catch((e) => console.error('[MenuContext] Error enviando actualización personalizada al servidor:', e));
    }

    saveOrdersToSupabase(nextOrders, nextAudit);

    return updatedOrder;
  }, [orders, auditOrders, saveOrdersToSupabase]);

  // Solo Administrador puede anular o eliminar
  const deleteOrder = useCallback((orderId, motivo = 'Anulado por Administrador') => {
    deletedOrderIdsRef.current.add(orderId);
    recentLocalUpdatesRef.current.set(orderId, Date.now() + 30000);

    const currentOrders = Array.isArray(orders) ? orders : [];
    const currentAudit = Array.isArray(auditOrders) ? auditOrders : [];

    const nextOrders = currentOrders.filter((o) => o && o.id !== orderId);
    const nextAudit = currentAudit.map((o) =>
      o && o.id === orderId
        ? {
            ...o,
            status: 'anulado_admin',
            anuladoAt: new Date().toISOString(),
            anuladoMotivo: motivo,
            updatedAt: new Date().toISOString(),
          }
        : o
    );

    setOrders(nextOrders);
    setAuditOrders(nextAudit);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(nextOrders));
        localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(nextAudit));
      } catch (e) {}

      if ('BroadcastChannel' in window) {
        try {
          const ch = new BroadcastChannel('tronos_orders_channel');
          ch.postMessage({ type: 'SYNC_ORDERS', data: nextOrders });
          ch.postMessage({ type: 'SYNC_AUDIT', data: nextAudit });
          ch.close();
        } catch (e) {}
      }
    }

    saveOrdersToSupabase(nextOrders, nextAudit);

    if (typeof window !== 'undefined') {
      fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', orderId, motivo }),
      }).catch((e) => console.error('[MenuContext] Error eliminando pedido en servidor:', e));
    }
  }, [orders, auditOrders, saveOrdersToSupabase]);

  // Purga física definitiva de auditoría (solo Admin)
  const purgeAuditOrder = useCallback((orderId) => {
    deletedOrderIdsRef.current.add(orderId);
    recentLocalUpdatesRef.current.set(orderId, Date.now() + 30000);

    const currentOrders = Array.isArray(orders) ? orders : [];
    const currentAudit = Array.isArray(auditOrders) ? auditOrders : [];

    const nextOrders = currentOrders.filter((o) => o && o.id !== orderId);
    const nextAudit = currentAudit.filter((o) => o && o.id !== orderId);

    setOrders(nextOrders);
    setAuditOrders(nextAudit);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(nextOrders));
        localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(nextAudit));
      } catch (e) {}

      if ('BroadcastChannel' in window) {
        try {
          const ch = new BroadcastChannel('tronos_orders_channel');
          ch.postMessage({ type: 'SYNC_ORDERS', data: nextOrders });
          ch.postMessage({ type: 'SYNC_AUDIT', data: nextAudit });
          ch.close();
        } catch (e) {}
      }
    }

    saveOrdersToSupabase(nextOrders, nextAudit);

    if (typeof window !== 'undefined') {
      fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'purge', orderId }),
      }).catch((e) => console.error('[MenuContext] Error purgando pedido en servidor:', e));
    }
  }, [orders, auditOrders, saveOrdersToSupabase]);

  // ── Limpiar y reiniciar todos los datos a cero (borrado completo) ──
  const resetAllOrdersData = useCallback(() => {
    deletedOrderIdsRef.current.clear();
    recentLocalUpdatesRef.current.clear();
    setOrders([]);
    setAuditOrders([]);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify([]));
      } catch (e) {}
      if ('BroadcastChannel' in window) {
        try {
          const ch = new BroadcastChannel('tronos_orders_channel');
          ch.postMessage({ type: 'SYNC_ORDERS', data: [] });
          ch.postMessage({ type: 'SYNC_AUDIT', data: [] });
          ch.close();
        } catch (e) {}
      }
    }
    saveOrdersToSupabase([], []);

    // ── Notificar al servidor ──
    if (typeof window !== 'undefined') {
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      }).catch(() => {});
    }
  }, [saveOrdersToSupabase]);

  // ── Cargar datos de Supabase después del montaje (solo cliente) ──
  useEffect(() => {
    const loadFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('app_state')
          .select('*')
          .eq('id', 'tronos')
          .single();

        if (error) {
          console.error('Error fetching from Supabase:', error);
          throw error;
        }

        if (data) {
          // Parse menu data (protegido si hubo cambios locales recientes)
          if (data.menu_data) {
            const now = Date.now();
            if (recentMenuUpdateRef.current > now) {
              // Proteger cambios locales recientes para que el polling de Supabase no los revierta
            } else {
              let parsedMenu = data.menu_data;
              if (typeof parsedMenu === 'string') parsedMenu = JSON.parse(parsedMenu);
              if (Array.isArray(parsedMenu) && parsedMenu.length > 0) {
                setMenuCategories((prev) => {
                  if (JSON.stringify(prev) === JSON.stringify(parsedMenu)) return prev;
                  return parsedMenu;
                });
                if (typeof window !== 'undefined') {
                  try { localStorage.setItem(STORAGE_KEY_MENU, JSON.stringify(parsedMenu)); } catch (e) {}
                }
              }
            }
          }

          // Parse config data (solo actualizar si los datos cambiaron)
          if (data.config_data) {
            let parsedConfig = data.config_data;
            if (typeof parsedConfig === 'string') parsedConfig = JSON.parse(parsedConfig);
            if (parsedConfig && typeof parsedConfig === 'object') {
              setRestaurantConfig((prev) => {
                const newConf = {
                  ...prev,
                  ...parsedConfig,
                  whatsapp: cleanWhatsAppNumber(parsedConfig.whatsapp || prev.whatsapp),
                  deliveryPrice: parsedConfig.deliveryPrice !== undefined ? Number(parsedConfig.deliveryPrice) : (prev.deliveryPrice || 4000),
                };
                if (JSON.stringify(prev) === JSON.stringify(newConf)) return prev;
                return newConf;
              });
            }
          }

          // Parse active orders (Acceso multi-computador con Smart Merge)
          const rawOrders = data.orders_data !== undefined ? data.orders_data : data.config_data?.orders_data;
          if (rawOrders !== undefined && rawOrders !== null) {
            const parsedOrders = typeof rawOrders === 'string' ? JSON.parse(rawOrders) : rawOrders;
            if (Array.isArray(parsedOrders)) {
              setOrders((prev) => {
                const merged = smartMergeOrders(prev, parsedOrders);
                if (merged === prev) return prev;
                if (typeof window !== 'undefined') {
                  try { localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(merged)); } catch (e) {}
                }
                return merged;
              });
            }
          }

          // Parse audit orders (Acceso multi-computador con Smart Merge)
          const rawAudit = data.audit_orders_data !== undefined ? data.audit_orders_data : data.config_data?.audit_orders_data;
          if (rawAudit !== undefined && rawAudit !== null) {
            const parsedAudit = typeof rawAudit === 'string' ? JSON.parse(rawAudit) : rawAudit;
            if (Array.isArray(parsedAudit)) {
              setAuditOrders((prev) => {
                const merged = smartMergeOrders(prev, parsedAudit);
                if (merged === prev) return prev;
                if (typeof window !== 'undefined') {
                  try { localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(merged)); } catch (e) {}
                }
                return merged;
              });
            }
          }
        }
      } catch (err) {
        // Fallback manteniendo el menú local
      } finally {
        setMenuLoaded(true);
      }
    };

    loadFromSupabase();

    // Polling periódico cada 3.5 segundos y Realtime para sincronizar todos los computadores
    const pollInterval = setInterval(() => {
      loadFromSupabase();
    }, 3500);

    let channel = null;
    try {
      channel = supabase
        .channel('app_state_realtime_orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state', filter: 'id=eq.tronos' }, () => {
          loadFromSupabase();
        })
        .subscribe();
    } catch (e) {}

    // Load auth from localStorage since it's user-specific and shouldn't be in the DB
    try {
      const storedRole = localStorage.getItem(STORAGE_KEY_AUTH_ROLE);
      if (storedRole === 'admin' || storedRole === 'cajero') {
        setTimeout(() => setUserRole(storedRole), 0);
      } else if (localStorage.getItem(STORAGE_KEY_AUTH) === 'true') {
        setTimeout(() => setUserRole('admin'), 0);
      }
    } catch {
      // Ignorar errores
    }

    return () => {
      clearInterval(pollInterval);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // ── Sincronización Multi-Dispositivo via API del Servidor + SSE ────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let eventSource = null;
    let reconnectTimeout = null;
    let isMounted = true;

    // Cargar pedidos iniciales desde el servidor y sincronizar localStorage → servidor
    const initSync = async () => {
      try {
        // 1) Cargar lo que tenga el servidor
        const res = await fetch('/api/orders');
        if (res.ok) {
          const data = await res.json();
          if (data.orders && Array.isArray(data.orders) && data.orders.length > 0) {
            setOrders((prev) => {
              const merged = smartMergeOrders(prev, data.orders);
              if (merged === prev) return prev;
              try { localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(merged)); } catch (e) {}
              return merged;
            });
          }
          if (data.auditOrders && Array.isArray(data.auditOrders) && data.auditOrders.length > 0) {
            setAuditOrders((prev) => {
              const merged = smartMergeOrders(prev, data.auditOrders);
              if (merged === prev) return prev;
              try { localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(merged)); } catch (e) {}
              return merged;
            });
          }
        }

        // 2) Enviar pedidos locales al servidor (por si el servidor acaba de reiniciar)
        const localOrders = JSON.parse(localStorage.getItem(STORAGE_KEY_ORDERS) || '[]');
        const localAudit = JSON.parse(localStorage.getItem(STORAGE_KEY_AUDIT_ORDERS) || '[]');
        if (localOrders.length > 0 || localAudit.length > 0) {
          fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'bulk_sync', orders: localOrders, auditOrders: localAudit }),
          }).catch(() => {});
        }
      } catch (e) {
        console.error('[MenuContext] Error en sincronización inicial con servidor:', e);
      }
    };

    // Conectar al stream SSE para recibir eventos en tiempo real
    const connectSSE = () => {
      if (!isMounted) return;
      try {
        eventSource = new EventSource('/api/orders/stream');

        eventSource.addEventListener('NEW_ORDER', (e) => {
          try {
            const order = JSON.parse(e.data);
            setOrders((prev) => {
              if (prev.some(o => o.id === order.id)) return prev;
              const next = [order, ...prev];
              try { localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(next)); } catch (err) {}
              return next;
            });
            setAuditOrders((prev) => {
              const next = [order, ...prev.filter(o => o.id !== order.id)];
              try { localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(next)); } catch (err) {}
              return next;
            });
            // También notificar via BroadcastChannel (para otras pestañas locales)
            if ('BroadcastChannel' in window) {
              try {
                const ch = new BroadcastChannel('tronos_orders_channel');
                ch.postMessage({ type: 'NEW_ORDER_ALERT', order });
                ch.close();
              } catch (err) {}
            }
          } catch (err) {}
        });

        eventSource.addEventListener('ORDER_UPDATED', (e) => {
          try {
            const { orderId, status, extraMeta, order } = JSON.parse(e.data);
            const now = Date.now();
            const protectUntil = recentLocalUpdatesRef.current?.get(orderId) || 0;
            if (protectUntil > now && order?.updatedAt) {
              // Si este cliente tiene una actualización más reciente, no retroceder
              return;
            }
            const updateFn = (o) =>
              o.id === orderId
                ? { ...o, ...(status ? { status } : {}), ...(extraMeta || {}), updatedAt: order?.updatedAt || new Date().toISOString() }
                : o;
            setOrders((prev) => {
              const next = prev.map(updateFn);
              try { localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(next)); } catch (err) {}
              return next;
            });
            setAuditOrders((prev) => {
              const next = prev.map(updateFn);
              try { localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(next)); } catch (err) {}
              return next;
            });
          } catch (err) {}
        });

        eventSource.addEventListener('ORDER_DELETED', (e) => {
          try {
            const { orderId, motivo } = JSON.parse(e.data);
            setOrders((prev) => {
              const next = prev.filter(o => o.id !== orderId);
              try { localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(next)); } catch (err) {}
              return next;
            });
            setAuditOrders((prev) => {
              const next = prev.map(o =>
                o.id === orderId
                  ? { ...o, status: 'anulado_admin', anuladoAt: new Date().toISOString(), anuladoMotivo: motivo }
                  : o
              );
              try { localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(next)); } catch (err) {}
              return next;
            });
          } catch (err) {}
        });

        eventSource.addEventListener('ORDERS_RESET', () => {
          setOrders([]);
          setAuditOrders([]);
          try {
            localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify([]));
            localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify([]));
          } catch (err) {}
        });

        eventSource.addEventListener('ORDERS_SYNCED', (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.orders && Array.isArray(data.orders)) {
              setOrders((prev) => {
                const merged = smartMergeOrders(prev, data.orders);
                if (merged === prev) return prev;
                try { localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(merged)); } catch (err) {}
                return merged;
              });
            }
            if (data.auditOrders && Array.isArray(data.auditOrders)) {
              setAuditOrders((prev) => {
                const merged = smartMergeOrders(prev, data.auditOrders);
                if (merged === prev) return prev;
                try { localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(merged)); } catch (err) {}
                return merged;
              });
            }
          } catch (err) {}
        });

        eventSource.onerror = () => {
          if (eventSource) eventSource.close();
          eventSource = null;
          // Reconectar después de 3 segundos
          if (isMounted) {
            reconnectTimeout = setTimeout(connectSSE, 3000);
          }
        };
      } catch (e) {
        // Reconectar después de 3 segundos
        if (isMounted) {
          reconnectTimeout = setTimeout(connectSSE, 3000);
        }
      }
    };

    initSync();
    connectSSE();

    // Polling periódico de respaldo al servidor cada 3.5 segundos
    const serverPollInterval = setInterval(() => {
      if (isMounted) initSync();
    }, 3500);

    return () => {
      isMounted = false;
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(serverPollInterval);
    };
  }, []);

  // ── Sincronización explícita de menú con Supabase y servidor local (/api/menu) ──
  const saveMenuToSupabase = useCallback(async (categories) => {
    if (!categories || !Array.isArray(categories)) return { success: false, error: 'Categorías inválidas' };

    // Proteger durante 30s contra sobreescrituras por lecturas remotas
    recentMenuUpdateRef.current = Date.now() + 30000;

    // 1) Guardar en localStorage de inmediato
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_MENU, JSON.stringify(categories));
      } catch (e) {}
    }

    // 2) Sincronizar entre pestañas locales
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('tronos_orders_channel');
        channel.postMessage({ type: 'SYNC_MENU', data: categories });
        channel.close();
      } catch (e) {}
    }

    // 3) Enviar al servidor local (/api/menu) para respaldo en disco
    let serverOk = false;
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_menu', menu_data: categories }),
        });
        if (res.ok) serverOk = true;
      } catch (e) {
        console.warn('[MenuContext] Error al enviar a /api/menu:', e);
      }
    }

    // 4) Sincronizar directo con Supabase con protección de timeout
    let supaOk = false;
    let supaError = null;

    try {
      const supaPromise = supabase
        .from('app_state')
        .update({ menu_data: categories })
        .eq('id', 'tronos');

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Tiempo de espera agotado con Supabase (5s)')), 5000)
      );

      const res = await Promise.race([supaPromise, timeoutPromise]);
      if (!res?.error) {
        supaOk = true;
      } else {
        supaError = res.error?.message;
      }
    } catch (err) {
      supaError = err?.message || 'Error de conexión';
    }

    return {
      success: supaOk || serverOk,
      supaOk,
      serverOk,
      error: supaError,
    };
  }, []);

  // ── Guardar todos los cambios (Menú + Configuración) con Botón de Seguridad ──
  const saveAllChanges = useCallback(async () => {
    recentMenuUpdateRef.current = Date.now() + 30000;

    const cleanActiveOrders = (orders || []).filter(
      (o) => o && o.status !== 'anulado_admin' && !deletedOrderIdsRef.current.has(o.id)
    );
    const cleanAuditOrders = (auditOrders || []).filter(
      (o) => o && (!deletedOrderIdsRef.current.has(o.id) || o.status === 'anulado_admin')
    );

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_MENU, JSON.stringify(menuCategories));
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(restaurantConfig));
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(cleanActiveOrders));
        localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(cleanAuditOrders));
      } catch (e) {}
    }

    let serverOk = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_all',
          menu_data: menuCategories,
          config_data: restaurantConfig,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) serverOk = true;
    } catch (e) {}

    try {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 5000);
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_sync',
          orders: cleanActiveOrders,
          auditOrders: cleanAuditOrders,
        }),
        signal: controller2.signal,
      });
      clearTimeout(timeout2);
    } catch (e) {}

    let supaOk = false;
    let supaError = null;

    try {
      // Timeout estricto de 6 segundos para no congelar la interfaz si Supabase demora
      const supaPromise = supabase
        .from('app_state')
        .update({
          menu_data: menuCategories,
          config_data: restaurantConfig,
          orders_data: cleanActiveOrders,
          audit_orders_data: cleanAuditOrders,
        })
        .eq('id', 'tronos');

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Tiempo de espera agotado con Supabase (6s)')), 6000)
      );

      const res = await Promise.race([supaPromise, timeoutPromise]);
      if (!res?.error) {
        supaOk = true;
      } else {
        supaError = res.error?.message;
      }
    } catch (err) {
      supaError = err?.message || 'Conexión lenta con Supabase';
    }

    return {
      success: supaOk || serverOk,
      supaOk,
      serverOk,
      error: supaError,
    };
  }, [menuCategories, restaurantConfig, orders, auditOrders]);

  // ── Sincronización explícita de config con Supabase (solo ante cambios manuales) ──
  const saveConfigToSupabase = useCallback(async (config) => {
    try {
      await supabase
        .from('app_state')
        .update({ config_data: config })
        .eq('id', 'tronos');
    } catch (error) {
      console.warn('Error saving config to Supabase:', error);
    }
  }, []);

  // ── Sincronizar autenticación con localStorage ───────────────────────
  useEffect(() => {
    try {
      if (userRole) {
        localStorage.setItem(STORAGE_KEY_AUTH_ROLE, userRole);
        if (userRole === 'admin') {
          localStorage.setItem(STORAGE_KEY_AUTH, 'true');
        } else {
          localStorage.removeItem(STORAGE_KEY_AUTH);
        }
      } else {
        localStorage.removeItem(STORAGE_KEY_AUTH_ROLE);
        localStorage.removeItem(STORAGE_KEY_AUTH);
      }
    } catch {
      // Ignorar
    }
  }, [userRole]);

  // ── Funciones del carrito ────────────────────────────────────────────
  const addToCart = useCallback((item, selectedExtras = [], removedIngredients = []) => {
    setCart((prev) => {
      // Agrupamos por id del plato y por la misma configuración de extras/ingredientes
      const existing = prev.find((cartItem) => 
        cartItem.id === item.id &&
        JSON.stringify(cartItem.selectedExtras) === JSON.stringify(selectedExtras) &&
        JSON.stringify(cartItem.removedIngredients) === JSON.stringify(removedIngredients)
      );
      if (existing) {
        return prev.map((cartItem) =>
          cartItem.cartItemId === existing.cartItemId
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prev, { 
        ...item, 
        cartItemId: `${item.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, 
        quantity: 1, 
        selectedExtras: selectedExtras, // Array of { id, name, price, quantity }
        removedIngredients: removedIngredients // Array of strings
      }];
    });
  }, []);

  const removeFromCart = useCallback((cartItemId) => {
    setCart((prev) => prev.filter((cartItem) => cartItem.cartItemId !== cartItemId));
  }, []);

  const updateQuantity = useCallback((cartItemId, quantity) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((cartItem) => cartItem.cartItemId !== cartItemId));
      return;
    }
    setCart((prev) =>
      prev.map((cartItem) =>
        cartItem.cartItemId === cartItemId ? { ...cartItem, quantity } : cartItem
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  // ── Funciones de Adicionales en el Carrito ───────────────────────────
  const addExtraToCartItem = useCallback((cartItemId, extra) => {
    setCart((prev) =>
      prev.map((cartItem) => {
        if (cartItem.cartItemId === cartItemId) {
          const existingExtra = cartItem.selectedExtras.find(e => e.id === extra.id);
          if (existingExtra) {
            return {
              ...cartItem,
              selectedExtras: cartItem.selectedExtras.map(e => 
                e.id === extra.id ? { ...e, quantity: e.quantity + 1 } : e
              )
            };
          } else {
            return {
              ...cartItem,
              selectedExtras: [...cartItem.selectedExtras, { ...extra, quantity: 1 }]
            };
          }
        }
        return cartItem;
      })
    );
  }, []);

  const removeExtraFromCartItem = useCallback((cartItemId, extraId) => {
    setCart((prev) =>
      prev.map((cartItem) => {
        if (cartItem.cartItemId === cartItemId) {
          const existingExtra = cartItem.selectedExtras.find(e => e.id === extraId);
          if (existingExtra && existingExtra.quantity > 1) {
            return {
              ...cartItem,
              selectedExtras: cartItem.selectedExtras.map(e => 
                e.id === extraId ? { ...e, quantity: e.quantity - 1 } : e
              )
            };
          } else {
            return {
              ...cartItem,
              selectedExtras: cartItem.selectedExtras.filter(e => e.id !== extraId)
            };
          }
        }
        return cartItem;
      })
    );
  }, []);

  const updateCartItemNote = useCallback((cartItemId, note) => {
    setCart((prev) =>
      prev.map((cartItem) =>
        cartItem.cartItemId === cartItemId ? { ...cartItem, note } : cartItem
      )
    );
  }, []);

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => {
      const extrasTotal = item.selectedExtras.reduce((sum, extra) => sum + (extra.price * extra.quantity), 0);
      return total + (item.price * item.quantity) + extrasTotal;
    }, 0);
  }, [cart]);

  const cartCount = useMemo(
    () => cart.reduce((count, item) => count + item.quantity, 0),
    [cart]
  );

  // ── Funciones de administración (Menú Dinámico) ──────────────────────

  // Añadir un nuevo plato a una categoría específica
  const addMenuItem = useCallback(async (categoryId, item) => {
    recentMenuUpdateRef.current = Date.now() + 30000;
    const currentCats = Array.isArray(menuCategories) ? menuCategories : [];
    const nextCategories = currentCats.map((cat) => {
      if (cat.id === categoryId) {
        const itemToAdd = {
          ...item,
          categoryId,
          extras: Array.isArray(item.extras) ? item.extras : [],
        };
        return { ...cat, items: [...(cat.items || []), itemToAdd] };
      }
      return cat;
    });

    setMenuCategories(nextCategories);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY_MENU, JSON.stringify(nextCategories)); } catch (e) {}
    }
    return await saveMenuToSupabase(nextCategories);
  }, [menuCategories, saveMenuToSupabase]);

  // Eliminar un plato
  const deleteMenuItem = useCallback(async (categoryId, itemId) => {
    recentMenuUpdateRef.current = Date.now() + 30000;
    const currentCats = Array.isArray(menuCategories) ? menuCategories : [];
    const nextCategories = currentCats.map((cat) => {
      if (cat.id === categoryId) {
        return { ...cat, items: (cat.items || []).filter((item) => item.id !== itemId) };
      }
      return cat;
    });

    setMenuCategories(nextCategories);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY_MENU, JSON.stringify(nextCategories)); } catch (e) {}
    }
    setCart((prev) => prev.filter((cartItem) => cartItem.id !== itemId));
    return await saveMenuToSupabase(nextCategories);
  }, [menuCategories, saveMenuToSupabase]);

  // Actualizar un plato
  const updateMenuItem = useCallback(async (categoryId, updatedItem) => {
    recentMenuUpdateRef.current = Date.now() + 30000;
    const currentCats = Array.isArray(menuCategories) ? menuCategories : [];
    const nextCategories = currentCats.map((cat) => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          items: (cat.items || []).map((item) => (item.id === updatedItem.id ? { ...item, ...updatedItem } : item)),
        };
      }
      return cat;
    });

    setMenuCategories(nextCategories);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY_MENU, JSON.stringify(nextCategories)); } catch (e) {}
    }
    setCart((prev) =>
      prev.map((cartItem) =>
        cartItem.id === updatedItem.id
          ? { ...cartItem, name: updatedItem.name, price: updatedItem.price, image: updatedItem.image }
          : cartItem
      )
    );
    return await saveMenuToSupabase(nextCategories);
  }, [menuCategories, saveMenuToSupabase]);

  // Actualizar adicionales de un plato (Admin)
  const updateItemExtras = useCallback(async (categoryId, itemId, newExtras) => {
    recentMenuUpdateRef.current = Date.now() + 30000;
    const currentCats = Array.isArray(menuCategories) ? menuCategories : [];
    const nextCategories = currentCats.map((cat) => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          items: (cat.items || []).map((item) => (item.id === itemId ? { ...item, extras: newExtras } : item)),
        };
      }
      return cat;
    });

    setMenuCategories(nextCategories);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY_MENU, JSON.stringify(nextCategories)); } catch (e) {}
    }
    return await saveMenuToSupabase(nextCategories);
  }, [menuCategories, saveMenuToSupabase]);

  // Añadir nueva categoría
  const addCategory = useCallback(async (category) => {
    recentMenuUpdateRef.current = Date.now() + 30000;
    const currentCats = Array.isArray(menuCategories) ? menuCategories : [];
    const nextCategories = [...currentCats, category];

    setMenuCategories(nextCategories);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY_MENU, JSON.stringify(nextCategories)); } catch (e) {}
    }
    return await saveMenuToSupabase(nextCategories);
  }, [menuCategories, saveMenuToSupabase]);

  // Eliminar categoría (y todos sus platos)
  const deleteCategory = useCallback(async (categoryId) => {
    recentMenuUpdateRef.current = Date.now() + 30000;
    const currentCats = Array.isArray(menuCategories) ? menuCategories : [];
    const nextCategories = currentCats.filter((cat) => cat.id !== categoryId);

    setMenuCategories(nextCategories);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY_MENU, JSON.stringify(nextCategories)); } catch (e) {}
    }
    setCart((prevCart) => prevCart.filter(item => item.categoryId !== categoryId));
    return await saveMenuToSupabase(nextCategories);
  }, [menuCategories, saveMenuToSupabase]);

  // ── Funciones de Configuración ─────────────────────────────────────────
  const updateWhatsApp = useCallback((phone) => {
    const cleaned = cleanWhatsAppNumber(phone);
    setRestaurantConfig((prev) => {
      const updated = { ...prev, whatsapp: cleaned };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
        } catch (e) {}
      }
      try {
        supabase
          .from('app_state')
          .update({ config_data: updated })
          .eq('id', 'tronos')
          .then(() => {});
      } catch (e) {}
      return updated;
    });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('tronos_orders_channel');
        channel.postMessage({ type: 'SYNC_CONFIG', data: { whatsapp: cleaned } });
        channel.close();
      } catch (e) {}
    }

    return cleaned;
  }, []);

  const updateDeliveryPrice = useCallback((price) => {
    const num = Math.max(0, parseInt(price, 10) || 0);
    setRestaurantConfig((prev) => {
      const updated = { ...prev, deliveryPrice: num };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
        } catch (e) {}
      }
      try {
        supabase
          .from('app_state')
          .update({ config_data: updated })
          .eq('id', 'tronos')
          .then(() => {});
      } catch (e) {}
      return updated;
    });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('tronos_orders_channel');
        channel.postMessage({ type: 'SYNC_CONFIG', data: { deliveryPrice: num } });
        channel.close();
      } catch (e) {}
    }

    return num;
  }, []);

  const addSocial = useCallback((social) => {
    setRestaurantConfig(prev => ({ ...prev, socials: [...prev.socials, social] }));
  }, []);

  const removeSocial = useCallback((id) => {
    setRestaurantConfig(prev => ({ ...prev, socials: prev.socials.filter(s => s.id !== id) }));
  }, []);

  const updateSocial = useCallback((id, updatedSocial) => {
    setRestaurantConfig(prev => ({
      ...prev,
      socials: prev.socials.map(s => s.id === id ? { ...s, ...updatedSocial } : s)
    }));
  }, []);

  // ── Funciones de autenticación ───────────────────────────────────────
  const login = useCallback((username, password) => {
    const cleanUser = (username || '').trim();
    const cleanPass = (password || '').trim();

    if (cleanUser === ADMIN_CREDENTIALS.username && cleanPass === ADMIN_CREDENTIALS.password) {
      setUserRole('admin');
      return 'admin';
    }
    if (cleanUser === CAJERO_CREDENTIALS.username && cleanPass === CAJERO_CREDENTIALS.password) {
      setUserRole('cajero');
      return 'cajero';
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setUserRole(null);
    try {
      localStorage.removeItem(STORAGE_KEY_AUTH_ROLE);
      localStorage.removeItem(STORAGE_KEY_AUTH);
    } catch {}
  }, []);

  // ── Valor del contexto ──────────────────────────────────────────────
  const value = useMemo(
    () => ({
      menuCategories,
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartTotal,
      cartCount,
      addExtraToCartItem,
      removeExtraFromCartItem,
      updateCartItemNote,
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
      updateSocial,
      expandedItemId,
      setExpandedItemId,
      userRole,
      isAdmin,
      isCajero,
      login,
      logout,
      orders,
      auditOrders,
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
    }),
    [
      menuCategories,
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartTotal,
      cartCount,
      addExtraToCartItem,
      removeExtraFromCartItem,
      updateCartItemNote,
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
      updateSocial,
      expandedItemId,
      userRole,
      isAdmin,
      isCajero,
      login,
      logout,
      orders,
      auditOrders,
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
    ]
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu() {
  const context = useContext(MenuContext);
  if (context === undefined) {
    throw new Error('useMenu debe usarse dentro de un <MenuProvider>');
  }
  return context;
}
