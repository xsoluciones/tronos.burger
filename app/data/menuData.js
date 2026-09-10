/**
 * Tronos Pub & Grill - Datos del Menú
 * Archivo de constantes con los datos por defecto del menú.
 */

export const tronosSpecialExtras = [
  { id: 'ext-doble-carne', name: 'Doble Carne Premium 150g', price: 6000, image: '/images/tronos-clasica.png' },
  { id: 'ext-tocineta', name: 'Tocineta Ahumada Artesanal', price: 4000, image: '/images/la-noble.png' },
  { id: 'ext-queso-mozarella', name: 'Extra Queso Mozarella', price: 3000, image: '/images/tronos-clasica.png' },
  { id: 'ext-queso-cheddar', name: 'Queso Cheddar Fundido', price: 3500, image: '/images/olimpo-smash.png' },
  { id: 'ext-cebolla-caramelizada', name: 'Cebolla Caramelizada al Vino', price: 2500, image: '/images/suprema-valkiria.png' },
  { id: 'ext-huevo', name: 'Huevo Frito a Caballo', price: 2500, image: '/images/tronos-clasica.png' },
  { id: 'ext-papas-francesa', name: 'Adición Papas Francesa', price: 5000, image: '/images/papas-francesa.png' },
  { id: 'ext-salsa-tronos', name: 'Salsa Tronos 2oz', price: 2000, image: '/images/tronos-clasica.png' }
];

