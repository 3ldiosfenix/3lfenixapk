import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    sendPasswordResetEmail, signOut, onAuthStateChanged, updateProfile,
    EmailAuthProvider, reauthenticateWithCredential, updatePassword, deleteUser
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore, collection, getDocs, getDocsFromServer, doc,
    setDoc, getDoc, getDocFromServer, deleteDoc, updateDoc, enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// =====================================================================
// 1. FIREBASE, OFFLINE, TOASTS Y PWA
// =====================================================================
const firebaseConfig = {
    apiKey: "AIzaSyCuwUQojfewTYO-A2iaO75HHp234r-Z0Tg",
    authDomain: "misfinanzasapp-dc2d1.firebaseapp.com",
    projectId: "misfinanzasapp-dc2d1",
    storageBucket: "misfinanzasapp-dc2d1.firebasestorage.app",
    messagingSenderId: "735407911555",
    appId: "1:735407911555:web:2333eeb95dd41548ce21b6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

enableIndexedDbPersistence(db).catch((err) => {
    console.warn('Persistencia offline de Firestore:', err.code);
});

window.showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const styles = {
        success: 'bg-slate-900/95 text-emerald-300 border-emerald-500/40',
        warning: 'bg-slate-900/95 text-amber-300 border-amber-500/40',
        error: 'bg-slate-900/95 text-rose-300 border-rose-500/40',
        info: 'bg-slate-900/95 text-cyan-300 border-cyan-500/40'
    };
    const icons = {
        success: 'fa-circle-check text-emerald-400',
        warning: 'fa-triangle-exclamation text-amber-400',
        error: 'fa-circle-xmark text-rose-400',
        info: 'fa-circle-info text-cyan-400'
    };

    const toast = document.createElement('div');
    toast.className = `${styles[type] || styles.info} border px-3.5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md text-xs font-semibold flex items-center gap-2.5 transition-all duration-300 opacity-0 -translate-y-2`;
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info} text-sm shrink-0"></i><span class="leading-snug">${message}</span>`;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('opacity-0', '-translate-y-2'));
    setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 2600);
};

function updateOnlineStatus() {
    document.getElementById('offline-banner').classList.toggle('hidden', navigator.onLine);
}
window.addEventListener('online', () => { updateOnlineStatus(); showToast('Conexión restablecida', 'info'); });
window.addEventListener('offline', () => { updateOnlineStatus(); showToast('Modo sin conexión activo', 'warning'); });
updateOnlineStatus();

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

window.installPWA = async () => {
    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    if (isIOS) {
        showToast("En iPhone: toca Compartir (↗️) y luego 'Agregar a inicio'.", "info");
    } else if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
    } else {
        showToast("Abre el menú del navegador (⋮) y elige 'Instalar aplicación'.", "info");
    }
};

// =====================================================================
// 2. ESTADO GLOBAL Y UTILIDADES DE FECHA / IMAGEN
// =====================================================================
const ADMIN_EMAILS = ["jesus1609@gmail.com"];
const DEFAULT_CATEGORIES = [
    { name: 'Alimentación', color: '#EF4444', budget: 300 },
    { name: 'Transporte', color: '#3B82F6', budget: 200 },
    { name: 'Servicios', color: '#F59E0B', budget: 150 },
    { name: 'Ingresos', color: '#10B981', budget: 0 },
    { name: 'Deudas', color: '#8B5CF6', budget: 0 },
    { name: 'Otros', color: '#64748B', budget: 100 }
];
const BALANCE_VIEWS = [
    { value: "week", label: "BALANCE DE ESTA SEMANA", short: "Sem. Actual" },
    { value: "week-prev-1", label: "BALANCE SEMANA ANTERIOR", short: "Sem. -1" },
    { value: "week-prev-2", label: "BALANCE HACE 2 SEMANAS", short: "Sem. -2" },
    { value: "month", label: "BALANCE DE ESTE MES", short: "Mes Actual" },
    { value: "month-prev-1", label: "BALANCE MES ANTERIOR", short: "Mes -1" },
    { value: "month-2026-10", label: "BALANCE DE OCTUBRE 2026", short: "Oct 2026" },
    { value: "month-2026-09", label: "BALANCE DE SEPTIEMBRE 2026", short: "Sep 2026" },
    { value: "all", label: "BALANCE TOTAL", short: "Todo" }
];
const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

let isAdmin = false;
let registeredUsers = [];
let deletedAccounts = [];
let globalAnnouncement = "";

let currentUser = null;
let currentType = 'expense';
let categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
let transactions = [];
let savingsGoals = [];
let motoSpares = [];
let motoServices = [];
let tasksList = [];
let deliveryShifts = [];
let deliveryGroupMode = 'daily';
let deliveryPlatforms = ['PedidosYa', 'inDrive'];

let soatPhotoBase64 = null;
let tarjetaPdfBase64 = null;
let vehiculoPhotoBase64 = null;
let motoMainPhotoBase64 = null;
let currentPhotoBase64 = null;

let isBalanceVisible = false;
let isRegister = false;
let showAllDebts = false;
let currentBalanceViewIndex = 0;
let isBalanceAnimating = false;

let currentMotoKmAceite = null;
let currentMotoKmAfinamiento = null;
let currentMotoOdometer = null;

let chartInstance = null;
let barChartInstance = null;
let dailyChartInstance = null;

function parseLocalDateParts(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length !== 3) return null;
    return {
        year: parseInt(parts[0], 10),
        month: parseInt(parts[1], 10) - 1,
        day: parseInt(parts[2], 10)
    };
}

function getStartOfCurrentWeek(referenceDate = new Date()) {
    const now = new Date(referenceDate);
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(now.getFullYear(), now.getMonth(), diff);
    start.setHours(0, 0, 0, 0);
    return start;
}

function getLocalDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getLocalDateTimeISO() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formatNowDateTime(dateISO = null) {
    if (dateISO && dateISO.includes("T")) {
        const [fecha, hora] = dateISO.split("T");
        const [anio, mes, dia] = fecha.split("-");
        return `${dia}/${mes}/${anio} ${hora.slice(0, 5)}`;
    }
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getPeriodDateRangeText(filterValue, referenceDate = new Date()) {
    const now = new Date(referenceDate);
    const startOfCurrentWeek = getStartOfCurrentWeek(now);

    if (filterValue === 'week' || filterValue === 'week-prev-1' || filterValue === 'week-prev-2') {
        const weeksBack = filterValue === 'week' ? 0 : (filterValue === 'week-prev-1' ? 1 : 2);
        const startWeek = new Date(startOfCurrentWeek);
        startWeek.setDate(startOfCurrentWeek.getDate() - 7 * weeksBack);
        const endWeek = new Date(startWeek);
        endWeek.setDate(startWeek.getDate() + 6);

        const startLabel = `${startWeek.getDate()} ${MONTHS_SHORT[startWeek.getMonth()]}`;
        const endLabel = `${endWeek.getDate()} ${MONTHS_SHORT[endWeek.getMonth()]}`;
        return startWeek.getFullYear() === endWeek.getFullYear()
            ? `${startLabel} – ${endLabel} ${endWeek.getFullYear()}`
            : `${startLabel} ${startWeek.getFullYear()} – ${endLabel} ${endWeek.getFullYear()}`;
    }

    if (filterValue === 'month') return `${MONTHS_FULL[now.getMonth()]} ${now.getFullYear()}`;
    if (filterValue === 'month-prev-1') {
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return `${MONTHS_FULL[prev.getMonth()]} ${prev.getFullYear()}`;
    }
    if (filterValue.startsWith('month-')) {
        const [, yStr, mStr] = filterValue.split('-');
        return `${MONTHS_FULL[parseInt(mStr, 10) - 1]} ${yStr}`;
    }
    return "Todo el registro guardado";
}

function matchesTimeFilter(txDateStr, filterValue, currentDate = new Date()) {
    const parsed = parseLocalDateParts(txDateStr);
    if (!parsed) return false;

    const txDate = new Date(parsed.year, parsed.month, parsed.day);
    const now = new Date(currentDate);
    const startOfCurrentWeek = getStartOfCurrentWeek(now);

    if (filterValue === 'week') {
        const endOfWeek = new Date(startOfCurrentWeek);
        endOfWeek.setDate(startOfCurrentWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return txDate >= startOfCurrentWeek && txDate <= endOfWeek;
    }
    if (filterValue === 'week-prev-1' || filterValue === 'week-prev-2') {
        const weeksBack = filterValue === 'week-prev-1' ? 1 : 2;
        const startPrev = new Date(startOfCurrentWeek);
        startPrev.setDate(startOfCurrentWeek.getDate() - 7 * weeksBack);
        const endPrev = new Date(startPrev);
        endPrev.setDate(startPrev.getDate() + 6);
        endPrev.setHours(23, 59, 59, 999);
        return txDate >= startPrev && txDate <= endPrev;
    }
    if (filterValue === 'month') return parsed.year === now.getFullYear() && parsed.month === now.getMonth();
    if (filterValue === 'month-prev-1') {
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return parsed.year === prev.getFullYear() && parsed.month === prev.getMonth();
    }
    if (filterValue.startsWith('month-')) {
        const [, y, m] = filterValue.split('-');
        return parsed.year === parseInt(y, 10) && parsed.month === parseInt(m, 10) - 1;
    }
    return true;
}

function getWeekIdentifier(dateStr) {
    const parsed = parseLocalDateParts(dateStr);
    if (!parsed) return dateStr || 'Desconocido';
    const d = new Date(parsed.year, parsed.month, parsed.day);
    const firstDayOfYear = new Date(parsed.year, 0, 1);
    const pastDays = (d - firstDayOfYear) / 86400000;
    const weekNum = Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);
    return `Semana ${weekNum} (${parsed.year})`;
}

function getMonthIdentifier(dateStr) {
    const parsed = parseLocalDateParts(dateStr);
    if (!parsed) return dateStr || 'Desconocido';
    return `${MONTHS_FULL[parsed.month]} ${parsed.year}`;
}

function getContrastTextColor(hexColor) {
    if (!hexColor) return '#FFFFFF';
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return (((r * 299) + (g * 587) + (b * 114)) / 1000 >= 150) ? '#1E293B' : '#FFFFFF';
}

function compressImageFileToDataURL(file, maxSize = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                let { width, height } = img;
                if (width > height) {
                    if (width > maxSize) { height *= maxSize / width; width = maxSize; }
                } else if (height > maxSize) {
                    width *= maxSize / height; height = maxSize;
                }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

document.getElementById('tx-date').value = getLocalDateString();
document.getElementById('spare-date').value = getLocalDateString();
document.getElementById('del-date').value = getLocalDateString();
document.getElementById('service-date').value = getLocalDateString();

// =====================================================================
// 3. TEMA, MENÚ, NAVEGACIÓN Y CARRUSEL DE BALANCE
// =====================================================================
let isDarkMode = localStorage.getItem('app_dark_mode') !== 'false';
applyDarkMode(isDarkMode);

function applyDarkMode(dark) {
    document.getElementById('html-root').classList.toggle('dark', dark);
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) icon.className = dark ? "fa-solid fa-sun text-amber-400" : "fa-solid fa-moon text-slate-300";
}

window.toggleDarkMode = () => {
    isDarkMode = !isDarkMode;
    localStorage.setItem('app_dark_mode', isDarkMode);
    applyDarkMode(isDarkMode);
    renderUI();
};

window.toggleMenuDropdown = () => {
    document.getElementById('header-dropdown-menu').classList.toggle('hidden');
    document.getElementById('menu-chevron').classList.toggle('rotate-180');
};

window.toggleBalanceVisibility = () => {
    isBalanceVisible = !isBalanceVisible;
    document.getElementById('toggle-eye-icon').className = isBalanceVisible ? "fa-solid fa-eye" : "fa-solid fa-eye-slash";
    renderUI();
};

window.switchTab = (tab) => {
    ['dashboard', 'add', 'history', 'gallery', 'moto', 'tasks', 'delivery'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.add('hidden');
    });
    document.getElementById('nav-btn-dashboard').className = "flex flex-col items-center text-slate-400 text-[11px] font-semibold";
    document.getElementById('nav-btn-history').className = "flex flex-col items-center text-slate-400 text-[11px] font-semibold";

    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    if (tab === 'dashboard') {
        document.getElementById('nav-btn-dashboard').className = "flex flex-col items-center text-emerald-600 dark:text-emerald-400 text-[11px] font-bold";
        renderDashboardNotesWidget();
    } else if (tab === 'history') {
        document.getElementById('nav-btn-history').className = "flex flex-col items-center text-emerald-600 dark:text-emerald-400 text-[11px] font-bold";
    } else if (tab === 'gallery') renderGallery();
    else if (tab === 'moto') renderMotoUI();
    else if (tab === 'tasks') renderTasksUI();
    else if (tab === 'delivery') renderDeliveryUI();
};

function refreshTimeFilterLabels(referenceDate = new Date()) {
    const selectEl = document.getElementById('time-filter');
    if (!selectEl) return;
    const labels = {
        'week': 'Esta Semana',
        'week-prev-1': 'Semana Anterior',
        'week-prev-2': 'Hace 2 Semanas',
        'month': 'Este Mes',
        'month-prev-1': 'Mes Anterior',
        'month-2026-10': '📅 Octubre 2026',
        'month-2026-09': '📅 Septiembre 2026',
        'all': 'Todo el Historial'
    };
    [...selectEl.options].forEach(opt => {
        const base = labels[opt.value] || opt.textContent;
        opt.textContent = opt.value.startsWith('week') ? `${base} (${getPeriodDateRangeText(opt.value, referenceDate)})` : base;
    });
}

function renderBalanceDots() {
    const dotsEl = document.getElementById("balance-period-dots");
    if (!dotsEl) return;
    dotsEl.innerHTML = BALANCE_VIEWS.map((view, idx) => `
        <button type="button" onclick="selectBalancePeriodIndex(${idx})" title="${view.short}"
            class="h-1.5 rounded-full transition-all duration-200 ${idx === currentBalanceViewIndex ? "w-5 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"}"></button>
    `).join("");
}

function syncBalanceViewWithSelect() {
    const selectEl = document.getElementById("time-filter");
    if (!selectEl) return;
    const idx = BALANCE_VIEWS.findIndex(v => v.value === selectEl.value);
    if (idx !== -1) currentBalanceViewIndex = idx;
    renderBalanceDots();
}

function applyBalancePeriodChange(index, direction = 0) {
    const total = BALANCE_VIEWS.length;
    currentBalanceViewIndex = ((index % total) + total) % total;
    const view = BALANCE_VIEWS[currentBalanceViewIndex];
    const selectEl = document.getElementById("time-filter");
    if (selectEl) selectEl.value = view.value;
    renderBalanceDots();
    renderUI();

    const card = document.getElementById("balance-card");
    if (card && direction !== 0) {
        isBalanceAnimating = true;
        card.style.transition = "none";
        card.style.opacity = "0.65";
        card.style.transform = `translateX(${direction > 0 ? 44 : -44}px) rotate(${direction > 0 ? 1.1 : -1.1}deg)`;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            card.style.transition = "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease";
            card.style.opacity = "1";
            card.style.transform = "translateX(0px) rotate(0deg)";
            setTimeout(() => { isBalanceAnimating = false; }, 260);
        }));
    }
}

