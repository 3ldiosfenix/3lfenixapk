import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, setDoc, getDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUser = null;
let currentType = 'expense';
let transactions = [];
let savingsGoals = [];
let motoSpares = [];
let soatPhotoBase64 = null;
let tarjetaPdfBase64 = null;
let vehiculoPhotoBase64 = null;
let isBalanceVisible = false;
let isRegister = false;
let currentPhotoBase64 = null;
let sparePhotoBase64 = null;

let isDarkMode = localStorage.getItem('app_dark_mode') !== 'false';

let categories = [
    { name: 'Comida / Alimentos', color: '#EF4444', budget: 300 },
    { name: 'Transporte', color: '#3B82F6', budget: 200 },
    { name: 'Servicios', color: '#F59E0B', budget: 150 },
    { name: 'Salario', color: '#10B981', budget: 0 },
    { name: 'Deudas', color: '#8B5CF6', budget: 0 },
    { name: 'General', color: '#64748B', budget: 100 }
];

let chartInstance = null;
let barChartInstance = null;
let dailyChartInstance = null;

// Exponer funciones necesarias al objeto global (window)
window.applyDarkMode = (dark) => {
    const htmlRoot = document.getElementById('html-root');
    const icon = document.getElementById('theme-toggle-icon');
    if (dark) {
        htmlRoot.classList.add('dark');
        if (icon) icon.className = "fa-solid fa-sun text-amber-400";
    } else {
        htmlRoot.classList.remove('dark');
        if (icon) icon.className = "fa-solid fa-moon text-slate-300";
    }
};

window.toggleDarkMode = () => {
    isDarkMode = !isDarkMode;
    localStorage.setItem('app_dark_mode', isDarkMode);
    window.applyDarkMode(isDarkMode);
    window.renderUI();
};

window.switchTab = (tab) => {
    document.getElementById('tab-dashboard').classList.add('hidden');
    document.getElementById('tab-add').classList.add('hidden');
    document.getElementById('tab-history').classList.add('hidden');
    document.getElementById('tab-gallery').classList.add('hidden');
    document.getElementById('tab-moto').classList.add('hidden');

    if (tab === 'dashboard') document.getElementById('tab-dashboard').classList.remove('hidden');
    else if (tab === 'add') document.getElementById('tab-add').classList.remove('hidden');
    else if (tab === 'history') document.getElementById('tab-history').classList.remove('hidden');
    else if (tab === 'gallery') {
        document.getElementById('tab-gallery').classList.remove('hidden');
        window.renderGallery();
    } else if (tab === 'moto') {
        document.getElementById('tab-moto').classList.remove('hidden');
        window.renderMotoUI();
    }
};

window.logout = () => signOut(auth);

window.toggleBalanceVisibility = () => {
    isBalanceVisible = !isBalanceVisible;
    const eyeIcon = document.getElementById('toggle-eye-icon');
    if (eyeIcon) eyeIcon.className = isBalanceVisible ? "fa-solid fa-eye" : "fa-solid fa-eye-slash";
    window.renderUI();
};

window.renderGoalsUI = () => {
    const listEl = document.getElementById('savings-goals-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (savingsGoals.length === 0) {
        listEl.innerHTML = `<p class="text-[11px] text-slate-400 text-center py-1">No tienes metas activas.</p>`;
        return;
    }
    savingsGoals.forEach(g => {
        const percent = Math.min(100, Math.round((g.current / g.target) * 100));
        listEl.innerHTML += `
            <div class="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-2.5 rounded-2xl space-y-1.5">
                <div class="flex justify-between items-center text-xs">
                    <span class="font-bold text-slate-800 dark:text-slate-200">${g.title}</span>
                    <span class="text-[11px] font-extrabold text-emerald-600">S/ ${g.current.toFixed(2)} / S/ ${g.target.toFixed(2)}</span>
                </div>
                <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div class="bg-emerald-500 h-full rounded-full" style="width: ${percent}%;"></div>
                </div>
            </div>
        `;
    });
};

