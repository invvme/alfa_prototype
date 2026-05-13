// ========== ДАННЫЕ КАТЕГОРИЙ ==========
const CATEGORIES_CONFIG = [
    { id: 1, name: 'ЖКХ, бытовые траты', colorVar: '--limitscolor1' },
    { id: 2, name: 'Кафе и рестораны', colorVar: '--limitscolor2' },
    { id: 3, name: 'Развлечения', colorVar: '--limitscolor3' },
    { id: 4, name: 'Одежда и обувь', colorVar: '--limitscolor4' },
    { id: 5, name: 'Питомцы', colorVar: '--limitscolor5' },
    { id: 6, name: 'Супермаркеты', colorVar: '--limitscolor6' },
    { id: 7, name: 'Здоровье', colorVar: '--limitscolor7' },
    { id: 8, name: 'Бизнес-траты', colorVar: '--limitscolor8' },
    { id: 9, name: 'Транспорт', colorVar: '--limitscolor9' },
    { id: 0, name: 'Другое', colorVar: '--limitscolor0' }
];


const CATEGORY_ICONS = {
    1: "🏠", // ЖКХ
    2: "🍽️", // кафе
    3: "🎮", // развлечения
    4: "👕", // одежда
    5: "🐶", // питомцы
    6: "🛒", // супермаркеты
    7: "🩺", // здоровье
    8: "💼", // бизнес
    9: "🚗", // транспорт
    0: "📦"  // другое
};



// ===================== ХРАНИЛИЩЕ: СОБЫТИЯ =====================
function getEvents() {
    const raw = localStorage.getItem('events');
    return raw ? JSON.parse(raw) : [];
}
function saveEvents(events) {
    localStorage.setItem('events', JSON.stringify(events));
}

function getFinanceData() {
    const raw = localStorage.getItem('finance');
    if (raw) return JSON.parse(raw);
    const def = {
        goalName: 'Подушка безопасности',
        goalTarget: 100000,
        saved: 25000,
        spent: 18700,
        monthlyProgress: 5.2,
        targetDate: '10 января 2027г',
        totalIncome: 320.50,
        interestRate: 13.5
    };
    localStorage.setItem('finance', JSON.stringify(def));
    return def;
}
function saveFinance(data) {
    localStorage.setItem('finance', JSON.stringify(data));
}

function getNextDate(event) {
    const today = new Date();
    today.setHours(0,0,0,0);
    if (event.type === 'one-time') {
        return new Date(event.date);
    } else {
        let current = new Date(event.startDate);
        if (isNaN(current)) return new Date('2999-12-31');
        const interval = parseInt(event.intervalValue) || 1;
        const unit = event.intervalUnit;
        while (current < today) {
            if (unit === 'days') current.setDate(current.getDate() + interval);
            else if (unit === 'weeks') current.setDate(current.getDate() + interval * 7);
            else if (unit === 'months') current.setMonth(current.getMonth() + interval);
        }
        return current;
    }
}

function formatShortDate(date) {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
}








// ========== ХРАНИЛИЩЕ ==========
function getLimitsData() {
    const raw = localStorage.getItem('limits');
    if (raw) return JSON.parse(raw);
    // По умолчанию только "Другое" имеет лимит
    const defaultData = {
        categories: [
            { id: 0, limit: 70000, spent: 0 },
            // остальные без лимита
        ]
    };
    saveLimitsData(defaultData);
    return defaultData;
}


function saveLimitsData(data) {
    localStorage.setItem('limits', JSON.stringify(data));
}

function getCategoryById(id) {
    return CATEGORIES_CONFIG.find(c => c.id === id);
}



function getCategoryColor(id) {
    const cat = getCategoryById(id);
    if (!cat) return '#b0b0b0';
    return getComputedStyle(document.documentElement).getPropertyValue(cat.colorVar).trim();
}




// Сделать цвет светлее на заданный процент (для штриховки)
function lightenColor(hex, percent) {
    if (!hex || hex[0] !== '#') return '#ffffff';
    let R, G, B;
    if (hex.length === 4) {
        R = parseInt(hex[1] + hex[1], 16);
        G = parseInt(hex[2] + hex[2], 16);
        B = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        R = parseInt(hex.substr(1,2), 16);
        G = parseInt(hex.substr(3,2), 16);
        B = parseInt(hex.substr(5,2), 16);
    } else {
        return hex;
    }
    R = Math.min(255, Math.round(R + (255 - R) * percent / 100));
    G = Math.min(255, Math.round(G + (255 - G) * percent / 100));
    B = Math.min(255, Math.round(B + (255 - B) * percent / 100));
    return '#' + [R,G,B].map(v => v.toString(16).padStart(2,'0')).join('');
}








