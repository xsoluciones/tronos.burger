/**
 * Tronos Pub & Grill - Datos del Menú
 * Archivo de constantes con los datos por defecto del menú.
 */

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
        extras: [
          { id: 'ext-doble-carne', name: 'Doble Carne', price: 6000, image: '/images/tronos-clasica.png' },
          { id: 'ext-queso-extra', name: 'Extra Queso Mozarella', price: 3000, image: '/images/tronos-clasica.png' },
          { id: 'ext-tocineta', name: 'Adición de Tocineta', price: 4000, image: '/images/tronos-clasica.png' }
        ]
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
        extras: [
          { id: 'ext-doble-carne-noble', name: 'Doble Carne', price: 6000, image: '/images/la-noble.png' },
          { id: 'ext-tocineta-extra', name: 'Extra Tocineta Ahumada', price: 4500, image: '/images/la-noble.png' }
        ]
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
        extras: []
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
        extras: []
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
      },
    ],
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
