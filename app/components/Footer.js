'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMenu } from '@/app/context/MenuContext';

export default function Footer() {
  const { restaurantConfig } = useMenu();
  const socials = restaurantConfig?.socials || [];

  return (
    <footer className="footer" style={{ position: 'relative', overflow: 'hidden', padding: '4rem 0 2rem 0' }}>
      {/* Video de Fondo en el Pie de Página */}
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

      {/* Contenido del Footer */}
      <div className="container" style={{ position: 'relative', zIndex: 2 }}>
        <div className="row align-items-center">
          {/* Logo y Marca */}
          <div className="col-md-4 text-center text-md-start mb-3 mb-md-0">
            <div className="d-flex align-items-center gap-3 justify-content-center justify-content-md-start">
              <Image
                src="/images/logo-tronos.webp"
                alt="Tronos Pub & Grill"
                width={60}
                height={60}
                unoptimized
                className="footer-logo"
                style={{ objectFit: 'cover', borderRadius: '10px' }}
              />
              <div>
                <div className="footer-brand" style={{ letterSpacing: '3px' }}>TRONOS</div>
                <div className="footer-tagline">— Pub & Grill —</div>
              </div>
            </div>
          </div>

          {/* Redes Sociales Dinámicas */}
          <div className="col-md-4 text-center mb-4 mb-md-0 d-flex justify-content-center flex-wrap gap-2">
            {socials.map((social) => {
              const isInstagram = social.name?.toLowerCase().includes('instagram');
              return (
                <a
                  key={social.id}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '9px',
                    padding: isInstagram ? '6px 18px 6px 10px' : '6px 16px',
                    background: isInstagram ? 'rgba(20, 10, 15, 0.75)' : 'rgba(0, 0, 0, 0.65)',
                    border: isInstagram ? '1.5px solid #e1306c' : '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '50px',
                    textDecoration: 'none',
                    transition: 'all 0.3s ease',
                    backdropFilter: 'blur(10px)',
                    boxShadow: isInstagram
                      ? '0 4px 18px rgba(225, 48, 108, 0.35)'
                      : '0 4px 15px rgba(0, 0, 0, 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isInstagram ? 'rgba(225, 48, 108, 0.2)' : 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.borderColor = isInstagram ? '#f43f5e' : 'rgba(212, 168, 67, 0.5)';
                    if (isInstagram) {
                      e.currentTarget.style.boxShadow = '0 6px 22px rgba(225, 48, 108, 0.55)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isInstagram ? 'rgba(20, 10, 15, 0.75)' : 'rgba(0, 0, 0, 0.65)';
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.borderColor = isInstagram ? '#e1306c' : 'rgba(255, 255, 255, 0.15)';
                    if (isInstagram) {
                      e.currentTarget.style.boxShadow = '0 4px 18px rgba(225, 48, 108, 0.35)';
                    }
                  }}
                >
                  {isInstagram ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '26px',
                        height: '26px',
                        borderRadius: '7px',
                        background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                        boxShadow: '0 2px 8px rgba(225, 48, 108, 0.4)',
                        flexShrink: 0,
                      }}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ display: 'block' }}
                      >
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                      </svg>
                    </span>
                  ) : social.image ? (
                    <img src={social.image} alt={social.name} width={24} height={24} style={{ borderRadius: '4px', objectFit: 'cover' }} />
                  ) : social.icon ? (
                    <span style={{ fontSize: '1.2rem' }}>{social.icon}</span>
                  ) : null}
                  <span style={{ 
                    color: '#ffffff',
                    fontWeight: '600', 
                    fontSize: '0.85rem',
                    letterSpacing: '0.5px',
                  }}>
                    {social.name}
                  </span>
                </a>
              );
            })}
          </div>

          {/* Slogan y Acceso Admin */}
          <div className="col-md-4 text-center text-md-end">
            <p style={{ color: '#ccc', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: '500' }}>
              Sabor de Reyes, Experiencias Únicas 🔥
            </p>
            <div className="d-flex justify-content-center justify-content-md-end">
              <Link href="/admin" className="footer-admin-link">
                🔐 Acceso al Sistema POS
              </Link>
            </div>
          </div>
        </div>

        <hr className="footer-divider" style={{ opacity: 0.15 }} />

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Tronos Pub & Grill. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
