'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

function SeguimientoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');

  useEffect(() => {
    if (id) {
      router.replace(`/pedido/tracking?id=${id}`);
    }
  }, [id, router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0b0f17',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '36px', marginBottom: '12px' }}>🍔</div>
      <h2 style={{ fontSize: '20px', fontWeight: 900 }}>Cargando seguimiento de tu pedido...</h2>
      <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>
        Por favor espera un instante mientras nos conectamos con la cocina.
      </p>
    </div>
  );
}

export default function SeguimientoPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: '#0b0f17', color: '#fff', padding: '40px', textAlign: 'center' }}>
          Cargando...
        </div>
      }
    >
      <SeguimientoContent />
    </Suspense>
  );
}
