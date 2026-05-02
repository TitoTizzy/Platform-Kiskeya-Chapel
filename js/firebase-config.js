// Importation des bibliothèques Firebase via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// Configuration Passion Football
const firebaseConfig = {
  apiKey: "AIzaSyCUVXlpPGeTmUf85CDhhaxeh-RtavY99OQ",
  authDomain: "passion-football.firebaseapp.com",
  projectId: "passion-football",
  storageBucket: "passion-football.firebasestorage.app",
  messagingSenderId: "731159830116",
  appId: "1:731159830116:web:cdade0352c6c20537e4971",
  measurementId: "G-6C68NJEDBY"
};

// Initialisation
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage };
