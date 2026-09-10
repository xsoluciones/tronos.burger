'use client';

import { useState } from 'react';
import { useMenu, cleanWhatsAppNumber } from '@/app/context/MenuContext';
import { formatPrice } from '@/app/data/menuData';

export default function OrderForm({ onClose }) {
  const { cart, cartTotal, clearCart, restaurantConfig, addOrder } = useMenu();

  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    direccion: '',
    descripcion: '',
  });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [orderIdCreated, setOrderIdCreated] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: false }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.nombre.trim()) newErrors.nombre = true;
    if (!form.telefono.trim()) newErrors.telefono = true;
    if (!form.direccion.trim()) newErrors.direccion = true;
    if (!form.descripcion.trim()) newErrors.descripcion = true;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Generar ID único de comanda
    const orderId = `TRN-${Date.now().toString().slice(-4)}`;
    setOrderIdCreated(orderId);

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tronospub.com';
    const trackingUrl = `${origin}/pedido/${orderId}`;

    // Build WhatsApp message con enlace de seguimiento y manita
    const lines = [
      `🏰 *NUEVO PEDIDO #${orderId} - TRONOS PUB & GRILL* 🏰`,
      '',
      '📋 *Detalle del pedido:*',
      ...cart.flatMap((item) => {
        const itemLine = `• ${item.name} x${item.quantity} = ${formatPrice(item.price * item.quantity)}`;
        const extraLines = [];
        if (item.selectedExtras && item.selectedExtras.length > 0) {
          item.selectedExtras.forEach(extra => {
             extraLines.push(`  + ${extra.name} x${extra.quantity} = ${formatPrice(extra.price * extra.quantity)}`);
          });
        }
        if (item.removedIngredients && item.removedIngredients.length > 0) {
          extraLines.push(`  🚫 Sin ingredientes: ${item.removedIngredients.join(', ')}`);
        }
        if (item.note && item.note.trim()) {
          extraLines.push(`  🚫 Notas: ${item.note.trim()}`);
        }
        return [itemLine, ...extraLines];
      }),
      '',
      `💰 *Total: ${formatPrice(cartTotal)}*`,
      '',
      '👤 *Datos del cliente:*',
      `• Nombre: ${form.nombre}`,
      `• Teléfono: ${form.telefono}`,
      `• Dirección: ${form.direccion}`,
      `• Referencia: ${form.descripcion}`,
      '',
      '👉 *Toca aquí para ver el seguimiento en vivo de tu pedido:*',
      trackingUrl,
    ];
    const message = lines.join('\n');
    const encoded = encodeURIComponent(message);
    const rawNumber =
      restaurantConfig?.whatsapp ||
      (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('tronos-config') || '{}')?.whatsapp : null) ||
      '573007708816';
    const whatsappNumber = cleanWhatsAppNumber(rawNumber);
    const url = `https://wa.me/${whatsappNumber}?text=${encoded}`;

    window.open(url, '_blank');

    // Registrar pedido en el sistema POS
    if (addOrder) {
      addOrder({
        id: orderId,
        date: new Date().toISOString(),
        customer: {
          nombre: form.nombre.trim(),
          telefono: form.telefono.trim(),
          direccion: form.direccion.trim(),
          descripcion: form.descripcion.trim(),
        },
        items: JSON.parse(JSON.stringify(cart)),
        total: cartTotal,
        status: 'pendiente',
      });
    }

    // Limpiar carrito y mostrar modal con botón de seguimiento
    clearCart();
    setSuccess(true);
  };

  return (
    <>
      {/* Backdrop */}
      <div style={styles.backdrop} onClick={onClose} />

      {/* Modal */}
      <div style={styles.modalWrapper}>
        <div style={styles.modal}>
          {success ? (
            /* ── Success State con Botón Interactivo de Seguimiento ── */
            <div style={styles.successContainer}>
              <span style={styles.successIcon}>🍔</span>
              <h2 style={styles.successTitle}>¡Pedido Enviado con Éxito!</h2>
              <p style={styles.successText}>
                Tu orden <strong style={{ color: '#22c55e' }}>#{orderIdCreated}</strong> fue registrada en caja y cocina.
              </p>

              {/* Botón con la manita indicando tocar para ver seguimiento */}
              <div style={{ marginTop: '18px', marginBottom: '14px' }}>
                <a
                  href={`/pedido/${orderIdCreated}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: '14.5px',
                    padding: '13px 20px',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)',
                    border: '1px solid #86efac',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span style={{ fontSize: '20px' }}>👉</span>
                  <span>Toca aquí para ver el seguimiento de mi pedido</span>
                </a>
              </div>

              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 16px' }}>
                También puedes entrar desde el link enviado a tu WhatsApp.
              </p>

              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255,255,255,0.15)',
                  padding: '7px 18px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cerrar ventana
              </button>
            </div>
          ) : (
            /* ── Form State ── */
            <>
              {/* Header */}
              <div style={styles.header}>
                <h2 style={styles.title}>Datos de Entrega 🏠</h2>
                <button
                  onClick={onClose}
                  style={styles.closeBtn}
                  aria-label="Cerrar formulario"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} style={styles.form}>
                {/* Fields */}
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Nombre Completo</label>
                  <input
                    type="text"
                    name="nombre"
                    value={form.nombre}
                    onChange={handleChange}
                    placeholder="Tu nombre completo"
                    style={{
                      ...styles.input,
                      borderColor: errors.nombre ? '#e53e3e' : '#333',
                    }}
                  />
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Teléfono</label>
                  <input
                    type="tel"
                    name="telefono"
                    value={form.telefono}
                    onChange={handleChange}
                    placeholder="300 123 4567"
                    style={{
                      ...styles.input,
                      borderColor: errors.telefono ? '#e53e3e' : '#333',
                    }}
                  />
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Dirección</label>
                  <input
                    type="text"
                    name="direccion"
                    value={form.direccion}
                    onChange={handleChange}
                    placeholder="Calle, número, barrio"
                    style={{
                      ...styles.input,
                      borderColor: errors.direccion ? '#e53e3e' : '#333',
                    }}
                  />
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Descripción de Ubicación</label>
                  <textarea
                    name="descripcion"
                    value={form.descripcion}
                    onChange={handleChange}
                    placeholder="Ej: Al frente de la tienda, casa amarilla con portón negro..."
                    rows={3}
                    style={{
                      ...styles.input,
                      ...styles.textarea,
                      borderColor: errors.descripcion ? '#e53e3e' : '#333',
                    }}
                  />
                </div>

                {/* Order Summary */}
                <div style={styles.summary}>
                  <h3 style={styles.summaryTitle}>Resumen del Pedido</h3>
                  {cart.map((item) => (
                    <div key={item.cartItemId || item.id} style={{ borderBottom: '1px solid #222', padding: '6px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={styles.summaryName}>
                          {item.name} <span style={styles.summaryQty}>x{item.quantity}</span>
                        </span>
                        <span style={styles.summaryPrice}>
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                      {item.selectedExtras && item.selectedExtras.length > 0 && item.selectedExtras.map(extra => (
                        <div key={extra.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '12px', marginTop: '4px' }}>
                          <span style={{ ...styles.summaryName, fontSize: '0.75rem', color: '#aaa' }}>
                            + {extra.name} <span style={{ color: '#d4a843' }}>x{extra.quantity}</span>
                          </span>
                          <span style={{ ...styles.summaryPrice, fontSize: '0.75rem', color: '#f0c96b' }}>
                            {formatPrice(extra.price * extra.quantity)}
                          </span>
                        </div>
                      ))}
                      {item.removedIngredients && item.removedIngredients.length > 0 && (
                        <div style={{ paddingLeft: '12px', marginTop: '4px' }}>
                          <span style={{ ...styles.summaryName, fontSize: '0.75rem', color: '#ff6b6b', fontStyle: 'italic' }}>
                            🚫 Sin ingredientes: {item.removedIngredients.join(', ')}
                          </span>
                        </div>
                      )}
                      {item.note && item.note.trim() && (
                        <div style={{ paddingLeft: '12px', marginTop: '4px' }}>
                          <span style={{ ...styles.summaryName, fontSize: '0.75rem', color: '#ff6b6b', fontStyle: 'italic' }}>
                            🚫 Notas: {item.note.trim()}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={styles.summaryTotal}>
                    <span>Total</span>
                    <span>{formatPrice(cartTotal)}</span>
                  </div>
                </div>

                {/* Submit */}
                <button type="submit" style={styles.submitBtn}>
                  Enviar Pedido por WhatsApp
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

/* ─────────────── Styles ─────────────── */
const gold = '#d4a843';
const goldLight = '#f0c96b';

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    zIndex: 2000,
  },

  modalWrapper: {
    position: 'fixed',
    inset: 0,
    zIndex: 2001,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },

  modal: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflowY: 'auto',
    background: 'rgba(17, 17, 17, 0.95)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: `1px solid ${gold}30`,
    borderRadius: '20px',
    padding: '28px',
    zIndex: 2002,
    animation: 'modalIn 0.3s ease-out forwards',
  },

  /* Header */
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
  },
  title: {
    margin: 0,
    fontSize: '1.3rem',
    fontWeight: '700',
    color: goldLight,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#999',
    fontSize: '1.3rem',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '6px',
  },

  /* Form */
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    color: '#ccc',
    fontSize: '0.85rem',
    fontWeight: '600',
  },
  input: {
    background: '#1a1a1a',
    border: '1.5px solid #333',
    borderRadius: '10px',
    padding: '12px 14px',
    color: '#eee',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'border-color 0.25s',
    fontFamily: 'inherit',
  },
  textarea: {
    resize: 'vertical',
    minHeight: '70px',
  },

  /* Summary */
  summary: {
    background: '#0d0d0d',
    borderRadius: '12px',
    padding: '16px',
    marginTop: '4px',
    border: `1px solid ${gold}15`,
  },
  summaryTitle: {
    margin: '0 0 12px 0',
    color: goldLight,
    fontSize: '0.95rem',
    fontWeight: '700',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid #222',
  },
  summaryName: {
    color: '#ccc',
    fontSize: '0.85rem',
  },
  summaryQty: {
    color: gold,
    fontWeight: '600',
  },
  summaryPrice: {
    color: '#eee',
    fontSize: '0.85rem',
    fontWeight: '600',
  },
  summaryTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '12px',
    marginTop: '4px',
    color: goldLight,
    fontSize: '1.1rem',
    fontWeight: '800',
  },

  /* Submit */
  submitBtn: {
    width: '100%',
    padding: '14px',
    background: '#25D366',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: '800',
    cursor: 'pointer',
    letterSpacing: '0.5px',
    marginTop: '4px',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 16px rgba(37, 211, 102, 0.3)',
    textShadow: '-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0px 3px 5px rgba(0,0,0,0.6)',
  },

  /* Success State */
  successContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    animation: 'fadeIn 0.5s ease-out',
  },
  successIcon: {
    fontSize: '4rem',
    marginBottom: '16px',
  },
  successTitle: {
    margin: 0,
    color: goldLight,
    fontSize: '1.3rem',
    fontWeight: '700',
    textAlign: 'center',
  },
  successText: {
    color: '#999',
    fontSize: '0.9rem',
    marginTop: '8px',
    textAlign: 'center',
  },
};