// ========== ОТРИСОВКА КОЛЕСА ==========
function drawWheel() {
    const data = getLimitsData();
    const categories = data.categories.filter(c => c.limit > 0); // только с лимитом
    if (categories.length === 0) {
        // пустое колесо? Показываем заглушку
        document.getElementById('wheel_svg').innerHTML = `
            <circle cx="144" cy="144" r="120" fill="none" stroke="var(--light-gray)" stroke-width="30" />
        `;
        document.getElementById('wheel_categories').innerHTML = '<span style="color: var(--gray);">Нет категорий</span>';
        return;
    }

    const totalLimit = categories.reduce((sum, c) => sum + c.limit, 0);
    let cumulativeAngle = 0; // начинаем с -90° (верхняя точка)
    const radius = 120;
    const strokeWidth = 30;
    const center = 144;
    const circumference = 2 * Math.PI * radius;

    // Собираем строки для SVG
    let defsHtml = '';
    let circlesHtml = '';
    let categoriesCounter = 0;

    categories.forEach(cat => {
        const catConfig = getCategoryById(cat.id);
        if (!catConfig) return;
        const color = getCategoryColor(cat.id);
        const lighterColor = lightenColor(color, 40); // светлее на 40%

        const limitFraction = cat.limit / totalLimit;
        const spent = cat.spent || 0;
        const remainingLimit = Math.max(0, cat.limit - spent);
        const spentFraction = spent / totalLimit; // доля потраченного от всего круга

        // Углы для сегмента лимита (remaining)
        const limitAngle = remainingLimit / totalLimit * 360;
        // Углы для потраченной части
        const spentAngle = spentFraction * 360;

        // Если есть потраченное, рисуем два сегмента подряд: remaining, затем spent
        // remaining
        if (remainingLimit > 0) {
            const dashArray = (remainingLimit / totalLimit) * circumference;
            const dashOffset = -cumulativeAngle * (circumference / 360);
            circlesHtml += `
                <circle cx="${center}" cy="${center}" r="${radius}"
                    fill="none"
                    stroke="${color}"
                    stroke-width="${strokeWidth}"
                    stroke-dasharray="${dashArray} ${circumference}"
                    stroke-dashoffset="${dashOffset}"
                    transform="rotate(-90, ${center}, ${center})"
                    opacity="0.85"
                />`;
            cumulativeAngle += limitAngle;
        }

    });

    document.getElementById('wheel_svg').innerHTML = `<defs>${defsHtml}</defs>${circlesHtml}`;

    // Заполняем центр
    // Заполняем центр
    const centerDiv = document.getElementById('wheel_categories');
    let centerHtml = '';

    categories.forEach(cat => {
        const catConfig = getCategoryById(cat.id);
        const color = getCategoryColor(cat.id);

        centerHtml += `
            <div class="flex items-center gap-1 min-w-0">
                <div 
                    class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style="background-color: ${color};">
                </div>

                <span 
                    class="text-[10px] leading-tight font-medium truncate"
                    style="color: var(--dark);">
                    ${catConfig.name}
                </span>
            </div>
        `;
    });

    centerDiv.innerHTML = `
        <div class="grid grid-cols-2 gap-x-2 gap-y-2 w-full">
            ${centerHtml}
        </div>
    `;
}









// ========== ОТРИСОВКА СПИСКА ЛИМИТОВ ==========
function renderLimitsList() {
    const data = getLimitsData();
    const container = document.getElementById('limits_list');
    // Показываем все категории, у которых лимит >0
    const activeCategories = data.categories.filter(c => c.limit > 0);
    if (activeCategories.length === 0) {
        container.innerHTML = '<p class="text-sm py-4" style="color: var(--gray);">Нет установленных лимитов. Нажмите «+ категория» чтобы добавить.</p>';
        return;
    }

    container.innerHTML = activeCategories.map(cat => {
        const catConfig = getCategoryById(cat.id);
        if (!catConfig) return '';
        const color = getCategoryColor(cat.id);
        const remaining = Math.max(0, cat.limit - (cat.spent || 0));
        return `
            <div class="limit-item" data-id="${cat.id}">
                <div class="limit-item__info">
                    <div class="limit-item__dot" style="background-color: ${color};"></div>
                    <span class="limit-item__name">${catConfig.name}</span>
                </div>
                <span class="limit-item__rest">${remaining.toLocaleString()} ₽</span>
            </div>
        `;
    }).join('');

}




