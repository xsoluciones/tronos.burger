'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useMenu } from '@/app/context/MenuContext';
import { formatPrice } from '@/app/data/menuData';

export default function AdminPage() {
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
  } = useMenu();

  // Login Form State
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState(false);

  // Add Item Inline Form State
  const [addingToCategoryId, setAddingToCategoryId] = useState(null);
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    detailedDescription: '',
    price: '',
    image: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  // Add Category State
  const [newCategoryTitle, setNewCategoryTitle] = useState('');

  // Inline Edit State
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

  // Extras Management State
  const [managingExtrasForItemId, setManagingExtrasForItemId] = useState(null);
  const [newExtra, setNewExtra] = useState({ name: '', price: '', image: '' });

  // Config Management State
  const [newSocial, setNewSocial] = useState({ name: '', url: '', image: '' });
  const [whatsappInput, setWhatsappInput] = useState('');

  useEffect(() => {
    if (restaurantConfig?.whatsapp) {
      setWhatsappInput(restaurantConfig.whatsapp);
    }
  }, [restaurantConfig?.whatsapp]);

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
    setLoginError(false);
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const success = login(credentials.username, credentials.password);
    if (!success) {
      setLoginError(true);
    }
  };

  const handleItemChange = (e) => {
    const { name, value } = e.target;
    setNewItem((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: false }));
    }
  };

  const validateItemForm = () => {
    const errors = {};
    if (!newItem.name.trim()) errors.name = true;
    if (!newItem.description.trim()) errors.description = true;
    if (!newItem.price || isNaN(newItem.price) || parseFloat(newItem.price) <= 0) {
      errors.price = true;
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddItemSubmit = (e, categoryId) => {
    e.preventDefault();
    if (!validateItemForm()) return;

    const slug = newItem.name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
    const id = `${slug}-${Date.now()}`;

    let imagePath = newItem.image.trim() || '/images/tronos-clasica.png';

    addMenuItem(categoryId, {
      id,
      name: newItem.name.trim(),
      description: newItem.description.trim(),
      detailedDescription: newItem.detailedDescription.trim(),
      price: parseFloat(newItem.price),
      image: imagePath,
      categoryId: categoryId,
    });

    setSuccessMessage('¡Plato agregado con éxito al menú!');
    setNewItem({
      name: '', description: '', detailedDescription: '', price: '', image: '',
    });
    setAddingToCategoryId(null);

    setTimeout(() => {
      setSuccessMessage('');
    }, 3000);
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
      categoryId: categoryId,
    });
    setAddingToCategoryId(null);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditingItem((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingItem.name.trim() || !editingItem.description.trim() || isNaN(editingItem.price) || parseFloat(editingItem.price) <= 0) {
      alert('Por favor rellena todos los campos con valores válidos.');
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
    setSuccessMessage('¡Plato actualizado con éxito!');
    setTimeout(() => setSuccessMessage(''), 3000);
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

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
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
    const id = `${slug}-${Date.now()}`;
    
    addCategory({
      id,
      title: newCategoryTitle.trim(),
      items: []
    });
    
    setNewCategoryTitle('');
    setSuccessMessage('¡Categoría agregada con éxito!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleAddExtra = (e, item) => {
    e.preventDefault();
    if (!newExtra.name.trim() || isNaN(newExtra.price) || parseFloat(newExtra.price) <= 0) {
      alert('Nombre y precio del adicional son requeridos.');
      return;
    }

    const extraId = `ext-${Date.now()}`;
    const extra = {
      id: extraId,
      name: newExtra.name.trim(),
      price: parseFloat(newExtra.price),
      image: newExtra.image || item.image // Use item image as fallback
    };

    const currentExtras = item.extras || [];
    updateItemExtras(item.categoryId, item.id, [...currentExtras, extra]);
    
    setNewExtra({ name: '', price: '', image: '' });
  };

  const handleDeleteExtra = (item, extraId) => {
    if (confirm('¿Deseas eliminar este adicional?')) {
      const updatedExtras = (item.extras || []).filter(e => e.id !== extraId);
      updateItemExtras(item.categoryId, item.id, updatedExtras);
    }
  };

  if (!isAdmin) {
    return (
      <div className="admin-container d-flex align-items-center justify-content-center min-vh-100">
        <style jsx>{`
          .admin-container { background: linear-gradient(180deg, #050505 0%, #0c0b08 100%); padding: 2rem 1rem; }
          .login-card { background: rgba(17, 17, 17, 0.95); border: 1px solid rgba(212, 168, 67, 0.25); border-radius: 20px; width: 100%; max-width: 420px; padding: 2.5rem; box-shadow: 0 0 40px rgba(212, 168, 67, 0.1); }
          .logo-wrapper { margin-bottom: 2rem; }
          .form-title { font-family: 'Cinzel', serif; color: #d4a843; font-weight: 700; letter-spacing: 1px; font-size: 1.5rem; }
          .form-label { color: #ccc; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.5rem; }
          .form-input { width: 100%; padding: 12px 14px; background: #151515; border: 1.5px solid #333; border-radius: 10px; color: #eee; font-size: 0.95rem; outline: none; transition: all 0.3s ease; }
          .form-input:focus { border-color: #d4a843; box-shadow: 0 0 0 3px rgba(212, 168, 67, 0.1); }
          .submit-btn { width: 100%; padding: 12px; background: linear-gradient(135deg, #d4a843, #f0c96b); color: #050505; border: none; border-radius: 10px; font-weight: 700; font-family: 'Cinzel', serif; cursor: pointer; }
          .error-alert { background: rgba(229, 62, 62, 0.1); border: 1px solid rgba(229, 62, 62, 0.3); color: #fc8181; padding: 10px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 1.5rem; text-align: center; }
          .back-link { display: block; text-align: center; margin-top: 1.5rem; color: #999; text-decoration: none; font-size: 0.9rem; }
        `}</style>
        <div className="login-card">
          <div className="logo-wrapper text-center">
            <Image src="/images/logo-tronos.webp" alt="Tronos Logo" width={100} height={100} unoptimized style={{ borderRadius: '12px', marginBottom: '1rem' }} />
            <h1 className="form-title">ACCESO ADMINISTRADOR</h1>
          </div>
          {loginError && <div className="error-alert">Usuario o contraseña incorrectos.</div>}
          <form onSubmit={handleLoginSubmit}>
            <div className="mb-3">
              <label className="form-label">Usuario</label>
              <input type="text" name="username" value={credentials.username} onChange={handleLoginChange} className="form-input" required />
            </div>
            <div className="mb-4">
              <label className="form-label">Contraseña</label>
              <input type="password" name="password" value={credentials.password} onChange={handleLoginChange} className="form-input" required />
            </div>
            <button type="submit" className="submit-btn">Iniciar Sesión</button>
          </form>
          <Link href="/" className="back-link">← Volver a la Carta</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-container min-vh-100 py-5">
      <style jsx>{`
        .admin-dashboard-container { background-color: #070707; color: #f5f5f5; }
        .header-panel { border-bottom: 1px solid rgba(212, 168, 67, 0.2); padding-bottom: 2rem; margin-bottom: 3rem; }
        .panel-title { font-family: 'Cinzel', serif; color: #d4a843; font-weight: 700; letter-spacing: 1px; }
        .section-card { background: rgba(17, 17, 17, 0.7); border: 1px solid rgba(212, 168, 67, 0.15); border-radius: 16px; padding: 1.5rem; backdrop-filter: blur(10px); margin-bottom: 2.5rem; }
        .section-card-title { font-family: 'Cinzel', serif; color: #f0c96b; font-weight: 600; font-size: 1.25rem; margin-bottom: 1.5rem; border-left: 3px solid #d4a843; padding-left: 10px; display: flex; justify-content: space-between; align-items: center; }
        .item-card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 1rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.8rem; }
        .item-card-header { display: flex; gap: 1rem; align-items: center; }
        .item-card-image { border-radius: 8px; object-fit: cover; border: 1px solid rgba(212, 168, 67, 0.2); }
        .item-card-info { flex: 1; }
        .item-card-actions { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 0.8rem; }
        .form-label { color: #ccc; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.4rem; }
        .form-input { width: 100%; padding: 10px 12px; background: #141414; border: 1.5px solid #2a2a2a; border-radius: 8px; color: #eee; font-size: 0.9rem; outline: none; transition: all 0.3s ease; }
        .form-input:focus { border-color: #d4a843; }
        .form-textarea { resize: vertical; min-height: 80px; }
        .action-btn { padding: 10px 20px; background: linear-gradient(135deg, #d4a843, #f0c96b); color: #050505; border: none; border-radius: 8px; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: all 0.3s ease; }
        .outline-btn { padding: 8px 16px; background: transparent; color: #d4a843; border: 1.5px solid #d4a843; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
        .outline-btn:hover { background: rgba(212, 168, 67, 0.1); }
        .logout-btn { padding: 8px 16px; background: transparent; color: #e53e3e; border: 1.5px solid #e53e3e; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
        .logout-btn:hover { background: #e53e3e; color: #fff; }
        .view-site-btn { padding: 8px 16px; background: transparent; color: #d4a843; border: 1.5px solid #d4a843; border-radius: 8px; font-weight: 600; font-size: 0.85rem; text-decoration: none; transition: all 0.2s; }
        .delete-btn { background: transparent; border: none; font-size: 1.1rem; cursor: pointer; padding: 6px; opacity: 0.7; transition: all 0.2s; }
        .alert-success { background: rgba(37, 211, 102, 0.1); border: 1px solid rgba(37, 211, 102, 0.3); color: #63e2b7; padding: 12px; border-radius: 8px; font-size: 0.9rem; margin-bottom: 1.5rem; }
        
        .extras-management-panel { background: rgba(0, 0, 0, 0.3); border: 1px dashed rgba(212, 168, 67, 0.4); border-radius: 8px; padding: 15px; margin-top: 10px; }
        .extra-list-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #161616; border-radius: 6px; border: 1px solid #222; margin-bottom: 8px; }
        .extras-badge { background: rgba(212, 168, 67, 0.2); color: #f0c96b; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; margin-left: 10px; }
      `}</style>

      <div className="container">
        {/* Header */}
        <div className="header-panel d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div className="d-flex align-items-center gap-3">
            <Image src="/images/logo-tronos.webp" alt="Logo" width={60} height={60} unoptimized style={{ borderRadius: '8px' }} />
            <div>
              <h1 className="panel-title mb-1 fs-3">PANEL DE CONTROL</h1>
              <p className="text-muted small mb-0">Gestión de la Carta Digital de Tronos</p>
            </div>
          </div>
          <div className="d-flex gap-2">
            <Link href="/" className="view-site-btn">👁️ Ver Carta</Link>
            <button onClick={logout} className="logout-btn">🔒 Cerrar Sesión</button>
          </div>
        </div>

        {successMessage && <div className="alert-success">{successMessage}</div>}

        {/* ── Configuración General ── */}
        <div className="row justify-content-center mb-5">
          <div className="col-12 col-lg-10">
            <div className="section-card" style={{ background: 'linear-gradient(145deg, rgba(17,17,17,0.9), rgba(10,10,10,0.9))' }}>
              <div className="section-card-title">
                <span>⚙️ Configuración General</span>
              </div>
              
              <div className="row g-4">
                {/* WhatsApp */}
                <div className="col-12 col-md-6">
                  <h4 style={{ fontSize: '1rem', color: '#d4a843', marginBottom: '10px' }}>WhatsApp para Pedidos</h4>
                  <div className="d-flex gap-2">
                    <input 
                      type="text" 
                      className="form-input" 
                      value={whatsappInput} 
                      onChange={(e) => setWhatsappInput(e.target.value)} 
                      placeholder="Ej: 573007708816"
                    />
                    <button 
                      onClick={() => {
                        updateWhatsApp(whatsappInput);
                        setSuccessMessage('¡Número de WhatsApp guardado!');
                        setTimeout(() => setSuccessMessage(''), 3000);
                      }}
                      className="action-btn"
                      style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}
                    >
                      Guardar
                    </button>
                  </div>
                  <small className="text-muted mt-1 d-block">Número con código de país, sin el +. Ej: 573007708816</small>
                </div>

                {/* Redes Sociales */}
                <div className="col-12 col-md-6">
                  <h4 style={{ fontSize: '1rem', color: '#d4a843', marginBottom: '10px' }}>Redes Sociales</h4>
                  
                  {/* Lista Actual */}
                  <div className="mb-3 d-flex flex-column gap-2">
                    {(restaurantConfig?.socials || []).map(social => (
                      <div key={social.id} className="d-flex align-items-center justify-content-between p-2" style={{ background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
                        <div className="d-flex align-items-center gap-2">
                          {social.image ? (
                            <img src={social.image} alt={social.name} width={24} height={24} style={{ borderRadius: '4px', objectFit: 'cover' }} />
                          ) : social.icon ? (
                            <span>{social.icon}</span>
                          ) : null}
                          <a href={social.url} target="_blank" rel="noopener noreferrer" style={{ color: '#eee', textDecoration: 'none', fontSize: '0.9rem' }}>{social.name}</a>
                        </div>
                        <button onClick={() => removeSocial(social.id)} className="logout-btn py-1 px-2" style={{ fontSize: '0.8rem' }}>🗑️</button>
                      </div>
                    ))}
                  </div>

                  {/* Añadir Nueva Red */}
                  <div className="p-3" style={{ background: '#0a0a0a', borderRadius: '8px', border: '1px solid rgba(212, 168, 67, 0.2)' }}>
                    <h5 style={{ fontSize: '0.85rem', color: '#ccc', marginBottom: '10px' }}>Añadir Red Social</h5>
                    <div className="row g-2 align-items-end">
                      <div className="col-12 col-sm-3">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Ícono/Logo</label>
                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setNewSocial)} className="form-input py-1" style={{ fontSize: '0.7rem' }} />
                      </div>
                      <div className="col-12 col-sm-9">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Nombre</label>
                        <input type="text" placeholder="Ej: Instagram" className="form-input py-1" value={newSocial.name} onChange={(e) => setNewSocial({...newSocial, name: e.target.value})} />
                      </div>
                      <div className="col-12">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Enlace (URL)</label>
                        <input type="url" placeholder="https://..." className="form-input py-1" value={newSocial.url} onChange={(e) => setNewSocial({...newSocial, url: e.target.value})} />
                      </div>
                      <div className="col-12 mt-2">
                        <button 
                          onClick={() => {
                            if (!newSocial.name || !newSocial.url) return;
                            addSocial({ id: `soc-${Date.now()}`, ...newSocial });
                            setNewSocial({ name: '', url: '', image: '' });
                            setSuccessMessage('Red social añadida');
                            setTimeout(() => setSuccessMessage(''), 2000);
                          }}
                          className="outline-btn w-100 py-1"
                        >
                          + Agregar Red Social
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row justify-content-center">
          <div className="col-12 col-lg-10">
            {menuCategories.map((category) => (
              <div key={category.id} className="section-card">
                <div className="section-card-title">
                  <span>{category.title}</span>
                  <button onClick={() => { if(confirm(`¿Deseas eliminar la categoría "${category.title}"?`)){ deleteCategory(category.id); } }} className="delete-btn" title="Eliminar Categoría">🗑️</button>
                </div>
                
                {category.items.length === 0 ? (
                  <p className="text-muted small text-center my-3">No hay productos en esta categoría.</p>
                ) : (
                  <div className="items-list">
                    {category.items.map((item) => {
                      const isEditing = editingItemId === item.id;
                      const isManagingExtras = managingExtrasForItemId === item.id;
                      
                      // ── Edit Form ──
                      if (isEditing) {
                        return (
                          <form key={item.id} onSubmit={handleSaveEdit} className="item-card" style={{ background: '#111', borderColor: 'rgba(212, 168, 67, 0.4)' }}>
                            <div className="row g-3">
                              <div className="col-12 col-md-6"><label className="form-label">Nombre del Plato</label><input type="text" name="name" value={editingItem.name} onChange={handleEditChange} className="form-input" required /></div>
                              <div className="col-12 col-md-6"><label className="form-label">Precio (COP)</label><input type="number" name="price" value={editingItem.price} onChange={handleEditChange} className="form-input" required /></div>
                              <div className="col-12"><label className="form-label">Cambiar Imagen</label><input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setEditingItem)} className="form-input" /></div>
                              <div className="col-12"><label className="form-label">Descripción Corta</label><textarea name="description" value={editingItem.description} onChange={handleEditChange} className="form-input form-textarea" required /></div>
                              <div className="col-12"><label className="form-label">Descripción Detallada (Ver más)</label><textarea name="detailedDescription" value={editingItem.detailedDescription} onChange={handleEditChange} className="form-input form-textarea" /></div>
                              <div className="col-12 d-flex justify-content-end gap-2 mt-2">
                                <button type="button" onClick={() => setEditingItemId(null)} className="logout-btn py-1.5 px-3">Cancelar</button>
                                <button type="submit" className="action-btn py-1.5 px-3">💾 Guardar</button>
                              </div>
                            </div>
                          </form>
                        );
                      }

                      // ── Normal Item Card ──
                      return (
                        <div key={item.id} className="item-card">
                          <div className="item-card-header">
                            <img src={item.image} alt={item.name} width={60} height={60} className="item-card-image" />
                            <div className="item-card-info">
                              <div className="fw-bold text-light">
                                {item.name}
                                {item.extras && item.extras.length > 0 && (
                                  <span className="extras-badge">{item.extras.length} adicionales</span>
                                )}
                              </div>
                              <div className="text-muted small text-truncate" style={{ maxWidth: '100%', WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', whiteSpace: 'normal' }}>
                                {item.description}
                              </div>
                            </div>
                          </div>
                          
                          <div className="item-card-actions">
                            <div className="fw-bold text-gold-light fs-5">{formatPrice(item.price)}</div>
                            <div className="d-flex flex-wrap justify-content-end gap-2">
                              <button onClick={() => { setManagingExtrasForItemId(isManagingExtras ? null : item.id); setEditingItemId(null); }} className="outline-btn py-1 px-2" style={{ fontSize: '0.9rem', color: isManagingExtras ? '#f0c96b' : '#aaa', borderColor: isManagingExtras ? '#f0c96b' : '#555' }}>
                                🍟 {isManagingExtras ? 'Ocultar Adicionales' : 'Adicionales'}
                              </button>
                              <button onClick={() => handleStartEdit(item, category.id)} className="outline-btn py-1 px-2" style={{ fontSize: '0.9rem' }}>
                                ✏️ Editar
                              </button>
                              <button onClick={() => { if (confirm(`¿Eliminar "${item.name}"?`)) deleteMenuItem(category.id, item.id); }} className="logout-btn py-1 px-2" style={{ fontSize: '0.9rem' }}>
                                🗑️
                              </button>
                            </div>
                          </div>

                          {/* ── Extras Management Panel ── */}
                          {isManagingExtras && (
                            <div className="extras-management-panel">
                              <h4 style={{ fontSize: '1rem', color: '#d4a843', marginBottom: '15px' }}>Adicionales para: {item.name}</h4>
                              
                              {(item.extras || []).length === 0 ? (
                                <p className="text-muted small mb-3">No hay adicionales configurados para este plato.</p>
                              ) : (
                                <div className="mb-4">
                                  {(item.extras || []).map(extra => (
                                    <div key={extra.id} className="extra-list-item">
                                      <div className="d-flex align-items-center gap-2">
                                        {extra.image && <img src={extra.image} alt={extra.name} width={30} height={30} style={{ borderRadius: '4px', objectFit: 'cover' }} />}
                                        <span className="text-light fs-6">{extra.name}</span>
                                      </div>
                                      <div className="d-flex align-items-center gap-3">
                                        <span className="text-gold-light">{formatPrice(extra.price)}</span>
                                        <button onClick={() => handleDeleteExtra(item, extra.id)} className="logout-btn py-1 px-2" style={{ fontSize: '0.8rem', padding: '2px 6px' }}>X</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <form onSubmit={(e) => handleAddExtra(e, item)} className="row g-2 align-items-end" style={{ background: '#0a0a0a', padding: '10px', borderRadius: '8px' }}>
                                <div className="col-12 col-md-4">
                                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Nuevo Adicional</label>
                                  <input type="text" value={newExtra.name} onChange={(e) => setNewExtra({...newExtra, name: e.target.value})} placeholder="Ej: Doble Carne" className="form-input py-1" required />
                                </div>
                                <div className="col-12 col-md-3">
                                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Precio</label>
                                  <input type="number" value={newExtra.price} onChange={(e) => setNewExtra({...newExtra, price: e.target.value})} placeholder="Ej: 5000" className="form-input py-1" required />
                                </div>
                                <div className="col-12 col-md-3">
                                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Foto (Opcional)</label>
                                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setNewExtra)} className="form-input py-1" style={{ fontSize: '0.7rem' }} />
                                </div>
                                <div className="col-12 col-md-2">
                                  <button type="submit" className="action-btn w-100 py-1" style={{ fontSize: '0.8rem' }}>+ Agregar</button>
                                </div>
                              </form>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add new Item Button for Category */}
                {addingToCategoryId !== category.id ? (
                  <div className="mt-4 text-center">
                    <button onClick={() => { setAddingToCategoryId(category.id); setEditingItemId(null); setManagingExtrasForItemId(null); }} className="outline-btn w-100 py-2">+ Añadir nuevo plato en {category.title}</button>
                  </div>
                ) : (
                  <div className="mt-4 p-4" style={{ background: 'rgba(212, 168, 67, 0.05)', borderRadius: '12px', border: '1px solid rgba(212, 168, 67, 0.2)' }}>
                    <h3 className="fs-5 mb-3" style={{ color: '#d4a843', fontFamily: "'Cinzel', serif" }}>Nuevo Plato - {category.title}</h3>
                    <form onSubmit={(e) => handleAddItemSubmit(e, category.id)}>
                      <div className="row g-3">
                        <div className="col-12 col-md-6"><label className="form-label">Nombre del Plato</label><input type="text" name="name" value={newItem.name} onChange={handleItemChange} className="form-input" required /></div>
                        <div className="col-12 col-md-6"><label className="form-label">Precio (COP)</label><input type="number" name="price" value={newItem.price} onChange={handleItemChange} className="form-input" required /></div>
                        <div className="col-12"><label className="form-label">Imagen</label><input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setNewItem)} className="form-input" /></div>
                        <div className="col-12"><label className="form-label">Descripción Corta</label><textarea name="description" value={newItem.description} onChange={handleItemChange} className="form-input form-textarea" required /></div>
                        <div className="col-12"><label className="form-label">Descripción Detallada (Ver más)</label><textarea name="detailedDescription" value={newItem.detailedDescription} onChange={handleItemChange} className="form-input form-textarea" /></div>
                        <div className="col-12 d-flex justify-content-end gap-2 mt-3">
                          <button type="button" onClick={() => setAddingToCategoryId(null)} className="logout-btn">Cancelar</button>
                          <button type="submit" className="action-btn">Agregar Plato</button>
                        </div>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            ))}

            <div className="section-card mt-5" style={{ borderStyle: 'dashed', borderColor: 'rgba(212, 168, 67, 0.4)' }}>
              <h2 className="section-card-title mb-3" style={{ borderLeft: 'none', paddingLeft: 0, justifyContent: 'center' }}>✨ Crear Nueva Categoría</h2>
              <form onSubmit={handleAddCategory} className="d-flex flex-column flex-md-row gap-3">
                <input type="text" value={newCategoryTitle} onChange={(e) => setNewCategoryTitle(e.target.value)} placeholder="Ej: Perros Calientes, Bebidas, Postres..." className="form-input flex-grow-1" required />
                <button type="submit" className="action-btn" style={{ minWidth: '150px' }}>+ Añadir Categoría</button>
              </form>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
