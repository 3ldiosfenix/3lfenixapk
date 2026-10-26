
import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

window.switchTab = (tab) => {
    document.getElementById('tab-dashboard').classList.add('hidden');
    document.getElementById('tab-add').classList.add('hidden');
    document.getElementById('tab-history').classList.add('hidden');
    document.getElementById('tab-gallery').classList.add('hidden');
    document.getElementById('tab-moto').classList.add('hidden');
    
    if (tab === 'dashboard') document.getElementById('tab-dashboard').classList.remove('hidden');
    else if (tab === 'add') document.getElementById('tab-add').classList.remove('hidden');
    else if (tab === 'history') document.getElementById('tab-history').classList.remove('hidden');
    else if (tab === 'gallery') document.getElementById('tab-gallery').classList.remove('hidden');
    else if (tab === 'moto') document.getElementById('tab-moto').classList.remove('hidden');
};

window.logout = () => signOut(auth);

let isRegister = false;
document.getElementById('auth-switch').onclick = () => {
    isRegister = !isRegister;
    document.getElementById('name-field').classList.toggle('hidden', !isRegister);
    document.getElementById('auth-title').textContent = isRegister ? 'Crear Cuenta' : 'Iniciar Sesión';
    document.getElementById('auth-btn').textContent = isRegister ? 'Registrarse' : 'Iniciar Sesión';
    document.getElementById('auth-switch').textContent = isRegister ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate';
};

document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const name = document.getElementById('auth-name').value.trim();
    const errDiv = document.getElementById('auth-error');
    errDiv.classList.add('hidden');

    try {
        if (isRegister) {
            const res = await createUserWithEmailAndPassword(auth, email, password);
            if (name) await updateProfile(res.user, { displayName: name });
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (err) {
        errDiv.textContent = "Error al autenticar. Verifica tus datos.";
        errDiv.classList.remove('hidden');
    }
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        document.getElementById('user-display-name').textContent = user.displayName || user.email;
    } else {
        document.getElementById('app-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
    }
});