window.renderMotoUI = () => {
    const listEl = document.getElementById('moto-spares-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (motoSpares.length === 0) {
        listEl.innerHTML = `<p class="text-[11px] text-slate-400 text-center py-3">No hay repuestos registrados.</p>`;
        return;
    }
    motoSpares.forEach(s => {
        listEl.innerHTML += `
            <div class="flex justify-between items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl">
                <div>
                    <p class="font-bold text-slate-800 dark:text-slate-100 text-xs">${s.name}</p>
                    <p class="text-[10px] text-slate-400">${s.date}</p>
                </div>
                <span class="font-extrabold text-xs text-emerald-600">S/ ${s.cost.toFixed(2)}</span>
            </div>
        `;
    });
};

window.renderGallery = () => {
    const gridEl = document.getElementById('gallery-grid');
    if (!gridEl) return;
    gridEl.innerHTML = `<p class="col-span-2 text-xs text-slate-400 text-center py-6">Galería sincronizada.</p>`;
};

window.renderCategories = () => {
    const selectForm = document.getElementById('tx-category');
    if (selectForm) {
        selectForm.innerHTML = categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('');
    }
};

window.renderUI = () => {
    const timeFilterEl = document.getElementById('time-filter');
    const timeFilter = timeFilterEl ? timeFilterEl.value : 'all';
    const categoryFilterSelect = document.getElementById('category-filter');
    const categoryFilter = categoryFilterSelect ? categoryFilterSelect.value : 'all';
    const searchInput = document.getElementById('history-search-input');
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    let income = 0, expense = 0;
    const recentEl = document.getElementById('dashboard-recent-list');
    const fullHistoryEl = document.getElementById('full-history-list');
    if (recentEl) recentEl.innerHTML = ''; 
    if (fullHistoryEl) fullHistoryEl.innerHTML = '';

    const categoryTotals = {};
    const monthlyDataMap = {};
    const monthNames = ['may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic', 'ene', 'feb', 'mar', 'abr'];

    transactions.forEach(tx => {
        const txDate = new Date(tx.date || Date.now());
        const monthKey = monthNames[txDate.getMonth() % 12];
        if (!monthlyDataMap[monthKey]) monthlyDataMap[monthKey] = { income: 0, expense: 0, net: 0 };

        const isDebt = (tx.category || '').toLowerCase().includes('deuda');

        if (tx.type === 'income') {
            income += tx.amount;
            monthlyDataMap[monthKey].income += tx.amount;
        } else {
            if (!isDebt) {
                expense += tx.amount;
                monthlyDataMap[monthKey].expense += tx.amount;
                categoryTotals[tx.category || 'General'] = (categoryTotals[tx.category || 'General'] || 0) + tx.amount;
            }
        }
    });

    if (categoryFilterSelect) {
        let selectHTML = `<option value="all">🔍 Todas las Categorías (Total Gastos: S/ ${expense.toFixed(2)})</option>`;
        categories.forEach(cat => {
            const totalCat = categoryTotals[cat.name] || 0;
            selectHTML += `<option value="${cat.name}">${cat.name} (S/ ${totalCat.toFixed(2)})</option>`;
        });
        categoryFilterSelect.innerHTML = selectHTML;
        categoryFilterSelect.value = categoryFilter;
    }

    const filteredTransactions = transactions.filter(tx => {
        const matchCategory = (categoryFilter === 'all') || ((tx.category || 'General') === categoryFilter);
        const matchSearch = searchQuery === '' || 
            (tx.description || '').toLowerCase().includes(searchQuery) || 
            (tx.category || '').toLowerCase().includes(searchQuery) ||
            (tx.amount || '').toString().includes(searchQuery);
        return matchCategory && matchSearch;
    });

    filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (document.getElementById('history-count')) {
        document.getElementById('history-count').textContent = `${filteredTransactions.length} registros`;
    }

    filteredTransactions.forEach((tx) => {
        let formattedDate = tx.date ? tx.date.split('T')[0] : '';
        const itemHTML = `
            <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div class="flex items-center space-x-3 overflow-hidden mr-2">
                    <div class="w-9 h-9 rounded-full ${tx.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'} flex items-center justify-center text-xs shrink-0">
                        <i class="fa-solid ${tx.type === 'income' ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                    </div>
                    <div class="min-w-0">
                        <span class="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block">${tx.description}</span>
                        <p class="text-[10px] text-slate-400 mt-0.5">${formattedDate} • ${tx.category || 'General'}</p>
                    </div>
                </div>
                <span class="font-extrabold text-xs ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-200'}">${tx.type === 'income' ? '+' : '-'} S/ ${tx.amount.toFixed(2)}</span>
            </div>
        `;
        if (recentEl) recentEl.innerHTML += itemHTML;
        if (fullHistoryEl) fullHistoryEl.innerHTML += itemHTML;
    });

    const balance = income - expense;
    if (isBalanceVisible) {
        if (document.getElementById('total-balance')) document.getElementById('total-balance').textContent = `S/ ${balance.toFixed(2)}`;
        if (document.getElementById('total-income')) document.getElementById('total-income').textContent = `S/ ${income.toFixed(2)}`;
        if (document.getElementById('total-expense')) document.getElementById('total-expense').textContent = `S/ ${expense.toFixed(2)}`;
    } else {
        if (document.getElementById('total-balance')) document.getElementById('total-balance').textContent = `S/ *****`;
        if (document.getElementById('total-income')) document.getElementById('total-income').textContent = `S/ *****`;
        if (document.getElementById('total-expense')) document.getElementById('total-expense').textContent = `S/ *****`;
    }
};

