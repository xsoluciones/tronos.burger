'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useMenu } from '@/app/context/MenuContext';
import { formatPrice } from '@/app/data/menuData';
import { animate, stagger } from 'animejs';

export default function DynamicCategorySection({ category }) {
  const { addToCart, expandedItemId, setExpandedItemId } = useMenu();
  const [expandedExtrasId, setExpandedExtrasId] = useState(null);
  const sectionRef = useRef(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!sectionRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            animate(`.card-${category.id}`, {
              translateY: [60, 0],
              opacity: [0, 1],
              duration: 800,
              delay: stagger(150),
              ease: 'outQuart',
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(sectionRef.current);

    return () => observer.disconnect();
  }, [category.id]);

  return (
    <section id={category.id} ref={sectionRef} style={styles.section}>
      <style>{`
        @keyframes pointRight {
          0%, 100% { transform: translateX(0) scale(1); }
          50% { transform: translateX(5px) scale(1.1); }
        }
        .pointing-hand {
          display: inline-block;
          animation: pointRight 1s infinite ease-in-out;
          margin-right: 6px;
          font-size: 1.2em;
        }
      `}</style>
      <div className="container">
        {/* ── Section Header ── */}
        <div style={styles.headerWrapper}>
          <h2 style={styles.title}>{category.title.toUpperCase()}</h2>
          <div style={styles.underline} />
          <p style={{ color: '#ffffff', fontSize: '1.15rem', fontStyle: 'italic', fontWeight: '500', marginTop: '-10px', marginBottom: '40px' }}>
            Toca el texto que dice "Adicionales ▼" en cada plato para ver más delicias ✨
          </p>
        </div>

        {/* ── Items Grid ── */}
        <div className="row g-4">
          {category.items.length === 0 ? (
            <div className="text-center w-100 text-muted my-5">No hay productos disponibles en esta categoría.</div>
          ) : (
            category.items.map((item) => (
              <div key={item.id} className="col-12 col-sm-6 col-lg-4">
                <div
                  className={`card-${category.id}`}
                  style={styles.card}
                  onMouseEnter={(e) => {
                    Object.assign(e.currentTarget.style, styles.cardHover);
                  }}
                  onMouseLeave={(e) => {
                    Object.assign(e.currentTarget.style, styles.cardLeave);
                  }}
                >
                  {/* Image Wrapper with Floating Add Button */}
                  <div style={styles.imageWrapper}>
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={400}
                      height={250}
                      style={styles.image}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    <button
                      style={styles.floatingCartBtn}
                      onClick={(e) => {
                        addToCart(item);
                        window.dispatchEvent(new CustomEvent('product-added-to-cart', {
                          detail: { x: e.clientX, y: e.clientY }
                        }));
                      }}
                      onMouseEnter={(e) => {
                        Object.assign(e.currentTarget.style, styles.floatingCartBtnHover);
                      }}
                      onMouseLeave={(e) => {
                        Object.assign(e.currentTarget.style, styles.floatingCartBtnLeave);
                      }}
                    >
                      + Agregar
                    </button>
                  </div>

                  {/* Card Body */}
                  <div style={styles.cardBody}>
                    {/* Title and Price Row */}
                    <div style={styles.cardHeaderRow}>
                      <h4 style={styles.cardName}>{item.name}</h4>
                      <span style={styles.cardPrice}>{formatPrice(item.price)}</span>
                    </div>

                    <p style={styles.cardDescription}>{item.description}</p>

                    {/* Ver más & Adicionales Buttons */}
                    <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        {item.detailedDescription && (
                          <button
                            onClick={() => {
                              setExpandedItemId(expandedItemId === item.id ? null : item.id);
                              if (expandedExtrasId === item.id) setExpandedExtrasId(null);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#d4a843',
                              fontSize: '0.8rem',
                              fontWeight: '700',
                              padding: 0,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {expandedItemId === item.id ? 'Ver menos ▲' : 'Ver más ▼'}
                          </button>
                        )}

                        {item.extras && item.extras.length > 0 && (
                          <button
                            onClick={() => {
                              setExpandedExtrasId(expandedExtrasId === item.id ? null : item.id);
                              if (expandedItemId === item.id) setExpandedItemId(null);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#d4a843',
                              fontSize: '0.8rem',
                              fontWeight: '700',
                              padding: 0,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {expandedExtrasId === item.id ? 'Ocultar adicionales ▲' : (
                              <>
                                <span className="pointing-hand">👉</span>
                                Adicionales ▼
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Ver más Detailed Description */}
                      {item.detailedDescription && (
                        <div
                          style={{
                            maxHeight: expandedItemId === item.id ? '220px' : '0px',
                            opacity: expandedItemId === item.id ? 1 : 0,
                            overflow: 'hidden',
                            transition: 'all 0.35s ease-in-out',
                            marginTop: expandedItemId === item.id ? '8px' : '0px',
                            fontSize: '0.8rem',
                            color: '#ccc',
                            lineHeight: '1.45',
                            borderTop: expandedItemId === item.id ? '1px solid rgba(212, 168, 67, 0.15)' : 'none',
                            paddingTop: expandedItemId === item.id ? '8px' : '0px'
                          }}
                        >
                          {item.detailedDescription}
                        </div>
                      )}

                      {/* Adicionales List */}
                      {item.extras && item.extras.length > 0 && (
                        <div
                          style={{
                            maxHeight: expandedExtrasId === item.id ? '300px' : '0px',
                            opacity: expandedExtrasId === item.id ? 1 : 0,
                            overflow: 'hidden',
                            overflowY: 'auto',
                            transition: 'all 0.35s ease-in-out',
                            marginTop: expandedExtrasId === item.id ? '8px' : '0px',
                            borderTop: expandedExtrasId === item.id ? '1px solid rgba(212, 168, 67, 0.15)' : 'none',
                            paddingTop: expandedExtrasId === item.id ? '8px' : '0px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          {item.extras.map(extra => (
                            <div key={extra.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(212, 168, 67, 0.1)' }}>
                              {extra.image && (
                                <img src={extra.image} alt={extra.name} style={{ width: '75px', height: '75px', borderRadius: '8px', objectFit: 'cover', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }} />
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: '#eee', fontWeight: '700' }}>{extra.name}</p>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#d4a843', fontWeight: '600' }}>+ {formatPrice(extra.price)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── Styles ─────────────── */
const gold = '#d4a843';
const goldLight = '#f0c96b';

const styles = {
  section: {
    padding: '60px 0',
    background: '#0a0a0a',
  },

  /* Header */
  headerWrapper: {
    textAlign: 'center',
    marginBottom: '50px',
  },
  title: {
    fontFamily: "'Cinzel', serif",
    fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
    color: gold,
    fontWeight: '700',
    letterSpacing: '3px',
    margin: '0 0 16px 0',
  },
  underline: {
    width: '80px',
    height: '3px',
    background: `linear-gradient(90deg, transparent, ${gold}, transparent)`,
    margin: '0 auto 20px auto',
    borderRadius: '2px',
  },

  /* Card */
  card: {
    background: 'rgba(20, 20, 20, 0.8)',
    border: '1px solid rgba(212, 168, 67, 0.2)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: '16px',
    overflow: 'hidden',
    opacity: 0,
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  cardHover: {
    transform: 'translateY(-8px)',
    borderColor: 'rgba(212, 168, 67, 0.5)',
    boxShadow: `0 12px 40px rgba(212, 168, 67, 0.2)`,
  },
  cardLeave: {
    transform: 'translateY(0)',
    borderColor: 'rgba(212, 168, 67, 0.2)',
    boxShadow: 'none',
  },

  /* Image Wrapper */
  imageWrapper: {
    position: 'relative',
    width: '100%',
    height: '250px',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '250px',
    objectFit: 'cover',
    borderRadius: '16px 16px 0 0',
  },

  /* Card Body */
  cardBody: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  cardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  cardName: {
    fontFamily: "'Cinzel', serif",
    color: gold,
    fontSize: '1.25rem',
    fontWeight: '700',
    margin: 0,
  },
  cardPrice: {
    color: gold,
    fontSize: '1.15rem',
    fontWeight: '700',
    whiteSpace: 'nowrap',
  },
  cardDescription: {
    fontFamily: "'Inter', sans-serif",
    color: '#ffffff',
    fontSize: '0.85rem',
    lineHeight: '1.45',
    margin: '0 0 10px 0',
    flex: 1,
  },

  /* Floating Add Button on Image */
  floatingCartBtn: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    padding: '6px 14px',
    borderRadius: '20px',
    background: 'rgba(0, 0, 0, 0.75)',
    border: `1.5px solid ${gold}`,
    color: gold,
    fontWeight: '600',
    fontSize: '0.78rem',
    cursor: 'pointer',
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
    transition: 'all 0.3s ease',
    zIndex: 5,
  },
  floatingCartBtnHover: {
    background: `linear-gradient(135deg, ${gold}, ${goldLight})`,
    color: '#0a0a0a',
    borderColor: gold,
    transform: 'scale(1.05)',
  },
  floatingCartBtnLeave: {
    background: 'rgba(0, 0, 0, 0.75)',
    color: gold,
    borderColor: gold,
    transform: 'scale(1)',
  },
};