// ========== МОДАЛЬНОЕ ОКНО ЛИМИТА ==========
let editingCategoryId = null;

function openLimitModal(isNew, catId = null) {
    const data = getLimitsData();

    let catConfig;
    let cat;

    if (isNew) {
        const data = getLimitsData();

        const activeIds = data.categories.map(c => c.id);
        const availableCategories = CATEGORIES_CONFIG.filter(c => !activeIds.includes(c.id));

        if (availableCategories.length === 0) {
            alert('Все категории уже добавлены');
            return;
        }

        window._availableCategories = availableCategories;
        openCategorySelectModal();

        return;
    }
    else {
        // ===== РЕДАКТИРОВАНИЕ =====
        cat = data.categories.find(c => c.id === catId);
        if (!cat) return;

        catConfig = getCategoryById(catId);
        if (!catConfig) return;

        editingCategoryId = catId;

        document.getElementById('limit_category_name').textContent = catConfig.name;
        document.getElementById('limit_value').value = cat.limit;

        document.getElementById('delete_limit_btn').classList.remove('hidden');
    }

    document.getElementById('limit_modal').classList.remove('hidden');
}

function closeLimitModal() {
    document.getElementById('limit_modal').classList.add('hidden');
    editingCategoryId = null;
}

function saveLimitChanges() {
    const newLimit = parseFloat(document.getElementById('limit_value').value);
    if (isNaN(newLimit) || newLimit < 0) {
        alert('Введите корректный лимит');
        return;
    }
    let data = getLimitsData();
    let cat = data.categories.find(c => c.id === editingCategoryId);
    if (!cat) {
        // создаём запись, если не было
        cat = { id: editingCategoryId, limit: newLimit, spent: 0 };
        data.categories.push(cat);
    } else {
        cat.limit = newLimit;
    }
    saveLimitsData(data);
    closeLimitModal();
    renderLimitsList();
    drawWheel();
}

function deleteLimitCategory() {
    if (editingCategoryId === null) return;
    let data = getLimitsData();
    data.categories = data.categories.filter(c => c.id !== editingCategoryId);
    saveLimitsData(data);
    closeLimitModal();
    renderLimitsList();
    drawWheel();
}

// Обработчики
document.addEventListener('DOMContentLoaded', function() {
    // ... существующие обработчики (limits_button, calendar_strip и т.д.)
    // Добавляем:
    document.getElementById('add_category_btn')
        .addEventListener('click', () => openLimitModal(true));

    document.getElementById('save_limit_btn').addEventListener('click', saveLimitChanges);

    document.getElementById('delete_limit_btn').addEventListener('click', deleteLimitCategory);

    // Закрытие модалки по фону
    document.getElementById('limit_modal').addEventListener('click', function(e) {
        if (e.target === this) closeLimitModal();
    });

    // Инициализация
    drawWheel();
    renderLimitsList();
});



// Limits button click handler
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');
    
    const limitsButton = document.getElementById('limits_button');
    console.log('limits_button found:', limitsButton);

    if (limitsButton) {
        limitsButton.addEventListener('click', function() {
            switchScreen('screen-limits');
        });
    }
});

// Back button click handler
document.addEventListener('click', function(e) {
    if (e.target.closest('#back_button')) {
        switchScreen('screen-home');
    }
});


// Финансовые показатели (демо)
function getFinanceData() {
    const raw = localStorage.getItem('finance');
    if (raw) return JSON.parse(raw);
    // Значения по умолчанию
    const def = {
        goalName: 'Подушка безопасности',
        goalTarget: 100000,
        saved: 25000,
        spent: 18700,
        monthlyProgress: 5.2, // проценты
        // расчётный срок: целевая сумма / (среднемесячное накопление) … пока статично
        targetDate: '10 января 2027г'
    };
    localStorage.setItem('finance', JSON.stringify(def));
    return def;
}
function saveFinance(data) {
    localStorage.setItem('finance', JSON.stringify(data));
}

