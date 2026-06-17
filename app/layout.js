import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import { MenuProvider } from './context/MenuContext';
import ScrollToTop from './components/ScrollToTop';

export const metadata = {
  title: 'Tronos Pub & Grill | Carta Digital',
  description: 'Sabor de Reyes, Experiencias Únicas. Pide las mejores hamburguesas artesanales a domicilio. Tronos Pub & Grill - Menú digital y pedidos a domicilio.',
  keywords: 'hamburguesas, tronos, pub, grill, domicilio, pedidos, artesanales',
  icons: {
    icon: '/images/logo-tronos.webp',
    apple: '/images/logo-tronos.webp',
  },
  openGraph: {
    title: 'Tronos Pub & Grill | Carta Digital',
    description: 'Sabor de Reyes, Experiencias Únicas. Las mejores hamburguesas artesanales.',
    images: ['/images/logo-tronos.webp'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <MenuProvider>
          {children}
          <ScrollToTop />
        </MenuProvider>
      </body>
    </html>
  );
}

