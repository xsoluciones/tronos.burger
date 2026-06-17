'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { defaultMenuData } from '../data/menuData';
import { supabase } from '../lib/supabaseClient';

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
            
            if (Array.isArray(parsedMenu) && parsedMenu[0]?.items?.[0]?.extras !== undefined) {
              setMenuCategories(parsedMenu);
            } else {
              setMenuCategories(defaultMenuData);
            }
          }

          // Parse config data
          if (data.config_data) {
            let parsedConfig = data.config_data;
            if (typeof parsedConfig === 'string') parsedConfig = JSON.parse(parsedConfig);
            if (parsedConfig.whatsapp) {
              setRestaurantConfig(parsedConfig);
            }
          }
        }
      } catch (err) {
        console.error('Error in loadFromSupabase:', err);
        // Fallback to defaults
        setMenuCategories(defaultMenuData);
      } finally {
        setMenuLoaded(true);
      }
    };

    loadFromSupabase();

    // Load auth from localStorage since it's user-specific and shouldn't be in the DB
    try {
      const storedAuth = localStorage.getItem(STORAGE_KEY_AUTH);
      if (storedAuth === 'true') {
        setIsAdmin(true);
      }
    } catch {
      // Ignorar errores
    }
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