async function loadUserData() {
    try {
        const querySnapTx = await getDocs(collection(db, `users/${currentUser.uid}/transactions`));
        transactions = [];
        querySnapTx.forEach((doc) => transactions.push({ id: doc.id, ...doc.data() }));

        const querySnapGoals = await getDocs(collection(db, `users/${currentUser.uid}/savingsGoals`));
        savingsGoals = [];
        querySnapGoals.forEach((doc) => savingsGoals.push({ id: doc.id, ...doc.data() }));

        const querySnapSpares = await getDocs(collection(db, `users/${currentUser.uid}/motoSpares`));
        motoSpares = [];
        querySnapSpares.forEach((doc) => motoSpares.push({ id: doc.id, ...doc.data() }));

        const catDoc = await getDoc(doc(db, `users_config/${currentUser.uid}`));
        if (catDoc.exists()) {
            const data = catDoc.data();
            if (data.categories && data.categories.length > 0) {
                categories = data.categories.map(c => typeof c === 'string' ? { name: c, color: '#3B82F6', budget: 0 } : { budget: 0, ...c });
            }
            if (data.appName) {
                const brandEl = document.getElementById('app-brand-name');
                if (brandEl) brandEl.textContent = data.appName;
            }
        }
    } catch (e) { console.error("Error al cargar datos del usuario:", e); }

    window.renderCategories();
    window.renderGoalsUI();
    window.renderMotoUI();
    window.renderUI();
}

// Inicializar Autenticación y Eventos
window.applyDarkMode(isDarkMode);

const authSwitchBtn = document.getElementById('auth-switch');
if (authSwitchBtn) {
    authSwitchBtn.onclick = () => {
        isRegister = !isRegister;
        document.getElementById('name-field').classList.toggle('hidden', !isRegister);
        document.getElementById('auth-title').textContent = isRegister ? 'Crear Cuenta' : 'Iniciar Sesión';
        document.getElementById('auth-btn').textContent = isRegister ? 'Registrarse' : 'Iniciar Sesión';
        authSwitchBtn.textContent = isRegister ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate';
    };
}

const authForm = document.getElementById('auth-form');
if (authForm) {
    authForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value.trim();
        const nameField = document.getElementById('auth-name');
        const name = nameField ? nameField.value.trim() : '';
        const errDiv = document.getElementById('auth-error');
        if (errDiv) errDiv.classList.add('hidden');

        try {
            if (isRegister) {
                const res = await createUserWithEmailAndPassword(auth, email, password);
                if (name) await updateProfile(res.user, { displayName: name });
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            if (errDiv) {
                errDiv.textContent = "Error de autenticación. Revisa tu correo y contraseña.";
                errDiv.classList.remove('hidden');
            }
        }
    };
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        const nameEl = document.getElementById('user-display-name');
        if (nameEl) nameEl.textContent = user.displayName || user.email;
        await loadUserData();
    } else {
        currentUser = null;
        document.getElementById('app-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
    }
});
