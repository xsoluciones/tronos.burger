import { Suspense } from 'react';
import PedidoTrackingClient from './PedidoTrackingClient';

export async function generateStaticParams() {
  return [{ id: 'tracking' }];
}

export default function PedidoTrackingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Cargando pedido...</div>}>
      <PedidoTrackingClient />
    </Suspense>
  );
}