window.selectBalancePeriodIndex = (index) => applyBalancePeriodChange(index, index === currentBalanceViewIndex ? 0 : (index > currentBalanceViewIndex ? 1 : -1));
window.stepBalancePeriod = (direction) => applyBalancePeriodChange(currentBalanceViewIndex + direction, direction);

function setupSwipeBalanceCard() {
    const card = document.getElementById("balance-card");
    if (!card) return;
    let startX = 0, deltaX = 0, isDragging = false;

    const onStart = (x) => { if (!isBalanceAnimating) { startX = x; deltaX = 0; isDragging = true; card.style.transition = "none"; } };
    const onMove = (x) => {
        if (!isDragging) return;
        deltaX = x - startX;
        const offset = Math.max(-105, Math.min(105, deltaX * 0.52));
        card.style.transform = `translateX(${offset}px) rotate(${(offset / 105) * 1.6}deg)`;
    };
    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        if (Math.abs(deltaX) > 36) {
            const dir = deltaX < 0 ? 1 : -1;
            isBalanceAnimating = true;
            card.style.transition = "transform 0.14s ease-in, opacity 0.14s ease-in";
            card.style.opacity = "0.4";
            card.style.transform = `translateX(${dir > 0 ? -78 : 78}px) rotate(${dir > 0 ? -1.4 : 1.4}deg)`;
            setTimeout(() => applyBalancePeriodChange(currentBalanceViewIndex + dir, dir), 135);
        } else {
            card.style.transition = "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease";
            card.style.opacity = "1";
            card.style.transform = "translateX(0px) rotate(0deg)";
        }
        deltaX = 0;
    };

    card.addEventListener("touchstart", (e) => { if (e.touches.length === 1) onStart(e.touches[0].clientX); }, { passive: true });
    card.addEventListener("touchmove", (e) => { if (e.touches.length === 1) onMove(e.touches[0].clientX); }, { passive: true });
    card.addEventListener("touchend", onEnd);
    card.addEventListener("mousedown", (e) => { if (e.button === 0 && !e.target.closest("button")) onStart(e.clientX); });
    window.addEventListener("mousemove", (e) => onMove(e.clientX));
    window.addEventListener("mouseup", onEnd);
}

setupSwipeBalanceCard();
renderBalanceDots();
refreshTimeFilterLabels(new Date());

// =====================================================================
// 4. AUTENTICACIÓN, ADMIN Y ELIMINACIÓN DE CUENTA
// =====================================================================
function isProtectedAdminEmail(email) {
    return ADMIN_EMAILS.map(e => e.toLowerCase()).includes((email || "").trim().toLowerCase());
}

function resetSessionStateToDefaults() {
    categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
    transactions = [];
    savingsGoals = [];
    motoSpares = [];
    motoServices = [];
    tasksList = [];
    deliveryShifts = [];
    deliveryGroupMode = 'daily';
    deliveryPlatforms = ['PedidosYa', 'inDrive'];
    soatPhotoBase64 = null;
    tarjetaPdfBase64 = null;
    vehiculoPhotoBase64 = null;
    motoMainPhotoBase64 = null;
    currentPhotoBase64 = null;
    currentMotoKmAceite = null;
    currentMotoKmAfinamiento = null;
    currentMotoOdometer = null;
    isAdmin = false;
    registeredUsers = [];
    deletedAccounts = [];

    document.getElementById('app-brand-name').textContent = "Mis Finanzas";
    document.getElementById('setting-app-name').value = "Mis Finanzas";
    document.getElementById('moto-soat-date').value = "";
    document.getElementById('moto-km-aceite-input').value = "";
    document.getElementById('moto-km-afinamiento-input').value = "";
    document.getElementById('moto-current-odometer-input').value = "";
    document.getElementById('moto-proximos-mantenimientos').classList.add('hidden');
    document.getElementById('admin-menu-btn').classList.add('hidden');

    updateMotoMainPhotoUI();
    updateMotoDocsUI();
    updateMotoKmUI();
    renderMotoServicesUI();
    renderDashboardNotesWidget();
}

window.togglePasswordVisibility = (inputId, iconId) => {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    icon.className = show ? "fa-solid fa-eye text-emerald-400" : "fa-solid fa-eye-slash";
};

window.handleForgotPassword = async () => {
    const email = document.getElementById('auth-email').value.trim();
    const errDiv = document.getElementById('auth-error');
    const successDiv = document.getElementById('auth-success');
    errDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    if (!email) { errDiv.textContent = "Escribe tu correo primero."; errDiv.classList.remove('hidden'); return; }
    try {
        await sendPasswordResetEmail(auth, email);
        successDiv.textContent = "¡Correo de recuperación enviado!";
        successDiv.classList.remove('hidden');
    } catch (err) {
        errDiv.textContent = "No se pudo enviar el correo.";
        errDiv.classList.remove('hidden');
    }
};

window.handleChangePassword = async (e) => {
    e.preventDefault();
    const currentPass = document.getElementById('current-password').value;
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-password').value;
    if (newPass !== confirmPass) { showToast("Las nuevas contraseñas no coinciden.", "warning"); return; }
    if (newPass.length < 6) { showToast("La nueva contraseña debe tener al menos 6 caracteres.", "warning"); return; }
    const user = auth.currentUser;
    if (!user || !user.email) { showToast("No hay una sesión activa válida.", "error"); return; }

    try {
        const credential = EmailAuthProvider.credential(user.email, currentPass);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPass);
        showToast("Contraseña actualizada con éxito.", "success");
        document.getElementById('change-password-form').reset();
    } catch (err) {
        showToast((err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') ? "La contraseña actual es incorrecta." : "Error al actualizar la contraseña.", "error");
    }
};

window.logout = async () => {
    toggleMenuDropdown();
    localStorage.removeItem('offline_cached_user');
    resetSessionStateToDefaults();
    await signOut(auth);
    showToast("Sesión cerrada.", "info");
};

window.toggleAuthMode = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    isRegister = !isRegister;
    document.getElementById('name-field').classList.toggle('hidden', !isRegister);
    document.getElementById('auth-title').textContent = isRegister ? 'Crear Cuenta' : 'Iniciar Sesión';
    document.getElementById('auth-btn').textContent = isRegister ? 'Registrarse' : 'Iniciar Sesión';
    document.getElementById('auth-switch').textContent = isRegister ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate';
};

window.handleAuthSubmit = async (e) => {
    if (e) e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const name = document.getElementById('auth-name').value.trim();
    const errDiv = document.getElementById('auth-error');
    const submitBtn = document.getElementById('auth-btn');
    errDiv.classList.add('hidden');

    if (!email || !password) { errDiv.textContent = "Completa todos los campos."; errDiv.classList.remove('hidden'); return; }
    submitBtn.disabled = true;
    submitBtn.textContent = isRegister ? "Registrando..." : "Ingresando...";

    try {
        if (isRegister) {
            const res = await createUserWithEmailAndPassword(auth, email, password);
            if (name) await updateProfile(res.user, { displayName: name });
            localStorage.setItem('offline_cached_user', JSON.stringify({ uid: res.user.uid, email: res.user.email, displayName: res.user.displayName || email }));
        } else {
            const res = await signInWithEmailAndPassword(auth, email, password);
            localStorage.setItem('offline_cached_user', JSON.stringify({ uid: res.user.uid, email: res.user.email, displayName: res.user.displayName || email }));
        }
    } catch (err) {
        if (!navigator.onLine && err.code === 'auth/network-request-failed') {
            const cached = JSON.parse(localStorage.getItem('offline_cached_user') || 'null');
            if (cached && cached.email.toLowerCase() === email.toLowerCase()) {
                await enterAuthenticatedSession(cached);
                return;
            }
        }
        errDiv.textContent = "Error al conectar: " + (err.message || "Verifica tus datos o tu conexión.");
        errDiv.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isRegister ? 'Registrarse' : 'Iniciar Sesión';
    }
};

async function enterAuthenticatedSession(userObj) {
    currentUser = userObj;
    resetSessionStateToDefaults();
    localStorage.setItem('offline_cached_user', JSON.stringify({ uid: userObj.uid, email: userObj.email, displayName: userObj.displayName || userObj.email }));
    const allowed = await syncUserProfileAndRole(userObj);
    if (!allowed) return;
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('user-display-name').textContent = userObj.displayName || userObj.email;
    await loadUserData();
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const prev = JSON.parse(localStorage.getItem('offline_cached_user') || 'null');
        if (!prev || prev.uid !== user.uid) localStorage.removeItem('offline_cached_user');
        await enterAuthenticatedSession(user);
    } else {
        const cached = JSON.parse(localStorage.getItem('offline_cached_user') || 'null');
        if (!navigator.onLine && cached) {
            await enterAuthenticatedSession(cached);
            return;
        }
        currentUser = null;
        resetSessionStateToDefaults();
        document.getElementById('app-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
    }
});

async function deleteAllUserFirestoreData(uid, userEmail) {
    if (isProtectedAdminEmail(userEmail)) throw new Error("Cuenta de administrador protegida.");
    const subcollections = ['transactions', 'deliveryShifts', 'savingsGoals', 'motoSpares', 'motoServices', 'tasks'];
    for (const sub of subcollections) {
        try {
            const snap = await getDocs(collection(db, `users/${uid}/${sub}`));
            await Promise.all(snap.docs.map(d => deleteDoc(doc(db, `users/${uid}/${sub}/${d.id}`))));
        } catch (e) {}
    }
    for (const path of [`users_config/${uid}`, `users_registry/${uid}`, `users/${uid}`]) {
        try { await deleteDoc(doc(db, path)); } catch (e) {}
    }
}

window.handleDeleteAccount = async () => {
    if (!navigator.onLine) { showToast("Necesitas conexión a internet para eliminar tu cuenta.", "warning"); return; }
    const user = auth.currentUser;
    if (!user) { showToast("No hay una sesión activa.", "error"); return; }
    if (isProtectedAdminEmail(user.email)) { showToast("Tu cuenta de administrador está protegida.", "info"); return; }

    const word = prompt(`⚠️ Esta acción eliminará permanentemente tu cuenta (${user.email}) y todos tus datos.\n\nEscribe ELIMINAR para confirmar:`);
    if (word !== "ELIMINAR") {
        if (word !== null) showToast("Eliminación cancelada. Escribe ELIMINAR exactamente.", "warning");
        return;
    }

    const btn = document.getElementById("delete-account-btn");
    if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Eliminando cuenta...</span>`; }

    try {
        await setDoc(doc(db, `account_deletions/${user.uid}`), {
            uid: user.uid, email: user.email || "", displayName: user.displayName || user.email || "Usuario",
            deletedAt: Date.now(), deletedDateLabel: new Date().toLocaleString("es-PE")
        }).catch(() => {});
        await deleteAllUserFirestoreData(user.uid, user.email);
        await deleteUser(user);
        localStorage.removeItem("offline_cached_user");
        resetSessionStateToDefaults();
        document.getElementById("settings-modal").classList.add("hidden");
        showToast("Cuenta eliminada correctamente.", "success");
    } catch (err) {
        if (err.code === "auth/requires-recent-login" && user.email) {
            const pass = prompt("Por seguridad, ingresa tu contraseña actual para confirmar la eliminación de tu cuenta:");
            if (pass) {
                try {
                    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pass));
                    await deleteAllUserFirestoreData(user.uid, user.email);
                    await deleteUser(user);
                    localStorage.removeItem("offline_cached_user");
                    resetSessionStateToDefaults();
                    document.getElementById("settings-modal").classList.add("hidden");
                    showToast("Cuenta eliminada correctamente.", "success");
                    return;
                } catch (e) { showToast("No se pudo verificar tu contraseña.", "error"); }
            }
        } else {
            showToast("No se pudo completar la eliminación: " + (err.message || "Inténtalo de nuevo."), "error");
        }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-user-xmark"></i> <span>Eliminar mi cuenta</span>`; }
    }
};

async function syncUserProfileAndRole(user) {
    const isWhitelisted = isProtectedAdminEmail(user.email);
    try {
        const ref = doc(db, `users_registry/${user.uid}`);
        const snap = await getDoc(ref);
        const base = { uid: user.uid, email: user.email || "", displayName: user.displayName || user.email || "Usuario", lastLogin: Date.now() };
        if (!snap.exists()) await setDoc(ref, { ...base, createdAt: Date.now(), status: "active" });
        else await setDoc(ref, base, { merge: true });

        const updated = (await getDoc(ref)).data();
        if (updated?.status === "suspended" && !isWhitelisted) {
            showToast("Tu cuenta ha sido suspendida por el administrador.", "error");
            await signOut(auth);
            return false;
        }
        let roleAdmin = false;
        try {
            const rSnap = await getDoc(doc(db, `roles/${user.uid}`));
            roleAdmin = rSnap.exists() && rSnap.data()?.role === "admin";
        } catch (e) {}
        isAdmin = isWhitelisted || roleAdmin;
    } catch (e) {
        isAdmin = isWhitelisted;
    }
    document.getElementById("admin-menu-btn").classList.toggle("hidden", !isAdmin);
    document.getElementById("delete-account-section").classList.toggle("hidden", isProtectedAdminEmail(user.email));
    return true;
}

window.openAdminModal = async () => {
    if (!isAdmin) return;
    document.getElementById("admin-panel-modal").classList.remove("hidden");
    await loadAdminPanelData();
};
window.closeAdminModal = () => document.getElementById("admin-panel-modal").classList.add("hidden");

