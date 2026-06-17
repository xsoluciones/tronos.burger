'use client';

import { useState, useEffect, useRef } from 'react';
import { useMenu } from '@/app/context/MenuContext';
import { formatPrice } from '@/app/data/menuData';
import OrderForm from './OrderForm';
import { animate } from 'animejs';

export default function Cart() {
  const { menuCategories, cart, cartCount, cartTotal, removeFromCart, updateQuantity, addExtraToCartItem, removeExtraFromCartItem, updateCartItemNote } = useMenu();
  const [isOpen, setIsOpen] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [pulse, setPulse] = useState(false);
  const prevCountRef = useRef(cartCount);
  const buttonRef = useRef(null);
  const [flyers, setFlyers] = useState([]);
  
  const [expandedExtrasCartItemId, setExpandedExtrasCartItemId] = useState(null);
  const [expandedNoteCartItemId, setExpandedNoteCartItemId] = useState(null);

  // Trigger pulse animation when cart count increases
  useEffect(() => {
    if (cartCount > prevCountRef.current) {
      setPulse(true);
      const timeout = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(timeout);
    }
    prevCountRef.current = cartCount;
  }, [cartCount]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Listen to adding products to animate floating arrow flyers
  useEffect(() => {
    const handleProductAdded = (e) => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const targetX = rect.left + rect.width / 2;
      const targetY = rect.top + rect.height / 2;
      
      const newFlyer = {
        id: Math.random().toString(36).substring(2, 9),
        startX: e.detail.x,
        startY: e.detail.y,
        targetX,
        targetY
      };
      
      setFlyers((prev) => [...prev, newFlyer]);
    };

    window.addEventListener('product-added-to-cart', handleProductAdded);
    return () => {
      window.removeEventListener('product-added-to-cart', handleProductAdded);
    };
  }, []);

  const removeFlyer = (id) => {
    setFlyers((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <>
      {/* Flyers layer */}
      {flyers.map((f) => (
        <Flyer key={f.id} flyer={f} onComplete={() => removeFlyer(f.id)} />
      ))}

      {/* ── Floating Food Bag Button ── */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(true)}
        style={{
          ...styles.floatingBtn,
          animation: pulse ? 'cartPulse 0.6s ease-out' : 'none',
        }}
        aria-label="Abrir pedido"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
          <path d="M4 4.5h16c.8 0 1.2-.5 1.2-1s-.4-1-1.2-1H4c-.8 0-1.2.5-1.2 1s.4 1 1.2 1z" fill="currentColor"/>
          <path d="M3 4.5l1.5 16.5c.1.8.8 1.5 1.6 1.5h11.8c.8 0 1.5-.7 1.6-1.5L21 4.5"/>
          <path d="M8.5 11.5h7M8.5 14h7" strokeWidth="2.8"/>
          <path d="M9 11.5a3 3 0 0 1 6 0"/>
        </svg>
        <span style={{ fontSize: '0.98rem', letterSpacing: '0.5px', marginLeft: '1px', fontWeight: '900' }}>PEDIDO</span>
        {cartCount > 0 && (
          <span style={styles.badge}>{cartCount}</span>
        )}
      </button>

      {/* ── Backdrop ── */}
      {isOpen && (
        <div style={styles.backdrop} onClick={() => setIsOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <div style={{ ...styles.sidebar, transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}>
        {/* Header */}
        <div style={styles.sidebarHeader}>
          <h2 style={styles.sidebarTitle}>Tu Pedido 👑</h2>
          <button onClick={() => setIsOpen(false)} style={styles.closeBtn} aria-label="Cerrar carrito">✕</button>
        </div>

        {/* Cart Content */}
        <div style={styles.cartContent}>
          {cart.length === 0 ? (
            <div style={styles.emptyCart}>
              <span style={{ fontSize: '3rem' }}>😔</span>
              <p style={styles.emptyText}>Tu carrito está vacío</p>
              <p style={styles.emptySubtext}>¡Agrega algo delicioso del menú!</p>
            </div>
          ) : (
            <div style={styles.itemsList}>
              {cart.map((item) => (
                <div key={item.cartItemId} style={styles.cartItem}>
                  <div style={styles.cartItemTop}>
                    <img src={item.image} alt={item.name} style={styles.cartItemImg} />
                    <div style={styles.cartItemInfo}>
                      <p style={styles.cartItemName}>{item.name}</p>
                      <p style={styles.cartItemPrice}>{formatPrice(item.price)}</p>
                      
                      {/* Lista de Adicionales Seleccionados */}
                      {item.selectedExtras && item.selectedExtras.length > 0 && (
                        <div style={styles.selectedExtrasContainer}>
                          {item.selectedExtras.map(extra => (
                            <div key={extra.id} style={styles.selectedExtraItem}>
                              <span style={{ flex: 1, fontSize: '0.75rem', color: '#ccc' }}>
                                + {extra.quantity > 1 ? `${extra.quantity}x ` : ''}{extra.name}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: goldLight, marginRight: '8px' }}>
                                {formatPrice(extra.price * extra.quantity)}
                              </span>
                              <button 
                                onClick={() => removeExtraFromCartItem(item.cartItemId, extra.id)}
                                style={styles.removeExtraBtn}
                              >
                                −
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Botón Ver Adicionales */}
                      {item.extras && item.extras.length > 0 && (
                        <button
                          onClick={() => setExpandedExtrasCartItemId(expandedExtrasCartItemId === item.cartItemId ? null : item.cartItemId)}
                          style={styles.toggleExtrasBtn}
                        >
                          {expandedExtrasCartItemId === item.cartItemId ? 'Ocultar adicionales ▲' : 'Ver adicionales ▼'}
                        </button>
                      )}

                      {/* Botón Quitar Ingredientes */}
                      <button
                        onClick={() => setExpandedNoteCartItemId(expandedNoteCartItemId === item.cartItemId ? null : item.cartItemId)}
                        style={{ ...styles.toggleExtrasBtn, color: '#aaa', marginTop: '4px' }}
                      >
                        {expandedNoteCartItemId === item.cartItemId ? 'Ocultar quitar ingredientes ▲' : 'Quitar ingredientes 🚫'}
                      </button>
                    </div>
                    <button onClick={() => removeFromCart(item.cartItemId)} style={styles.removeBtn}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff3333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.2s, transform 0.2s' }}>
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </div>

                  {/* Extras Expansion Panel */}
                  {expandedExtrasCartItemId === item.cartItemId && item.extras && item.extras.length > 0 && (
                    <div style={styles.extrasPanel}>
                      <p style={styles.extrasPanelTitle}>Adicionales para {item.name}:</p>
                      {item.extras.map(extra => (
                        <div key={extra.id} style={styles.extraOptionCard}>
                          {extra.image && <img src={extra.image} alt={extra.name} style={styles.extraOptionImg} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={styles.extraOptionName}>{extra.name}</p>
                            <p style={styles.extraOptionPrice}>+ {formatPrice(extra.price)}</p>
                          </div>
                          <button 
                            onClick={() => addExtraToCartItem(item.cartItemId, extra)}
                            style={styles.addExtraBtn}
                          >
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Note / Exclusions Panel */}
                  {expandedNoteCartItemId === item.cartItemId && (
                    <div style={{ ...styles.extrasPanel, background: '#1a0d0d', borderColor: '#ff444433' }}>
                      <p style={{ ...styles.extrasPanelTitle, color: '#ff6b6b' }}>¿Qué le quitamos?</p>
                      <textarea
                        value={item.note || ''}
                        onChange={(e) => updateCartItemNote(item.cartItemId, e.target.value)}
                        placeholder="Ej: Quítale la ensalada y el queso"
                        style={{
                          width: '100%',
                          minHeight: '60px',
                          background: '#111',
                          border: '1px solid #333',
                          borderRadius: '6px',
                          color: '#eee',
                          padding: '8px',
                          fontSize: '0.8rem',
                          resize: 'vertical',
                          outline: 'none',
                        }}
                      />
                    </div>
                  )}

                  {/* Quantity and Subtotal Bottom Row */}
                  <div style={styles.cartItemBottom}>
                    <div style={styles.qtyControls}>
                      <button onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)} style={styles.qtyBtn}>−</button>
                      <span style={styles.qtyValue}>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)} style={styles.qtyBtn}>+</button>
                    </div>
                    <p style={styles.subtotal}>
                      {formatPrice(
                        (item.price * item.quantity) + 
                        (item.selectedExtras?.reduce((sum, extra) => sum + (extra.price * extra.quantity), 0) || 0)
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div style={styles.sidebarFooter}>
            <div style={styles.totalRow}>
              <span style={styles.totalLabel}>Total</span>
              <span style={styles.totalValue}>{formatPrice(cartTotal)}</span>
            </div>
            <button onClick={() => setShowOrderForm(true)} style={styles.orderBtn}>
              Realizar Pedido
            </button>
          </div>
        )}
      </div>

      {/* ── Order Form Modal ── */}
      {showOrderForm && <OrderForm onClose={() => setShowOrderForm(false)} />}

      {/* ── Keyframe Animations ── */}
      <style>{`
        @keyframes cartPulse {
          0% { transform: scale(1); }
          30% { transform: scale(1.25); }
          60% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
      `}</style>
    </>
  );
}

/* ─────────────── Styles ─────────────── */
const gold = '#d4a843';
const goldLight = '#f0c96b';

const styles = {
  floatingBtn: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 1000,
    height: '38px',
    padding: '0 6px',
    borderRadius: '8px',
    background: `linear-gradient(135deg, ${gold}, ${goldLight})`,
    border: 'none',
    color: '#0a0a0a',
    fontFamily: "'Cinzel', serif",
    fontWeight: '900',
    fontSize: '0.98rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    boxShadow: `0 4px 15px rgba(212, 168, 67, 0.35)`,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  badge: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    background: '#ff001c',
    color: '#ffffff',
    fontSize: '0.75rem',
    fontWeight: '900',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #ffffff',
    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 1001,
  },
  sidebar: {
    position: 'fixed',
    top: 0,
    right: 0,
    height: '100%',
    width: '380px',
    maxWidth: '100%',
    background: '#111',
    borderLeft: `2px solid ${gold}33`,
    zIndex: 1002,
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.35s cubic-bezier(.4,0,.2,1)',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: `1px solid ${gold}22`,
  },
  sidebarTitle: {
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
    transition: 'color 0.2s',
  },
  cartContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 24px',
  },
  emptyCart: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '8px',
  },
  emptyText: {
    color: '#ccc',
    fontSize: '1.1rem',
    fontWeight: '600',
    margin: 0,
  },
  emptySubtext: {
    color: '#777',
    fontSize: '0.85rem',
    margin: 0,
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  cartItem: {
    background: '#1a1a1a',
    borderRadius: '12px',
    padding: '14px',
    border: `1px solid ${gold}15`,
  },
  cartItemTop: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '10px',
  },
  cartItemImg: {
    width: '50px',
    height: '50px',
    borderRadius: '8px',
    objectFit: 'cover',
    marginTop: '2px',
  },
  cartItemInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  cartItemName: {
    margin: 0,
    color: '#eee',
    fontSize: '0.9rem',
    fontWeight: '600',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cartItemPrice: {
    margin: 0,
    color: gold,
    fontSize: '0.8rem',
  },
  removeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '4px',
    opacity: 0.7,
    transition: 'opacity 0.2s',
  },
  toggleExtrasBtn: {
    background: 'transparent',
    border: 'none',
    color: goldLight,
    fontSize: '0.75rem',
    fontWeight: '700',
    padding: '4px 0 0 0',
    textAlign: 'left',
    cursor: 'pointer',
    opacity: 0.9,
  },
  selectedExtrasContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    marginTop: '2px',
    background: 'rgba(212, 168, 67, 0.05)',
    borderRadius: '4px',
    padding: '4px 6px',
  },
  selectedExtraItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  removeExtraBtn: {
    background: 'rgba(255,50,50,0.1)',
    color: '#ff4444',
    border: 'none',
    borderRadius: '4px',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  extrasPanel: {
    background: '#111',
    border: `1px solid ${gold}22`,
    borderRadius: '8px',
    padding: '10px',
    marginTop: '8px',
    marginBottom: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  extrasPanelTitle: {
    margin: '0 0 4px 0',
    fontSize: '0.75rem',
    color: '#aaa',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  extraOptionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#161616',
    borderRadius: '6px',
    padding: '6px',
    border: `1px solid rgba(212, 168, 67, 0.1)`,
  },
  extraOptionImg: {
    width: '64px',
    height: '64px',
    borderRadius: '8px',
    objectFit: 'cover',
  },
  extraOptionName: {
    margin: 0,
    fontSize: '0.95rem',
    color: '#ddd',
    fontWeight: '600',
  },
  extraOptionPrice: {
    margin: 0,
    fontSize: '0.9rem',
    color: gold,
  },
  addExtraBtn: {
    background: `linear-gradient(135deg, ${gold}, ${goldLight})`,
    border: 'none',
    color: '#000',
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  cartItemBottom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '6px',
  },
  qtyControls: {
    display: 'flex',
    alignItems: 'center',
    background: '#0a0a0a',
    borderRadius: '8px',
    border: `1px solid ${gold}30`,
  },
  qtyBtn: {
    background: 'transparent',
    border: 'none',
    color: gold,
    fontSize: '1rem',
    fontWeight: '700',
    width: '32px',
    height: '32px',
    cursor: 'pointer',
  },
  qtyValue: {
    color: '#fff',
    fontSize: '0.85rem',
    fontWeight: '600',
    minWidth: '24px',
    textAlign: 'center',
  },
  subtotal: {
    margin: 0,
    color: goldLight,
    fontSize: '0.9rem',
    fontWeight: '700',
  },
  sidebarFooter: {
    padding: '20px 24px',
    borderTop: `1px solid ${gold}22`,
    background: '#0d0d0d',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  totalLabel: {
    color: '#ccc',
    fontSize: '1rem',
    fontWeight: '600',
  },
  totalValue: {
    color: goldLight,
    fontSize: '1.5rem',
    fontWeight: '800',
  },
  orderBtn: {
    width: '100%',
    padding: '14px',
    background: `linear-gradient(135deg, ${gold}, ${goldLight})`,
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: '700',
    cursor: 'pointer',
    letterSpacing: '0.5px',
    boxShadow: `0 4px 16px rgba(212, 168, 67, 0.3)`,
  },
};

// ── Floating Arrow Flyer Component ──
function Flyer({ flyer, onComplete }) {
  const ref = useRef(null);
  
  useEffect(() => {
    if (!ref.current) return;
    const { startX, startY, targetX, targetY } = flyer;
    
    ref.current.style.left = `${startX - 13}px`;
    ref.current.style.top = `${startY - 13}px`;
    
    const anim = animate(ref.current, {
      translateX: [0, targetX - startX],
      translateY: [0, targetY - startY],
      scale: [1.2, 0.3],
      opacity: [1, 1, 0],
      rotate: [0, 360],
      duration: 2200,
      ease: 'outQuad'
    });
    
    anim.then(onComplete).catch(() => onComplete());
  }, [flyer, onComplete]);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        width: '26px',
        height: '26px',
        borderRadius: '50%',
        backgroundColor: '#000000',
        border: '1.5px solid #d4a843',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        pointerEvents: 'none',
        boxShadow: '0 0 8px rgba(212, 168, 67, 0.6)',
        transformOrigin: 'center center',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4a843" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="19" x2="12" y2="5"></line>
        <polyline points="5 12 12 5 19 12"></polyline>
      </svg>
    </div>
  );
}
