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
        src="/videos/intro.mp4"
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
            {socials.map((social) => (
              <a
                key={social.id}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 16px',
                  background: 'rgba(0, 0, 0, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '50px',
                  textDecoration: 'none',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.borderColor = 'rgba(212, 168, 67, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.65)';
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }}
              >
                {social.image ? (
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
            ))}
          </div>

          {/* Slogan y Acceso Admin */}
          <div className="col-md-4 text-center text-md-end">
            <p style={{ color: '#ccc', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: '500' }}>
              Sabor de Reyes, Experiencias Únicas 🔥
            </p>
            <Link href="/admin" className="footer-admin-link">
              🔐 Panel Admin
            </Link>
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