// Вычисление ближайшей даты события
function getNextDate(event) {
    const today = new Date();
    today.setHours(0,0,0,0);
    if (event.type === 'one-time') {
        const d = new Date(event.date);
        return d;
    } else {
        let current = new Date(event.startDate);
        if (isNaN(current)) return new Date('2999-12-31');
        const interval = parseInt(event.intervalValue) || 1;
        const unit = event.intervalUnit;
        while (current < today) {
            if (unit === 'days') current.setDate(current.getDate() + interval);
            else if (unit === 'weeks') current.setDate(current.getDate() + interval * 7);
            else if (unit === 'months') current.setMonth(current.getMonth() + interval);
        }
        return current;
    }
}

// Формат даты ДД.ММ
function formatShortDate(date) {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
}

// Обновление строки календаря на главном экране
function updateHomeStrip() {
    const events = getEvents();
    let nextEvent = null;
    let minDate = new Date('2999-12-31');
    events.forEach(ev => {
        const nd = getNextDate(ev);
        if (nd < minDate) {
            minDate = nd;
            nextEvent = ev;
        }
    });
    const stripDate = document.getElementById('strip_date');
    const stripName = document.getElementById('strip_name');
    const stripAmount = document.getElementById('strip_amount');
    if (nextEvent) {
        stripDate.textContent = formatShortDate(minDate);
        stripName.textContent = nextEvent.name || 'Без названия';
        stripAmount.textContent = (nextEvent.amount || 0) + '₽';
    } else {
        stripDate.textContent = '--.--';
        stripName.textContent = 'Нет событий';
        stripAmount.textContent = '0₽';
    }
}

// Заполнение финансовых блоков
function updateFinanceBlocks() {
    const f = getFinanceData();
    document.getElementById('goal_name').textContent = f.goalName;
    const percent = f.saved / f.goalTarget * 100;
    document.getElementById('goal_percent').textContent = Math.min(100, Math.round(percent)) + '%';
    document.getElementById('goal_fill').style.width = Math.min(100, percent) + '%';
    document.getElementById('spent_amount').textContent = f.spent.toLocaleString() + ' ₽';
    document.getElementById('saved_amount').textContent = f.saved.toLocaleString() + ' ₽';
    document.getElementById('monthly_progress').textContent = (f.monthlyProgress >= 0 ? '+' : '') + f.monthlyProgress.toFixed(1) + '%';
    document.getElementById('target_date').textContent = f.targetDate;
}

// Отрисовка списка событий в календаре
function renderCalendarEvents() {
    const list = document.getElementById('events_list');
    const events = getEvents();
    // Сортируем по ближайшей дате
    const withDate = events.map(ev => ({ ev, date: getNextDate(ev) }));
    withDate.sort((a,b) => a.date - b.date);
    
    list.innerHTML = '';
    if (withDate.length === 0) {
        list.innerHTML = '<p class="text-center text-sm" style="color: var(--gray);">Нет событий</p>';
        return;
    }
    withDate.forEach(item => {
        const ev = item.ev;
        const date = item.date;
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-3 rounded-xl border cursor-pointer';
        div.style.borderColor = 'var(--light-gray)';
        div.style.backgroundColor = 'white';
        div.innerHTML = `
            <div>
                <span class="text-sm font-medium" style="color: var(--dark);">${formatShortDate(date)}</span>
                <span class="ml-2 text-sm" style="color: var(--gray);">${ev.name || '—'}</span>
            </div>
            <span class="text-sm font-medium" style="color: var(--dark);">${ev.amount || 0} ₽</span>
        `;
        div.addEventListener('click', () => openEditModal(ev));
        list.appendChild(div);
    });
}

// Открытие модального окна создания
function openCreateModal() {
    document.getElementById('modal_title').textContent = 'Новый платёж';
    document.getElementById('event_name').value = '';
    document.querySelector('input[name="event_type"][value="one-time"]').checked = true;
    document.getElementById('event_date').value = '';
    document.getElementById('interval_value').value = '';
    document.getElementById('interval_unit').value = 'days';
    document.getElementById('start_date').value = '';
    document.getElementById('event_amount').value = '';
    document.getElementById('event_reminder').value = 'none';
    document.getElementById('delete_event_btn').classList.add('hidden');
    document.getElementById('save_event_btn').classList.remove('hidden');
    toggleTypeFields('one-time');
    document.getElementById('event_modal').classList.remove('hidden');
    // сохраним id редактируемого события (null при создании)
    document.getElementById('event_modal').dataset.editId = '';
}

