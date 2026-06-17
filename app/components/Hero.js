'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { animate } from 'animejs';

export default function Hero() {
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    // Animar la mitad izquierda (caballo)
    animate('.left-half', {
      scale: [0.95, 1],
      opacity: [0, 1],
      duration: 1200,
      ease: 'outExpo',
    });

    // Animar la mitad derecha (papas)
    animate('.right-half', {
      scale: [0.95, 1],
      opacity: [0, 1],
      duration: 1200,
      delay: 150,
      ease: 'outExpo',
    });

    // Text: fade in from bottom
    animate('.hero-instruction-text', {
      translateY: [20, 0],
      opacity: [0, 1],
      duration: 800,
      delay: 400,
      ease: 'outExpo',
    });

    // Button: fade in from bottom
    animate('.hero-btn', {
      translateY: [30, 0],
      opacity: [0, 1],
      duration: 900,
      delay: 500,
      ease: 'outExpo',
    });

    // Arrow: infinite bounce
    animate('.hero-arrow', {
      translateY: [-8, 8],
      opacity: [1, 0.3],
      duration: 1200,
      loop: true,
      alternate: true,
      ease: 'inOutSine',
    });
  }, []);

  const scrollToMenu = () => {
    const menuSection = document.getElementById('menu');
    if (menuSection) {
      menuSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <style jsx>{`
        .hero-section {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background-color: #000000;
          z-index: 1;
          overflow: hidden;
        }

        /* Capa de fondo dividida en 50/50 */
        .hero-bg-split {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          z-index: 1;
        }

        .bg-half {
          position: relative;
          width: 50%;
          height: 100%;
          background-color: #000000;
          opacity: 0;
          overflow: hidden; /* Oculta los bordes recortados de la imagen */
        }

        /* Capa de contenido */
        .hero-content {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2rem 1rem;
          background: rgba(0, 0, 0, 0.3);
          pointer-events: none;
        }

        .hero-content button,
        .hero-content h2,
        .hero-content div {
          pointer-events: auto;
        }

        .hero-instruction-text {
          color: #ffffff;
          font-size: 1.5rem;
          font-weight: 800;
          max-width: 800px;
          margin: 0 auto 1.5rem auto;
          line-height: 1.3;
          text-shadow: 0 4px 15px rgba(0,0,0,0.8);
          opacity: 0;
        }

        /* Botón redondeado */
        .hero-btn {
          opacity: 0;
          margin-top: 2rem;
          padding: 0.95rem 3rem;
          border: 2px solid #d4a843;
          border-radius: 50px;
          background: transparent;
          color: #d4a843;
          font-family: 'Cinzel', serif;
          font-size: 1.05rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          cursor: pointer;
          transition: all 0.35s ease;
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
        }

        .hero-btn:hover {
          background: linear-gradient(135deg, #d4a843, #f0c96b);
          color: #0a0a0a;
          transform: scale(1.06);
          box-shadow: 0 0 35px rgba(212, 168, 67, 0.6),
                      0 0 70px rgba(212, 168, 67, 0.3);
        }

        .hero-btn:active {
          transform: scale(1.02);
        }

        .hero-btn .fire-icon {
          font-size: 1.2rem;
        }

        .hero-arrow {
          position: absolute;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%);
          color: #d4a843;
          font-size: 1.5rem;
          opacity: 0.7;
          cursor: pointer;
          user-select: none;
        }

        /* ── DISEÑO PARA MÓVILES (APILAR IMÁGENES ARRIBA Y BOTÓN ABAJO) ── */
        @media (max-width: 768px) {
          .hero-section {
            flex-direction: column;
            justify-content: flex-start;
            height: auto;
            min-height: auto;
            padding: 0;
          }

          .hero-bg-split {
            position: relative;
            width: 100%;
            height: 40vh;
            min-height: 240px;
          }

          .bg-half {
            height: 100%;
          }

          .hero-content {
            position: relative;
            width: 100%;
            height: auto;
            flex: none;
            padding: 0 1rem 0.2rem 1rem; /* Sin padding arriba para pegar el botón a las imágenes */
            background: #000000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin-top: -2px; /* Solapar ligeramente para evitar líneas o separaciones */
          }

          .hero-instruction-text {
            font-size: 1.1rem;
            margin-bottom: 0.8rem;
            padding: 0 1rem;
          }

          .hero-btn {
            padding: 0.8rem 2.2rem;
            font-size: 0.95rem;
            margin-top: 0.5rem; /* Pequeño respiro con el texto */
            margin-bottom: 0.2rem;
          }

          .hero-arrow {
            position: relative;
            bottom: auto;
            left: auto;
            transform: none;
            margin-top: 0.1rem;
            font-size: 1.2rem;
          }
        }
      `}</style>

      <section className="hero-section">
        {/* Capa de Fondo Dividida 50/50 Ancho Completo */}
        <div className="hero-bg-split">
          <div className="bg-half left-half">
            <Image
              src="/images/logo-tronos.webp"
              alt="Tronos Caballo Logo"
              fill
              priority
              unoptimized
              style={{ objectFit: 'contain', backgroundColor: '#000000', transform: 'scale(1.04)' }}
            />
          </div>
          <div className="bg-half right-half">
            <Image
              src="/images/papas.webp"
              alt="Tronos Papas Logo"
              fill
              priority
              unoptimized
              style={{ objectFit: 'contain', backgroundColor: '#000000', transform: 'scale(1.04)' }}
            />
          </div>
        </div>

        {/* Capa de Contenido de Texto */}
        <div className="hero-content">
          <h2 className="hero-instruction-text">
            Si no te gusta algun ingrediente lo puedes quitar desde el carrito de compras 😉
          </h2>
          <button className="hero-btn" onClick={scrollToMenu}>
            <span className="fire-icon">🔥</span>
            Ver el Menú
          </button>

          <div className="hero-arrow" onClick={scrollToMenu}>
            ▼
          </div>
        </div>
      </section>
    </>
  );
}
