const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');

const firebaseConfig = {
  apiKey: 'AIzaSyBvk6luvansao4VKTxA1L57UAz1Y2Megww',
  authDomain: 'tronos-food.firebaseapp.com',
  databaseURL: 'https://tronos-food-default-rtdb.firebaseio.com',
  projectId: 'tronos-food'
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function check() {
  try {
    const snap = await get(ref(db, 'orders'));
    const orders = snap.val() || [];
    console.log('TOTAL_COUNT:', orders.length);
    console.log('LATEST_ORDERS:');
    const topOrders = orders.slice(0, 5);
    topOrders.forEach((o, i) => {
      console.log(`[${i+1}] ID: ${o.id} | Cliente: ${o.customer?.nombre || 'Sin nombre'} | Tel: ${o.customer?.telefono || 'N/A'} | Total: $${o.total} | Hora: ${o.date || o.createdAt}`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();