// Открытие редактирования
function openEditModal(event) {
    document.getElementById('modal_title').textContent = 'Редактировать платёж';
    document.getElementById('event_name').value = event.name || '';
    document.querySelector(`input[name="event_type"][value="${event.type}"]`).checked = true;
    if (event.type === 'one-time') {
        document.getElementById('event_date').value = event.date || '';
    } else {
        document.getElementById('interval_value').value = event.intervalValue || '';
        document.getElementById('interval_unit').value = event.intervalUnit || 'days';
        document.getElementById('start_date').value = event.startDate || '';
    }
    document.getElementById('event_amount').value = event.amount || '';
    document.getElementById('event_reminder').value = event.reminder || 'none';
    document.getElementById('delete_event_btn').classList.remove('hidden');
    document.getElementById('save_event_btn').classList.remove('hidden');
    toggleTypeFields(event.type);
    document.getElementById('event_modal').classList.remove('hidden');
    document.getElementById('event_modal').dataset.editId = event.id;
}

// Переключение полей по типу
function toggleTypeFields(type) {
    const oneTime = document.getElementById('one_time_fields');
    const regular = document.getElementById('regular_fields');
    if (type === 'one-time') {
        oneTime.classList.remove('hidden');
        regular.classList.add('hidden');
    } else {
        oneTime.classList.add('hidden');
        regular.classList.remove('hidden');
    }
}

// Закрытие модального окна
function closeModal() {
    document.getElementById('event_modal').classList.add('hidden');
}

// Сохранение события
function saveEventFromModal() {
    const name = document.getElementById('event_name').value.trim();
    const type = document.querySelector('input[name="event_type"]:checked').value;
    const amount = parseFloat(document.getElementById('event_amount').value) || 0;
    const reminder = document.getElementById('event_reminder').value;
    const editId = document.getElementById('event_modal').dataset.editId;
    
    let event = {};
    if (type === 'one-time') {
        event.date = document.getElementById('event_date').value;
        if (!event.date) return alert('Укажите дату');
    } else {
        event.intervalValue = document.getElementById('interval_value').value;
        event.intervalUnit = document.getElementById('interval_unit').value;
        event.startDate = document.getElementById('start_date').value;
        if (!event.intervalValue || !event.startDate) return alert('Заполните периодичность и стартовую дату');
    }
    event.name = name || 'Без названия';
    event.type = type;
    event.amount = amount;
    event.reminder = reminder;
    
    let events = getEvents();
    if (editId) {
        // Редактирование
        const idx = events.findIndex(e => e.id === editId);
        if (idx >= 0) {
            event.id = editId;
            events[idx] = event;
        }
    } else {
        // Создание
        event.id = Date.now().toString();
        events.push(event);
    }
    saveEvents(events);
    closeModal();
    renderCalendarEvents();
    updateHomeStrip();
}

// Удаление события
function deleteEventFromModal() {
    const editId = document.getElementById('event_modal').dataset.editId;
    if (!editId) return;
    let events = getEvents().filter(e => e.id !== editId);
    saveEvents(events);
    closeModal();
    renderCalendarEvents();
    updateHomeStrip();
}

// Обработчики переключения типов в модалке
document.querySelectorAll('input[name="event_type"]').forEach(radio => {
    radio.addEventListener('change', function() {
        toggleTypeFields(this.value);
    });
});

// Инициализация переключения экранов (сохраняем старую функцию)
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    if (screenId === 'screen-calendar') {
        renderCalendarEvents();
    }
    if (screenId === 'screen-home') {
        updateHomeStrip();
        updateFinanceBlocks();
    }
    if (screenId === 'screen-goals') {
        updateGoalsScreen();
    }
}

// Навешиваем события после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    // Кнопка limits (существующая) – оставлена, код уже был в app.js
    const limitsButton = document.getElementById('limits_button');
    if (limitsButton) {
        limitsButton.addEventListener('click', () => switchScreen('screen-limits'));
    }
    
    // Кнопка календаря на главном экране (полоса)
    document.getElementById('calendar_strip').addEventListener('click', () => switchScreen('screen-calendar'));
    
    // Кнопка назад (back_button) – слушаем глобально, но дополним для календаря
    document.addEventListener('click', function(e) {
        if (e.target.closest('#back_button')) {
            switchScreen('screen-home');
        }
    });

    document.addEventListener('click', function(e) {
        const item = e.target.closest('.limit-item');

        if (item) {
            const id = parseInt(item.dataset.id);
            openLimitModal(false, id);
        }
    });
    
    // Кнопка "+" в календаре
    document.getElementById('add_event_btn').addEventListener('click', openCreateModal);
    
    // Кнопки модального окна
    document.getElementById('save_event_btn').addEventListener('click', saveEventFromModal);
    document.getElementById('delete_event_btn').addEventListener('click', deleteEventFromModal);
    
    // Закрытие модального окна по клику вне карточки
    document.getElementById('event_modal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
    
    // Прогресс-бар цели → экран goals
    document.getElementById('goal_progress_button').addEventListener('click', function() {
        switchScreen('screen-goals');
    });
    
    // Первичное заполнение
    updateHomeStrip();
    updateFinanceBlocks();
});



