'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { defaultMenuData } from '../data/menuData';

const MenuContext = createContext(undefined);

const STORAGE_KEY_MENU = 'tronos-menu';
const STORAGE_KEY_AUTH = 'tronos-admin-auth';
const STORAGE_KEY_CONFIG = 'tronos-config';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'tronos2024';

const defaultRestaurantConfig = {
  whatsapp: '573007708816',
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
  const [menuCategories, setMenuCategories] = useState(defaultMenuData);
  const [menuLoaded, setMenuLoaded] = useState(false);

  // ── Estado del carrito ───────────────────────────────────────────────
  const [cart, setCart] = useState([]);

  // ── Estado de admin ──────────────────────────────────────────────────
  const [isAdmin, setIsAdmin] = useState(false);

  // ── Configuración General ────────────────────────────────────────────
  const [restaurantConfig, setRestaurantConfig] = useState(defaultRestaurantConfig);

  // ── Estado de ver más expandido (mutuamente excluyente) ──────────────
  const [expandedItemId, setExpandedItemId] = useState(null);

  // ── Cargar datos de localStorage después del montaje (solo cliente) ──
  useEffect(() => {
    try {
      const storedMenu = localStorage.getItem(STORAGE_KEY_MENU);
      if (storedMenu) {
        const parsed = JSON.parse(storedMenu);
        // Validar si es la nueva estructura (array) y si los items tienen la propiedad extras
        if (Array.isArray(parsed) && parsed[0]?.items?.[0]?.extras !== undefined) {
          setMenuCategories(parsed);
        } else {
          // Si era la vieja, la ignoramos y sobreescribimos usando defaultMenuData
          console.warn('Estructura de menú vieja detectada. Reseteando a la versión con categorías dinámicas y adicionales.');
          setMenuCategories(defaultMenuData);
        }
      }
    } catch {
      // Error leyendo
    }
    setMenuLoaded(true);

    try {
      const storedAuth = localStorage.getItem(STORAGE_KEY_AUTH);
      if (storedAuth === 'true') {
        setIsAdmin(true);
      }
    } catch {
      // Ignorar errores
    }

    try {
      const storedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (storedConfig) {
        setRestaurantConfig(JSON.parse(storedConfig));
      }
    } catch {
      // Ignorar
    }
  }, []);

  // ── Sincronizar menú con localStorage ────────────────────────────────
  useEffect(() => {
    if (!menuLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY_MENU, JSON.stringify(menuCategories));
    } catch {
      // Ignorar errores
    }
  }, [menuCategories, menuLoaded]);

  // ── Sincronizar config con localStorage ────────────────────────────────
  useEffect(() => {
    if (!menuLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(restaurantConfig));
    } catch {
      // Ignorar errores
    }
  }, [restaurantConfig, menuLoaded]);

  // ── Sincronizar autenticación con localStorage ───────────────────────
  useEffect(() => {
    try {
      if (isAdmin) {
        localStorage.setItem(STORAGE_KEY_AUTH, 'true');
      } else {
        localStorage.removeItem(STORAGE_KEY_AUTH);
      }
    } catch {
      // Ignorar
    }
  }, [isAdmin]);

  // ── Funciones del carrito ────────────────────────────────────────────
  const addToCart = useCallback((item) => {
    setCart((prev) => {
      // Agrupamos por id del plato
      const existing = prev.find((cartItem) => cartItem.id === item.id);
      if (existing) {
        return prev.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prev, { 
        ...item, 
        cartItemId: `${item.id}-${Date.now()}`, 
        quantity: 1, 
        selectedExtras: [] // Array of { id, name, price, quantity }
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
    setRestaurantConfig(prev => ({ ...prev, whatsapp: phone }));
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
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setIsAdmin(false);
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
      isAdmin,
      login,
      logout,
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
      isAdmin,
      login,
      logout,
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