async function loadAdminPanelData() {
    if (!isAdmin) return;
    try {
        const uSnap = navigator.onLine ? await getDocsFromServer(collection(db, "users_registry")) : await getDocs(collection(db, "users_registry"));
        registeredUsers = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        try {
            const dSnap = navigator.onLine ? await getDocsFromServer(collection(db, "account_deletions")) : await getDocs(collection(db, "account_deletions"));
            deletedAccounts = dSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {}

        try {
            const aSnap = navigator.onLine ? await getDocFromServer(doc(db, "app_config/global")) : await getDoc(doc(db, "app_config/global"));
            globalAnnouncement = aSnap.exists() ? (aSnap.data().announcement || "") : "";
        } catch (e) {}

        renderAdminUI();
    } catch (err) {
        document.getElementById("admin-users-list").innerHTML = `<div class="bg-rose-500/15 border border-rose-500/40 text-rose-300 p-3 rounded-2xl text-xs"><p class="font-bold">No se pudo leer usuarios</p><p class="text-[11px]">${err.message || ""}</p></div>`;
    }
}

function renderAdminUI() {
    document.getElementById("admin-total-users").textContent = registeredUsers.length;
    document.getElementById("admin-active-users").textContent = registeredUsers.filter(u => u.status !== "suspended").length;
    document.getElementById("admin-suspended-users").textContent = registeredUsers.filter(u => u.status === "suspended").length;
    document.getElementById("admin-announcement-input").value = globalAnnouncement;

    const listEl = document.getElementById("admin-users-list");
    listEl.innerHTML = registeredUsers.length === 0
        ? `<p class="text-xs text-slate-400 text-center py-3">Aún no hay usuarios en el directorio.</p>`
        : [...registeredUsers].sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0)).map(u => {
            const suspended = u.status === "suspended";
            const badge = suspended
                ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400">Suspendido</span>`
                : `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">Activo</span>`;
            const removeBtn = isProtectedAdminEmail(u.email) ? "" : `<button onclick="removeRegistryUser('${u.uid}', '${(u.email || "").replace(/'/g, "\\'")}')" class="bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 px-2 py-1 rounded-xl text-[10px] font-bold transition"><i class="fa-solid fa-trash-can"></i></button>`;
            return `<div class="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex justify-between items-center gap-2 text-xs">
                <div class="min-w-0"><p class="font-bold text-white truncate">${u.displayName || "Usuario"}</p><p class="text-[10px] text-slate-400 truncate">${u.email || ""}</p></div>
                <div class="flex items-center gap-1.5 shrink-0">${badge}${removeBtn}<button onclick="toggleUserStatus('${u.uid}', '${suspended ? "active" : "suspended"}')" class="px-2.5 py-1 rounded-xl text-[10px] font-bold ${suspended ? "bg-emerald-600 text-white" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"}">${suspended ? "Activar" : "Suspender"}</button></div>
            </div>`;
        }).join("");

    const delCount = document.getElementById("admin-deleted-count");
    const delList = document.getElementById("admin-deleted-users-list");
    delCount.textContent = deletedAccounts.length;
    delList.innerHTML = deletedAccounts.length === 0
        ? `<p class="text-[11px] text-slate-500 text-center py-2">No hay cuentas eliminadas registradas.</p>`
        : [...deletedAccounts].sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)).map(item => `
            <div class="bg-slate-950 border border-rose-500/20 p-2.5 rounded-xl flex justify-between items-center gap-2 text-xs">
                <div class="min-w-0"><p class="font-bold text-slate-200 truncate">${item.displayName || "Usuario"}</p><p class="text-[10px] text-slate-400 truncate">${item.email || ""}</p><p class="text-[9px] text-rose-400/90 mt-0.5">Eliminada: ${item.deletedDateLabel || ""}</p></div>
                <button onclick="deleteSingleDeletionLog('${item.id}')" class="text-slate-500 hover:text-rose-400 text-xs px-1.5 shrink-0"><i class="fa-solid fa-xmark"></i></button>
            </div>`).join("");
}

window.removeRegistryUser = async (uid, email) => {
    if (!isAdmin || isProtectedAdminEmail(email)) return;
    if (!confirm(`¿Quitar a "${email || uid}" de la lista de usuarios registrados?`)) return;
    await deleteDoc(doc(db, `users_registry/${uid}`));
    await loadAdminPanelData();
    showToast("Registro eliminado del panel.", "success");
};
window.deleteSingleDeletionLog = async (id) => {
    if (!isAdmin) return;
    await deleteDoc(doc(db, `account_deletions/${id}`));
    deletedAccounts = deletedAccounts.filter(d => d.id !== id);
    renderAdminUI();
};
window.clearDeletedAccountsLog = async () => {
    if (!isAdmin || deletedAccounts.length === 0 || !confirm("¿Borrar todo el historial de cuentas eliminadas?")) return;
    for (const item of deletedAccounts) await deleteDoc(doc(db, `account_deletions/${item.id}`));
    deletedAccounts = [];
    renderAdminUI();
};
window.toggleUserStatus = async (uid, status) => {
    if (!isAdmin) return;
    await updateDoc(doc(db, `users_registry/${uid}`), { status });
    await loadAdminPanelData();
    showToast(`Estado actualizado a ${status === 'active' ? 'Activo' : 'Suspendido'}.`, "success");
};
window.saveGlobalAnnouncement = async () => {
    if (!isAdmin) return;
    const val = document.getElementById("admin-announcement-input").value.trim();
    await setDoc(doc(db, "app_config/global"), { announcement: val, updatedAt: Date.now() }, { merge: true });
    globalAnnouncement = val;
    await loadGlobalAnnouncementForUser();
    showToast("Aviso global actualizado.", "success");
};
async function loadGlobalAnnouncementForUser() {
    try {
        const snap = navigator.onLine ? await getDocFromServer(doc(db, "app_config/global")) : await getDoc(doc(db, "app_config/global"));
        const msg = snap.exists() ? (snap.data().announcement || "").trim() : "";
        globalAnnouncement = msg;
        document.getElementById("global-announcement-text").textContent = msg;
        document.getElementById("global-announcement-banner").classList.toggle("hidden", msg.length === 0);
    } catch (e) {}
}

// =====================================================================
// 5. CARGA DE DATOS Y RENDER PRINCIPAL
// =====================================================================
async function loadUserData() {
    await loadGlobalAnnouncementForUser();
    try {
        const [txSnap, delSnap, goalSnap, spareSnap, srvSnap, taskSnap, cfgDoc] = await Promise.all([
            getDocs(collection(db, `users/${currentUser.uid}/transactions`)),
            getDocs(collection(db, `users/${currentUser.uid}/deliveryShifts`)),
            getDocs(collection(db, `users/${currentUser.uid}/savingsGoals`)),
            getDocs(collection(db, `users/${currentUser.uid}/motoSpares`)),
            getDocs(collection(db, `users/${currentUser.uid}/motoServices`)),
            getDocs(collection(db, `users/${currentUser.uid}/tasks`)),
            getDoc(doc(db, `users_config/${currentUser.uid}`))
        ]);

        transactions = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        deliveryShifts = delSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        savingsGoals = goalSnap.docs.map(d => {
            const g = { id: d.id, ...d.data() };
            g.contributions = normalizeGoalContributions(g);
            g.current = getGoalCurrentTotal(g);
            return g;
        });
        motoSpares = spareSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        motoServices = srvSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        tasksList = taskSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (cfgDoc.exists()) {
            const data = cfgDoc.data();
            categories = (data.categories && data.categories.length > 0)
                ? data.categories.map(c => typeof c === 'string' ? { name: c, color: '#3B82F6', budget: 0 } : { budget: 0, ...c })
                : DEFAULT_CATEGORIES.map(c => ({ ...c }));
            const appName = data.appName || "Mis Finanzas";
            document.getElementById('app-brand-name').textContent = appName;
            document.getElementById('setting-app-name').value = appName;

            const docs = data.motoDocs || {};
            document.getElementById('moto-soat-date').value = docs.soatDate || "";
            currentMotoKmAceite = docs.kmAceite ?? null;
            currentMotoKmAfinamiento = docs.kmAfinamiento ?? null;
            currentMotoOdometer = docs.odometer ?? null;
            soatPhotoBase64 = docs.soatPhoto || null;
            tarjetaPdfBase64 = docs.tarjetaPdf || null;
            vehiculoPhotoBase64 = docs.vehiculoPhoto || null;
            motoMainPhotoBase64 = docs.motoMainPhoto || null;
            checkMotoDocAlerts(docs.soatDate || "");
        } else {
            checkMotoDocAlerts("");
        }

        updateMotoDocsUI();
        updateMotoMainPhotoUI();
        updateMotoKmUI();
    } catch (e) {
        console.warn("Cargando desde caché local offline...", e);
    }

    renderCategories();
    renderGoalsUI();
    renderMotoUI();
    renderTasksUI();
    renderUI();
}

window.renderUI = () => {
    syncBalanceViewWithSelect();
    renderDashboardNotesWidget();

    const timeFilter = document.getElementById('time-filter').value;
    const categorySelect = document.getElementById('category-filter');
    const categoryFilter = categorySelect.value;
    const searchQuery = document.getElementById('history-search-input').value.toLowerCase().trim();
    document.getElementById('clear-search-btn').classList.toggle('hidden', searchQuery === '');

    const now = new Date();
    refreshTimeFilterLabels(now);

    const matchedView = BALANCE_VIEWS.find(v => v.value === timeFilter);
    if (matchedView) {
        document.getElementById('balance-label').textContent = matchedView.label;
    } else if (timeFilter.startsWith('month-')) {
        const [, y, m] = timeFilter.split('-');
        document.getElementById('balance-label').textContent = `BALANCE DE ${MONTHS_FULL[parseInt(m, 10) - 1].toUpperCase()} ${y}`;
    } else {
        document.getElementById('balance-label').textContent = "BALANCE TOTAL";
    }

    const rangeText = getPeriodDateRangeText(timeFilter, now);
    document.getElementById('balance-date-range').textContent = rangeText;
    document.getElementById('delivery-widget-date-range').textContent = rangeText;

    categorySelect.innerHTML = `<option value="all">🔍 Todas las Categorías</option>` + categories.map(c =>
        `<option value="${c.name}" ${categoryFilter === c.name ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    const timeFilteredTxs = transactions.filter(t => matchesTimeFilter(t.date, timeFilter, now));

    let balanceIncome = 0, balanceExpense = 0;
    timeFilteredTxs.forEach(t => {
        if (t.type === 'income') balanceIncome += t.amount;
        else if (!t.category.toLowerCase().includes('deuda')) balanceExpense += t.amount;
    });

    const balance = balanceIncome - balanceExpense;
    const card = document.getElementById('balance-card');
    card.classList.toggle('bg-emerald-600', balance >= 0);
    card.classList.toggle('bg-rose-600', balance < 0);

    document.getElementById('total-balance').textContent = isBalanceVisible ? `S/ ${balance.toFixed(2)}` : `S/ *****`;
    document.getElementById('total-income').textContent = isBalanceVisible ? `S/ ${balanceIncome.toFixed(2)}` : `S/ *****`;
    document.getElementById('total-expense').textContent = isBalanceVisible ? `S/ ${balanceExpense.toFixed(2)}` : `S/ *****`;

    const shiftsPeriod = deliveryShifts.filter(s => matchesTimeFilter(s.date, timeFilter, now));
    const totalDelivery = shiftsPeriod.reduce((acc, s) => acc + (s.total || 0), 0);
    const totalKm = shiftsPeriod.reduce((acc, s) => acc + (parseFloat(s.km) || 0), 0);
    const totalFuel = timeFilteredTxs.filter(t => t.type === 'expense' && /combustible|gasolina|grifo/.test(`${t.category} ${t.description}`.toLowerCase())).reduce((acc, t) => acc + t.amount, 0);
    const netDelivery = totalDelivery - totalFuel;
    const grossPerKm = totalKm > 0 ? totalDelivery / totalKm : 0;
    const netPerKm = totalKm > 0 ? netDelivery / totalKm : 0;

    document.getElementById('widget-delivery-total').textContent = `S/ ${totalDelivery.toFixed(2)}`;
    document.getElementById('widget-fuel-total').textContent = `S/ ${totalFuel.toFixed(2)}`;
    const netEl = document.getElementById('widget-net-delivery');
    netEl.textContent = `S/ ${netDelivery.toFixed(2)}`;
    netEl.className = netDelivery >= 0 ? "text-[11px] font-black text-cyan-400" : "text-[11px] font-black text-rose-400";
    document.getElementById('widget-km-total').textContent = `${totalKm.toFixed(1)} km`;
    document.getElementById('widget-gross-per-km').textContent = `S/ ${grossPerKm.toFixed(2)}`;
    const netKmEl = document.getElementById('widget-net-per-km');
    netKmEl.textContent = `S/ ${netPerKm.toFixed(2)}`;
    netKmEl.className = netPerKm >= 0 ? "text-cyan-400" : "text-rose-400";

    const debtTxs = transactions.filter(t => t.type === 'expense' && t.category.toLowerCase().includes('deuda'));
    const totalDebt = debtTxs.reduce((acc, d) => acc + d.amount, 0);
    document.getElementById('total-debt-amount').textContent = `S/ ${totalDebt.toFixed(2)}`;
    document.getElementById('debtors-list').innerHTML = debtTxs.length === 0
        ? `<p class="text-[11px] text-slate-400 text-center py-1">No tienes deudas pendientes. Haz clic en '+' para añadir una.</p>`
        : (showAllDebts ? debtTxs : debtTxs.slice(0, 3)).map(d => `
            <div class="flex justify-between items-center bg-slate-800/80 border border-slate-700/80 px-3 py-2 rounded-xl text-xs">
                <span onclick="openDebtHistoryModal('${d.id}')" class="font-bold text-slate-200 truncate pr-2 cursor-pointer hover:text-amber-400 transition underline decoration-dotted decoration-slate-500">${d.description}</span>
                <div class="flex items-center space-x-1.5 shrink-0">
                    <span onclick="openDebtHistoryModal('${d.id}')" class="font-extrabold text-amber-400 mr-1 cursor-pointer">S/ ${d.amount.toFixed(2)}</span>
                    <button onclick="adjustDebtAmount('${d.id}', 'add')" class="bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 w-5 h-5 rounded-full flex items-center justify-center font-black transition text-[10px]"><i class="fa-solid fa-plus"></i></button>
                    <button onclick="adjustDebtAmount('${d.id}', 'sub')" class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 w-5 h-5 rounded-full flex items-center justify-center font-black transition text-[10px]"><i class="fa-solid fa-minus"></i></button>
                    <button onclick="deleteTx('${d.id}', false)" class="text-slate-400 hover:text-red-500 text-xs px-1 transition"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>`).join("");

    let displayTxs = timeFilteredTxs;
    if (categoryFilter !== 'all') displayTxs = displayTxs.filter(t => t.category === categoryFilter);
    if (searchQuery !== '') displayTxs = displayTxs.filter(t => (t.description && t.description.toLowerCase().includes(searchQuery)) || (t.category && t.category.toLowerCase().includes(searchQuery)));
    displayTxs.sort((a, b) => (b.timestamp || new Date(b.date).getTime()) - (a.timestamp || new Date(a.date).getTime()));

    document.getElementById('dashboard-recent-list').innerHTML = displayTxs.length === 0
        ? `<p class="text-xs text-slate-400 text-center py-4">Sin registros para este filtro o búsqueda.</p>`
        : displayTxs.map(createTxItemHTML).join("");

    document.getElementById('history-count').textContent = `${displayTxs.length} registro${displayTxs.length === 1 ? '' : 's'}`;
    document.getElementById('full-history-list').innerHTML = displayTxs.length === 0
        ? `<p class="text-xs text-slate-400 text-center py-6">No se encontraron movimientos con este filtro.</p>`
        : displayTxs.map(createTxItemHTML).join("");

    updateCharts(timeFilteredTxs, timeFilter, now);
};

function createTxItemHTML(t) {
    const isIncome = t.type === 'income';
    const catObj = categories.find(c => c.name === t.category) || { color: '#64748B' };
    const textColor = getContrastTextColor(catObj.color);
    const photoBtn = t.photo ? `<button onclick="openImageModal('${t.photo}')" title="Ver comprobante" class="text-emerald-500 hover:text-emerald-600 text-xs px-1"><i class="fa-solid fa-image"></i></button>` : '';
    return `<div class="flex justify-between items-center bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700/70 p-2.5 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors duration-200">
        <div class="overflow-hidden pr-2 flex-1 min-w-0">
            <p class="font-bold text-slate-800 dark:text-slate-100 text-xs truncate">${t.description}</p>
            <div class="flex items-center space-x-2 mt-1">
                <span style="background-color: ${catObj.color}; color: ${textColor};" class="text-[9px] font-extrabold px-2 py-0.5 rounded-full tracking-wide shadow-sm">${t.category}</span>
                <span class="text-[10px] text-slate-400">${(t.date || '').split('T')[0]}</span>
            </div>
        </div>
        <div class="flex items-center space-x-0.5 shrink-0">
            <span class="font-extrabold text-xs ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'} mr-1">${isIncome ? '+' : '-'} S/ ${t.amount.toFixed(2)}</span>
            ${photoBtn}
            <button onclick="editTx('${t.id}')" class="text-slate-400 hover:text-emerald-500 text-xs px-1"><i class="fa-solid fa-pen"></i></button>
            <button onclick="deleteTx('${t.id}', true)" class="text-slate-400 hover:text-red-500 text-xs px-1"><i class="fa-solid fa-trash-can"></i></button>
        </div>
    </div>`;
}

// =====================================================================
// 6. GRÁFICOS (CHART.JS)
// =====================================================================
function updateCharts(filteredTxs, timeFilter, now) {
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
    const tickColor = isDarkMode ? '#94A3B8' : '#64748B';

    const dailyCanvas = document.getElementById('dailyTrendChart');
    if (dailyCanvas) {
        const dailyMap = {};
        filteredTxs.forEach(t => {
            if (t.type === 'expense' && t.date && !t.category.toLowerCase().includes('deuda')) {
                const dayKey = t.date.split('T')[0];
                dailyMap[dayKey] = (dailyMap[dayKey] || 0) + t.amount;
            }
        });
        const sortedDays = Object.keys(dailyMap).sort();
        if (dailyChartInstance) dailyChartInstance.destroy();
        dailyChartInstance = new Chart(dailyCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: sortedDays.length > 0 ? sortedDays.map(d => { const p = d.split('-'); return `${p[2]}/${p[1]}`; }) : ['Sin datos'],
                datasets: [{
                    label: 'Gasto Diario (S/)',
                    data: sortedDays.length > 0 ? sortedDays.map(d => dailyMap[d]) : [0],
                    borderColor: '#3B82F6',
                    backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.12)',
                    borderWidth: 2.5, pointBackgroundColor: '#3B82F6', pointRadius: 3.5, fill: true, tension: 0.35
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 9 } } },
                    y: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 9 } }, beginAtZero: true }
                }
            }
        });
    }

    const targetYear = timeFilter.startsWith('month-') ? parseInt(timeFilter.split('-')[1], 10) : now.getFullYear();
    document.getElementById('chart-year-label').textContent = `${targetYear}`;

    const barCanvas = document.getElementById('financialBarChart');
    if (barCanvas) {
        const monthlyIncome = Array(12).fill(0);
        const monthlyExpense = Array(12).fill(0);
        transactions.forEach(t => {
            const p = parseLocalDateParts(t.date);
            if (p && p.year === targetYear && p.month >= 0 && p.month < 12) {
                if (t.type === 'income') monthlyIncome[p.month] += t.amount;
                else if (!t.category.toLowerCase().includes('deuda')) monthlyExpense[p.month] += t.amount;
            }
        });
        if (barChartInstance) barChartInstance.destroy();
        barChartInstance = new Chart(barCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
                datasets: [
                    { label: 'ingresos', data: monthlyIncome, backgroundColor: '#10B981', borderRadius: 4, barPercentage: 0.7 },
                    { label: 'gastos', data: monthlyExpense, backgroundColor: '#FBBF24', borderRadius: 4, barPercentage: 0.7 },
                    { label: 'beneficio', data: monthlyIncome.map((inc, i) => Math.max(0, inc - monthlyExpense[i])), backgroundColor: '#3B82F6', borderRadius: 4, barPercentage: 0.7 },
                    { label: 'pérdida neta', data: monthlyIncome.map((inc, i) => Math.max(0, monthlyExpense[i] - inc)), backgroundColor: '#FB7185', borderRadius: 4, barPercentage: 0.7 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 9, weight: 'bold' } } },
                    y: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 9 } }, beginAtZero: true }
                }
            }
        });
    }

    const catTotals = {};
    filteredTxs.forEach(t => { if (t.type === 'expense') catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
    const labels = Object.keys(catTotals);
    const data = Object.values(catTotals);
    const bgColors = labels.map(l => (categories.find(c => c.name === l) || { color: '#64748B' }).color);

    const legendEl = document.getElementById('category-custom-legend');
    if (legendEl) {
        if (labels.length === 0) {
            legendEl.innerHTML = `<p class="text-[11px] text-slate-400 text-center py-2">Sin gastos en este período.</p>`;
        } else {
            const totalExp = data.reduce((a, b) => a + b, 0);
            legendEl.innerHTML = labels.map((label, idx) => ({
                name: label,
                amount: data[idx],
                color: bgColors[idx],
                pct: totalExp > 0 ? Math.round((data[idx] / totalExp) * 100) : 0
            })).sort((a, b) => b.amount - a.amount).map(item => {
                const cObj = categories.find(c => c.name === item.name);
                const budget = cObj?.budget || 0;
                let budgetHtml = '';
                if (budget > 0) {
                    const bPct = Math.min(100, Math.round((item.amount / budget) * 100));
                    const bColor = bPct > 100 ? 'bg-rose-500' : (bPct >= 80 ? 'bg-amber-400' : 'bg-emerald-500');
                    budgetHtml = `<div class="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1"><div class="${bColor} h-full rounded-full transition-all duration-300" style="width:${bPct}%;"></div></div>
                        <div class="flex justify-between text-[9px] text-slate-400 mt-0.5"><span>Presupuesto: S/ ${budget.toFixed(0)}</span><span class="${bPct > 100 ? 'text-rose-500 font-bold' : ''}">${bPct}% usado</span></div>`;
                }
                return `<div class="bg-slate-50 dark:bg-slate-900/80 px-2.5 py-2 rounded-xl text-xs border border-slate-100 dark:border-slate-700/60">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 min-w-0"><span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color:${item.color};"></span><span class="font-bold text-slate-700 dark:text-slate-200 truncate">${item.name}</span><span class="text-[10px] font-semibold text-slate-400 shrink-0">(${item.pct}%)</span></div>
                        <span class="font-extrabold text-slate-800 dark:text-slate-100 shrink-0">S/ ${item.amount.toFixed(2)}</span>
                    </div>${budgetHtml}
                </div>`;
            }).join("");
        }
    }

    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(document.getElementById('categoryChart').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: labels.length > 0 ? labels : ['Sin gastos'],
            datasets: [{
                data: data.length > 0 ? data : [1],
                backgroundColor: labels.length > 0 ? bgColors : (isDarkMode ? ['#1E293B'] : ['#E2E8F0']),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: S/ ${Number(ctx.parsed || 0).toFixed(2)}` } }
            }
        }
    });
}

