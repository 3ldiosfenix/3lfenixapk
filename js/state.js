// js/state.js

export const DEFAULT_CATEGORIES = [
    { name: 'Alimentación', color: '#EF4444', budget: 300 },
    { name: 'Transporte', color: '#3B82F6', budget: 200 },
    { name: 'Servicios', color: '#F59E0B', budget: 150 },
    { name: 'Ingresos', color: '#10B981', budget: 0 },
    { name: 'Deudas', color: '#8B5CF6', budget: 0 },
    { name: 'Otros', color: '#64748B', budget: 100 }
];

export const BALANCE_VIEWS = [
    { value: "week", label: "BALANCE DE ESTA SEMANA", short: "Sem. Actual" },
    { value: "week-prev-1", label: "BALANCE SEMANA ANTERIOR", short: "Sem. -1" },
    { value: "week-prev-2", label: "BALANCE HACE 2 SEMANAS", short: "Sem. -2" },
    { value: "month", label: "BALANCE DE ESTE MES", short: "Mes Actual" },
    { value: "month-prev-1", label: "BALANCE MES ANTERIOR", short: "Mes -1" },
    { value: "month-2026-10", label: "BALANCE DE OCTUBRE 2026", short: "Oct 2026" },
    { value: "month-2026-09", label: "BALANCE DE SEPTIEMBRE 2026", short: "Sep 2026" },
    { value: "all", label: "BALANCE TOTAL", short: "Todo" }
];

export const MONTHS_FULL = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function cloneDefaultCategories() {
    return DEFAULT_CATEGORIES.map(c => ({ ...c }));
}

export function getLocalDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getLocalDateTimeISO() {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function formatNowDateTime(dateISO = null) {
    if (dateISO && dateISO.includes("T")) {
        const [fecha, hora] = dateISO.split("T");
        const [anio, mes, dia] = fecha.split("-");
        return `${dia}/${mes}/${anio} ${hora.slice(0, 5)}`;
    }
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function formatShortDateES(dateObj) {
    const day = dateObj.getDate();
    return `${day} ${MONTHS_SHORT[dateObj.getMonth()]}`;
}

function getStartOfCurrentWeek(referenceDate = new Date()) {
    const now = new Date(referenceDate);
    const currentDay = now.getDay();
    const diffToMonday = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
}

export function getPeriodDateRangeText(filterValue, referenceDate = new Date()) {
    const now = new Date(referenceDate);
    const startOfCurrentWeek = getStartOfCurrentWeek(now);

    if (filterValue === 'week' || filterValue === 'week-prev-1' || filterValue === 'week-prev-2') {
        const weeksBack = filterValue === 'week' ? 0 : (filterValue === 'week-prev-1' ? 1 : 2);
        const startWeek = new Date(startOfCurrentWeek);
        startWeek.setDate(startOfCurrentWeek.getDate() - (7 * weeksBack));

        const endWeek = new Date(startWeek);
        endWeek.setDate(startWeek.getDate() + 6);

        const sameYear = startWeek.getFullYear() === endWeek.getFullYear();
        const startLabel = formatShortDateES(startWeek);
        const endLabel = formatShortDateES(endWeek);
        return sameYear
            ? `${startLabel} – ${endLabel} ${endWeek.getFullYear()}`
            : `${startLabel} ${startWeek.getFullYear()} – ${endLabel} ${endWeek.getFullYear()}`;
    }

    if (filterValue === 'month') {
        return `${MONTHS_FULL[now.getMonth()]} ${now.getFullYear()}`;
    }

    if (filterValue === 'month-prev-1') {
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return `${MONTHS_FULL[prevMonth.getMonth()]} ${prevMonth.getFullYear()}`;
    }

    if (filterValue.startsWith('month-')) {
        const [, yearStr, monthStr] = filterValue.split('-');
        const mIdx = parseInt(monthStr, 10) - 1;
        return `${MONTHS_FULL[mIdx]} ${yearStr}`;
    }

    return "Todo el registro guardado";
}

export function matchesTimeFilter(txDateStr, filterValue, currentDate = new Date()) {
    if (!txDateStr) return false;
    const parts = txDateStr.split('T')[0].split('-');
    if (parts.length !== 3) return false;

    const txDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const txYear = txDate.getFullYear();
    const txMonth = txDate.getMonth();

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
        startPrev.setDate(startOfCurrentWeek.getDate() - (7 * weeksBack));
        const endPrev = new Date(startPrev);
        endPrev.setDate(startPrev.getDate() + 6);
        endPrev.setHours(23, 59, 59, 999);
        return txDate >= startPrev && txDate <= endPrev;
    }

    if (filterValue === 'month') {
        return txYear === now.getFullYear() && txMonth === now.getMonth();
    }

    if (filterValue === 'month-prev-1') {
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return txYear === prevMonthDate.getFullYear() && txMonth === prevMonthDate.getMonth();
    }

    if (filterValue.startsWith('month-')) {
        const [, targetYear, targetMonth] = filterValue.split('-');
        return txYear === parseInt(targetYear, 10) && txMonth === (parseInt(targetMonth, 10) - 1);
    }

    return true;
}

export function getWeekIdentifier(dateStr) {
    if (!dateStr) return 'Desconocido';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const year = d.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (d - firstDayOfYear) / 86400000;
    const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `Semana ${weekNum} (${year})`;
}

export function getMonthIdentifier(dateStr) {
    if (!dateStr) return 'Desconocido';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length !== 3) return dateStr;
    const monthName = MONTHS_FULL[parseInt(parts[1], 10) - 1];
    return `${monthName} ${parts[0]}`;
}

export function getContrastTextColor(hexColor) {
    if (!hexColor) return '#FFFFFF';
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(char => char + char).join('');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return (((r * 299) + (g * 587) + (b * 114)) / 1000 >= 150) ? '#1E293B' : '#FFFFFF';
}
