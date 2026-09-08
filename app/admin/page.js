'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useMenu } from '@/app/context/MenuContext';
import { formatPrice } from '@/app/data/menuData';

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
    addSocial,
    removeSocial,
    isAdmin,
    login,
    logout,
    orders = [],
    addOrder,
    updateOrderStatus,
    deleteOrder,
    posBackupFolderName,
    updatePosBackupFolderName,
  } = useMenu();

  // ── Tema Día / Noche ──────────────────────────────────────────
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('tronos-pos-theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
      }
    } catch (e) {}
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      localStorage.setItem('tronos-pos-theme', nextTheme);
    } catch (e) {}
  };

  // ── Reloj en vivo para el POS ────────────────────────────────
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('es-CO', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }) + ' • ' + now.toLocaleTimeString('es-CO')
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Pestaña Activa ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'menu' | 'settings'

  // ── Filtros de Pedidos ────────────────────────────────────────
  const [orderFilter, setOrderFilter] = useState('all'); // 'all' | 'pendiente' | 'en_camino' | 'entregado'
  const [orderSearch, setOrderSearch] = useState('');

  // ── Directorio para Respaldo Electrónico en PC ───────────────
  const [directoryHandle, setDirectoryHandle] = useState(null);

  // ── Estado de Pedido para Impresión Térmica ───────────────────
  const [printingOrder, setPrintingOrder] = useState(null);

  // ── Alertas / Notificaciones ──────────────────────────────────
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3500);
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(''), 3500);
  };

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
  const [formErrors, setFormErrors] = useState({});
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItem, setEditingItem] = useState({
    id: '',
    name: '',
    price: '',
    description: '',
    detailedDescription: '',
    image: '',
    categoryId: '',
  });
  const [managingExtrasForItemId, setManagingExtrasForItemId] = useState(null);
  const [newExtra, setNewExtra] = useState({ name: '', price: '', image: '' });

  // ── Config State ──────────────────────────────────────────────
  const [whatsappInput, setWhatsappInput] = useState('');
  const [newSocial, setNewSocial] = useState({ name: '', url: '', image: '' });

  useEffect(() => {
    if (restaurantConfig?.whatsapp) {
      setWhatsappInput(restaurantConfig.whatsapp);
    }
  }, [restaurantConfig?.whatsapp]);

  // ── Métricas POS ─────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o) => o.status === 'pendiente').length;
    const inTransitOrders = orders.filter((o) => o.status === 'en_camino').length;
    const totalSales = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalMenuItems = menuCategories.reduce((sum, c) => sum + (c.items?.length || 0), 0);

    return {
      totalOrders,
      pendingOrders,
      inTransitOrders,
      totalSales,
      totalMenuItems,
      totalCategories: menuCategories.length,
    };
  }, [orders, menuCategories]);

  // ── Filtrado de Pedidos ──────────────────────────────────────
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesFilter =
        orderFilter === 'all' || order.status === orderFilter;
      const search = orderSearch.toLowerCase().trim();
      const matchesSearch =
        !search ||
        order.id?.toLowerCase().includes(search) ||
        order.customer?.nombre?.toLowerCase().includes(search) ||
        order.customer?.telefono?.includes(search) ||
        order.customer?.direccion?.toLowerCase().includes(search);
      return matchesFilter && matchesSearch;
    });
  }, [orders, orderFilter, orderSearch]);

  // ── Generador de Factura Electrónica (HTML Standalone) ────────
  const generateElectronicInvoiceHtml = (order) => {
    const dateFormatted = new Date(order.date || Date.now()).toLocaleString('es-CO');
    const itemsHtml = (order.items || [])
      .map((item) => {
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        const extrasHtml = (item.selectedExtras || [])
          .map((e) => `<div style="font-size:12px; color:#555; padding-left:10px;">+ ${e.name} x${e.quantity || 1} (${formatPrice((e.price || 0) * (e.quantity || 1))})</div>`)
          .join('');
        const removedHtml = (item.removedIngredients || []).length > 0
          ? `<div style="font-size:12px; color:#c0392b; padding-left:10px;">🚫 Sin: ${item.removedIngredients.join(', ')}</div>`
          : '';
        const noteHtml = item.note ? `<div style="font-size:12px; color:#7f8c8d; font-style:italic; padding-left:10px;">Nota: ${item.note}</div>` : '';

        return `
          <tr>
            <td style="padding:8px 0; border-bottom:1px solid #eee;">
              <strong>${item.name}</strong> x${item.quantity || 1}
              ${extrasHtml}
              ${removedHtml}
              ${noteHtml}
            </td>
            <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:right; vertical-align:top; font-weight:bold;">
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
  <title>Factura Electrónica - ${order.id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 20px; }
    .invoice-card { max-width: 500px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 16px; margin-bottom: 16px; }
    .title { font-size: 22px; font-weight: 800; color: #b45309; margin: 0; letter-spacing: 1px; }
    .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
    .meta-box { background: #f8fafc; border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 13px; }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .meta-label { font-weight: 600; color: #475569; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 14px; }
    .total-box { border-top: 2px dashed #cbd5e1; padding-top: 12px; text-align: right; }
    .total-title { font-size: 14px; color: #64748b; text-transform: uppercase; }
    .total-amount { font-size: 24px; font-weight: 800; color: #b45309; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <h1 class="title">🏰 TRONOS PUB & GRILL</h1>
      <div class="subtitle">Carnes, Hamburguesas & Parrilla</div>
      <div style="font-size:12px; color:#64748b; margin-top:4px;">Factura Electrónica de Venta / Respaldo Digital</div>
    </div>

    <div class="meta-box">
      <div class="meta-row"><span class="meta-label">Factura N°:</span> <span><strong>${order.id}</strong></span></div>
      <div class="meta-row"><span class="meta-label">Fecha y Hora:</span> <span>${dateFormatted}</span></div>
      <div class="meta-row"><span class="meta-label">Cliente:</span> <span>${order.customer?.nombre || 'Cliente General'}</span></div>
      <div class="meta-row"><span class="meta-label">Teléfono:</span> <span>${order.customer?.telefono || 'N/A'}</span></div>
      <div class="meta-row"><span class="meta-label">Dirección:</span> <span>${order.customer?.direccion || 'Entrega en local'}</span></div>
      ${order.customer?.descripcion ? `<div class="meta-row"><span class="meta-label">Ref. Entrega:</span> <span>${order.customer.descripcion}</span></div>` : ''}
    </div>

    <table class="table">
      <thead>
        <tr>
          <th style="text-align:left; border-bottom:1px solid #cbd5e1; padding-bottom:6px; font-size:12px; color:#64748b;">PRODUCTO</th>
          <th style="text-align:right; border-bottom:1px solid #cbd5e1; padding-bottom:6px; font-size:12px; color:#64748b;">SUBTOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="total-box">
      <div class="total-title">Total a Pagar</div>
      <div class="total-amount">${formatPrice(order.total || 0)}</div>
    </div>

    <div class="footer">
      <p style="margin:0;">¡Gracias por elegir Tronos Pub & Grill! 🍔</p>
      <p style="margin:4px 0 0 0; font-size:11px;">Copia Electrónica Generada Automáticamente</p>
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

    // Si el usuario seleccionó una carpeta con la API de Archivos del Navegador
    if (directoryHandle) {
      try {
        const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(htmlContent);
        await writable.close();
        return { success: true, method: 'folder', fileName, folderName: directoryHandle.name };
      } catch (err) {
        console.warn('No se pudo escribir en el directorio seleccionado, recurriendo a descarga:', err);
      }
    }

    // Fallback: Descarga automática del navegador
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true, method: 'download', fileName };
  };

  // ── Selector de Carpeta en la Computadora ─────────────────────
  const handleSelectFolder = async () => {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const handle = await window.showDirectoryPicker();
        setDirectoryHandle(handle);
        updatePosBackupFolderName(handle.name);
        showSuccess(`¡Carpeta "${handle.name}" conectada! Las facturas electrónicas se guardarán aquí.`);
      } catch (err) {
        if (err.name !== 'AbortError') {
          showError('Error al seleccionar la carpeta: ' + err.message);
        }
      }
    } else {
      showError('Tu navegador no admite selección directa de carpetas. Las facturas se guardarán mediante Descarga Automática.');
    }
  };

  // ── Enviar Domicilio & Generar Factura (2 Físicas + 1 Electrónica) ─
  const handleDespacharYFacturar = async (order) => {
    // 1. Cambiar estado a 'en_camino'
    updateOrderStatus(order.id, 'en_camino');

    // 2. Guardar Factura Electrónica
    try {
      const res = await saveElectronicInvoice(order);
      if (res.method === 'folder') {
        showSuccess(`✅ Pedido #${order.id} despachado. Factura electrónica guardada en "${res.folderName}"`);
      } else {
        showSuccess(`✅ Pedido #${order.id} despachado. Factura electrónica descargada.`);
      }
    } catch (e) {
      showError('Error al guardar la factura electrónica.');
    }

    // 3. Preparar e imprimir las 2 copias físicas idénticas
    setPrintingOrder(order);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // ── Solo Imprimir Físico (2 Copias) ───────────────────────────
  const handlePrintPhysicalOnly = (order) => {
    setPrintingOrder(order);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // ── Manejo de Formularios de Carta / Menú ──────────────────────
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const success = login(credentials.username, credentials.password);
    if (!success) setLoginError(true);
  };

  const handleAddItemSubmit = (e, categoryId) => {
    e.preventDefault();
    if (!newItem.name.trim() || !newItem.description.trim() || !newItem.price || isNaN(newItem.price)) {
      showError('Completa todos los campos del producto.');
      return;
    }

    const slug = newItem.name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
    const id = `${slug}-${Date.now()}`;
    const imagePath = newItem.image.trim() || '/images/tronos-clasica.png';

    addMenuItem(categoryId, {
      id,
      name: newItem.name.trim(),
      description: newItem.description.trim(),
      detailedDescription: newItem.detailedDescription.trim(),
      price: parseFloat(newItem.price),
      image: imagePath,
      categoryId,
    });

    showSuccess('¡Plato agregado con éxito al menú!');
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
    if (!editingItem.name.trim() || !editingItem.description.trim() || isNaN(editingItem.price)) {
      showError('Valores inválidos.');
      return;
    }
    updateMenuItem(editingItem.categoryId, {
      id: editingItem.id,
      name: editingItem.name.trim(),
      description: editingItem.description.trim(),
      detailedDescription: editingItem.detailedDescription.trim(),
      price: parseFloat(editingItem.price),
      image: editingItem.image.trim(),
      categoryId: editingItem.categoryId,
    });
    setEditingItemId(null);
    showSuccess('¡Plato actualizado!');
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
    showSuccess('Categoría añadida.');
  };

  const handleAddExtra = (e, item) => {
    e.preventDefault();
    if (!newExtra.name.trim() || isNaN(newExtra.price)) {
      showError('Nombre y precio del adicional requeridos.');
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
    showSuccess('Adicional agregado.');
  };

  const handleDeleteExtra = (item, extraId) => {
    if (confirm('¿Deseas eliminar este adicional?')) {
      const updatedExtras = (item.extras || []).filter((e) => e.id !== extraId);
      updateItemExtras(item.categoryId, item.id, updatedExtras);
    }
  };

  // ── Pantalla de Login si no es Admin ───────────────────────────
  if (!isAdmin) {
    return (
      <div className={`admin-login-screen ${theme === 'dark' ? 'dark-mode' : 'light-mode'}`}>
        <style jsx>{`
          .admin-login-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            transition: background 0.3s ease;
          }
          .dark-mode {
            background: radial-gradient(circle at top, #161b22 0%, #090d13 100%);
            color: #f1f5f9;
          }
          .light-mode {
            background: radial-gradient(circle at top, #f8fafc 0%, #e2e8f0 100%);
            color: #0f172a;
          }
          .login-box {
            width: 100%;
            max-width: 420px;
            padding: 2.5rem;
            border-radius: 18px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.25);
            transition: all 0.3s;
          }
          .dark-mode .login-box {
            background: rgba(22, 27, 34, 0.95);
            border: 1px solid rgba(212, 168, 67, 0.3);
          }
          .light-mode .login-box {
            background: #ffffff;
            border: 1px solid #cbd5e1;
          }
          .pos-badge {
            display: inline-block;
            background: rgba(245, 158, 11, 0.15);
            color: #d97706;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 1px;
            margin-bottom: 0.8rem;
          }
          .dark-mode .pos-badge {
            color: #f59e0b;
          }
          .login-title {
            font-size: 1.5rem;
            font-weight: 800;
            letter-spacing: 0.5px;
            margin-bottom: 0.25rem;
          }
          .input-label {
            font-size: 0.8rem;
            font-weight: 600;
            margin-bottom: 0.4rem;
            display: block;
          }
          .pos-input {
            width: 100%;
            padding: 12px 14px;
            border-radius: 10px;
            font-size: 0.95rem;
            outline: none;
            transition: all 0.2s;
            margin-bottom: 1rem;
          }
          .dark-mode .pos-input {
            background: #0d1117;
            border: 1.5px solid #30363d;
            color: #f0f6fc;
          }
          .light-mode .pos-input {
            background: #f8fafc;
            border: 1.5px solid #cbd5e1;
            color: #0f172a;
          }
          .pos-input:focus {
            border-color: #d97706;
            box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.2);
          }
          .pos-btn-primary {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #d97706, #f59e0b);
            color: #ffffff;
            border: none;
            border-radius: 10px;
            font-weight: 700;
            font-size: 1rem;
            cursor: pointer;
            transition: opacity 0.2s;
          }
          .pos-btn-primary:hover { opacity: 0.92; }
          .theme-toggle-btn {
            position: absolute;
            top: 20px;
            right: 20px;
            background: transparent;
            border: 1px solid currentColor;
            border-radius: 20px;
            padding: 6px 14px;
            font-size: 0.85rem;
            cursor: pointer;
          }
        `}</style>

        <button onClick={toggleTheme} className="theme-toggle-btn">
          {theme === 'dark' ? '☀️ Modo Día' : '🌙 Modo Noche'}
        </button>

        <div className="login-box text-center">
          <Image
            src="/images/logo-tronos.webp"
            alt="Tronos Logo"
            width={85}
            height={85}
            unoptimized
            style={{ borderRadius: '12px', marginBottom: '0.8rem' }}
          />
          <span className="pos-badge">SISTEMA POS TRONOS</span>
          <h1 className="login-title">Acceso al Panel</h1>
          <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1.5rem' }}>
            Control de comanda, pedidos, menú y facturación
          </p>

          {loginError && (
            <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Usuario o contraseña incorrectos.
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="text-start">
            <label className="input-label">Usuario</label>
            <input
              type="text"
              name="username"
              value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
              className="pos-input"
              required
            />
            <label className="input-label">Contraseña</label>
            <input
              type="password"
              name="password"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              className="pos-input"
              required
            />
            <button type="submit" className="pos-btn-primary mt-2">
              Ingresar al POS
            </button>
          </form>

          <Link href="/" style={{ display: 'inline-block', marginTop: '1.5rem', fontSize: '0.85rem', opacity: 0.7, textDecoration: 'none', color: 'inherit' }}>
            ← Volver a la Carta
          </Link>
        </div>
      </div>
    );
  }

  // ── Render Principal del Panel POS ──────────────────────────────
  return (
    <div className={`pos-app-root ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
      <style jsx global>{`
        /* ── Estilos de Pantalla del POS ── */
        .pos-app-root {
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          transition: background-color 0.25s, color 0.25s;
        }

        .theme-dark {
          --bg-main: #0a0d12;
          --bg-card: #121720;
          --bg-card-alt: #18202c;
          --border-color: #242f40;
          --border-accent: rgba(245, 158, 11, 0.35);
          --text-primary: #f1f5f9;
          --text-secondary: #94a3b8;
          --input-bg: #0e131a;
          --accent-primary: #f59e0b;
          --accent-secondary: #d97706;
          --stat-card-bg: linear-gradient(135deg, #131922, #182230);
          --highlight: rgba(245, 158, 11, 0.15);
        }

        .theme-light {
          --bg-main: #f1f5f9;
          --bg-card: #ffffff;
          --bg-card-alt: #f8fafc;
          --border-color: #cbd5e1;
          --border-accent: rgba(217, 119, 6, 0.4);
          --text-primary: #0f172a;
          --text-secondary: #475569;
          --input-bg: #ffffff;
          --accent-primary: #d97706;
          --accent-secondary: #b45309;
          --stat-card-bg: linear-gradient(135deg, #ffffff, #f8fafc);
          --highlight: rgba(217, 119, 6, 0.1);
        }

        .pos-app-root {
          background-color: var(--bg-main);
          color: var(--text-primary);
        }

        /* ── Ocultar tickets en pantalla ── */
        .print-only-container {
          display: none;
        }

        /* ── ESTILOS PARA IMPRESIÓN FÍSICA EN IMPRESORA POS (58mm/80mm) ── */
        @media print {
          body * {
            visibility: hidden;
          }
          .pos-app-root, .pos-header, .pos-tabs, .pos-stats-grid, .pos-content-section {
            display: none !important;
          }
          .print-only-container, .print-only-container * {
            visibility: visible !important;
            display: block !important;
          }
          .print-only-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 2mm !important;
            background: #fff !important;
            color: #000 !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
          }
          .ticket-copy {
            page-break-inside: avoid;
            margin-bottom: 8mm;
          }
          .ticket-cut-divider {
            text-align: center;
            font-weight: bold;
            border-top: 2px dashed #000;
            border-bottom: 2px dashed #000;
            margin: 8mm 0;
            padding: 4mm 0;
            font-size: 10px;
          }
        }
      `}</style>

      {/* ── Barra Superior POS ── */}
      <header className="pos-header border-bottom py-2 px-3 px-md-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div className="d-flex align-items-center gap-3">
            <Image
              src="/images/logo-tronos.webp"
              alt="Logo"
              width={46}
              height={46}
              unoptimized
              style={{ borderRadius: '8px', border: '1px solid var(--border-accent)' }}
            />
            <div>
              <div className="d-flex align-items-center gap-2">
                <h1 className="m-0 fs-5 fw-bold" style={{ color: 'var(--accent-primary)', letterSpacing: '0.5px' }}>
                  TRONOS BURGER POS
                </h1>
                <span className="badge rounded-pill px-2 py-1" style={{ background: 'var(--highlight)', color: 'var(--accent-primary)', fontSize: '0.7rem' }}>
                  ADMINISTRACIÓN
                </span>
              </div>
              <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                🕒 {currentTime || 'Cargando reloj...'}
              </small>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            {/* Toggle Día / Noche */}
            <button
              onClick={toggleTheme}
              className="btn btn-sm d-flex align-items-center gap-1 fw-bold"
              style={{
                background: 'var(--bg-card-alt)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '6px 12px',
              }}
              title="Cambiar tema Día / Noche"
            >
              {theme === 'dark' ? '☀️ Modo Día' : '🌙 Modo Noche'}
            </button>

            {/* Ver Carta */}
            <Link
              href="/"
              className="btn btn-sm d-flex align-items-center gap-1"
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '6px 12px',
                textDecoration: 'none',
              }}
            >
              👁️ Ver Carta
            </Link>

            {/* Cerrar Sesión */}
            <button
              onClick={logout}
              className="btn btn-sm fw-semibold"
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '6px 12px',
              }}
            >
              🔒 Salir
            </button>
          </div>
        </div>
      </header>

      {/* ── Alertas Globales ── */}
      {successMessage && (
        <div className="alert alert-success m-3 mb-0 d-flex align-items-center gap-2" style={{ borderRadius: '10px' }}>
          <span>✅</span>
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="alert alert-danger m-3 mb-0 d-flex align-items-center gap-2" style={{ borderRadius: '10px' }}>
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Contenedor Principal del Panel ── */}
      <main className="container-fluid px-3 px-md-4 py-4">
        {/* ── Fila de Métricas Rápidas POS ── */}
        <div className="row g-3 mb-4">
          <div className="col-6 col-md-3">
            <div className="p-3 h-100 rounded-3 shadow-sm border" style={{ background: 'var(--stat-card-bg)', borderColor: 'var(--border-color)' }}>
              <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Pedidos Registrados</small>
              <div className="d-flex align-items-baseline gap-2 mt-1">
                <span className="fs-3 fw-bolder">{metrics.totalOrders}</span>
                {metrics.pendingOrders > 0 && (
                  <span className="badge bg-warning text-dark px-2 py-1" style={{ fontSize: '0.75rem' }}>
                    {metrics.pendingOrders} pendientes
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="p-3 h-100 rounded-3 shadow-sm border" style={{ background: 'var(--stat-card-bg)', borderColor: 'var(--border-color)' }}>
              <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Total en Ventas</small>
              <div className="fs-4 fw-bolder mt-1" style={{ color: 'var(--accent-primary)' }}>
                {formatPrice(metrics.totalSales)}
              </div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="p-3 h-100 rounded-3 shadow-sm border" style={{ background: 'var(--stat-card-bg)', borderColor: 'var(--border-color)' }}>
              <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Platos en Menú</small>
              <div className="fs-3 fw-bolder mt-1">{metrics.totalMenuItems} productos</div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="p-3 h-100 rounded-3 shadow-sm border" style={{ background: 'var(--stat-card-bg)', borderColor: 'var(--border-color)' }}>
              <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Respaldo PC</small>
              <div className="mt-1 text-truncate" style={{ fontSize: '0.85rem' }}>
                {posBackupFolderName ? (
                  <span className="text-success fw-bold">🟢 {posBackupFolderName}</span>
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>⚪ Descarga Auto</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Navegación de Pestañas POS ── */}
        <div className="d-flex gap-2 border-bottom pb-2 mb-4 overflow-auto" style={{ borderColor: 'var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('orders')}
            className="btn fw-bold d-flex align-items-center gap-2"
            style={{
              background: activeTab === 'orders' ? 'var(--accent-primary)' : 'var(--bg-card)',
              color: activeTab === 'orders' ? '#ffffff' : 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '8px 18px',
              whiteSpace: 'nowrap',
            }}
          >
            📦 Comandas & Pedidos POS
            {metrics.pendingOrders > 0 && (
              <span className="badge bg-danger text-white rounded-pill px-2 py-0" style={{ fontSize: '0.75rem' }}>
                {metrics.pendingOrders}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('menu')}
            className="btn fw-bold d-flex align-items-center gap-2"
            style={{
              background: activeTab === 'menu' ? 'var(--accent-primary)' : 'var(--bg-card)',
              color: activeTab === 'menu' ? '#ffffff' : 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '8px 18px',
              whiteSpace: 'nowrap',
            }}
          >
            🍔 Gestión de Carta & Menú ({metrics.totalMenuItems})
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className="btn fw-bold d-flex align-items-center gap-2"
            style={{
              background: activeTab === 'settings' ? 'var(--accent-primary)' : 'var(--bg-card)',
              color: activeTab === 'settings' ? '#ffffff' : 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '8px 18px',
              whiteSpace: 'nowrap',
            }}
          >
            ⚙️ Ajustes & Respaldo en PC
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            PESTAÑA 1: COMANDAS & PEDIDOS POS
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'orders' && (
          <div>
            {/* Controles de filtro y búsqueda */}
            <div className="card p-3 mb-4 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <div className="row g-3 align-items-center">
                <div className="col-12 col-md-6">
                  <div className="btn-group w-100" role="group">
                    <button
                      type="button"
                      onClick={() => setOrderFilter('all')}
                      className={`btn btn-sm ${orderFilter === 'all' ? 'btn-warning text-dark fw-bold' : 'btn-outline-secondary'}`}
                    >
                      Todos ({orders.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderFilter('pendiente')}
                      className={`btn btn-sm ${orderFilter === 'pendiente' ? 'btn-warning text-dark fw-bold' : 'btn-outline-secondary'}`}
                    >
                      Pendientes ({metrics.pendingOrders})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderFilter('en_camino')}
                      className={`btn btn-sm ${orderFilter === 'en_camino' ? 'btn-warning text-dark fw-bold' : 'btn-outline-secondary'}`}
                    >
                      En Camino ({metrics.inTransitOrders})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderFilter('entregado')}
                      className={`btn btn-sm ${orderFilter === 'entregado' ? 'btn-warning text-dark fw-bold' : 'btn-outline-secondary'}`}
                    >
                      Entregados
                    </button>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <input
                    type="text"
                    placeholder="🔍 Buscar por cliente, teléfono o #TRN..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="form-control form-control-sm"
                    style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
                  />
                </div>
              </div>
            </div>

            {/* Listado de Pedidos */}
            {filteredOrders.length === 0 ? (
              <div className="card p-5 text-center border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <p className="fs-3 mb-2">📋</p>
                <h3 className="fs-5 fw-bold">No hay pedidos en esta vista</h3>
                <p className="text-muted small">Los pedidos que realicen los clientes por la web aparecerán automáticamente aquí.</p>
              </div>
            ) : (
              <div className="row g-3">
                {filteredOrders.map((order) => {
                  const isPending = order.status === 'pendiente';
                  const isInTransit = order.status === 'en_camino';
                  const isDelivered = order.status === 'entregado';

                  return (
                    <div key={order.id} className="col-12 col-lg-6">
                      <div
                        className="card h-100 border shadow-sm"
                        style={{
                          background: 'var(--bg-card)',
                          borderColor: isPending ? 'var(--accent-primary)' : 'var(--border-color)',
                          borderRadius: '12px',
                        }}
                      >
                        {/* Cabecera de la Comanda */}
                        <div
                          className="card-header d-flex justify-content-between align-items-center py-2 px-3"
                          style={{
                            background: isPending ? 'var(--highlight)' : 'var(--bg-card-alt)',
                            borderBottom: '1px solid var(--border-color)',
                          }}
                        >
                          <div className="d-flex align-items-center gap-2">
                            <span className="fw-bolder fs-6" style={{ color: 'var(--accent-primary)' }}>
                              #{order.id}
                            </span>
                            <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                              {new Date(order.date || Date.now()).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            </small>
                          </div>

                          <div>
                            {isPending && (
                              <span className="badge bg-warning text-dark fw-bold px-2 py-1" style={{ fontSize: '0.75rem' }}>
                                ⏳ Pendiente
                              </span>
                            )}
                            {isInTransit && (
                              <span className="badge bg-primary text-white fw-bold px-2 py-1" style={{ fontSize: '0.75rem' }}>
                                🛵 En Camino
                              </span>
                            )}
                            {isDelivered && (
                              <span className="badge bg-success text-white fw-bold px-2 py-1" style={{ fontSize: '0.75rem' }}>
                                ✅ Entregado
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Cuerpo de la Comanda */}
                        <div className="card-body p-3">
                          {/* Datos del Cliente */}
                          <div className="p-2 mb-3 rounded-2" style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                            <div className="fw-bold fs-6 mb-1">👤 {order.customer?.nombre || 'Cliente General'}</div>
                            <div className="text-truncate">📞 <strong>Tel:</strong> {order.customer?.telefono || 'N/A'}</div>
                            <div className="text-truncate">📍 <strong>Dir:</strong> {order.customer?.direccion || 'En local'}</div>
                            {order.customer?.descripcion && (
                              <div className="text-muted fst-italic mt-1" style={{ fontSize: '0.78rem' }}>
                                🏠 Ref: {order.customer.descripcion}
                              </div>
                            )}
                          </div>

                          {/* Lista de Ítems */}
                          <h6 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                            Detalle del Pedido:
                          </h6>
                          <div className="mb-3 d-flex flex-column gap-1">
                            {(order.items || []).map((item, idx) => (
                              <div
                                key={idx}
                                className="d-flex justify-content-between align-items-start py-1 border-bottom"
                                style={{ borderColor: 'var(--border-color)', fontSize: '0.85rem' }}
                              >
                                <div style={{ flex: 1 }}>
                                  <span className="fw-bold">{item.name}</span> <span className="badge bg-secondary">x{item.quantity || 1}</span>
                                  {/* Extras */}
                                  {(item.selectedExtras || []).map((ex, eIdx) => (
                                    <div key={eIdx} className="text-success small ms-2">
                                      + {ex.name} x{ex.quantity || 1} ({formatPrice((ex.price || 0) * (ex.quantity || 1))})
                                    </div>
                                  ))}
                                  {/* Ingredientes removidos */}
                                  {(item.removedIngredients || []).length > 0 && (
                                    <div className="text-danger small ms-2">
                                      🚫 Sin: {item.removedIngredients.join(', ')}
                                    </div>
                                  )}
                                  {/* Nota */}
                                  {item.note && (
                                    <div className="text-muted fst-italic small ms-2">
                                      💬 {item.note}
                                    </div>
                                  )}
                                </div>
                                <div className="fw-bold ms-2" style={{ color: 'var(--accent-primary)' }}>
                                  {formatPrice((item.price || 0) * (item.quantity || 1))}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Total */}
                          <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
                            <span className="fw-bold fs-6">TOTAL:</span>
                            <span className="fw-bolder fs-5" style={{ color: 'var(--accent-primary)' }}>
                              {formatPrice(order.total || 0)}
                            </span>
                          </div>
                        </div>

                        {/* Botones de Acción POS */}
                        <div className="card-footer p-2 d-flex flex-wrap gap-2 justify-content-between align-items-center" style={{ background: 'var(--bg-card-alt)', borderTop: '1px solid var(--border-color)' }}>
                          <div className="d-flex gap-1">
                            <button
                              onClick={() => {
                                if (confirm(`¿Eliminar comanda #${order.id}?`)) {
                                  deleteOrder(order.id);
                                  showSuccess(`Comanda #${order.id} eliminada.`);
                                }
                              }}
                              className="btn btn-sm btn-outline-danger"
                              title="Eliminar Pedido"
                            >
                              🗑️
                            </button>
                            <button
                              onClick={() => saveElectronicInvoice(order)}
                              className="btn btn-sm btn-outline-secondary"
                              title="Guardar / Descargar Factura Electrónica"
                            >
                              💾 Electrónica
                            </button>
                            <button
                              onClick={() => handlePrintPhysicalOnly(order)}
                              className="btn btn-sm btn-outline-secondary"
                              title="Imprimir 2 Copias Físicas"
                            >
                              🖨️ Re-Imprimir (2)
                            </button>
                          </div>

                          <div className="d-flex gap-1">
                            {isPending && (
                              <button
                                onClick={() => handleDespacharYFacturar(order)}
                                className="btn btn-sm fw-bold btn-warning text-dark d-flex align-items-center gap-1 shadow-sm"
                                title="Cambiar a En Camino, imprimir 2 facturas y guardar copia electrónica"
                              >
                                🛵 Enviar Domicilio & Facturar
                              </button>
                            )}
                            {isInTransit && (
                              <button
                                onClick={() => {
                                  updateOrderStatus(order.id, 'entregado');
                                  showSuccess(`Pedido #${order.id} marcado como Entregado.`);
                                }}
                                className="btn btn-sm btn-success fw-bold"
                              >
                                ✅ Marcar Entregado
                              </button>
                            )}
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
            PESTAÑA 2: GESTIÓN DE CARTA & MENÚ
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'menu' && (
          <div>
            {/* Formulario Añadir Categoría */}
            <div className="card p-3 mb-4 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                  <h3 className="fs-6 fw-bold m-0" style={{ color: 'var(--accent-primary)' }}>
                    📂 Añadir Nueva Categoría a la Carta
                  </h3>
                  <small style={{ color: 'var(--text-secondary)' }}>Ej: Hamburguesas Especiales, Bebidas, Entradas</small>
                </div>
                <form onSubmit={handleAddCategory} className="d-flex gap-2" style={{ maxWidth: '400px', width: '100%' }}>
                  <input
                    type="text"
                    value={newCategoryTitle}
                    onChange={(e) => setNewCategoryTitle(e.target.value)}
                    placeholder="Nombre de la categoría..."
                    className="form-control form-control-sm"
                    style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
                  />
                  <button type="submit" className="btn btn-sm btn-warning text-dark fw-bold text-nowrap">
                    + Crear
                  </button>
                </form>
              </div>
            </div>

            {/* Listado de Categorías y sus Ítems */}
            <div className="d-flex flex-column gap-4">
              {menuCategories.map((category) => (
                <div
                  key={category.id}
                  className="card border shadow-sm"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '12px' }}
                >
                  <div className="card-header d-flex justify-content-between align-items-center py-2 px-3" style={{ background: 'var(--bg-card-alt)', borderBottom: '1px solid var(--border-color)' }}>
                    <div className="d-flex align-items-center gap-2">
                      <span className="fs-5 fw-bold" style={{ color: 'var(--accent-primary)' }}>
                        🍔 {category.title}
                      </span>
                      <span className="badge bg-secondary" style={{ fontSize: '0.75rem' }}>
                        {category.items?.length || 0} ítems
                      </span>
                    </div>

                    <div className="d-flex gap-2">
                      <button
                        onClick={() => setAddingToCategoryId(addingToCategoryId === category.id ? null : category.id)}
                        className="btn btn-sm btn-outline-warning"
                      >
                        {addingToCategoryId === category.id ? '✕ Cancelar' : '+ Añadir Plato'}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar la categoría "${category.title}"?`)) {
                            deleteCategory(category.id);
                            showSuccess('Categoría eliminada.');
                          }
                        }}
                        className="btn btn-sm btn-outline-danger"
                        title="Eliminar categoría"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div className="card-body p-3">
                    {/* Formulario Inline para Añadir Plato a esta categoría */}
                    {addingToCategoryId === category.id && (
                      <div className="p-3 mb-4 rounded-3 border" style={{ background: 'var(--bg-card-alt)', borderColor: 'var(--border-accent)' }}>
                        <h5 className="fs-6 fw-bold mb-3" style={{ color: 'var(--accent-primary)' }}>
                          Nuevo Plato en {category.title}
                        </h5>
                        <form onSubmit={(e) => handleAddItemSubmit(e, category.id)}>
                          <div className="row g-2">
                            <div className="col-12 col-md-6">
                              <label className="form-label small fw-bold">Nombre del Plato</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Ej: Tronos Doble Carne"
                                value={newItem.name}
                                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                required
                              />
                            </div>
                            <div className="col-12 col-md-6">
                              <label className="form-label small fw-bold">Precio ($ COP)</label>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                placeholder="Ej: 28000"
                                value={newItem.price}
                                onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                                required
                              />
                            </div>
                            <div className="col-12">
                              <label className="form-label small fw-bold">Descripción Corta (Ingredientes principales)</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Ej: Carne 150g, queso cheddar, tocineta ahumada, cebolla caramelizada"
                                value={newItem.description}
                                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                required
                              />
                            </div>
                            <div className="col-12 col-md-6">
                              <label className="form-label small fw-bold">Foto del Plato</label>
                              <input
                                type="file"
                                accept="image/*"
                                className="form-control form-control-sm"
                                onChange={(e) => handleImageUpload(e, setNewItem)}
                              />
                            </div>
                            <div className="col-12 col-md-6">
                              <label className="form-label small fw-bold">O URL de imagen existente</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="/images/tronos-clasica.png"
                                value={newItem.image}
                                onChange={(e) => setNewItem({ ...newItem, image: e.target.value })}
                              />
                            </div>
                            <div className="col-12 mt-3 text-end">
                              <button type="submit" className="btn btn-sm btn-warning text-dark fw-bold px-4">
                                Guardar Plato
                              </button>
                            </div>
                          </div>
                        </form>
                      </div>
                    )}

                    {/* Grilla de Platos de la Categoría */}
                    {(category.items || []).length === 0 ? (
                      <p className="text-muted small text-center my-3">No hay productos en esta categoría.</p>
                    ) : (
                      <div className="row g-3">
                        {category.items.map((item) => {
                          const isEditing = editingItemId === item.id;
                          const isManagingExtras = managingExtrasForItemId === item.id;

                          return (
                            <div key={item.id} className="col-12 col-md-6 col-xl-4">
                              <div className="card h-100 border" style={{ background: 'var(--bg-card-alt)', borderColor: 'var(--border-color)', borderRadius: '10px' }}>
                                {isEditing ? (
                                  /* Formulario de Edición */
                                  <form onSubmit={handleSaveEdit} className="p-3">
                                    <h6 className="fw-bold mb-2 text-warning">Editar Producto</h6>
                                    <input
                                      type="text"
                                      value={editingItem.name}
                                      onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                      className="form-control form-control-sm mb-2"
                                      placeholder="Nombre"
                                      required
                                    />
                                    <input
                                      type="number"
                                      value={editingItem.price}
                                      onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                                      className="form-control form-control-sm mb-2"
                                      placeholder="Precio"
                                      required
                                    />
                                    <textarea
                                      value={editingItem.description}
                                      onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                                      className="form-control form-control-sm mb-2"
                                      rows={2}
                                      placeholder="Descripción"
                                      required
                                    />
                                    <div className="d-flex gap-1 justify-content-end">
                                      <button type="button" onClick={() => setEditingItemId(null)} className="btn btn-sm btn-secondary">
                                        Cancelar
                                      </button>
                                      <button type="submit" className="btn btn-sm btn-warning text-dark fw-bold">
                                        Guardar
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  /* Vista del Producto */
                                  <div className="p-3 d-flex flex-column h-100">
                                    <div className="d-flex gap-2 align-items-start mb-2">
                                      {item.image ? (
                                        <img
                                          src={item.image}
                                          alt={item.name}
                                          width={55}
                                          height={55}
                                          style={{ objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                                        />
                                      ) : (
                                        <div style={{ width: 55, height: 55, background: '#333', borderRadius: 8 }} />
                                      )}
                                      <div style={{ flex: 1 }}>
                                        <h6 className="fw-bold m-0 fs-6">{item.name}</h6>
                                        <div className="fw-bolder mt-1" style={{ color: 'var(--accent-primary)', fontSize: '0.95rem' }}>
                                          {formatPrice(item.price)}
                                        </div>
                                      </div>
                                    </div>

                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', flex: 1, marginBottom: '0.75rem' }}>
                                      {item.description}
                                    </p>

                                    {/* Adicionales configurados */}
                                    <div className="mb-2">
                                      <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                        Adicionales ({item.extras?.length || 0}):
                                      </small>
                                      <button
                                        onClick={() => setManagingExtrasForItemId(isManagingExtras ? null : item.id)}
                                        className="btn btn-sm py-0 px-2 ms-2 btn-outline-secondary"
                                        style={{ fontSize: '0.72rem' }}
                                      >
                                        {isManagingExtras ? '✕ Ocultar' : '⚙️ Gestionar Extras'}
                                      </button>
                                    </div>

                                    {/* Panel Inline de Gestión de Extras */}
                                    {isManagingExtras && (
                                      <div className="p-2 mb-2 rounded border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-accent)', fontSize: '0.8rem' }}>
                                        <div className="mb-2 d-flex flex-column gap-1">
                                          {(item.extras || []).map((extra) => (
                                            <div key={extra.id} className="d-flex justify-content-between align-items-center py-1 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                                              <span>{extra.name} ({formatPrice(extra.price)})</span>
                                              <button onClick={() => handleDeleteExtra(item, extra.id)} className="btn btn-sm p-0 text-danger" title="Eliminar">🗑️</button>
                                            </div>
                                          ))}
                                        </div>
                                        <form onSubmit={(e) => handleAddExtra(e, item)} className="d-flex gap-1">
                                          <input
                                            type="text"
                                            placeholder="Extra (ej: Tocineta)"
                                            value={newExtra.name}
                                            onChange={(e) => setNewExtra({ ...newExtra, name: e.target.value })}
                                            className="form-control form-control-sm py-1"
                                            style={{ fontSize: '0.75rem' }}
                                          />
                                          <input
                                            type="number"
                                            placeholder="Precio"
                                            value={newExtra.price}
                                            onChange={(e) => setNewExtra({ ...newExtra, price: e.target.value })}
                                            className="form-control form-control-sm py-1"
                                            style={{ width: '80px', fontSize: '0.75rem' }}
                                          />
                                          <button type="submit" className="btn btn-sm btn-warning text-dark py-1 px-2 fw-bold" style={{ fontSize: '0.75rem' }}>+</button>
                                        </form>
                                      </div>
                                    )}

                                    {/* Botones de acción del plato */}
                                    <div className="d-flex justify-content-end gap-1 mt-auto pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
                                      <button
                                        onClick={() => handleStartEdit(item, category.id)}
                                        className="btn btn-sm btn-outline-secondary py-1 px-2"
                                        style={{ fontSize: '0.8rem' }}
                                      >
                                        ✏️ Editar
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (confirm(`¿Eliminar "${item.name}"?`)) {
                                            deleteMenuItem(category.id, item.id);
                                            showSuccess('Plato eliminado.');
                                          }
                                        }}
                                        className="btn btn-sm btn-outline-danger py-1 px-2"
                                        style={{ fontSize: '0.8rem' }}
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            PESTAÑA 3: AJUSTES & RESPALDO PC
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="row g-4">
            {/* SECCIÓN ESPECIAL: Respaldo Electrónico en Carpeta de la PC */}
            <div className="col-12 col-lg-6">
              <div className="card h-100 border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-accent)', borderRadius: '12px' }}>
                <div className="card-header py-3 px-4" style={{ background: 'var(--bg-card-alt)', borderBottom: '1px solid var(--border-color)' }}>
                  <h4 className="fs-6 fw-bold m-0" style={{ color: 'var(--accent-primary)' }}>
                    💾 Respaldo de Factura Electrónica en tu PC
                  </h4>
                  <small style={{ color: 'var(--text-secondary)' }}>
                    Elige la carpeta local de tu computadora para archivar automáticamente cada factura generada.
                  </small>
                </div>

                <div className="card-body p-4">
                  <div className="p-3 mb-4 rounded-3 border" style={{ background: 'var(--bg-card-alt)', borderColor: 'var(--border-color)' }}>
                    <div className="fw-bold mb-1" style={{ fontSize: '0.9rem' }}>Estado de la carpeta:</div>
                    {posBackupFolderName ? (
                      <div>
                        <span className="badge bg-success text-white px-3 py-2 fs-6 mb-2">
                          🟢 Carpeta Conectada: {posBackupFolderName}
                        </span>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                          Al hacer clic en <strong>"Enviar Domicilio & Facturar"</strong>, el sistema guardará el archivo electrónico directamente dentro de esta carpeta sin preguntar.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <span className="badge bg-secondary text-white px-3 py-2 fs-6 mb-2">
                          ⚪ Ninguna carpeta local seleccionada
                        </span>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                          Actualmente las copias electrónicas se descargan a través de la carpeta de Descargas del navegador. Selecciona una carpeta a continuación para guardado directo.
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSelectFolder}
                    className="btn btn-warning text-dark fw-bold w-100 py-2 d-flex align-items-center justify-content-center gap-2 shadow-sm mb-3"
                  >
                    📁 Elegir / Cambiar Carpeta de Respaldo en mi PC
                  </button>

                  <div className="small text-muted p-2 rounded border" style={{ background: 'var(--bg-card-alt)', borderColor: 'var(--border-color)', fontSize: '0.78rem' }}>
                    💡 <strong>Compatibilidad:</strong> La selección directa de carpetas funciona en navegadores modernos basados en Chromium (Google Chrome, Microsoft Edge, Brave, Opera). Si usas otro navegador, el sistema descargará el archivo de forma automática.
                  </div>
                </div>
              </div>
            </div>

            {/* Configuración de WhatsApp y Negocio */}
            <div className="col-12 col-lg-6">
              <div className="card h-100 border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '12px' }}>
                <div className="card-header py-3 px-4" style={{ background: 'var(--bg-card-alt)', borderBottom: '1px solid var(--border-color)' }}>
                  <h4 className="fs-6 fw-bold m-0" style={{ color: 'var(--accent-primary)' }}>
                    📱 Teléfono WhatsApp para Pedidos
                  </h4>
                  <small style={{ color: 'var(--text-secondary)' }}>Número al que se envían los mensajes desde la carta web</small>
                </div>

                <div className="card-body p-4">
                  <div className="d-flex gap-2 mb-4">
                    <input
                      type="text"
                      className="form-control"
                      value={whatsappInput}
                      onChange={(e) => setWhatsappInput(e.target.value)}
                      placeholder="Ej: 573007708816"
                      style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
                    />
                    <button
                      onClick={() => {
                        updateWhatsApp(whatsappInput);
                        showSuccess('¡Número de WhatsApp guardado!');
                      }}
                      className="btn btn-warning text-dark fw-bold text-nowrap"
                    >
                      Guardar
                    </button>
                  </div>

                  <h5 className="fs-6 fw-bold mb-2">Redes Sociales</h5>
                  <div className="d-flex flex-column gap-2 mb-3">
                    {(restaurantConfig?.socials || []).map((social) => (
                      <div
                        key={social.id}
                        className="d-flex justify-content-between align-items-center p-2 rounded border"
                        style={{ background: 'var(--bg-card-alt)', borderColor: 'var(--border-color)' }}
                      >
                        <span className="small">{social.name} ({social.url})</span>
                        <button onClick={() => removeSocial(social.id)} className="btn btn-sm btn-outline-danger py-0 px-2">
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded border" style={{ background: 'var(--bg-card-alt)', borderColor: 'var(--border-color)' }}>
                    <h6 className="small fw-bold mb-2">Añadir Red Social</h6>
                    <div className="row g-2">
                      <div className="col-5">
                        <input
                          type="text"
                          placeholder="Nombre (ej: Instagram)"
                          className="form-control form-control-sm"
                          value={newSocial.name}
                          onChange={(e) => setNewSocial({ ...newSocial, name: e.target.value })}
                        />
                      </div>
                      <div className="col-7">
                        <input
                          type="url"
                          placeholder="URL (https://...)"
                          className="form-control form-control-sm"
                          value={newSocial.url}
                          onChange={(e) => setNewSocial({ ...newSocial, url: e.target.value })}
                        />
                      </div>
                      <div className="col-12 text-end mt-2">
                        <button
                          onClick={() => {
                            if (!newSocial.name || !newSocial.url) return;
                            addSocial({ id: `soc-${Date.now()}`, ...newSocial });
                            setNewSocial({ name: '', url: '', image: '' });
                            showSuccess('Red social añadida.');
                          }}
                          className="btn btn-sm btn-outline-warning fw-bold"
                        >
                          + Añadir
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════════
          ÁREA OCULTA EN PANTALLA / VISIBLE EN IMPRESIÓN FÍSICA (@media print)
          GENERA 2 COPIAS FÍSICAS IDÉNTICAS PARA LA IMPRESORA TÉRMICA POS
      ════════════════════════════════════════════════════════════════ */}
      {printingOrder && (
        <div className="print-only-container">
          {/* ── COPIA 1: CLIENTE ── */}
          <div className="ticket-copy">
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '15px', fontWeight: 'bold' }}>🏰 TRONOS PUB & GRILL 🏰</div>
              <div style={{ fontSize: '10px' }}>Carnes, Hamburguesas & Parrilla</div>
              <div style={{ fontSize: '10px' }}>Tel / WhatsApp: {restaurantConfig?.whatsapp || '3007708816'}</div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', margin: '4px 0' }}>
                *** COPIA 1: COMPROBANTE CLIENTE ***
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', marginBottom: '6px' }}>
              <div><strong>FACTURA:</strong> #{printingOrder.id}</div>
              <div><strong>FECHA:</strong> {new Date(printingOrder.date || Date.now()).toLocaleString('es-CO')}</div>
              <div><strong>CLIENTE:</strong> {printingOrder.customer?.nombre || 'Consumidor Final'}</div>
              <div><strong>TEL:</strong> {printingOrder.customer?.telefono || 'N/A'}</div>
              <div><strong>DIRECCIÓN:</strong> {printingOrder.customer?.direccion || 'En local'}</div>
              {printingOrder.customer?.descripcion && (
                <div><strong>REF:</strong> {printingOrder.customer.descripcion}</div>
              )}
            </div>

            <div style={{ borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '10px' }}>
                <span>CANT / DESCRIPCIÓN</span>
                <span>SUBTOTAL</span>
              </div>
              {(printingOrder.items || []).map((item, i) => (
                <div key={i} style={{ margin: '4px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.name} x{item.quantity || 1}</span>
                    <span>{formatPrice((item.price || 0) * (item.quantity || 1))}</span>
                  </div>
                  {(item.selectedExtras || []).map((ex, eI) => (
                    <div key={eI} style={{ fontSize: '9px', paddingLeft: '8px' }}>
                      + {ex.name} x{ex.quantity || 1} ({formatPrice((ex.price || 0) * (ex.quantity || 1))})
                    </div>
                  ))}
                  {(item.removedIngredients || []).length > 0 && (
                    <div style={{ fontSize: '9px', paddingLeft: '8px' }}>
                      🚫 Sin: {item.removedIngredients.join(', ')}
                    </div>
                  )}
                  {item.note && (
                    <div style={{ fontSize: '9px', paddingLeft: '8px', fontStyle: 'italic' }}>
                      💬 {item.note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>
              <span>TOTAL A PAGAR:</span>
              <span>{formatPrice(printingOrder.total || 0)}</span>
            </div>

            <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '6px' }}>
              <div>¡Gracias por su compra! 🍔</div>
              <div>Tronos Burger - El Sabor del Trono</div>
            </div>
          </div>

          {/* ── LÍNEA DE CORTE DE PAPEL ENTRE AMBAS FACTURAS ── */}
          <div className="ticket-cut-divider">
            - - - - - - - - - - CORTE DE PAPEL - - - - - - - - - -
          </div>

          {/* ── COPIA 2: LOCAL / COCINA / DESPACHO (IDÉNTICA) ── */}
          <div className="ticket-copy">
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '15px', fontWeight: 'bold' }}>🏰 TRONOS PUB & GRILL 🏰</div>
              <div style={{ fontSize: '10px' }}>Carnes, Hamburguesas & Parrilla</div>
              <div style={{ fontSize: '10px' }}>Tel / WhatsApp: {restaurantConfig?.whatsapp || '3007708816'}</div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', margin: '4px 0' }}>
                *** COPIA 2: LOCAL / COCINA / RESPALDO ***
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', marginBottom: '6px' }}>
              <div><strong>FACTURA:</strong> #{printingOrder.id}</div>
              <div><strong>FECHA:</strong> {new Date(printingOrder.date || Date.now()).toLocaleString('es-CO')}</div>
              <div><strong>CLIENTE:</strong> {printingOrder.customer?.nombre || 'Consumidor Final'}</div>
              <div><strong>TEL:</strong> {printingOrder.customer?.telefono || 'N/A'}</div>
              <div><strong>DIRECCIÓN:</strong> {printingOrder.customer?.direccion || 'En local'}</div>
              {printingOrder.customer?.descripcion && (
                <div><strong>REF:</strong> {printingOrder.customer.descripcion}</div>
              )}
            </div>

            <div style={{ borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '10px' }}>
                <span>CANT / DESCRIPCIÓN</span>
                <span>SUBTOTAL</span>
              </div>
              {(printingOrder.items || []).map((item, i) => (
                <div key={i} style={{ margin: '4px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.name} x{item.quantity || 1}</span>
                    <span>{formatPrice((item.price || 0) * (item.quantity || 1))}</span>
                  </div>
                  {(item.selectedExtras || []).map((ex, eI) => (
                    <div key={eI} style={{ fontSize: '9px', paddingLeft: '8px' }}>
                      + {ex.name} x{ex.quantity || 1} ({formatPrice((ex.price || 0) * (ex.quantity || 1))})
                    </div>
                  ))}
                  {(item.removedIngredients || []).length > 0 && (
                    <div style={{ fontSize: '9px', paddingLeft: '8px' }}>
                      🚫 Sin: {item.removedIngredients.join(', ')}
                    </div>
                  )}
                  {item.note && (
                    <div style={{ fontSize: '9px', paddingLeft: '8px', fontStyle: 'italic' }}>
                      💬 {item.note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>
              <span>TOTAL A PAGAR:</span>
              <span>{formatPrice(printingOrder.total || 0)}</span>
            </div>

            <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '6px' }}>
              <div>*** COPIA PARA DESPACHO Y CONTROL ***</div>
              <div>Firma Repartidor: _______________________</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