// =====================================================================
// 7. TRANSACCIONES, DEUDAS, METAS Y NOTAS / TAREAS
// =====================================================================
window.setTxType = (type) => {
    currentType = type;
    const exp = document.getElementById('btn-type-expense');
    const inc = document.getElementById('btn-type-income');
    exp.className = type === 'expense'
        ? "py-2.5 rounded-xl text-xs font-bold border border-red-500 text-red-500 bg-red-50 dark:bg-red-950/40 transition"
        : "py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-400 transition";
    inc.className = type === 'income'
        ? "py-2.5 rounded-xl text-xs font-bold border border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 transition"
        : "py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-400 transition";
};

document.getElementById('transaction-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('tx-edit-id').value;
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const category = document.getElementById('tx-category').value;
    const date = document.getElementById('tx-date').value;
    const description = document.getElementById('tx-description').value.trim() || category;

    if (isNaN(amount) || amount <= 0 || !currentUser) { showToast("Monto inválido.", "warning"); return; }

    const txData = { description, amount, type: currentType, category, date, timestamp: Date.now(), photo: currentPhotoBase64 || null };
    try {
        if (editId) {
            const existing = transactions.find(t => t.id === editId);
            if (existing?.historyLogs) txData.historyLogs = existing.historyLogs;
            await updateDoc(doc(db, `users/${currentUser.uid}/transactions/${editId}`), txData);
            const idx = transactions.findIndex(t => t.id === editId);
            if (idx !== -1) transactions[idx] = { id: editId, ...txData };
            cancelEdit();
            showToast("Transacción actualizada.", "success");
        } else {
            const ref = doc(collection(db, `users/${currentUser.uid}/transactions`));
            await setDoc(ref, txData);
            transactions.unshift({ id: ref.id, ...txData });
            showToast(navigator.onLine ? "Guardado." : "Guardado offline; sincronizará al volver la red.", "success");
        }
        document.getElementById('transaction-form').reset();
        document.getElementById('tx-date').value = getLocalDateString();
        removeTxPhoto();
        renderUI();
        renderGallery();
        switchTab('dashboard');
    } catch (err) { showToast("Error al guardar.", "error"); }
});

window.editTx = (id) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    document.getElementById('tx-edit-id').value = tx.id;
    document.getElementById('tx-amount').value = tx.amount;
    renderCategories();
    const sel = document.getElementById('tx-category');
    if ([...sel.options].some(o => o.value === tx.category)) sel.value = tx.category;
    document.getElementById('tx-date').value = tx.date ? tx.date.split('T')[0] : getLocalDateString();
    document.getElementById('tx-description').value = tx.description;
    setTxType(tx.type);
    if (tx.photo) {
        currentPhotoBase64 = tx.photo;
        document.getElementById('photo-preview-img').src = tx.photo;
        document.getElementById('photo-upload-box').classList.add('hidden');
        document.getElementById('photo-preview-container').classList.remove('hidden');
    } else {
        removeTxPhoto();
    }
    document.getElementById('form-title').textContent = "EDITAR REGISTRO";
    document.getElementById('form-submit-btn').textContent = "Actualizar Transacción";
    document.getElementById('form-cancel-btn').classList.remove('hidden');
    switchTab('add');
};

window.cancelEdit = () => {
    document.getElementById('transaction-form').reset();
    document.getElementById('tx-edit-id').value = '';
    document.getElementById('tx-date').value = getLocalDateString();
    removeTxPhoto();
    document.getElementById('form-title').textContent = "NUEVO REGISTRO";
    document.getElementById('form-submit-btn').textContent = "Guardar Transacción";
    document.getElementById('form-cancel-btn').classList.add('hidden');
    setTxType('expense');
};

window.deleteTx = async (id, askConfirm = true) => {
    if (askConfirm && !confirm("¿Eliminar registro?")) return;
    try {
        await deleteDoc(doc(db, `users/${currentUser.uid}/transactions/${id}`));
        transactions = transactions.filter(t => t.id !== id);
        renderUI();
        renderGallery();
        showToast("Registro eliminado.", "info");
    } catch (err) { showToast("Error al eliminar.", "error"); }
};

window.toggleAllDebtsView = () => {
    showAllDebts = !showAllDebts;
    document.getElementById('toggle-debts-btn').textContent = showAllDebts ? "Ver menos" : "Ver todos";
    renderUI();
};

window.addQuickDebt = () => {
    setTxType('expense');
    renderCategories();
    const debtCat = categories.find(c => c.name.toLowerCase().includes('deuda'));
    if (debtCat) document.getElementById('tx-category').value = debtCat.name;
    document.getElementById('tx-description').value = '';
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-date').value = getLocalDateString();
    switchTab('add');
    document.getElementById('tx-description').focus();
};

window.adjustDebtAmount = async (id, mode) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    const inputVal = prompt(mode === 'add' ? `¿Cuánto deseas SUMAR a la deuda de "${tx.description}"?` : `¿Cuánto deseas RESTAR/AMORTIZAR de la deuda de "${tx.description}"?`, "0.00");
    if (inputVal === null) return;
    const amt = parseFloat(inputVal.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) { showToast("Ingresa un monto válido mayor a 0.", "warning"); return; }

    const newAmount = Math.max(0, mode === 'add' ? tx.amount + amt : tx.amount - amt);
    const historyLogs = [{ type: mode === 'add' ? 'sum' : 'sub', amount: amt, previousAmount: tx.amount, newAmount, date: formatNowDateTime(), timestamp: Date.now() }, ...(tx.historyLogs || [])];

    if (newAmount === 0 && confirm(`La deuda queda en S/ 0.00. ¿Deseas eliminar este registro de deuda?`)) {
        await deleteTx(id, false);
        return;
    }
    try {
        await updateDoc(doc(db, `users/${currentUser.uid}/transactions/${id}`), { amount: newAmount, historyLogs });
        const idx = transactions.findIndex(t => t.id === id);
        if (idx !== -1) { transactions[idx].amount = newAmount; transactions[idx].historyLogs = historyLogs; }
        renderUI();
        showToast(mode === 'add' ? `Sumado +S/ ${amt.toFixed(2)}` : `Amortizado -S/ ${amt.toFixed(2)}`, 'success');
    } catch (err) { showToast("Error al actualizar la deuda.", "error"); }
};

window.openDebtHistoryModal = (id) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    document.getElementById('debt-modal-title').innerHTML = `<i class="fa-solid fa-clock-rotate-left mr-1.5"></i> Historial: ${tx.description}`;
    document.getElementById('debt-modal-current').textContent = `S/ ${tx.amount.toFixed(2)}`;
    const logs = [...(tx.historyLogs || [])].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    document.getElementById('debt-history-list').innerHTML = logs.length === 0
        ? `<p class="text-xs text-slate-400 text-center py-4">No hay abonos ni amortizaciones registradas aún. Usa los botones + o - en la deuda.</p>`
        : logs.map(log => {
            const isSum = log.type === 'sum';
            return `<div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1 shrink-0">
                <div class="flex justify-between items-center text-xs">
                    <span class="font-bold px-2 py-0.5 rounded-full border text-[10px] ${isSum ? 'bg-amber-500/25 text-amber-300 border-amber-500/30' : 'bg-emerald-500/25 text-emerald-300 border-emerald-500/30'}">${isSum ? 'Se sumó a la deuda' : 'Se amortizó / pagó'}</span>
                    <span class="font-extrabold text-xs ${isSum ? 'text-amber-400' : 'text-emerald-400'}">${isSum ? '+' : '-'} S/ ${log.amount.toFixed(2)}</span>
                </div>
                <div class="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-900"><span>📅 ${log.date}</span><span>Quedó en: <b>S/ ${log.newAmount.toFixed(2)}</b></span></div>
            </div>`;
        }).join("");
    document.getElementById('debt-history-modal').classList.remove('hidden');
};
window.closeDebtHistoryModal = () => document.getElementById('debt-history-modal').classList.add('hidden');

// Metas de ahorro
let goalContribContext = { goalId: null, contribId: null };

