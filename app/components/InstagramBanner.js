'use client';

import Image from 'next/image';

export default function InstagramBanner() {
  return (
    <section 
      className="instagram-banner" 
      style={{ 
        position: 'relative', 
        overflow: 'hidden', 
        padding: '2rem 0',
        backgroundColor: '#000000'
      }}
    >
      {/* Video de Fondo en el Banner */}
      <video
        src="/videos/brasas.mp4"
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Capa de oscurecimiento para legibilidad (semi-transparente para que el video se vea claramente) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.8) 100%)',
          zIndex: 1,
        }}
      />

      {/* Contenido del Banner */}
      <div className="container" style={{ position: 'relative', zIndex: 2 }}>
        <div className="d-flex flex-column flex-md-row align-items-center justify-content-center gap-4 gap-md-5">
          {/* Logo y Marca */}
          <div className="d-flex align-items-center gap-3">
            <Image
              src="/images/logo-tronos.webp"
              alt="Tronos Pub & Grill"
              width={65}
              height={65}
              unoptimized
              className="banner-logo"
              style={{ objectFit: 'cover', borderRadius: '10px' }}
            />
            <div>
              <div className="banner-brand" style={{ 
                fontFamily: 'Cinzel, serif', 
                fontSize: '1.6rem', 
                fontWeight: '700', 
                color: '#d4a843', 
                letterSpacing: '3px',
                lineHeight: 1.1
              }}>
                TRONOS
              </div>
              <div className="banner-tagline" style={{ 
                color: '#aaa', 
                fontSize: '0.85rem', 
                fontStyle: 'italic',
                marginTop: '2px'
              }}>
                — Pub & Grill —
              </div>
            </div>
          </div>

          {/* Enlace de Instagram con Logo Original */}
          <div className="d-flex justify-content-center">
            <a
              href="https://www.instagram.com/tronospubgrill"
              target="_blank"
              rel="noopener noreferrer"
              className="banner-instagram-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 24px 8px 12px',
                background: 'rgba(0, 0, 0, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '50px',
                textDecoration: 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 6px 25px rgba(224, 45, 96, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.65)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.4)';
              }}
            >
              {/* Contenedor del Logo de Instagram con su Degradado Original */}
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                  boxShadow: '0 2px 8px rgba(220, 39, 67, 0.3)',
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ display: 'block' }}
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </span>
              <span style={{ 
                color: '#ffffff',
                fontWeight: '700', 
                fontSize: '0.9rem',
                letterSpacing: '1px',
              }}>
                @TRONOSPUBGRILL
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