let selectedCategoryId = null;

function openCategorySelectModal() {
    const data = getLimitsData();
    const usedIds = data.categories.map(c => c.id);

    const available = CATEGORIES_CONFIG.filter(c => !usedIds.includes(c.id));

    const list = document.getElementById('category_select_list');
    list.innerHTML = '';

    selectedCategoryId = null;
    updateConfirmButton();

    if (available.length === 0) {
        list.innerHTML = `<p class="text-center text-sm text-gray-400">Все категории уже добавлены</p>`;
    }

    available.forEach(cat => {
        const el = document.createElement('div');

        el.className = `
            flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer
            text-white font-medium
        `;

        el.style.backgroundColor = getCategoryColor(cat.id);

        el.innerHTML = `
            <span class="text-lg">${CATEGORY_ICONS[cat.id] || "📁"}</span>
            <span>${cat.name}</span>
        `;

        el.addEventListener('click', () => {
            selectedCategoryId = cat.id;

            // подсветка выбора
            document.querySelectorAll('#category_select_list > div')
                .forEach(d => d.style.outline = 'none');

            el.style.outline = '2px solid black';

            updateConfirmButton();
        });

        list.appendChild(el);
    });

    document.getElementById('category_select_modal').classList.remove('hidden');
}

function updateConfirmButton() {
    const btn = document.getElementById('confirm_category_btn');
    if (!btn) return;

    const isActive = selectedCategoryId !== null;

    if (isActive) {
        btn.classList.remove('opacity-50');
        btn.disabled = false;
    } else {
        btn.classList.add('opacity-50');
        btn.disabled = true;
    }
}

function confirmCategorySelection() {
    if (!selectedCategoryId) return;

    const cat = CATEGORIES_CONFIG.find(c => c.id === selectedCategoryId);
    if (!cat) return;

    editingCategoryId = cat.id;

    document.getElementById('limit_category_name').textContent = cat.name;
    document.getElementById('limit_value').value = '';

    document.getElementById('delete_limit_btn').classList.add('hidden');

    closeCategorySelectModal();
    document.getElementById('limit_modal').classList.remove('hidden');
}

function closeCategorySelectModal() {
    document.getElementById('category_select_modal').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', function () {

    // кнопка "добавить категорию"
    document.getElementById('add_category_btn')
        .addEventListener('click', openCategorySelectModal);

    // кнопка "выбрать"
    document.getElementById('confirm_category_btn')
        .addEventListener('click', confirmCategorySelection);

    // закрытие по фону
    document.getElementById('category_select_modal')
        .addEventListener('click', function (e) {
            if (e.target === this) closeCategorySelectModal();
        });
});

function updateGoalsScreen() {
    const f = getFinanceData();
    document.getElementById('goal_title').textContent = f.goalName || 'Цель';
    document.getElementById('goal_balance').textContent = (f.saved || 0).toLocaleString() + ' ₽';
    document.getElementById('goal_total_income').textContent = 'Доход за всё время ' + (f.totalIncome || 0).toFixed(2) + ' ₽';
    const remaining = Math.max(0, (f.goalTarget || 0) - (f.saved || 0));
    document.getElementById('goal_remaining').textContent = remaining.toLocaleString() + ' ₽';
    const percent = (f.saved || 0) / (f.goalTarget || 1) * 100;
    document.getElementById('goal_progress_inner').style.width = Math.min(100, percent) + '%';
    document.getElementById('goal_interest_rate').textContent = (f.interestRate || '13.5') + '%';
    // Прогноз дохода (заглушка)
    document.getElementById('goal_predicted_income').textContent = '8,51 ₽';
    document.getElementById('goal_income_date').textContent = 'Начислим 31 мая с 20:00';
}