'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
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
            let categories = [...parsed];
            for (const defCat of defaultMenuData) {
              const existingCatIdx = categories.findIndex((c) => c.id === defCat.id);
              if (existingCatIdx === -1) {
                categories.push(defCat);
              } else if (defCat.id === 'burgers') {
                const updatedItems = categories[existingCatIdx].items.map((item) => {
                  if (!item.extras || item.extras.length === 0) {
                    const defItem = defCat.items.find((di) => di.id === item.id);
                    if (defItem?.extras) {
                      return { ...item, extras: defItem.extras };
                    }
                  }
                  return item;
                });
                categories[existingCatIdx] = { ...categories[existingCatIdx], items: updatedItems };
              }
            }
            return categories;
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
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return defaultDemoOrders;
  });

  // ── Estado de Auditoría Central / Respaldo Maestro ───────────────────
  const [auditOrders, setAuditOrders] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_AUDIT_ORDERS);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return defaultDemoOrders;
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

  // ── Sincronizar pedidos con Supabase (Acceso Multi-Computador) ──────
  const saveOrdersToSupabase = useCallback(async (ordersList, auditList) => {
    try {
      const { error } = await supabase
        .from('app_state')
        .update({
          orders_data: ordersList,
          audit_orders_data: auditList,
        })
        .eq('id', 'tronos');

      if (error) {
        await supabase
          .from('app_state')
          .update({
            config_data: {
              ...restaurantConfig,
              orders_data: ordersList,
              audit_orders_data: auditList,
            },
          })
          .eq('id', 'tronos');
      }
    } catch (e) {
      console.error('Error al guardar pedidos en Supabase:', e);
    }
  }, [restaurantConfig]);

  const addOrder = useCallback((newOrder) => {
    const orderWithMeta = {
      ...newOrder,
      createdAt: newOrder.date || new Date().toISOString(),
      invoiced: false,
      auditFlag: 'registrado',
    };

    let nextOrders = [];
    let nextAudit = [];

    setOrders((prev) => {
      nextOrders = [orderWithMeta, ...prev];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(nextOrders));
        } catch (e) {}
      }
      return nextOrders;
    });

    setAuditOrders((prev) => {
      nextAudit = [orderWithMeta, ...prev.filter((o) => o.id !== orderWithMeta.id)];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(nextAudit));
        } catch (e) {}
      }
      saveOrdersToSupabase(nextOrders, nextAudit);
      return nextAudit;
    });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('tronos_orders_channel');
        channel.postMessage({ type: 'NEW_ORDER_ALERT', order: orderWithMeta });
        channel.close();
      } catch (e) {}
    }

    // ── Enviar al servidor para sincronización multi-dispositivo ──
    if (typeof window !== 'undefined') {
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: orderWithMeta }),
      }).catch((e) => console.error('[MenuContext] Error enviando pedido al servidor:', e));
    }
  }, [saveOrdersToSupabase]);

  const updateOrderStatus = useCallback((orderId, status, extraMeta = {}) => {
    let nextOrders = [];
    let nextAudit = [];

    setOrders((prev) => {
      nextOrders = prev.map((o) =>
        o.id === orderId
          ? { ...o, ...(status ? { status } : {}), ...extraMeta, updatedAt: new Date().toISOString() }
          : o
      );
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(nextOrders));
        } catch (e) {}
      }
      return nextOrders;
    });

    setAuditOrders((prev) => {
      nextAudit = prev.map((o) =>
        o.id === orderId
          ? { ...o, ...(status ? { status } : {}), ...extraMeta, updatedAt: new Date().toISOString() }
          : o
      );
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(nextAudit));
        } catch (e) {}
      }
      saveOrdersToSupabase(nextOrders, nextAudit);
      return nextAudit;
    });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('tronos_orders_channel');
        channel.postMessage({ type: 'STATUS_UPDATED', orderId, status });
        channel.close();
      } catch (e) {}
    }

    // ── Enviar al servidor para sincronización multi-dispositivo ──
    if (typeof window !== 'undefined') {
      fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status, extraMeta }),
      }).catch((e) => console.error('[MenuContext] Error actualizando pedido en servidor:', e));
    }
  }, [saveOrdersToSupabase]);

  const markOrderInvoiced = useCallback((orderId, invoiceDetails = {}) => {
    updateOrderStatus(orderId, undefined, {
      invoiced: true,
      invoicedAt: new Date().toISOString(),
      ...invoiceDetails,
    });
  }, [updateOrderStatus]);

  // Solo Administrador puede anular o eliminar
  const deleteOrder = useCallback((orderId, motivo = 'Anulado por Administrador') => {
    let nextOrders = [];
    let nextAudit = [];

    setOrders((prev) => {
      nextOrders = prev.filter((o) => o.id !== orderId);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(nextOrders));
        } catch (e) {}
      }
      return nextOrders;
    });

    setAuditOrders((prev) => {
      nextAudit = prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'anulado_admin',
              anuladoAt: new Date().toISOString(),
              anuladoMotivo: motivo,
            }
          : o
      );
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(nextAudit));
        } catch (e) {}
      }
      saveOrdersToSupabase(nextOrders, nextAudit);
      return nextAudit;
    });

    // ── Enviar al servidor para sincronización multi-dispositivo ──
    if (typeof window !== 'undefined') {
      fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', orderId, motivo }),
      }).catch((e) => console.error('[MenuContext] Error eliminando pedido en servidor:', e));
    }
  }, [saveOrdersToSupabase]);

  // Purga física de auditoría (solo Admin)
  const purgeAuditOrder = useCallback((orderId) => {
    setAuditOrders((prev) => {
      const updated = prev.filter((o) => o.id !== orderId);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(updated));
        } catch (e) {}
      }
      return updated;
    });
  }, []);

  // ── Limpiar y reiniciar todos los datos a cero (borrado completo) ──
  const resetAllOrdersData = useCallback(() => {
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
          // Parse menu data
          if (data.menu_data) {
            let parsedMenu = data.menu_data;
            if (typeof parsedMenu === 'string') parsedMenu = JSON.parse(parsedMenu);
            
              let categories = [...parsedMenu];
              for (const defCat of defaultMenuData) {
                const existingCatIdx = categories.findIndex((c) => c.id === defCat.id);
                if (existingCatIdx === -1) {
                  categories.push(defCat);
                } else if (defCat.id === 'burgers') {
                  const updatedItems = categories[existingCatIdx].items.map((item) => {
                    if (!item.extras || item.extras.length === 0) {
                      const defItem = defCat.items.find((di) => di.id === item.id);
                      if (defItem?.extras) {
                        return { ...item, extras: defItem.extras };
                      }
                    }
                    return item;
                  });
                  categories[existingCatIdx] = { ...categories[existingCatIdx], items: updatedItems };
                }
              }
              setMenuCategories(categories);
          }

          // Parse config data
          if (data.config_data) {
            let parsedConfig = data.config_data;
            if (typeof parsedConfig === 'string') parsedConfig = JSON.parse(parsedConfig);
            if (parsedConfig && parsedConfig.whatsapp) {
              setRestaurantConfig((prev) => {
                const localSaved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_CONFIG) : null;
                if (localSaved) {
                  try {
                    const parsedLocal = JSON.parse(localSaved);
                    if (parsedLocal?.whatsapp) {
                      return { ...parsedConfig, ...parsedLocal, whatsapp: cleanWhatsAppNumber(parsedLocal.whatsapp) };
                    }
                  } catch (e) {}
                }
                return { ...prev, ...parsedConfig, whatsapp: cleanWhatsAppNumber(parsedConfig.whatsapp) };
              });
            }
          }

          // Parse active orders (Acceso multi-computador)
          const rawOrders = data.orders_data || data.config_data?.orders_data;
          if (rawOrders) {
            const parsedOrders = typeof rawOrders === 'string' ? JSON.parse(rawOrders) : rawOrders;
            if (Array.isArray(parsedOrders) && parsedOrders.length > 0) {
              setOrders(parsedOrders);
              if (typeof window !== 'undefined') {
                try { localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(parsedOrders)); } catch (e) {}
              }
            }
          }

          // Parse audit orders (Acceso multi-computador)
          const rawAudit = data.audit_orders_data || data.config_data?.audit_orders_data;
          if (rawAudit) {
            const parsedAudit = typeof rawAudit === 'string' ? JSON.parse(rawAudit) : rawAudit;
            if (Array.isArray(parsedAudit) && parsedAudit.length > 0) {
              setAuditOrders(parsedAudit);
              if (typeof window !== 'undefined') {
                try { localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(parsedAudit)); } catch (e) {}
              }
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

    // Polling periódico cada 5 segundos y Realtime para sincronizar todos los computadores
    const pollInterval = setInterval(() => {
      loadFromSupabase();
    }, 5000);

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
              // Merge: servidor + local sin duplicados (servidor tiene prioridad si tiene updatedAt más reciente)
              const merged = new Map();
              prev.forEach(o => merged.set(o.id, o));
              data.orders.forEach(o => {
                const existing = merged.get(o.id);
                if (!existing || (o.updatedAt && o.updatedAt > (existing.updatedAt || ''))) {
                  merged.set(o.id, o);
                }
              });
              const result = Array.from(merged.values());
              try { localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(result)); } catch (e) {}
              return result;
            });
          }
          if (data.auditOrders && Array.isArray(data.auditOrders) && data.auditOrders.length > 0) {
            setAuditOrders((prev) => {
              const merged = new Map();
              prev.forEach(o => merged.set(o.id, o));
              data.auditOrders.forEach(o => {
                const existing = merged.get(o.id);
                if (!existing || (o.updatedAt && o.updatedAt > (existing.updatedAt || ''))) {
                  merged.set(o.id, o);
                }
              });
              const result = Array.from(merged.values());
              try { localStorage.setItem(STORAGE_KEY_AUDIT_ORDERS, JSON.stringify(result)); } catch (e) {}
              return result;
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
            const updateFn = (o) =>
              o.id === orderId
                ? { ...o, ...(status ? { status } : {}), ...(extraMeta || {}), updatedAt: new Date().toISOString() }
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

    return () => {
      isMounted = false;
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // ── Sincronizar menú con Supabase ────────────────────────────────
  useEffect(() => {
    if (!menuLoaded) return;
    const saveMenu = async () => {
      try {
        await supabase
          .from('app_state')
          .update({ menu_data: menuCategories })
          .eq('id', 'tronos');
      } catch (error) {
        console.error('Error saving menu to Supabase:', error);
      }
    };
    saveMenu();
  }, [menuCategories, menuLoaded]);

  // ── Sincronizar config con Supabase ────────────────────────────────
  useEffect(() => {
    if (!menuLoaded) return;
    const saveConfig = async () => {
      try {
        await supabase
          .from('app_state')
          .update({ config_data: restaurantConfig })
          .eq('id', 'tronos');
      } catch (error) {
        console.error('Error saving config to Supabase:', error);
      }
    };
    saveConfig();
  }, [restaurantConfig, menuLoaded]);

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
  const addMenuItem = useCallback((categoryId, item) => {
    setMenuCategories((prev) =>
      prev.map((cat) => {
        if (cat.id === categoryId) {
          return { ...cat, items: [...cat.items, { ...item, extras: [] }] };
        }
        return cat;
      })
    );
  }, []);

  // Eliminar un plato
  const deleteMenuItem = useCallback((categoryId, itemId) => {
    setMenuCategories((prev) =>
      prev.map((cat) => {
        if (cat.id === categoryId) {
          return { ...cat, items: cat.items.filter((item) => item.id !== itemId) };
        }
        return cat;
      })
    );
    // Remover del carrito
    setCart((prev) => prev.filter((cartItem) => cartItem.id !== itemId));
  }, []);

  // Actualizar un plato
  const updateMenuItem = useCallback((categoryId, updatedItem) => {
    setMenuCategories((prev) =>
      prev.map((cat) => {
        if (cat.id === categoryId) {
          return {
            ...cat,
            items: cat.items.map((item) => (item.id === updatedItem.id ? { ...item, ...updatedItem } : item)),
          };
        }
        return cat;
      })
    );
    // Actualizar en el carrito si existe
    setCart((prev) =>
      prev.map((cartItem) =>
        cartItem.id === updatedItem.id
          ? { ...cartItem, name: updatedItem.name, price: updatedItem.price, image: updatedItem.image }
          : cartItem
      )
    );
  }, []);

  // Actualizar adicionales de un plato (Admin)
  const updateItemExtras = useCallback((categoryId, itemId, newExtras) => {
    setMenuCategories((prev) =>
      prev.map((cat) => {
        if (cat.id === categoryId) {
          return {
            ...cat,
            items: cat.items.map((item) => (item.id === itemId ? { ...item, extras: newExtras } : item)),
          };
        }
        return cat;
      })
    );
  }, []);

  // Añadir nueva categoría
  const addCategory = useCallback((category) => {
    setMenuCategories((prev) => [...prev, category]);
  }, []);

  // Eliminar categoría (y todos sus platos)
  const deleteCategory = useCallback((categoryId) => {
    setMenuCategories((prev) => prev.filter((cat) => cat.id !== categoryId));
    setCart((prevCart) => prevCart.filter(item => item.categoryId !== categoryId));
  }, []);

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
      return updated;
    });

    // Notificar a todas las pestañas (Carta web de clientes, Caja, Admin)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('tronos_orders_channel');
        channel.postMessage({ type: 'SYNC_CONFIG', data: { whatsapp: cleaned } });
        channel.close();
      } catch (e) {}
    }

    try {
      supabase
        .from('app_state')
        .update({ config_data: { whatsapp: cleaned } })
        .eq('id', 'tronos')
        .then(() => {})
        .catch(() => {});
    } catch (e) {}

    return cleaned;
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
      deleteOrder,
      purgeAuditOrder,
      resetAllOrdersData,
      posBackupFolderName,
      updatePosBackupFolderName,
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
      deleteOrder,
      purgeAuditOrder,
      resetAllOrdersData,
      posBackupFolderName,
      updatePosBackupFolderName,
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