function parseContribISO(c) {
    if (c?.dateISO) return c.dateISO;
    const m = (c?.date || '').match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}))?/);
    return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4] || "00:00"}` : "";
}

function normalizeGoalContributions(goal) {
    return (Array.isArray(goal.contributions) ? goal.contributions : []).map((c, idx) => {
        const iso = parseContribISO(c);
        const ts = c.timestamp || (iso ? new Date(iso).getTime() : 0) || (Date.now() + idx);
        return { id: c.id || `contrib-${ts}-${idx}`, amount: Number(Number(c.amount || 0).toFixed(2)), dateISO: iso, date: c.date || formatNowDateTime(iso), timestamp: ts };
    }).sort((a, b) => (a.dateISO && b.dateISO) ? a.dateISO.localeCompare(b.dateISO) : (a.timestamp || 0) - (b.timestamp || 0));
}

function getGoalCurrentTotal(goal) {
    const contribs = normalizeGoalContributions(goal);
    return contribs.length > 0 ? Number(contribs.reduce((s, x) => s + Number(x.amount || 0), 0).toFixed(2)) : Number(Number(goal.current || 0).toFixed(2));
}

window.addQuickGoal = () => {
    document.getElementById('goal-create-title').value = '';
    document.getElementById('goal-create-target').value = '500';
    document.getElementById('goal-create-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('goal-create-title').focus(), 40);
};
window.closeGoalCreateModal = () => document.getElementById('goal-create-modal').classList.add('hidden');

window.saveNewGoalModal = async () => {
    const title = document.getElementById('goal-create-title').value.trim();
    const target = parseFloat(document.getElementById('goal-create-target').value);
    if (!title) { showToast("Escribe un nombre para la meta.", "warning"); return; }
    if (isNaN(target) || target <= 0) { showToast("Monto objetivo inválido.", "warning"); return; }
    const newGoal = { title, target: Number(target.toFixed(2)), current: 0, createdAt: formatNowDateTime(), contributions: [] };
    try {
        const ref = doc(collection(db, `users/${currentUser.uid}/savingsGoals`));
        await setDoc(ref, newGoal);
        savingsGoals.push({ id: ref.id, ...newGoal });
        closeGoalCreateModal();
        renderGoalsUI();
        showToast("Meta de ahorro creada.", "success");
    } catch (e) { showToast("Error al guardar la meta.", "error"); }
};

window.openGoalContributionModal = (goalId, contribId = null) => {
    const goal = savingsGoals.find(g => g.id === goalId);
    if (!goal) return;
    goalContribContext = { goalId, contribId };
    const titleEl = document.getElementById('goal-contrib-modal-title');
    const amtEl = document.getElementById('goal-contrib-amount');
    const dtEl = document.getElementById('goal-contrib-datetime');
    if (contribId) {
        const found = normalizeGoalContributions(goal).find(c => c.id === contribId);
        if (!found) return;
        titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square mr-1.5"></i> Editar Abono · ${goal.title}`;
        amtEl.value = Number(found.amount).toFixed(2);
        dtEl.value = found.dateISO || getLocalDateTimeISO();
    } else {
        titleEl.innerHTML = `<i class="fa-solid fa-coins mr-1.5"></i> Abonar a "${goal.title}"`;
        amtEl.value = "";
        dtEl.value = getLocalDateTimeISO();
    }
    document.getElementById('goal-contribution-modal').classList.remove('hidden');
    setTimeout(() => amtEl.focus(), 40);
};
window.closeGoalContributionModal = () => { document.getElementById('goal-contribution-modal').classList.add('hidden'); goalContribContext = { goalId: null, contribId: null }; };
window.adjustGoalAmount = (id) => window.openGoalContributionModal(id, null);

window.saveGoalContributionModal = async () => {
    const { goalId, contribId } = goalContribContext;
    const goal = savingsGoals.find(g => g.id === goalId);
    if (!goal) return;
    const amount = parseFloat(document.getElementById('goal-contrib-amount').value);
    const dateISO = document.getElementById('goal-contrib-datetime').value || getLocalDateTimeISO();
    if (isNaN(amount) || amount <= 0) { showToast("Monto inválido.", "warning"); return; }

    let contribs = normalizeGoalContributions(goal);
    const entry = {
        id: contribId || `contrib-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        amount: Number(amount.toFixed(2)),
        dateISO,
        date: formatNowDateTime(dateISO),
        timestamp: new Date(dateISO).getTime() || Date.now()
    };
    contribs = contribId ? contribs.map(c => c.id === contribId ? entry : c) : [...contribs, entry];
    contribs.sort((a, b) => (a.dateISO && b.dateISO) ? a.dateISO.localeCompare(b.dateISO) : (a.timestamp || 0) - (b.timestamp || 0));
    const newCurrent = Number(contribs.reduce((s, x) => s + Number(x.amount || 0), 0).toFixed(2));

    try {
        await updateDoc(doc(db, `users/${currentUser.uid}/savingsGoals/${goalId}`), { current: newCurrent, contributions: contribs });
        goal.current = newCurrent;
        goal.contributions = contribs;
        closeGoalContributionModal();
        renderGoalsUI();
        showToast(contribId ? `Abono actualizado a S/ ${amount.toFixed(2)}.` : `Abonado +S/ ${amount.toFixed(2)} a "${goal.title}".`, "success");
    } catch (e) { showToast("Error al guardar el abono.", "error"); }
};

window.deleteGoalContribution = async (goalId, contribId) => {
    const goal = savingsGoals.find(g => g.id === goalId);
    if (!goal) return;
    let contribs = normalizeGoalContributions(goal);
    const item = contribs.find(c => c.id === contribId);
    if (!item || !confirm(`¿Eliminar el abono de S/ ${Number(item.amount).toFixed(2)} (${item.date})?`)) return;
    contribs = contribs.filter(c => c.id !== contribId);
    const newCurrent = Number(contribs.reduce((s, x) => s + Number(x.amount || 0), 0).toFixed(2));
    try {
        await updateDoc(doc(db, `users/${currentUser.uid}/savingsGoals/${goalId}`), { current: newCurrent, contributions: contribs });
        goal.current = newCurrent;
        goal.contributions = contribs;
        renderGoalsUI();
        showToast("Abono eliminado.", "info");
    } catch (e) { showToast("Error al eliminar el abono.", "error"); }
};

window.toggleGoalHistory = (id) => document.getElementById(`goal-history-${id}`)?.classList.toggle('hidden');
window.deleteGoal = async (id) => {
    if (!confirm("¿Eliminar esta meta de ahorro?")) return;
    await deleteDoc(doc(db, `users/${currentUser.uid}/savingsGoals/${id}`));
    savingsGoals = savingsGoals.filter(g => g.id !== id);
    renderGoalsUI();
    showToast("Meta eliminada.", "info");
};

function renderGoalsUI() {
    const listEl = document.getElementById('savings-goals-list');
    if (savingsGoals.length === 0) {
        listEl.innerHTML = `<p class="text-[11px] text-slate-400 text-center py-1">No tienes metas activas. Haz clic en 'Nueva Meta'.</p>`;
        return;
    }
    listEl.innerHTML = savingsGoals.map(g => {
        const contribs = normalizeGoalContributions(g);
        const currentAmount = getGoalCurrentTotal(g);
        g.current = currentAmount;
        g.contributions = contribs;
        const percent = g.target > 0 ? Math.min(100, Math.round((currentAmount / g.target) * 100)) : 0;
        const latest = contribs[contribs.length - 1];
        const lastText = latest ? `Último abono: ${latest.date}` : (g.createdAt ? `Creada: ${g.createdAt}` : 'Sin abonos registrados');
        const historyHTML = contribs.length > 0
            ? contribs.map(c => `<div class="flex justify-between items-center gap-2 text-[10px] py-1.5 px-2 rounded-lg bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300">
                <span class="truncate">📅 ${c.date}</span>
                <div class="flex items-center gap-1.5 shrink-0">
                    <span class="font-bold text-emerald-600 dark:text-emerald-400">+ S/ ${Number(c.amount).toFixed(2)}</span>
                    <button type="button" onclick="openGoalContributionModal('${g.id}', '${c.id}')" class="text-blue-500 hover:text-blue-400 px-0.5"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button type="button" onclick="deleteGoalContribution('${g.id}', '${c.id}')" class="text-slate-400 hover:text-rose-500 px-0.5"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>`).join('')
            : `<p class="text-[10px] text-slate-400 py-1 px-1">Aún no hay fechas de abonos registradas.</p>`;

        return `<div class="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-2.5 rounded-2xl space-y-1.5">
            <div class="flex justify-between items-center text-xs"><span class="font-bold text-slate-800 dark:text-slate-200">${g.title}</span><span class="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">S/ ${currentAmount.toFixed(2)} / S/ ${Number(g.target).toFixed(2)}</span></div>
            <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden"><div class="bg-emerald-500 h-full rounded-full transition-all duration-500" style="width:${percent}%;"></div></div>
            <div class="flex justify-between items-center text-[10px] text-slate-400"><span class="font-semibold">${percent}% completado</span><button type="button" onclick="toggleGoalHistory('${g.id}')" class="text-slate-400 hover:text-emerald-500 font-medium truncate max-w-[68%] text-right"><i class="fa-solid fa-clock-rotate-left mr-0.5"></i> ${lastText}</button></div>
            <div class="flex justify-end items-center text-[10px] pt-0.5"><div class="flex gap-2.5 items-center"><button type="button" onclick="adjustGoalAmount('${g.id}')" class="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">+ Abonar</button><button type="button" onclick="deleteGoal('${g.id}')" class="text-slate-300 hover:text-red-500"><i class="fa-solid fa-trash-can"></i></button></div></div>
            <div id="goal-history-${g.id}" class="pt-1.5 mt-1 border-t border-slate-200/70 dark:border-slate-800 space-y-1 max-h-36 overflow-y-auto custom-scroll pr-0.5">${historyHTML}</div>
        </div>`;
    }).join("");
}

// Notas / Pendientes y Tareas
let isSavingQuickNote = false;
const NOTE_COLORS = ['#F59E0B', '#EF4444', '#3B82F6', '#10B981', '#8B5CF6'];

async function createTaskItem(text, color = '#F59E0B') {
    const clean = (text || '').trim();
    if (!clean || !currentUser) return false;
    const now = new Date();
    const newTask = {
        text: clean, completed: false, color,
        date: `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
        timestamp: Date.now()
    };
    const ref = doc(collection(db, `users/${currentUser.uid}/tasks`));
    await setDoc(ref, newTask);
    tasksList.push({ id: ref.id, ...newTask });
    renderTasksUI();
    return true;
}

window.addQuickNoteFromDashboard = async () => {
    if (isSavingQuickNote) return;
    const input = document.getElementById('quick-note-input');
    const colorSelect = document.getElementById('quick-note-color');
    const text = (input?.value || '').trim();
    const color = colorSelect?.value || '#F59E0B';
    if (!text) return;

    isSavingQuickNote = true;
    if (input) input.value = '';
    try {
        await createTaskItem(text, color);
        showToast("Nota agregada a pendientes.", "success");
    } catch (e) {
        if (input && !input.value) input.value = text;
        showToast("Error al guardar la nota.", "error");
    } finally {
        isSavingQuickNote = false;
    }
};

window.editQuickNoteText = async (id) => {
    const task = tasksList.find(t => t.id === id);
    if (!task) return;
    const updated = prompt("Editar nota o pendiente:", task.text);
    if (updated === null) return;
    const clean = updated.trim();
    if (!clean) { showToast("La nota no puede quedar vacía.", "warning"); return; }

    const prevText = task.text;
    task.text = clean;
    renderTasksUI();
    try {
        await updateDoc(doc(db, `users/${currentUser.uid}/tasks/${id}`), { text: clean });
        showToast("Nota actualizada.", "success");
    } catch (e) {
        task.text = prevText;
        renderTasksUI();
        showToast("Error al editar la nota.", "error");
    }
};

window.cycleTaskColor = async (id) => {
    const task = tasksList.find(t => t.id === id);
    if (!task) return;
    const idx = NOTE_COLORS.indexOf(task.color);
    const nextColor = NOTE_COLORS[(idx + 1) % NOTE_COLORS.length];
    const prevColor = task.color;
    task.color = nextColor;
    renderTasksUI();
    try {
        await updateDoc(doc(db, `users/${currentUser.uid}/tasks/${id}`), { color: nextColor });
    } catch (e) {
        task.color = prevColor;
        renderTasksUI();
        showToast("No se pudo cambiar el color.", "error");
    }
};

function renderDashboardNotesWidget() {
    const badge = document.getElementById('dashboard-notes-badge');
    const list = document.getElementById('dashboard-notes-list');
    const clearBtn = document.getElementById('dashboard-clear-done-btn');
    if (!badge || !list) return;

    const ordered = [...tasksList].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const pendingCount = ordered.filter(t => !t.completed).length;
    const doneCount = ordered.length - pendingCount;
    badge.textContent = `${pendingCount} pendiente${pendingCount === 1 ? '' : 's'}`;
    if (clearBtn) clearBtn.classList.toggle('hidden', doneCount === 0);

    list.innerHTML = ordered.length === 0
        ? `<p class="text-[11px] text-slate-400 text-center py-2">Sin pendientes activos. Escribe algo rápido arriba.</p>`
        : ordered.slice(0, 6).map(task => `<div class="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/70 px-3 py-2 rounded-xl gap-2 text-xs">
            <div class="flex items-center gap-2 min-w-0 flex-1">
                <button type="button" onclick="toggleTaskComplete('${task.id}')" title="${task.completed ? 'Marcar pendiente' : 'Marcar completada'}" class="w-5 h-5 rounded-full border-2 ${task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-400 dark:border-slate-500 hover:border-emerald-500'} flex items-center justify-center shrink-0 transition">${task.completed ? `<i class="fa-solid fa-check text-slate-950 text-[10px] font-black"></i>` : ''}</button>
                <button type="button" onclick="cycleTaskColor('${task.id}')" title="Cambiar color" class="w-3 h-3 rounded-full shrink-0 border border-white/20" style="background-color:${task.color || '#F59E0B'};"></button>
                <span onclick="editQuickNoteText('${task.id}')" title="Toca para editar" class="font-semibold ${task.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'} truncate cursor-pointer hover:text-emerald-500 transition">${task.text}</span>
            </div>
            <button type="button" onclick="deleteTask('${task.id}')" title="Eliminar nota" class="text-slate-400 hover:text-rose-500 text-xs shrink-0 px-1.5 py-1"><i class="fa-solid fa-trash-can"></i></button>
        </div>`).join("");
}

window.addNewTask = async () => {
    const input = document.getElementById('new-task-input');
    const text = input.value.trim();
    if (!text) return;
    try { await createTaskItem(text, document.getElementById('task-color-select').value); input.value = ''; showToast("Tarea agregada.", "success"); }
    catch (e) { showToast("Error al añadir tarea.", "error"); }
};

window.toggleTaskComplete = async (id) => {
    const task = tasksList.find(t => t.id === id);
    if (!task) return;
    const nextState = !task.completed;
    task.completed = nextState;
    renderTasksUI();
    try {
        await updateDoc(doc(db, `users/${currentUser.uid}/tasks/${id}`), { completed: nextState });
        showToast(nextState ? "Tarea marcada como completada." : "Tarea marcada como pendiente.", "success");
    } catch (e) {
        task.completed = !nextState;
        renderTasksUI();
        showToast("Error al actualizar la tarea.", "error");
    }
};

window.deleteTask = async (id) => {
    try {
        await deleteDoc(doc(db, `users/${currentUser.uid}/tasks/${id}`));
        tasksList = tasksList.filter(t => t.id !== id);
        renderTasksUI();
        showToast("Tarea eliminada.", "info");
    } catch (e) {
        showToast("Error al eliminar la tarea.", "error");
    }
};

