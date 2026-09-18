const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, get } = require('firebase/database');
const fs = require('fs');
const path = require('path');

const firebaseConfig = {
  apiKey: "AIzaSyBvk6luvansao4VKTxA1L57UAz1Y2Megww",
  authDomain: "tronos-food.firebaseapp.com",
  databaseURL: "https://tronos-food-default-rtdb.firebaseio.com",
  projectId: "tronos-food",
  storageBucket: "tronos-food.firebasestorage.app",
  messagingSenderId: "402797947403",
  appId: "1:402797947403:web:3036ccfdaf13362cbd350e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function syncAllToFirebase() {
  try {
    const ordersPath = path.join(__dirname, '..', '.data', 'orders.json');
    const auditPath = path.join(__dirname, '..', '.data', 'audit-orders.json');

    const orders = fs.existsSync(ordersPath) ? JSON.parse(fs.readFileSync(ordersPath, 'utf8') || '[]') : [];
    const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8') || '[]') : [];

    console.log(`Subiendo ${orders.length} pedidos a Firebase Realtime Database...`);
    await set(ref(db, 'orders'), orders);
    console.log('✓ Pedidos sincronizados con éxito en Firebase!');

    console.log(`Subiendo ${audit.length} pedidos de auditoría a Firebase...`);
    await set(ref(db, 'audit_orders'), audit);
    console.log('✓ Auditoría sincronizada con éxito en Firebase!');

    // Probar lectura
    const snapshot = await get(ref(db, 'orders'));
    console.log('✓ Comprobación de lectura: pedidos leídos de Firebase =', snapshot.val()?.length);
    process.exit(0);
  } catch (error) {
    console.error('Error sincronizando con Firebase:', error);
    process.exit(1);
  }
}

syncAllToFirebase();
