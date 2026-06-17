'use client';

import { useState, useEffect } from 'react';

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // Calculamos la mitad del total de la página scrollable
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const currentScroll = window.scrollY;
      
      // Si el usuario ha bajado más de la mitad del scroll posible
      if (currentScroll > scrollableHeight / 2) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    // Verificación inicial
    toggleVisibility();

    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      style={{
        position: 'fixed',
        bottom: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #d4a843, #f0c96b)',
        color: '#050505',
        border: '2px solid rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.8rem',
        cursor: 'pointer',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.6), 0 0 15px rgba(212, 168, 67, 0.4)',
        zIndex: 1500,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: 'bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateX(-50%) scale(1.1)';
        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.8), 0 0 25px rgba(212, 168, 67, 0.6)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.6), 0 0 15px rgba(212, 168, 67, 0.4)';
      }}
      aria-label="Volver arriba"
    >
      <style>{`
        @keyframes bounceIn {
          0% { transform: translateX(-50%) scale(0); opacity: 0; }
          50% { transform: translateX(-50%) scale(1.1); }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }
      `}</style>
      ↑
    </button>
  );
}