export const defaultMenuData = [
  {
    id: 'burgers',
    title: 'Hamburguesas (Burgers)',
    items: [
      {
        id: 'tronos-clasica',
        name: 'Tronos Clásica',
        description:
          'Pan Brioche, salsa tronos, 150g de carne premium, queso mozarella, pepinillos agridulces y vegetales.',
        detailedDescription:
          'Nuestra hamburguesa insignia viene con una carne seleccionada y madurada durante 15 días, asada a la parrilla con leña de mezquite para un sabor ahumado único. Los vegetales son frescos del día de cultivos locales.',
        price: 20000,
        image: '/images/tronos-clasica.png',
        categoryId: 'burgers',
        removableIngredients: ['Salsa Tronos', 'Queso Mozarella', 'Pepinillos Agridulces', 'Vegetales'],
        extras: tronosSpecialExtras,
      },
      {
        id: 'la-noble',
        name: 'La Noble',
        description:
          'Pan de papa, alioli de ajo, 150g de carne premium, queso colvijack, cebolla caramelizada, tocineta y lechuga romana.',
        detailedDescription:
          'La combinación perfecta entre dulce y salado. Nuestras cebollas caramelizadas se cocinan a fuego lento durante 4 horas con vino tinto y azúcar de caña. La tocineta es ahumada en madera de manzano.',
        price: 24000,
        image: '/images/la-noble.png',
        categoryId: 'burgers',
        removableIngredients: ['Alioli de Ajo', 'Queso Colvijack', 'Cebolla Caramelizada', 'Tocineta', 'Lechuga Romana'],
        extras: tronosSpecialExtras,
      },
      {
        id: 'olimpo-smash',
        name: 'Olimpo Smash',
        description:
          'Pan de papa, salsa chipotle, mermelada de tocineta, doble carne Smash y doble queso cheddar.',
        detailedDescription:
          'Dos carnes smash súper crujientes con costra dorada perfecta. Mermelada casera de tocineta reducida con cerveza stout de barril y sirope de arce puro.',
        price: 25000,
        image: '/images/olimpo-smash.png',
        categoryId: 'burgers',
        removableIngredients: ['Salsa Chipotle', 'Mermelada de Tocineta', 'Queso Cheddar'],
        extras: tronosSpecialExtras,
      },
      {
        id: 'suprema-valkiria',
        name: 'Suprema Valkiria',
        description:
          'Pan Brioche, salsa Bigmac, carne premium, queso colvijack, tocineta ahumada y cebolla caramelizada.',
        detailedDescription:
          'Inspirada en el norte. La salsa Bigmac especial de la casa combina pepinillos artesanales, mostaza dijon y un toque secreto de especias locales.',
        price: 25000,
        image: '/images/suprema-valkiria.png',
        categoryId: 'burgers',
        removableIngredients: ['Salsa Bigmac', 'Queso Colvijack', 'Tocineta Ahumada', 'Cebolla Caramelizada'],
        extras: tronosSpecialExtras,
      },
      {
        id: 'chicken-tronos',
        name: 'Chicken Tronos',
        description:
          'Pan de papa, pollo frito bañado con aceite especiado y espolvoreado con especias secas de diferentes niveles de picante (opcional), pepinillos, tocineta y salsa Sweet chipotle.',
        detailedDescription:
          'Pollo de campo marinado en buttermilk durante 24 horas para garantizar su jugosidad, rebozado en harina especial crujiente y bañado en aceites especiados.',
        price: 26000,
        image: '/images/chicken-tronos.png',
        categoryId: 'burgers',
        removableIngredients: ['Pepinillos', 'Tocineta', 'Salsa Sweet Chipotle', 'Especias picantes'],
        extras: tronosSpecialExtras,
      },
    ],
  },
  {
    id: 'entradas',
    title: 'Entradas & Papas (Sides)',
    items: [
      {
        id: 'papas-queso-tocineta',
        name: 'Papas Tronos Queso & Tocineta',
        description: 'Papas crujientes bañadas en queso cheddar fundido artesanal y trozos de tocineta crocante.',
        detailedDescription: 'Una montaña de papas recién fritas cubiertas de una cremosa salsa de cuatro quesos con cheddar madurado y tocineta ahumada en leña.',
        price: 16000,
        image: '/images/papas-queso-tocineta.png',
        categoryId: 'entradas',
        removableIngredients: ['Queso Cheddar', 'Tocineta'],
        extras: [
          { id: 'ext-extra-queso', name: 'Extra Queso Cheddar', price: 3500, image: '/images/papas-queso-tocineta.png' },
          { id: 'ext-extra-tocineta', name: 'Extra Tocineta', price: 4000, image: '/images/papas-queso-tocineta.png' }
        ]
      },
      {
        id: 'papas-cascos',
        name: 'Papas en Cascos Rústicas',
        description: 'Papas rústicas con piel sazonadas con paprika ahumada, orégano y alioli de la casa.',
        detailedDescription: 'Papas seleccionadas cortadas en gruesos gajos dorados, crujientes por fuera y tiernas por dentro, servidas con dip de alioli artesanal.',
        price: 11000,
        image: '/images/papas-cascos.png',
        categoryId: 'entradas',
        removableIngredients: ['Paprika', 'Alioli'],
        extras: [
          { id: 'ext-salsa-tronos-side', name: 'Salsa Tronos 2oz', price: 2000, image: '/images/papas-cascos.png' }
        ]
      },
      {
        id: 'papas-francesa',
        name: 'Papas a la Francesa Tronos',
        description: 'Papas clásicas corte delgado, extra crujientes sazonadas con sal marina fina.',
        detailedDescription: 'Papas fritas con doble cocción para lograr la crocancia perfecta, ideales para acompañar cualquiera de tus hamburguesas.',
        price: 9000,
        image: '/images/papas-francesa.png',
        categoryId: 'entradas',
        removableIngredients: ['Sal Marina'],
        extras: [
          { id: 'ext-queso-fundido-side', name: 'Bañadas en Cheddar', price: 3500, image: '/images/papas-francesa.png' }
        ]
      },
      {
        id: 'papas-picantes',
        name: 'Papas Spicy Tronos',
        description: 'Papas crocantes bañadas en salsa chipotle picante suave y especias secas.',
        detailedDescription: 'Para los amantes de las emociones fuertes. Servidas con reducción dulce de chipotle ahumado y cebollín fresco.',
        price: 13000,
        image: '/images/papas-picantes.png',
        categoryId: 'entradas',
        removableIngredients: ['Salsa Chipotle', 'Especias picantes'],
        extras: []
      }
    ]
  },
  {
    id: 'bebidas',
    title: 'Bebidas & Cervezas (Drinks)',
    items: [
      {
        id: 'coca-cola-original',
        name: 'Coca-Cola Original 400ml',
        description: 'Gaseosa refrescante sabor clásico servida bien fría.',
        detailedDescription: 'Botella personal de Coca-Cola original de 400ml, servida a temperatura ideal.',
        price: 6000,
        image: '/images/logo-tronos.webp',
        categoryId: 'bebidas',
        removableIngredients: [],
        extras: []
      },
      {
        id: 'coca-cola-zero',
        name: 'Coca-Cola Zero 400ml',
        description: 'El sabor clásico de siempre sin azúcar y sin calorías.',
        detailedDescription: 'Botella personal de Coca-Cola Zero azúcar 400ml, bien fría.',
        price: 6000,
        image: '/images/logo-tronos.webp',
        categoryId: 'bebidas',
        removableIngredients: [],
        extras: []
      },
      {
        id: 'cerveza-corona',
        name: 'Cerveza Corona Extra 355ml',
        description: 'Cerveza mexicana clara y refrescante con rodaja de limón.',
        detailedDescription: 'Cerveza importada tipo lager con 4.5% alcohol, perfecta para acompañar la parrilla.',
        price: 9000,
        image: '/images/logo-tronos.webp',
        categoryId: 'bebidas',
        removableIngredients: ['Limón'],
        extras: []
      },
      {
        id: 'cerveza-club-colombia',
        name: 'Cerveza Club Colombia Dorada',
        description: 'Cerveza premium colombiana 100% malta con aroma y cuerpo balanceado.',
        detailedDescription: 'Botella de 330ml de cerveza dorada premium con notas acarameladas.',
        price: 8000,
        image: '/images/logo-tronos.webp',
        categoryId: 'bebidas',
        removableIngredients: [],
        extras: []
      },
      {
        id: 'cerveza-heineken',
        name: 'Cerveza Heineken 330ml',
        description: 'Cerveza premium holandesa tipo pilsen pura malta.',
        detailedDescription: 'Botella de 330ml con notas afrutadas y suave amargor característico.',
        price: 9000,
        image: '/images/logo-tronos.webp',
        categoryId: 'bebidas',
        removableIngredients: [],
        extras: []
      },
      {
        id: 'te-hatsu',
        name: 'Té Hatsu 400ml',
        description: 'Té blanco o negro con extractos naturales y antioxidantes.',
        detailedDescription: 'Bebida premium a base de té sin gas, sabores variados según disponibilidad.',
        price: 8000,
        image: '/images/logo-tronos.webp',
        categoryId: 'bebidas',
        removableIngredients: [],
        extras: []
      },
      {
        id: 'limonada-natural',
        name: 'Limonada Natural Fría',
        description: 'Limonada recién exprimida servida con hielo y menta fresca.',
        detailedDescription: 'Vaso de 16oz preparado al momento con limones tahití frescos.',
        price: 7000,
        image: '/images/logo-tronos.webp',
        categoryId: 'bebidas',
        removableIngredients: ['Hielo', 'Azúcar'],
        extras: []
      },
      {
        id: 'agua-mineral',
        name: 'Agua Manantial 500ml',
        description: 'Agua pura mineral de manantial (con gas o sin gas).',
        detailedDescription: 'Botella de agua pura embotellada en origen.',
        price: 4500,
        image: '/images/logo-tronos.webp',
        categoryId: 'bebidas',
        removableIngredients: [],
        extras: []
      }
    ]
  }
];

/**
 * Formatea un precio numérico al formato colombiano.
 * Ejemplo: 20000 → '$20.000'
 * @param {number} price - Precio en pesos colombianos.
 * @returns {string} Precio formateado con signo $ y separadores de miles con punto.
 */
export function formatPrice(price) {
  return '$' + price.toLocaleString('es-CO');
}
