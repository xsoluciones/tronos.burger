import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

export const firebaseConfig = {
  apiKey: "AIzaSyBvk6luvansao4VKTxA1L57UAz1Y2Megww",
  authDomain: "tronos-food.firebaseapp.com",
  databaseURL: "https://tronos-food-default-rtdb.firebaseio.com",
  projectId: "tronos-food",
  storageBucket: "tronos-food.firebasestorage.app",
  messagingSenderId: "402797947403",
  appId: "1:402797947403:web:3036ccfdaf13362cbd350e",
  measurementId: "G-4JY1Q1YHNN"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
export default app;
