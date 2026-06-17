'use client';

import ParticlesBackground from './components/ParticlesBackground';
import Hero from './components/Hero';
import InstagramBanner from './components/InstagramBanner';
import DynamicCategorySection from './components/DynamicCategorySection';
import Cart from './components/Cart';
import Footer from './components/Footer';
import { useMenu } from './context/MenuContext';

export default function Home() {
  const { menuCategories } = useMenu();

  return (
    <main style={{ position: 'relative', overflowX: 'hidden', minHeight: '100vh' }}>
      {/* Canvas Partículas de Fondo */}
      <ParticlesBackground />

      {/* Sección Hero con Logo y Eslogan */}
      <Hero />

      {/* Banner de Instagram con Video de Fondo (Entre Hero y Menú) */}
      <InstagramBanner />

      {/* Renderizar cada categoría dinámicamente */}
      <div id="menu">
        {menuCategories.map((category) => (
          <DynamicCategorySection key={category.id} category={category} />
        ))}
      </div>

      {/* Carrito Flotante y Sidebar */}
      <Cart />

      {/* Footer del Restaurante */}
      <Footer />
    </main>
  );
}
