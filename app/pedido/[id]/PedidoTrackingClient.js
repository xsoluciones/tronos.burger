'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/app/data/menuData';
import { rtdb } from '@/app/lib/firebaseClient';
import { ref, onValue } from 'firebase/database';

// Clave de almacenamiento exclusiva para opiniones de clientes
export const STORAGE_KEY_CUSTOMER_FEEDBACK = 'tronos_customer_feedback';

export default function PedidoTrackingClient() {
  const params = useParams();
  let orderId = params?.id ? decodeURIComponent(params.id) : '';
  if ((!orderId || orderId === 'tracking') && typeof window !== 'undefined') {
    const parts = window.location.pathname.split('/');
    const last = parts[parts.length - 1] || parts[parts.length - 2];
    if (last && last !== 'pedido' && last !== 'tracking') {
      orderId = decodeURIComponent(last);
    }
  }

  const [orders, setOrders] = useState([]);
  const [liveOrder, setLiveOrder] = useState(null);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [improvements, setImprovements] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [restaurantWhatsapp, setRestaurantWhatsapp] = useState('573007708616');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cfg = JSON.parse(localStorage.getItem('tronos-config') || '{}');
      if (cfg?.whatsapp) {
        let clean = String(cfg.whatsapp).replace(/\D/g, '');
        if (clean.length === 10 && clean.startsWith('3')) clean = `57${clean}`;
        setRestaurantWhatsapp(clean || '573007708616');
      }
    } catch (e) {}
  }, []);

  // ── Cargar Pedidos y Mantener Sincronización en Vivo ───────────────
  const fetchOrderData = async () => {
    if (typeof window === 'undefined') return;
    try {
      let combined = [];


      // 2) Fallback: cargar desde localStorage (solo funciona en el mismo dispositivo)
      const rawOrders = localStorage.getItem('tronos-orders');
      const rawAudit = localStorage.getItem('tronos-audit-backup');

      if (rawOrders) {
        try { combined = [...combined, ...JSON.parse(rawOrders)]; } catch (e) {}
      }
      if (rawAudit) {
        try { combined = [...combined, ...JSON.parse(rawAudit)]; } catch (e) {}
      }

      // 3) Datos combinados y ordenados por fecha

      // Eliminar duplicados priorizando el estado más reciente
      const map = new Map();
      combined.forEach((o) => {
        if (o?.id) {
          if (!map.has(o.id) || o.updatedAt) {
            map.set(o.id, o);
          }
        }
      });
      const orderList = Array.from(map.values());
      setOrders(orderList);

      const found = orderList.find((o) => o.id?.toLowerCase() === orderId.toLowerCase());
      if (found) {
        setLiveOrder(found);
      }
    } catch (err) {
      console.error('Error cargando orden:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderData();

    // Listen to Firebase for real-time order updates (replaces polling)
    const ordersRef = ref(rtdb, 'orders');
    const auditRef = ref(rtdb, 'audit_orders');
    const unsubOrders = onValue(ordersRef, (snapshot) => {
      const val = snapshot.val();
      if (val && Array.isArray(val)) {
        setOrders(prev => {
          const combined = [...prev];
          val.forEach(o => { if (o && !combined.some(c => c.id === o.id)) combined.push(o); });
          return combined;
        });
      }
    }, () => {});
    const unsubAudit = onValue(auditRef, (snapshot) => {
      const val = snapshot.val();
      if (val && Array.isArray(val)) {
        setOrders(prev => {
          const combined = [...prev];
          val.forEach(o => { if (o && !combined.some(c => c.id === o.id)) combined.push(o); });
          return combined;
        });
      }
    }, () => {});

    // Sincronización por storage event (otra pestaña del mismo navegador)
    const handleStorage = (e) => {
      if (e.key === 'tronos-orders' || e.key === 'tronos-audit-backup') {
        fetchOrderData();
      }
    };
    window.addEventListener('storage', handleStorage);

    // Sincronización en tiempo real por BroadcastChannel
    let channel = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('tronos_orders_channel');
        channel.onmessage = (event) => {
          const t = event.data?.type;
          if (
            t === 'SYNC_ORDERS' ||
            t === 'SYNC_AUDIT' ||
            t === 'NEW_ORDER_ALERT' ||
            t === 'STATUS_UPDATED' ||
            t === 'ORDER_STATUS_CHANGED'
          ) {
            fetchOrderData();
          }
        };
      } catch (e) {}
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
      if (channel) channel.close();
      if (unsubOrders) unsubOrders();
      if (unsubAudit) unsubAudit();
    };
  }, [orderId]);

  // Verificar si ya envió calificación previa para esta comanda
  useEffect(() => {
    if (typeof window === 'undefined' || !orderId) return;
    try {
      const rawFeedback = localStorage.getItem(STORAGE_KEY_CUSTOMER_FEEDBACK);
      if (rawFeedback) {
        const list = JSON.parse(rawFeedback);
        const existing = list.find((f) => f.orderId?.toLowerCase() === orderId.toLowerCase());
        if (existing) {
          setFeedbackSent(true);
          setRating(existing.rating || 5);
          setComment(existing.comment || '');
          setImprovements(existing.improvements || '');
        }
      }
    } catch (e) {}
  }, [orderId]);

  // ── Enviar Calificación (Llega EXCLUSIVAMENTE al Admin) ────────────
  const handleSubmitFeedback = (e) => {
    e.preventDefault();
    if (!orderId) return;

    const newFeedback = {
      id: `FBK-${Date.now()}`,
      orderId: orderId,
      customerName: liveOrder?.customer?.nombre || 'Cliente Tronos',
      customerPhone: liveOrder?.customer?.telefono || '',
      rating: rating,
      comment: comment.trim(),
      improvements: improvements.trim(),
      createdAt: new Date().toISOString(),
      orderTotal: liveOrder?.total || 0,
      orderItems: (liveOrder?.items || []).map((i) => `${i.name} (x${i.quantity})`).join(', '),
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEY_CUSTOMER_FEEDBACK);
      const existingList = raw ? JSON.parse(raw) : [];
      const updatedList = [newFeedback, ...existingList.filter((f) => f.orderId !== orderId)];
      localStorage.setItem(STORAGE_KEY_CUSTOMER_FEEDBACK, JSON.stringify(updatedList));

      // Notificar al admin por BroadcastChannel
      if ('BroadcastChannel' in window) {
        const ch = new BroadcastChannel('tronos_orders_channel');
        ch.postMessage({ type: 'NEW_CUSTOMER_FEEDBACK', feedback: newFeedback });
        ch.close();
      }

      setFeedbackSent(true);
    } catch (err) {
      console.error('Error guardando feedback:', err);
    }
  };

  // Determinar paso actual del progreso
  const status = liveOrder?.status || 'pendiente';
  const steps = [
    { key: 'pendiente', label: 'Recibido', subtitle: 'Verificando en caja', icon: '📋' },
    { key: 'en_cocina', label: 'En Cocina', subtitle: 'Preparando tu orden', icon: '👨‍🍳' },
    { key: 'en_camino', label: 'En Camino', subtitle: 'Repartidor en ruta', icon: '🛵' },
    { key: 'entregado', label: 'Entregado', subtitle: '¡Buen provecho!', icon: '✅' },
  ];

  const getStepIndex = (st) => {
    if (st === 'pendiente') return 0;
    if (st === 'en_cocina') return 1;
    if (st === 'en_camino') return 2;
    if (st === 'entregado') return 3;
    if (st === 'devuelto') return -1;
    return 0;
  };

  const currentStepIndex = getStepIndex(status);

  const statusColor =
    status === 'entregado' ? '#16a34a'
    : status === 'en_camino' ? '#0284c7'
    : status === 'en_cocina' ? '#ea580c'
    : status === 'devuelto' ? '#dc2626'
    : '#7c3aed';

  const statusBg =
    status === 'entregado' ? '#f0fdf4'
    : status === 'en_camino' ? '#f0f9ff'
    : status === 'en_cocina' ? '#fff7ed'
    : status === 'devuelto' ? '#fef2f2'
    : '#faf5ff';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatUp {
          0% { transform: translateY(100vh) rotate(0deg) scale(0.7); opacity: 0; }
          10% { opacity: 0.15; }
          90% { opacity: 0.1; }
          100% { transform: translateY(-120px) rotate(360deg) scale(1); opacity: 0; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.4); }
          50% { box-shadow: 0 0 0 12px rgba(124, 58, 237, 0); }
        }
        @keyframes bounceIcon {
          0%, 100% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-10px) scale(1.08); }
          60% { transform: translateY(-4px) scale(1.03); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .tronos-float-1 { position:absolute; font-size:28px; animation: floatUp 14s linear infinite; left: 8%; animation-delay: 0s; }
        .tronos-float-2 { position:absolute; font-size:22px; animation: floatUp 18s linear infinite; left: 25%; animation-delay: 3s; }
        .tronos-float-3 { position:absolute; font-size:32px; animation: floatUp 16s linear infinite; left: 55%; animation-delay: 6s; }
        .tronos-float-4 { position:absolute; font-size:20px; animation: floatUp 20s linear infinite; left: 78%; animation-delay: 2s; }
        .tronos-float-5 { position:absolute; font-size:26px; animation: floatUp 17s linear infinite; left: 90%; animation-delay: 8s; }
        .tronos-float-6 { position:absolute; font-size:24px; animation: floatUp 15s linear infinite; left: 42%; animation-delay: 10s; }
        .tronos-card {
          animation: slideUp 0.6s ease-out forwards;
          opacity: 0;
        }
        .tronos-bounce { animation: bounceIcon 2s ease-in-out infinite; }
        .tronos-pulse { animation: pulseGlow 2s ease-in-out infinite; }
      ` }} />

      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(160deg, #f8fafc 0%, #ffffff 40%, #f0f9ff 70%, #faf5ff 100%)',
          color: '#0f172a',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '24px 16px 60px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* ── FONDO DECORATIVO CON HAMBURGUESA ── */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: 'url(/images/tronos-clasica.png)',
            backgroundSize: '600px',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.035,
            filter: 'blur(12px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* ── EMOJIS FLOTANTES ANIMADOS ── */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
          <span className="tronos-float-1">🍔</span>
          <span className="tronos-float-2">🍟</span>
          <span className="tronos-float-3">🍔</span>
          <span className="tronos-float-4">🥤</span>
          <span className="tronos-float-5">🍔</span>
          <span className="tronos-float-6">🔥</span>
        </div>

        <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* ── CABECERA ── */}
          <header
            className="tronos-card"
            style={{
              textAlign: 'center',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '1px solid #e2e8f0',
              animationDelay: '0.05s',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <Image
                src="/images/logo-tronos.webp"
                alt="Tronos Pub & Grill"
                width={50}
                height={50}
                unoptimized
                style={{ borderRadius: '14px', border: '2px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.5px', color: '#0f172a' }}>
                  TRONOS PUB & GRILL
                </div>
                <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>
                  Seguimiento en Vivo de tu Pedido
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <span
                style={{
                  background: '#f1f5f9',
                  color: '#0f172a',
                  padding: '5px 14px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 800,
                  border: '1px solid #e2e8f0',
                }}
              >
                Comanda #{orderId}
              </span>
              {liveOrder?.date && (
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                  {new Date(liveOrder.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </header>

          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: '42px', animation: 'spin 2s linear infinite', display: 'inline-block' }}>🍔</div>
              <div style={{ marginTop: '12px', color: '#64748b', fontWeight: 600, fontSize: '14px' }}>Cargando tu pedido...</div>
            </div>
          )}

          {!loading && !liveOrder && (
            <div
              className="tronos-card"
              style={{
                background: '#ffffff',
                borderRadius: '20px',
                padding: '40px 24px',
                textAlign: 'center',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                animationDelay: '0.1s',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>😕</div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Pedido No Encontrado</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
                No encontramos la comanda #{orderId}. Verifica que el enlace sea correcto.
              </p>
              <Link
                href="/"
                style={{
                  display: 'inline-block',
                  background: '#0f172a',
                  color: '#ffffff',
                  padding: '10px 24px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  textDecoration: 'none',
                }}
              >
                ← Volver al Menú
              </Link>
            </div>
          )}

          {!loading && liveOrder && (
            <>
              {/* ── ALERTA EN VIVO DEL ESTADO ── */}
              <div
                className="tronos-card"
                style={{
                  background: statusBg,
                  border: `2px solid ${statusColor}30`,
                  borderRadius: '20px',
                  padding: '20px 22px',
                  marginBottom: '20px',
                  boxShadow: `0 8px 30px ${statusColor}15`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  animationDelay: '0.1s',
                }}
              >
                <div
                  className="tronos-bounce"
                  style={{
                    fontSize: '36px',
                    background: '#ffffff',
                    width: '64px',
                    height: '64px',
                    borderRadius: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 4px 16px ${statusColor}20`,
                    border: `2px solid ${statusColor}30`,
                  }}
                >
                  {status === 'entregado' ? '✅' : status === 'en_camino' ? '🛵' : status === 'en_cocina' ? '👨‍🍳' : status === 'devuelto' ? '⚠️' : '📋'}
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: statusColor }}>
                    {status === 'entregado' ? '¡Tu pedido ha sido Entregado!' : status === 'en_camino' ? '¡Tu pedido va En Camino!' : status === 'en_cocina' ? '¡Tu pedido está En Cocina!' : status === 'devuelto' ? 'Comanda en Revisión' : '¡Pedido Recibido con Éxito!'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px', lineHeight: '1.4' }}>
                    {status === 'entregado' ? 'Esperamos que disfrutes cada bocado. ¡Califica nuestro servicio abajo!' : status === 'en_camino' ? 'El repartidor ya salió hacia tu dirección. ¡Prepárate!' : status === 'en_cocina' ? 'Nuestros parrilleros preparan tus hamburguesas con ingredientes frescos.' : status === 'devuelto' ? 'Hubo una novedad con la entrega. Te contactaremos por WhatsApp.' : 'Tu orden fue recibida y se está verificando en caja.'}
                  </div>
                </div>
              </div>

              {/* ── BARRA DE PROGRESO / TIMELINE ── */}
              <div
                className="tronos-card"
                style={{
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '20px',
                  padding: '22px 18px',
                  marginBottom: '20px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
                  animationDelay: '0.2s',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: '18px', textAlign: 'center', letterSpacing: '1px' }}>
                  Progreso en Tiempo Real
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                  {/* Línea conectora de fondo */}
                  <div style={{ position: 'absolute', top: '24px', left: '30px', right: '30px', height: '4px', background: '#e2e8f0', zIndex: 1, borderRadius: '4px' }} />
                  {/* Línea conectora activa */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '24px',
                      left: '30px',
                      width: `${Math.max(0, Math.min(100, (currentStepIndex / (steps.length - 1)) * 100))}%`,
                      height: '4px',
                      background: `linear-gradient(90deg, #7c3aed, #0284c7, #16a34a)`,
                      zIndex: 2,
                      transition: 'width 0.8s ease',
                      borderRadius: '4px',
                    }}
                  />

                  {steps.map((s, idx) => {
                    const isCompleted = idx < currentStepIndex;
                    const isCurrent = idx === currentStepIndex;
                    const isPending = idx > currentStepIndex;

                    return (
                      <div
                        key={s.key}
                        style={{
                          position: 'relative',
                          zIndex: 3,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          width: '76px',
                          textAlign: 'center',
                        }}
                      >
                        <div
                          className={isCurrent ? 'tronos-pulse' : ''}
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '16px',
                            background: isCurrent ? '#ffffff' : isCompleted ? '#0f172a' : '#f1f5f9',
                            color: isCurrent ? statusColor : isCompleted ? '#ffffff' : '#94a3b8',
                            border: isCurrent ? `3px solid ${statusColor}` : isCompleted ? '3px solid #0f172a' : '2px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: isCompleted ? '16px' : '20px',
                            fontWeight: 900,
                            boxShadow: isCurrent ? `0 0 20px ${statusColor}30` : isCompleted ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                            transition: 'all 0.4s ease',
                          }}
                        >
                          {isCompleted ? '✓' : s.icon}
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '11px', fontWeight: isCurrent ? 900 : 700, color: isCurrent ? '#0f172a' : isCompleted ? '#334155' : '#94a3b8' }}>
                          {s.label}
                        </div>
                        <div style={{ fontSize: '9.5px', color: '#94a3b8', marginTop: '2px' }}>
                          {s.subtitle}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── DATOS DEL CLIENTE & DIRECCIÓN ── */}
              <div
                className="tronos-card"
                style={{
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '20px',
                  padding: '20px 22px',
                  marginBottom: '20px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                  animationDelay: '0.3s',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: '14px', letterSpacing: '0.8px' }}>
                  📍 Información de Entrega
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>👤</span>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Cliente:</span>
                    <strong style={{ color: '#0f172a' }}>{liveOrder?.customer?.nombre || 'Cliente'}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>📞</span>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Teléfono:</span>
                    <strong style={{ color: '#0f172a' }}>{liveOrder?.customer?.telefono || 'No especificado'}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🏠</span>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Dirección:</span>
                    <strong style={{ color: '#0f172a' }}>{liveOrder?.customer?.direccion || 'Entrega en Tronos'}</strong>
                  </div>
                  {liveOrder?.customer?.descripcion && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>📝</span>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Referencia:</span>
                      <span style={{ color: '#334155', fontStyle: 'italic' }}>{liveOrder.customer.descripcion}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── RESUMEN DE LO QUE PIDIÓ ── */}
              <div
                className="tronos-card"
                style={{
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '20px',
                  padding: '20px 22px',
                  marginBottom: '24px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                  animationDelay: '0.4s',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: '14px', letterSpacing: '0.8px' }}>
                  🍔 Lo que Pediste
                </div>

                {liveOrder?.items && liveOrder.items.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {liveOrder.items.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          borderBottom: idx < liveOrder.items.length - 1 ? '1px solid #f1f5f9' : 'none',
                          paddingBottom: idx < liveOrder.items.length - 1 ? '10px' : '0',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>
                            {item.quantity}x {item.name}
                          </div>
                          {item.selectedExtras && item.selectedExtras.length > 0 && (
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                              + {item.selectedExtras.map((e) => `${e.name} (x${e.quantity})`).join(', ')}
                            </div>
                          )}
                          {item.removedIngredients && item.removedIngredients.length > 0 && (
                            <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '2px' }}>
                              🚫 Sin: {item.removedIngredients.join(', ')}
                            </div>
                          )}
                          {item.note && (
                            <div style={{ fontSize: '12px', color: '#ea580c', marginTop: '2px', fontStyle: 'italic' }}>
                              📝 {item.note}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                          {formatPrice(item.price * item.quantity)}
                        </div>
                      </div>
                    ))}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '10px',
                        borderTop: '2px solid #e2e8f0',
                        marginTop: '4px',
                      }}
                    >
                      <span style={{ fontSize: '15px', fontWeight: 900, color: '#64748b' }}>TOTAL:</span>
                      <span style={{ fontSize: '22px', fontWeight: 900, color: '#16a34a' }}>
                        {formatPrice(liveOrder.total || 0)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
                    Cargando productos de la orden #{orderId}...
                  </div>
                )}
              </div>

              {/* ── MÓDULO DE CALIFICACIÓN & COMENTARIOS ── */}
              <div
                className="tronos-card"
                style={{
                  background: 'rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '20px',
                  padding: '28px 22px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
                  marginBottom: '32px',
                  animationDelay: '0.5s',
                }}
              >
                <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                  <div style={{ fontSize: '28px', marginBottom: '6px' }}>⭐</div>
                  <h3 style={{ fontSize: '19px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                    ¿Qué te pareció nuestro servicio?
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '6px 0 0', lineHeight: '1.4' }}>
                    Tu opinión es confidencial y le llegará directamente a nuestra gerencia para seguir mejorando.
                  </p>
                </div>

                {feedbackSent ? (
                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '2px solid #86efac',
                      borderRadius: '16px',
                      padding: '24px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
                    <h4 style={{ fontSize: '17px', fontWeight: 900, color: '#16a34a', margin: 0 }}>
                      ¡Muchas gracias por tu opinión!
                    </h4>
                    <p style={{ fontSize: '13px', color: '#475569', marginTop: '8px', lineHeight: '1.5' }}>
                      Hemos guardado tu calificación de {rating} estrellas y tus recomendaciones. ¡Trabajamos con amor para darte siempre la mejor hamburguesa!
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitFeedback}>
                    {/* Selector de Estrellas */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            fontSize: '36px',
                            cursor: 'pointer',
                            color: (hoverRating || rating) >= star ? '#eab308' : '#cbd5e1',
                            transition: 'transform 0.15s ease, color 0.15s ease',
                            transform: (hoverRating || rating) >= star ? 'scale(1.2)' : 'scale(1)',
                            padding: '2px',
                          }}
                          title={`${star} estrellas`}
                        >
                          ★
                        </button>
                      ))}
                    </div>

                    <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#ea580c', marginBottom: '18px' }}>
                      {rating === 5 && '¡Excelente experiencia! 😍'}
                      {rating === 4 && 'Muy buena comida y servicio 👍'}
                      {rating === 3 && 'Aceptable, con detalles por mejorar 🙂'}
                      {rating === 2 && 'Regular, no cumplió expectativas 😐'}
                      {rating === 1 && 'Mala experiencia, necesitamos mejorar 😔'}
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                        ¿Qué tal estuvo el sabor y la atención?
                      </label>
                      <textarea
                        rows={3}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Cuéntanos qué fue lo que más te gustó..."
                        style={{
                          width: '100%',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          color: '#0f172a',
                          fontSize: '13px',
                          padding: '12px 14px',
                          outline: 'none',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#ea580c', marginBottom: '6px' }}>
                        💡 Cosas a mejorar (Sugerencias directas al Admin)
                      </label>
                      <textarea
                        rows={2}
                        value={improvements}
                        onChange={(e) => setImprovements(e.target.value)}
                        placeholder="¿Algún ingrediente, tiempo de entrega o detalle que podamos perfeccionar?"
                        style={{
                          width: '100%',
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          borderRadius: '12px',
                          color: '#0f172a',
                          fontSize: '13px',
                          padding: '12px 14px',
                          outline: 'none',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                        color: '#000000',
                        border: 'none',
                        borderRadius: '14px',
                        padding: '14px',
                        fontSize: '15px',
                        fontWeight: 900,
                        cursor: 'pointer',
                        boxShadow: '0 6px 20px rgba(234, 179, 8, 0.3)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      ⭐ Enviar Calificación a Gerencia
                    </button>
                  </form>
                )}
              </div>

              {/* ── ENLACE DE SOPORTE & REGRESO A LA CARTA ── */}
              <div
                className="tronos-card"
                style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', animationDelay: '0.6s' }}
              >
                <Link
                  href="/"
                  style={{
                    color: '#475569',
                    fontSize: '13px',
                    textDecoration: 'none',
                    fontWeight: 700,
                    padding: '8px 18px',
                    borderRadius: '12px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}
                >
                  ← Volver al Menú
                </Link>
                <a
                  href={`https://wa.me/${restaurantWhatsapp}?text=${encodeURIComponent(`Hola Tronos, tengo una consulta sobre mi comanda #${orderId}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#16a34a',
                    fontSize: '13px',
                    textDecoration: 'none',
                    fontWeight: 700,
                    padding: '8px 18px',
                    borderRadius: '12px',
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    boxShadow: '0 2px 8px rgba(22, 163, 74, 0.1)',
                  }}
                >
                  💬 Contactar por WhatsApp
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
