import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCs6TaK4wUa-Xf0JkbL4my61JxJlX5CMUM",
  authDomain: "manupi-web.firebaseapp.com",
  databaseURL: "https://PROJECT_ID.firebaseio.com",
  projectId: "manupi-web",
  storageBucket: "manupi-web.firebasestorage.app",
  messagingSenderId: "399169759168",
  appId: "1:399169759168:web:7f16f4bfe23f9b989aca25"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
