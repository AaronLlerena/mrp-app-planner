import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Tu configuración REAL de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC3MH4h8OcxmgvQJW-C7m1gMEmisltuJAE",
  authDomain: "mrp-planner-alimentos.firebaseapp.com",
  projectId: "mrp-planner-alimentos",
  storageBucket: "mrp-planner-alimentos.firebasestorage.app",
  messagingSenderId: "167639898278",
  appId: "1:167639898278:web:23538226bcada6cec57c67"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Exporta la conexión a Firestore para usarla en el resto de la app
export const db = getFirestore(app);