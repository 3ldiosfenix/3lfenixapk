
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCuwUQojfewTYO-A2iaO75HHp234r-Z0Tg",
    authDomain: "misfinanzasapp-dc2d1.firebaseapp.com",
    projectId: "misfinanzasapp-dc2d1",
    storageBucket: "misfinanzasapp-dc2d1.firebasestorage.app",
    messagingSenderId: "735407911555",
    appId: "1:735407911555:web:2333eeb95dd41548ce21b6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