window.deleteCompletedTasks = async () => {
    const done = tasksList.filter(t => t.completed);
    if (done.length === 0 || !confirm(`¿Deseas eliminar todas las ${done.length} tareas completadas?`)) return;
    for (const t of done) await deleteDoc(doc(db, `users/${currentUser.uid}/tasks/${t.id}`));
    tasksList = tasksList.filter(t => !t.completed);
    renderTasksUI();
    showToast("Tareas completadas eliminadas.", "info");
};

function renderTasksUI() {
    renderDashboardNotesWidget();
    const container = document.getElementById('tasks-list-container');
    const delContainer = document.getElementById('delete-completed-container');
    const doneCount = tasksList.filter(t => t.completed).length;
    delContainer.innerHTML = doneCount > 0 ? `<button onclick="deleteCompletedTasks()" class="bg-rose-500/25 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold px-2.5 py-1 rounded-xl transition flex items-center gap-1 shadow"><i class="fa-solid fa-trash-can"></i> Eliminar completadas (${doneCount})</button>` : '';
    if (tasksList.length === 0) { container.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">No hay tareas registradas. Agrega una arriba.</p>`; return; }
    container.innerHTML = [...tasksList].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)).map(task => `
        <div class="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-2xl gap-3 shadow-sm transition">
            <div class="flex items-center gap-3 overflow-hidden flex-1">
                <span class="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style="background-color:${task.color || '#3B82F6'};"></span>
                <div class="overflow-hidden flex-1">
                    <span class="text-xs font-semibold ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'} truncate block">${task.text}</span>
                    ${task.date ? `<span class="text-[9px] text-slate-400 font-medium block">📅 ${task.date}</span>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <button onclick="toggleTaskComplete('${task.id}')" class="w-6 h-6 rounded-full border-2 ${task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-400 dark:border-slate-600 bg-transparent'} flex items-center justify-center transition shadow-inner">${task.completed ? `<i class="fa-solid fa-check text-slate-950 text-xs font-black"></i>` : ''}</button>
                <button onclick="deleteTask('${task.id}')" class="text-slate-300 hover:text-rose-500 text-xs transition px-1"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        </div>`).join("");
}

// =====================================================================
// 8. DELIVERY, MOTO, GALERÍA Y CALCULADORA
// =====================================================================
window.setDeliveryGroup = (mode) => {
    deliveryGroupMode = mode;
    ['daily', 'weekly', 'monthly'].forEach(m => {
        document.getElementById(`del-group-${m}`).className = m === mode
            ? "px-2.5 py-1 rounded-lg bg-emerald-600 text-white transition"
            : "px-2.5 py-1 rounded-lg text-slate-400 hover:text-white transition";
    });
    renderDeliveryUI();
};

window.clearDeliveryTipsAndBonus = () => {
    document.getElementById('del-tips').value = "0";
    document.getElementById('del-bonus').value = "0";
    showToast("Propinas y bonos en 0.", "info");
};

window.repeatLastDeliveryShift = () => {
    if (!deliveryShifts.length) { showToast("Aún no hay turnos anteriores para repetir.", "warning"); return; }
    const last = [...deliveryShifts].sort((a, b) => (new Date(b.date || 0) - new Date(a.date || 0)) || ((b.timestamp || 0) - (a.timestamp || 0)))[0];
    document.getElementById('del-edit-id').value = '';
    document.getElementById('delivery-form-title').innerHTML = `<i class="fa-solid fa-motorcycle mr-1.5"></i> Registro de Turnos & Pagos`;
    document.getElementById('del-submit-btn').textContent = "Guardar Registro de Turno";
    document.getElementById('del-cancel-btn').classList.add('hidden');
    const sel = document.getElementById('del-platform');
    if (last.platform && [...sel.options].some(o => o.value === last.platform)) sel.value = last.platform;
    document.getElementById('del-base').value = last.base || 0;
    document.getElementById('del-km').value = last.km || 0;
    document.getElementById('del-tips').value = last.tips || 0;
    document.getElementById('del-bonus').value = last.bonus || 0;
    if (!document.getElementById('del-date').value) document.getElementById('del-date').value = getLocalDateString();
    showToast(`Copiado último turno (${last.platform}).`, "info");
};

window.saveDeliveryShift = async (e) => {
    e.preventDefault();
    const editId = document.getElementById('del-edit-id').value;
    const platform = document.getElementById('del-platform').value;
    const date = document.getElementById('del-date').value;
    const base = parseFloat(document.getElementById('del-base').value) || 0;
    const km = parseFloat(document.getElementById('del-km').value) || 0;
    const tips = parseFloat(document.getElementById('del-tips').value) || 0;
    const bonus = parseFloat(document.getElementById('del-bonus').value) || 0;
    const total = base + tips + bonus;
    if (total <= 0) { showToast("Ingresa valores de pago válidos.", "warning"); return; }

    const desc = `${platform} - Base: S/${base.toFixed(2)}${tips > 0 ? ' + Propina: S/' + tips.toFixed(2) : ''}${bonus > 0 ? ' + Bono: S/' + bonus.toFixed(2) : ''} | ${km} km`;
    try {
        if (editId) {
            const existing = deliveryShifts.find(s => s.id === editId);
            const ts = existing?.timestamp || Date.now();
            const txData = { description: desc, amount: total, type: 'income', category: 'Ingresos', date, timestamp: ts, photo: null };
            if (existing?.txId) await updateDoc(doc(db, `users/${currentUser.uid}/transactions/${existing.txId}`), txData);
            const shiftData = { platform, base, km, tips, bonus, total, date, timestamp: ts, txId: existing?.txId || null };
            await updateDoc(doc(db, `users/${currentUser.uid}/deliveryShifts/${editId}`), shiftData);
            const sIdx = deliveryShifts.findIndex(s => s.id === editId);
            if (sIdx !== -1) deliveryShifts[sIdx] = { id: editId, ...shiftData };
            const tIdx = transactions.findIndex(t => t.id === existing?.txId);
            if (tIdx !== -1) transactions[tIdx] = { id: existing.txId, ...txData };
            cancelDeliveryEdit();
            showToast("Turno actualizado.", "success");
        } else {
            const ts = Date.now();
            const txData = { description: desc, amount: total, type: 'income', category: 'Ingresos', date, timestamp: ts, photo: null };
            const txRef = doc(collection(db, `users/${currentUser.uid}/transactions`));
            await setDoc(txRef, txData);
            transactions.unshift({ id: txRef.id, ...txData });

            const shiftData = { platform, base, km, tips, bonus, total, date, timestamp: ts, txId: txRef.id };
            const shiftRef = doc(collection(db, `users/${currentUser.uid}/deliveryShifts`));
            await setDoc(shiftRef, shiftData);
            deliveryShifts.unshift({ id: shiftRef.id, ...shiftData });
            document.getElementById('delivery-form').reset();
            document.getElementById('del-date').value = getLocalDateString();
            showToast(navigator.onLine ? "Turno guardado." : "Guardado offline; sincronizará al volver la red.", "success");
        }
        renderDeliveryUI();
        renderUI();
    } catch (err) { showToast("Error al guardar registro.", "error"); }
};

window.editDeliveryShift = (id) => {
    const s = deliveryShifts.find(x => x.id === id);
    if (!s) return;
    document.getElementById('del-edit-id').value = s.id;
    document.getElementById('del-platform').value = s.platform || 'PedidosYa';
    document.getElementById('del-base').value = s.base || 0;
    document.getElementById('del-km').value = s.km || 0;
    document.getElementById('del-tips').value = s.tips || 0;
    document.getElementById('del-bonus').value = s.bonus || 0;
    document.getElementById('del-date').value = s.date || getLocalDateString();
    document.getElementById('delivery-form-title').innerHTML = `<i class="fa-solid fa-pen-to-square mr-1.5"></i> Modificar Turno`;
    document.getElementById('del-submit-btn').textContent = "Actualizar Turno";
    document.getElementById('del-cancel-btn').classList.remove('hidden');
    document.getElementById('del-base').focus();
};

window.cancelDeliveryEdit = () => {
    document.getElementById('delivery-form').reset();
    document.getElementById('del-edit-id').value = '';
    document.getElementById('del-date').value = getLocalDateString();
    document.getElementById('delivery-form-title').innerHTML = `<i class="fa-solid fa-motorcycle mr-1.5"></i> Registro de Turnos & Pagos`;
    document.getElementById('del-submit-btn').textContent = "Guardar Registro de Turno";
    document.getElementById('del-cancel-btn').classList.add('hidden');
};

window.deleteDeliveryShift = async (id) => {
    if (!confirm("¿Deseas eliminar este registro y su ingreso asociado?")) return;
    const shift = deliveryShifts.find(s => s.id === id);
    await deleteDoc(doc(db, `users/${currentUser.uid}/deliveryShifts/${id}`));
    deliveryShifts = deliveryShifts.filter(s => s.id !== id);
    if (shift?.txId) {
        await deleteDoc(doc(db, `users/${currentUser.uid}/transactions/${shift.txId}`));
        transactions = transactions.filter(t => t.id !== shift.txId);
    }
    renderDeliveryUI();
    renderUI();
    showToast("Turno eliminado.", "info");
};

function renderDeliveryUI() {
    const sel = document.getElementById('del-platform');
    if (sel) {
        const prev = sel.value;
        sel.innerHTML = deliveryPlatforms.map(p => `<option value="${p}">${p}</option>`).join('');
        if (deliveryPlatforms.includes(prev)) sel.value = prev;
    }
    const listEl = document.getElementById('delivery-shifts-list');
    if (!listEl) return;
    const sorted = [...deliveryShifts].sort((a, b) => (new Date(b.date || 0) - new Date(a.date || 0)) || ((b.timestamp || 0) - (a.timestamp || 0)));
    if (sorted.length === 0) { listEl.innerHTML = `<p class="text-xs text-slate-400 text-center py-3">No hay turnos o pagos registrados aún.</p>`; return; }

    if (deliveryGroupMode === 'daily') {
        listEl.innerHTML = sorted.map(s => `<div class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl flex justify-between items-center text-xs">
            <div><span class="font-bold text-slate-800 dark:text-slate-100">${s.platform}</span><p class="text-[10px] text-slate-400">${s.date} • ${s.km ? s.km + ' km • ' : ''}Base: S/${(s.base || 0).toFixed(2)}${s.km > 0 ? ` • S/${(s.total / s.km).toFixed(2)}/km` : ''}</p></div>
            <div class="flex items-center space-x-2.5"><span class="font-black text-emerald-600 dark:text-emerald-400">S/ ${s.total.toFixed(2)}</span><button onclick="editDeliveryShift('${s.id}')" class="text-blue-400 hover:text-blue-600 text-xs"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="deleteDeliveryShift('${s.id}')" class="text-slate-400 hover:text-red-500 text-xs"><i class="fa-solid fa-trash-can"></i></button></div>
        </div>`).join("");
    } else {
        const groups = {};
        sorted.forEach(s => {
            const key = deliveryGroupMode === 'weekly' ? getWeekIdentifier(s.date) : getMonthIdentifier(s.date);
            if (!groups[key]) groups[key] = { total: 0, km: 0, count: 0, shifts: [] };
            groups[key].total += s.total;
            groups[key].km += (s.km || 0);
            groups[key].count += 1;
            groups[key].shifts.push(s);
        });
        listEl.innerHTML = Object.keys(groups).map(k => {
            const g = groups[k];
            return `<div class="bg-slate-900 border border-slate-800 p-3 rounded-2xl space-y-2">
                <div class="flex justify-between items-center border-b border-slate-800 pb-1.5">
                    <div><span class="font-black text-xs text-emerald-400 uppercase tracking-wider">${k}</span><p class="text-[9px] text-slate-400">${g.count} turnos • ${g.km.toFixed(1)} km totales${g.km > 0 ? ` • S/${(g.total / g.km).toFixed(2)}/km` : ''}</p></div>
                    <span class="font-black text-sm text-emerald-400">S/ ${g.total.toFixed(2)}</span>
                </div>
                <div class="space-y-1 pt-1">${g.shifts.map(s => `<div class="flex justify-between items-center bg-slate-950 p-2 rounded-xl text-xs">
                    <div><span class="font-bold text-slate-200">${s.platform}</span><span class="text-[10px] text-slate-400 ml-2">(${s.date})</span></div>
                    <div class="flex items-center space-x-2"><span class="font-bold text-emerald-400">S/ ${s.total.toFixed(2)}</span><button onclick="editDeliveryShift('${s.id}')" class="text-blue-400 text-xs"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="deleteDeliveryShift('${s.id}')" class="text-rose-400 text-xs"><i class="fa-solid fa-trash-can"></i></button></div>
                </div>`).join("")}</div>
            </div>`;
        }).join("");
    }
}

// Moto
window.openMotoSpareModal = () => document.getElementById('moto-spare-modal').classList.remove('hidden');
window.closeMotoSpareModal = () => document.getElementById('moto-spare-modal').classList.add('hidden');
window.openServiceLogModal = () => {
    document.getElementById('service-log-form').reset();
    document.getElementById('service-date').value = getLocalDateString();
    document.getElementById('service-km').value = currentMotoOdometer ?? '';
    document.getElementById('service-reset-base').checked = true;
    document.getElementById('service-log-modal').classList.remove('hidden');
};
window.closeServiceLogModal = () => document.getElementById('service-log-modal').classList.add('hidden');

window.saveMaintenanceService = async (e) => {
    e.preventDefault();
    const type = document.getElementById('service-type').value;
    const km = parseFloat(document.getElementById('service-km').value);
    const cost = parseFloat(document.getElementById('service-cost').value) || 0;
    const date = document.getElementById('service-date').value || getLocalDateString();
    const note = document.getElementById('service-note').value.trim();
    const resetBase = document.getElementById('service-reset-base').checked;
    if (isNaN(km) || km < 0) { showToast("Ingresa un kilometraje válido.", "warning"); return; }

    const labels = { oil: "Cambio de Aceite (2,500 km)", full: "Mantenimiento Integral (5,000 km)", both: "Aceite + Mantenimiento Integral" };
    const record = { type, label: labels[type] || "Servicio", km, cost, date, note, timestamp: Date.now() };
    const ref = doc(collection(db, `users/${currentUser.uid}/motoServices`));
    await setDoc(ref, record);
    motoServices.unshift({ id: ref.id, ...record });

    if (resetBase) {
        currentMotoOdometer = km;
        if (type === 'oil' || type === 'both') currentMotoKmAceite = km;
        if (type === 'full' || type === 'both') currentMotoKmAfinamiento = km;
        await saveMotoDocs();
    }
    closeServiceLogModal();
    renderMotoServicesUI();
    updateMotoKmUI();
    showToast("Servicio registrado en el historial.", "success");
};

window.deleteMaintenanceService = async (id) => {
    if (!confirm("¿Eliminar este registro del historial de servicios?")) return;
    await deleteDoc(doc(db, `users/${currentUser.uid}/motoServices/${id}`));
    motoServices = motoServices.filter(s => s.id !== id);
    renderMotoServicesUI();
    showToast("Servicio eliminado.", "info");
};

function renderMotoServicesUI() {
    const srvSum = motoServices.reduce((a, s) => a + (parseFloat(s.cost) || 0), 0);
    const sprSum = motoSpares.reduce((a, s) => a + (parseFloat(s.cost) || 0), 0);
    document.getElementById('moto-services-total').textContent = `S/ ${srvSum.toFixed(2)}`;
    document.getElementById('moto-spares-total').textContent = `S/ ${sprSum.toFixed(2)}`;
    document.getElementById('moto-summary-services').textContent = `S/ ${srvSum.toFixed(2)}`;
    document.getElementById('moto-summary-spares').textContent = `S/ ${sprSum.toFixed(2)}`;
    document.getElementById('moto-combined-total').textContent = `S/ ${(srvSum + sprSum).toFixed(2)}`;

    const listEl = document.getElementById('moto-services-list');
    const sorted = [...motoServices].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    listEl.innerHTML = sorted.length === 0
        ? `<p class="text-[11px] text-slate-400 text-center py-2">Aún no hay servicios registrados.</p>`
        : sorted.map(s => `<div class="bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl flex justify-between items-start gap-2 text-xs">
            <div class="min-w-0"><p class="font-bold text-slate-200 truncate">${s.label}</p><p class="text-[10px] text-slate-400 mt-0.5">${s.date} • <b>${Number(s.km).toLocaleString()} km</b></p>${s.note ? `<p class="text-[10px] text-slate-400 truncate mt-0.5">${s.note}</p>` : ''}</div>
            <div class="flex items-center gap-2 shrink-0">${s.cost > 0 ? `<span class="text-[10px] font-bold text-emerald-400">S/ ${Number(s.cost).toFixed(2)}</span>` : ''}<button onclick="deleteMaintenanceService('${s.id}')" class="text-slate-500 hover:text-rose-400 text-xs"><i class="fa-solid fa-trash-can"></i></button></div>
        </div>`).join("");
}

window.saveMotoKmAceite = async () => {
    const km = parseFloat(document.getElementById('moto-km-aceite-input').value.trim());
    if (isNaN(km)) return;
    currentMotoKmAceite = km;
    await saveMotoDocs();
    showToast("Km inicial de aceite guardado.", "success");
};
window.saveMotoKmAfinamiento = async () => {
    const km = parseFloat(document.getElementById('moto-km-afinamiento-input').value.trim());
    if (isNaN(km)) return;
    currentMotoKmAfinamiento = km;
    await saveMotoDocs();
    showToast("Km inicial de mantenimiento guardado.", "success");
};
window.saveMotoOdometer = async () => {
    const km = parseFloat(document.getElementById('moto-current-odometer-input').value.trim());
    if (isNaN(km)) return;
    currentMotoOdometer = km;
    await saveMotoDocs();
    showToast("Odómetro actualizado.", "success");
};

function getAlertStyle(rem, defClass) {
    if (rem <= 0 || rem <= 50) return { colorClass: "text-rose-400 font-extrabold", barClass: "bg-rose-500", tag: rem <= 0 ? " • ¡VENCIDO!" : " • ¡Urgente!" };
    if (rem <= 250) return { colorClass: "text-amber-400 font-extrabold", barClass: "bg-amber-400", tag: " • Próximo" };
    return { colorClass: defClass, barClass: null, tag: "" };
}

function updateBar(startKm, intervalKm, od, barEl, labelEl, pctEl, defBar, defPct) {
    if (startKm === null || od === null) {
        barEl.style.width = "0%";
        barEl.className = `${defBar} h-full rounded-full transition-all duration-500`;
        labelEl.textContent = startKm === null ? "Define km inicial" : "Actualiza odómetro";
        pctEl.textContent = "0%";
        pctEl.className = `font-bold ${defPct}`;
        return;
    }
    const traveled = Math.max(0, od - startKm);
    const pct = Math.min(100, Math.max(0, Math.round((traveled / intervalKm) * 100)));
    const style = getAlertStyle(intervalKm - traveled, defPct);
    barEl.style.width = `${pct}%`;
    barEl.className = `${style.barClass || defBar} h-full rounded-full transition-all duration-500`;
    labelEl.textContent = `Recorridos: ${traveled.toLocaleString()} / ${intervalKm.toLocaleString()} km`;
    pctEl.textContent = `${pct}%`;
    pctEl.className = `font-bold ${style.colorClass}`;
}

function updateMotoKmUI() {
    const statusEl = document.getElementById('moto-km-status');
    document.getElementById('moto-km-aceite-input').value = currentMotoKmAceite ?? "";
    document.getElementById('moto-km-afinamiento-input').value = currentMotoKmAfinamiento ?? "";
    document.getElementById('moto-current-odometer-input').value = currentMotoOdometer ?? "";

    const box = document.getElementById('moto-proximos-mantenimientos');
    if (currentMotoKmAceite !== null || currentMotoKmAfinamiento !== null) {
        statusEl.textContent = currentMotoOdometer !== null ? `Odómetro: ${currentMotoOdometer.toLocaleString()} km` : "Configurado";
        statusEl.className = currentMotoOdometer !== null
            ? "text-[9px] font-bold px-2 py-0.5 rounded-full inline-block bg-blue-500/20 text-blue-400 border border-blue-500/30"
            : "text-[9px] font-bold px-2 py-0.5 rounded-full inline-block bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";

        let aceiteText = "Sin definir", aceiteStyle = "font-bold text-emerald-400 text-right";
        if (currentMotoKmAceite !== null) {
            const meta = currentMotoKmAceite + 2500;
            aceiteText = `${meta.toLocaleString()} km`;
            if (currentMotoOdometer !== null) {
                const rem = meta - currentMotoOdometer;
                const info = getAlertStyle(rem, "text-emerald-400");
                aceiteStyle = `font-bold ${info.colorClass} text-right`;
                aceiteText += ` (Faltan ${Math.max(0, rem).toLocaleString()} km${info.tag})`;
            }
        }

        let afinText = "Sin definir", afinStyle = "font-bold text-amber-400 text-right";
        if (currentMotoKmAfinamiento !== null) {
            const meta = currentMotoKmAfinamiento + 5000;
            afinText = `${meta.toLocaleString()} km`;
            if (currentMotoOdometer !== null) {
                const rem = meta - currentMotoOdometer;
                const info = getAlertStyle(rem, "text-amber-400");
                afinStyle = `font-bold ${info.colorClass} text-right`;
                afinText += ` (Faltan ${Math.max(0, rem).toLocaleString()} km${info.tag})`;
            }
        }

        document.getElementById('prox-aceite').className = aceiteStyle;
        document.getElementById('prox-aceite').textContent = aceiteText;
        document.getElementById('prox-afinamiento').className = afinStyle;
        document.getElementById('prox-afinamiento').textContent = afinText;

        updateBar(currentMotoKmAceite, 2500, currentMotoOdometer, document.getElementById('progress-bar-aceite'), document.getElementById('progress-label-aceite'), document.getElementById('progress-pct-aceite'), 'bg-emerald-500', 'text-emerald-400');
        updateBar(currentMotoKmAfinamiento, 5000, currentMotoOdometer, document.getElementById('progress-bar-afinamiento'), document.getElementById('progress-label-afinamiento'), document.getElementById('progress-pct-afinamiento'), 'bg-amber-400', 'text-amber-400');
        box.classList.remove('hidden');
    } else {
        statusEl.textContent = "Sin datos";
        statusEl.className = "text-[9px] font-bold px-2 py-0.5 rounded-full inline-block bg-slate-800 text-slate-300";
        box.classList.add('hidden');
    }
}

window.uploadMotoMainPhoto = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    motoMainPhotoBase64 = await compressImageFileToDataURL(f);
    await saveMotoDocs();
    showToast("Foto de la moto guardada.", "success");
};
window.removeMotoMainPhoto = async () => {
    if (!confirm("¿Deseas eliminar la foto principal de tu moto?")) return;
    motoMainPhotoBase64 = null;
    await saveMotoDocs();
    showToast("Foto principal eliminada.", "info");
};
function updateMotoMainPhotoUI() {
    const has = Boolean(motoMainPhotoBase64);
    document.getElementById('moto-main-photo-img').src = motoMainPhotoBase64 || '';
    document.getElementById('moto-main-photo-container').classList.toggle('hidden', !has);
    document.getElementById('moto-main-photo-actions').classList.toggle('hidden', !has);
    document.getElementById('moto-main-photo-upload').classList.toggle('hidden', has);
}

window.uploadSoatPhoto = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    soatPhotoBase64 = await compressImageFileToDataURL(f);
    await saveMotoDocs();
    showToast("Foto del SOAT guardada.", "success");
};
window.removeSoatPhoto = async () => {
    if (!confirm("¿Deseas eliminar la foto del SOAT?")) return;
    soatPhotoBase64 = null;
    await saveMotoDocs();
    showToast("Foto del SOAT eliminada.", "info");
};

window.uploadTarjetaPdf = (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = async (e) => { tarjetaPdfBase64 = e.target.result; await saveMotoDocs(); showToast("Tarjeta de Propiedad (PDF) guardada.", "success"); };
    reader.readAsDataURL(f);
};
window.removeTarjetaPdf = async () => {
    if (!confirm("¿Deseas eliminar la tarjeta de propiedad?")) return;
    tarjetaPdfBase64 = null;
    await saveMotoDocs();
    showToast("Tarjeta de propiedad eliminada.", "info");
};

window.uploadVehiculoPhoto = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    vehiculoPhotoBase64 = await compressImageFileToDataURL(f);
    await saveMotoDocs();
    showToast("Foto del vehículo guardada.", "success");
};
window.removeVehiculoPhoto = async () => {
    if (!confirm("¿Deseas eliminar la foto de datos del vehículo?")) return;
    vehiculoPhotoBase64 = null;
    await saveMotoDocs();
    showToast("Foto eliminada.", "info");
};

window.saveMotoSpare = async (e) => {
    e.preventDefault();
    const data = {
        name: document.getElementById('spare-name').value.trim(),
        cost: parseFloat(document.getElementById('spare-cost').value),
        date: document.getElementById('spare-date').value,
        timestamp: Date.now(), photo: null
    };
    const ref = doc(collection(db, `users/${currentUser.uid}/motoSpares`));
    await setDoc(ref, data);
    motoSpares.unshift({ id: ref.id, ...data });
    document.getElementById('moto-spare-form').reset();
    document.getElementById('spare-date').value = getLocalDateString();
    closeMotoSpareModal();
    renderMotoUI();
    showToast("Repuesto registrado.", "success");
};

window.deleteMotoSpare = async (id) => {
    if (!confirm("¿Eliminar este registro de repuesto?")) return;
    await deleteDoc(doc(db, `users/${currentUser.uid}/motoSpares/${id}`));
    motoSpares = motoSpares.filter(s => s.id !== id);
    renderMotoUI();
    renderGallery();
    showToast("Repuesto eliminado.", "info");
};

window.saveMotoDocs = async () => {
    const soatDate = document.getElementById('moto-soat-date').value;
    try {
        await setDoc(doc(db, `users_config/${currentUser.uid}`), {
            motoDocs: { soatDate, kmAceite: currentMotoKmAceite, kmAfinamiento: currentMotoKmAfinamiento, odometer: currentMotoOdometer, soatPhoto: soatPhotoBase64, tarjetaPdf: tarjetaPdfBase64, vehiculoPhoto: vehiculoPhotoBase64, motoMainPhoto: motoMainPhotoBase64 }
        }, { merge: true });
        checkMotoDocAlerts(soatDate);
        updateMotoDocsUI();
        updateMotoMainPhotoUI();
        updateMotoKmUI();
    } catch (err) { console.error("Error al guardar en Firebase:", err); }
};

function updateMotoDocsUI() {
    document.getElementById('tarjeta-pdf-status').innerHTML = tarjetaPdfBase64
        ? `<a href="${tarjetaPdfBase64}" target="_blank" class="text-emerald-400 font-bold hover:underline"><i class="fa-solid fa-eye mr-0.5"></i> Ver</a> <button onclick="removeTarjetaPdf()" class="text-rose-400 font-bold hover:underline ml-1"><i class="fa-solid fa-trash-can"></i></button>`
        : "Sin archivo";
    document.getElementById('vehiculo-photo-status').innerHTML = vehiculoPhotoBase64
        ? `<button onclick="openImageModal('${vehiculoPhotoBase64}')" class="text-emerald-400 font-bold hover:underline"><i class="fa-solid fa-eye mr-0.5"></i> Ver</button> <button onclick="removeVehiculoPhoto()" class="text-rose-400 font-bold hover:underline ml-1"><i class="fa-solid fa-trash-can"></i></button>`
        : "Sin foto";
}

function checkMotoDocAlerts(soatDate) {
    const viewBtn = document.getElementById('soat-view-btn');
    if (soatPhotoBase64) {
        viewBtn.innerHTML = `<button onclick="openImageModal('${soatPhotoBase64}')" class="text-[9px] text-emerald-400 font-bold hover:underline"><i class="fa-solid fa-eye mr-0.5"></i> Ver</button> <button onclick="removeSoatPhoto()" class="text-[9px] text-rose-400 font-bold hover:underline ml-1"><i class="fa-solid fa-trash-can"></i></button>`;
        viewBtn.classList.remove('hidden');
    } else {
        viewBtn.innerHTML = '';
        viewBtn.classList.add('hidden');
    }

    const badge = document.getElementById('soat-status-badge');
    if (!soatDate) { badge.className = "text-[9px] font-bold px-2 py-0.5 rounded-full inline-block bg-slate-800 text-slate-400"; badge.textContent = "Sin registrar"; return; }
    const diffDays = Math.ceil((new Date(soatDate) - new Date()) / 86400000);
    if (diffDays < 0) { badge.className = "text-[9px] font-bold px-2 py-0.5 rounded-full inline-block bg-red-500/20 text-red-400 border border-red-500/30"; badge.textContent = "¡SOAT Vencido!"; }
    else if (diffDays <= 15) { badge.className = "text-[9px] font-bold px-2 py-0.5 rounded-full inline-block bg-amber-500/20 text-amber-400 border border-amber-500/30"; badge.textContent = `Vence en ${diffDays} días`; }
    else { badge.className = "text-[9px] font-bold px-2 py-0.5 rounded-full inline-block bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"; badge.textContent = "Vigente"; }
}

function renderMotoUI() {
    renderMotoServicesUI();
    const sorted = [...motoSpares].sort((a, b) => (b.timestamp || new Date(b.date).getTime()) - (a.timestamp || new Date(a.date).getTime()));
    document.getElementById('moto-spares-list').innerHTML = sorted.length === 0
        ? `<p class="text-[11px] text-slate-400 text-center py-3">No hay repuestos registrados todavía.</p>`
        : sorted.map(s => `<div class="flex justify-between items-center bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl text-xs">
            <div class="min-w-0 pr-2"><p class="font-bold text-slate-200 truncate">${s.name}</p><p class="text-[10px] text-slate-400 mt-0.5">${s.date}</p></div>
            <div class="flex items-center space-x-2.5 shrink-0"><span class="font-extrabold text-xs text-amber-400">S/ ${s.cost.toFixed(2)}</span><button onclick="deleteMotoSpare('${s.id}')" class="text-slate-500 hover:text-rose-400 text-xs"><i class="fa-solid fa-trash-can"></i></button></div>
        </div>`).join("");
}

// Galería y comprobantes
window.clearHistorySearch = () => { document.getElementById('history-search-input').value = ''; document.getElementById('clear-search-btn').classList.add('hidden'); renderUI(); };
window.openImageModal = (url) => { document.getElementById('modal-image-view').src = url; document.getElementById('image-modal').classList.remove('hidden'); };
window.closeImageModal = () => { document.getElementById('image-modal').classList.add('hidden'); document.getElementById('modal-image-view').src = ''; };

window.removePhotoFromTx = async (id) => {
    if (!confirm("¿Deseas eliminar este comprobante/foto de la transacción?")) return;
    await updateDoc(doc(db, `users/${currentUser.uid}/transactions/${id}`), { photo: null });
    const idx = transactions.findIndex(t => t.id === id);
    if (idx !== -1) transactions[idx].photo = null;
    renderUI(); renderGallery(); showToast("Foto eliminada.", "info");
};

window.previewTxPhoto = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    currentPhotoBase64 = await compressImageFileToDataURL(f);
    document.getElementById('photo-preview-img').src = currentPhotoBase64;
    document.getElementById('photo-upload-box').classList.add('hidden');
    document.getElementById('photo-preview-container').classList.remove('hidden');
};

window.removeTxPhoto = () => {
    currentPhotoBase64 = null;
    document.getElementById('tx-photo-file').value = '';
    document.getElementById('photo-preview-img').src = '';
    document.getElementById('photo-preview-container').classList.add('hidden');
    document.getElementById('photo-upload-box').classList.remove('hidden');
};

function renderGallery() {
    const all = [
        ...transactions.filter(t => t.photo).map(t => ({ title: t.description, date: t.date, amount: t.amount, photo: t.photo, del: `removePhotoFromTx('${t.id}')` })),
        ...motoSpares.filter(s => s.photo).map(s => ({ title: `[Moto] ${s.name}`, date: s.date, amount: s.cost, photo: s.photo, del: `deleteMotoSpare('${s.id}')` })),
        ...(motoMainPhotoBase64 ? [{ title: '[Mi Motocicleta]', date: '2026', amount: 0, photo: motoMainPhotoBase64, del: `removeMotoMainPhoto()` }] : []),
        ...(soatPhotoBase64 ? [{ title: '[SOAT Vigente]', date: '2026', amount: 0, photo: soatPhotoBase64, del: `removeSoatPhoto()` }] : []),
        ...(vehiculoPhotoBase64 ? [{ title: '[Datos del Vehículo]', date: '2026', amount: 0, photo: vehiculoPhotoBase64, del: `removeVehiculoPhoto()` }] : [])
    ];
    document.getElementById('gallery-count').textContent = `${all.length} fotos`;
    document.getElementById('gallery-grid').innerHTML = all.length === 0
        ? `<p class="col-span-2 text-xs text-slate-400 text-center py-6">No hay comprobantes guardados todavía.</p>`
        : all.map(item => `<div class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 flex flex-col justify-between space-y-2 transition-colors duration-300">
            <div class="w-full h-32 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-950 relative cursor-pointer group" onclick="openImageModal('${item.photo}')">
                <img src="${item.photo}" alt="Comprobante" class="w-full h-full object-cover group-hover:scale-105 transition">
                <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold"><i class="fa-solid fa-expand mr-1"></i> Ver</div>
            </div>
            <div class="space-y-0.5"><p class="font-bold text-slate-800 dark:text-slate-100 text-xs truncate">${item.title}</p><p class="text-[10px] text-slate-400">${(item.date || '').split('T')[0]} ${item.amount ? '• S/ ' + item.amount.toFixed(2) : ''}</p></div>
            <button onclick="${item.del}" class="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 py-1.5 rounded-xl text-[10px] font-bold transition flex items-center justify-center"><i class="fa-solid fa-trash-can mr-1"></i> Eliminar Foto</button>
        </div>`).join("");
}

// Calculadora segura
let calcInput = "0", calcHistoryStr = "";
function safeMathEvaluate(expr) {
    const norm = String(expr).replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
    if (!/^[0-9+\-*/.%]+$/.test(norm)) throw new Error("Inválido");
    const tokens = [];
    let i = 0;
    while (i < norm.length) {
        const ch = norm[i];
        if (/[0-9.]/.test(ch)) {
            let s = '', dots = 0;
            while (i < norm.length && /[0-9.]/.test(norm[i])) { if (norm[i] === '.') dots++; if (dots > 1) throw new Error("Decimal"); s += norm[i++]; }
            let val = parseFloat(s);
            if (isNaN(val)) throw new Error("Num");
            if (norm[i] === '%') { val /= 100; i++; }
            tokens.push({ type: 'num', value: val });
        } else if ('+-*/'.includes(ch)) {
            const prev = tokens[tokens.length - 1];
            if (!prev || prev.type === 'op') {
                if (ch === '+') { i++; continue; }
                if (ch === '-') { tokens.push({ type: 'num', value: -1 }, { type: 'op', value: '*' }); i++; continue; }
                throw new Error("Op");
            }
            tokens.push({ type: 'op', value: ch }); i++;
        } else if (ch === '%') {
            const prev = tokens[tokens.length - 1];
            if (!prev || prev.type !== 'num') throw new Error("Pct");
            prev.value /= 100; i++;
        }
    }
    if (!tokens.length || tokens[tokens.length - 1].type === 'op') throw new Error("Incompleto");
    const md = [];
    for (let k = 0; k < tokens.length; k++) {
        const t = tokens[k];
        if (t.type === 'op' && (t.value === '*' || t.value === '/')) {
            const left = md.pop(), right = tokens[++k];
            if (!left || !right || right.type !== 'num') throw new Error("Op");
            const res = t.value === '*' ? left.value * right.value : (right.value === 0 ? NaN : left.value / right.value);
            if (!Number.isFinite(res)) throw new Error("Div");
            md.push({ type: 'num', value: res });
        } else md.push(t);
    }
    let total = md[0].value;
    for (let k = 1; k < md.length; k += 2) total = md[k].value === '+' ? total + md[k + 1].value : total - md[k + 1].value;
    if (!Number.isFinite(total)) throw new Error("Fin");
    return total;
}

window.toggleCalcModal = () => document.getElementById('calc-modal').classList.toggle('hidden');
window.calcClear = () => { calcInput = "0"; calcHistoryStr = ""; updateCalcDisplay(); };
window.calcBackSpace = () => { calcInput = calcInput.length > 1 ? calcInput.slice(0, -1) : "0"; updateCalcDisplay(); };
window.calcAppend = (v) => { if (calcInput === "Error") calcInput = "0"; calcInput = (calcInput === "0" && !isNaN(v)) ? v : calcInput + v; updateCalcDisplay(); };
window.calcEvaluate = () => {
    try { calcHistoryStr = calcInput; calcInput = Number(safeMathEvaluate(calcInput).toFixed(2)).toString(); }
    catch (e) { calcInput = "Error"; }
    updateCalcDisplay();
};
function updateCalcDisplay() { document.getElementById('calc-display').textContent = calcInput; document.getElementById('calc-history').textContent = calcHistoryStr; }
window.sendCalcToForm = () => {
    let v = 0;
    try { v = safeMathEvaluate(calcInput); } catch (e) { v = parseFloat(calcInput) || 0; }
    document.getElementById('tx-amount').value = (Number.isFinite(v) ? v : 0).toFixed(2);
    toggleCalcModal(); switchTab('add'); showToast(`Monto enviado: S/ ${(Number.isFinite(v) ? v : 0).toFixed(2)}`, 'info');
};

// =====================================================================
// 9. CONFIGURACIÓN, EXPORTAR/IMPORTAR Y ASISTENTE POR VOZ
// =====================================================================
window.toggleVoiceHelp = () => document.getElementById('voice-help-box').classList.toggle('hidden');
window.toggleSettingsModal = () => { renderCategoriesManagement(); renderPlatformsManagement(); document.getElementById('settings-modal').classList.toggle('hidden'); };

function renderCategories() {
    document.getElementById('tx-category').innerHTML = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}
function renderPlatformsManagement() {
    const el = document.getElementById('platforms-management-list');
    if (el) el.innerHTML = deliveryPlatforms.map(p => `<div class="flex justify-between items-center bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border dark:border-slate-700 text-xs"><span class="font-semibold text-slate-700 dark:text-slate-200">${p}</span><span class="text-[10px] text-emerald-500 font-bold">Activa</span></div>`).join('');
}
function renderCategoriesManagement() {
    document.getElementById('categories-management-list').innerHTML = categories.map((c, idx) => `<div class="flex flex-col gap-1.5 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border dark:border-slate-700 text-xs">
        <div class="flex justify-between items-center"><div class="flex items-center space-x-2"><input type="color" value="${c.color}" onchange="updateCategoryColor(${idx}, this.value)" class="w-5 h-5 p-0 border-0 rounded cursor-pointer bg-transparent"><span class="font-semibold text-slate-700 dark:text-slate-200">${c.name}</span></div><button type="button" onclick="deleteCategory(${idx})" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash-can"></i></button></div>
        <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60"><span class="text-[10px] text-slate-400 font-semibold">Límite mensual (S/):</span><input type="number" min="0" step="10" value="${c.budget || 0}" onchange="updateCategoryBudget(${idx}, this.value)" class="w-24 px-2 py-1 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 dark:text-white rounded text-[11px] font-bold text-right outline-none"></div>
    </div>`).join('');
}
window.updateCategoryBudget = (idx, val) => { const p = parseFloat(val); categories[idx].budget = isNaN(p) || p < 0 ? 0 : p; };
window.updateCategoryColor = (idx, col) => { categories[idx].color = col; renderCategoriesManagement(); };
window.addCategory = () => {
    const nameInput = document.getElementById('new-category-name');
    const name = nameInput.value.trim();
    if (!name) return;
    if (!categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        categories.push({ name, color: document.getElementById('new-category-color').value, budget: 0 });
        renderCategoriesManagement(); nameInput.value = '';
    } else showToast("Esa categoría ya existe.", "warning");
};
window.deleteCategory = (idx) => {
    if (categories.length <= 1) { showToast("Debe haber al menos una categoría.", "warning"); return; }
    if (confirm(`¿Eliminar categoría "${categories[idx].name}"?`)) { categories.splice(idx, 1); renderCategoriesManagement(); }
};
window.saveSettings = async () => {
    const appName = document.getElementById('setting-app-name').value.trim() || "Mis Finanzas";
    try {
        await setDoc(doc(db, `users_config/${currentUser.uid}`), { appName, categories }, { merge: true });
        document.getElementById('app-brand-name').textContent = appName;
        renderCategories(); renderUI(); toggleSettingsModal();
        showToast("Configuración guardada.", "success");
    } catch (e) { showToast("Error al guardar configuración.", "error"); }
};

window.exportCSV = () => {
    if (!transactions.length) { showToast("No hay movimientos para exportar.", "warning"); return; }
    const rows = [["Fecha", "Tipo", "Categoria", "Descripcion", "Monto (S/)"], ...transactions.map(t => [(t.date || '').split('T')[0], t.type === 'income' ? 'Ingreso' : 'Gasto', `"${(t.category || '').replace(/"/g, '""')}"`, `"${(t.description || '').replace(/"/g, '""')}"`, Number(t.amount || 0).toFixed(2)])];
    const blob = new Blob(["\uFEFF" + rows.map(r => r.join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `MisFinanzas_${getLocalDateString()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast("Archivo CSV descargado.", "success");
};

window.exportJSON = () => {
    const blob = new Blob([JSON.stringify({ app: "Mis Finanzas - 3ldiosfenix", exportDate: new Date().toISOString(), appName: document.getElementById('app-brand-name').textContent, categories, transactions, savingsGoals, motoSpares, motoServices, tasksList, deliveryShifts }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `MisFinanzas_Respaldo_${getLocalDateString()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast("Respaldo JSON descargado.", "success");
};

window.importJSON = (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data.transactions)) { showToast("Archivo de respaldo inválido.", "error"); return; }
            if (!confirm(`¿Importar ${data.transactions.length} movimientos y datos desde este respaldo?`)) return;
            for (const tx of data.transactions) {
                const { id, ...cleanTx } = tx;
                const ref = doc(collection(db, `users/${currentUser.uid}/transactions`));
                await setDoc(ref, { ...cleanTx, timestamp: cleanTx.timestamp || Date.now() });
                transactions.unshift({ id: ref.id, ...cleanTx });
            }
            if (Array.isArray(data.categories) && data.categories.length > 0) {
                categories = data.categories;
                await setDoc(doc(db, `users_config/${currentUser.uid}`), { categories }, { merge: true });
            }
            renderCategories(); renderUI(); renderGallery();
            showToast("Respaldo importado con éxito.", "success");
        } catch (err) { showToast("Error al leer el archivo JSON.", "error"); }
    };
    reader.readAsText(file); event.target.value = "";
};

window.startMasterVoiceAssistant = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast("Tu navegador no soporta reconocimiento de voz.", "warning"); return; }
    const rec = new SR();
    rec.lang = 'es-PE';
    const subtext = document.getElementById('voice-subtext');
    const icon = document.getElementById('voice-mic-icon');
    subtext.textContent = "Escuchando...";
    icon.classList.add('animate-pulse');

    rec.onresult = async (ev) => {
        const transcript = ev.results[0][0].transcript;
        const text = transcript.toLowerCase();
        subtext.textContent = `"${transcript}"`;
        const numMatch = text.match(/(\d+(?:[.,]\d+)?)/);
        const amount = numMatch ? parseFloat(numMatch[1].replace(',', '.')) : 0;

        if (text.includes("crear categoría") || text.includes("nueva categoría")) {
            const catName = transcript.split(/categor[íi]a/i)[1]?.trim();
            if (catName && !categories.some(c => c.name.toLowerCase() === catName.toLowerCase())) {
                categories.push({ name: catName, color: '#8B5CF6', budget: 0 });
                await setDoc(doc(db, `users_config/${currentUser.uid}`), { categories }, { merge: true });
                renderCategories();
                showToast(`Categoría "${catName}" creada.`, "success");
            }
        } else if (amount > 0) {
            const type = text.includes("ingreso") || text.includes("gané") ? 'income' : 'expense';
            let matchedCat = categories.find(c => text.includes(c.name.toLowerCase()));
            if (!matchedCat) matchedCat = categories.find(c => c.name.toLowerCase().includes(type === 'income' ? 'ingreso' : 'otro')) || categories[0];
            const txData = { description: transcript, amount, type, category: matchedCat.name, date: getLocalDateString(), timestamp: Date.now(), photo: null };
            const ref = doc(collection(db, `users/${currentUser.uid}/transactions`));
            await setDoc(ref, txData);
            transactions.unshift({ id: ref.id, ...txData });
            renderUI();
            showToast(`Guardado: ${type === 'income' ? '+' : '-'} S/ ${amount.toFixed(2)} en ${matchedCat.name}`, "success");
        } else {
            showToast("No detecté un monto claro. Intenta de nuevo.", "warning");
        }
        setTimeout(() => { subtext.textContent = "Toca el micro y habla"; icon.classList.remove('animate-pulse'); }, 2500);
    };
    rec.onerror = () => { subtext.textContent = "Toca el micro y habla"; icon.classList.remove('animate-pulse'); };
    rec.start();
};
