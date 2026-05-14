// ========== ЕДИНАЯ БАЗА ДАННЫХ ==========
const DEFAULT_USER_DATA = {
  setupCompleted: false,
  communicationStyle: 'friendly', // friendly | business | motivational | toxic
  personalBalance: 100000,
  totalSpent: 0,
  monthlySpent: 0,
  monthlyProgress: 0,
  prevGoalPercent: 0, // для расчёта прогресса за месяц
  goal: {
    name: 'Подушка безопасности',
    target: 100000,
    saved: 0,
    deadline: '2027-01-10',
    totalIncome: 320.5,
    interestRate: 13.5
  },
  categoriesLimits: [
    // id:0 теперь "Потрачено" – скрытая категория, лимит не задаётся
    { id: 0, limit: 0, spent: 0 }
  ],
  autoTopUp: {
    enabled: false,
    type: 'none',
    percent: 10,
    maxAmount: 5000
  },
  events: [],
  notifications: [],
  challenges: {
    friendName: 'Друг',
    yourProgress: 0,
    friendProgress: 0,
    jointGoal: { target: 100000, saved: 0 }
  },
  lastMonthReset: new Date().toISOString()
};

function loadUserData() {
  const raw = localStorage.getItem('userData');
  if (raw) {
    try { return JSON.parse(raw); }
    catch (e) { return { ...DEFAULT_USER_DATA }; }
  }
  return { ...DEFAULT_USER_DATA };
}

function saveUserData(data) {
  localStorage.setItem('userData', JSON.stringify(data));
}

// ========== КОНФИГИ КАТЕГОРИЙ ==========
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
  // "Потрачено" id=0 скрыто
];

const CATEGORY_ICONS = {
  1: "🏠", 2: "🍽️", 3: "🎮", 4: "👕", 5: "🐶",
  6: "🛒", 7: "🩺", 8: "💼", 9: "🚗", 0: "📦"
};

function getCategoryById(id) {
  return CATEGORIES_CONFIG.find(c => c.id === id);
}

function getCategoryColor(id) {
  const cat = getCategoryById(id);
  if (!cat) return '#b0b0b0';
  return getComputedStyle(document.documentElement).getPropertyValue(cat.colorVar).trim();
}

// ========== ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ ==========
function switchScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(screenId).classList.remove('hidden');
  if (screenId === 'screen-calendar') renderCalendarEvents();
  if (screenId === 'screen-home') { updateHomeStrip(); updateFinanceBlocks(); drawWheel(); }
  if (screenId === 'screen-limits') renderLimitsList();
  if (screenId === 'screen-goals') updateGoalsScreen();
  if (screenId === 'screen-notifications') renderNotifications();
  if (screenId === 'screen-friends') updateFriendsScreen();
  if (screenId === 'screen-goal-achieved') checkGoalAchievement();
}

// ========== ГЛАВНЫЙ ЭКРАН ==========
function updateHomeStrip() {
  const ud = loadUserData();
  const events = ud.events || [];
  let nextEvent = null, minDate = new Date('2999-12-31');
  events.forEach(ev => {
    const d = getNextDate(ev);
    if (d < minDate) { minDate = d; nextEvent = ev; }
  });
  document.getElementById('strip_date').textContent = nextEvent ? formatShortDate(minDate) : '--.--';
  document.getElementById('strip_name').textContent = nextEvent ? nextEvent.name || 'Без названия' : 'Нет событий';
  document.getElementById('strip_amount').textContent = nextEvent ? (nextEvent.amount || 0) + '₽' : '0₽';
}

function updateFinanceBlocks() {
  const ud = loadUserData();
  const g = ud.goal;
  document.getElementById('goal_name').textContent = g.name;
  const percent = g.saved / g.target * 100;
  document.getElementById('goal_percent').textContent = Math.min(100, Math.round(percent)) + '%';
  document.getElementById('goal_fill').style.width = Math.min(100, percent) + '%';
  document.getElementById('spent_amount').textContent = ud.totalSpent.toLocaleString() + ' ₽';
  document.getElementById('saved_amount').textContent = g.saved.toLocaleString() + ' ₽';
  // Прогресс в этом месяце: разница между текущим процентом и процентом на начало месяца
  const currentPercent = g.target > 0 ? g.saved / g.target * 100 : 0;
  const diff = currentPercent - (ud.prevGoalPercent || 0);
  document.getElementById('monthly_progress').textContent = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
  document.getElementById('target_date').textContent = g.deadline ? new Date(g.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '--';
}

// ========== КОЛЕСО ЛИМИТОВ ==========
function drawWheel() {
  const ud = loadUserData();
  // Для колеса используем только категории с лимитом >0, исключая id 0 (Потрачено)
  const categories = ud.categoriesLimits.filter(c => c.limit > 0 && c.id !== 0);
  const svg = document.getElementById('wheel_svg');
  if (!svg) return;
  if (categories.length === 0) {
    svg.innerHTML = `<circle cx="144" cy="144" r="120" fill="none" stroke="var(--light-gray)" stroke-width="30" />`;
    document.getElementById('wheel_categories').innerHTML = '<span style="color: var(--gray);">Нет категорий</span>';
    return;
  }
  const totalLimit = categories.reduce((s, c) => s + c.limit, 0);
  let cumulativeAngle = 0;
  const radius = 120, stroke = 30, center = 144, circ = 2 * Math.PI * radius;
  let defsHtml = '', circlesHtml = '';
  categories.forEach(cat => {
    const color = getCategoryColor(cat.id);
    const limitAngle = (cat.limit / totalLimit) * 360;
    const dashArray = (cat.limit / totalLimit) * circ;
    const dashOffset = -cumulativeAngle * (circ / 360);
    circlesHtml += `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-dasharray="${dashArray} ${circ}" stroke-dashoffset="${dashOffset}" transform="rotate(-90, ${center}, ${center})" opacity="0.85"/>`;
    cumulativeAngle += limitAngle;
  });
  svg.innerHTML = `<defs>${defsHtml}</defs>${circlesHtml}`;
  const centerDiv = document.getElementById('wheel_categories');
  let html = '<div class="grid grid-cols-2 gap-x-2 gap-y-2 w-full">';
  categories.forEach(cat => {
    const color = getCategoryColor(cat.id);
    const warning = cat.spent > cat.limit ? (cat.spent / cat.limit > 1.15 ? '🔴' : '🟡') : '';
    html += `<div class="flex items-center gap-1 min-w-0">
      <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${color};"></div>
      ${warning ? `<span class="text-xs">${warning}</span>` : ''}
      <span class="text-[10px] leading-tight font-medium truncate" style="color: var(--dark);">${getCategoryById(cat.id)?.name || '—'}</span>
    </div>`;
  });
  html += '</div>';
  centerDiv.innerHTML = html;
}

// ========== СПИСОК ЛИМИТОВ ==========
function renderLimitsList() {
  const ud = loadUserData();
  const container = document.getElementById('limits_list');
  // Показываем категории с лимитом >0, кроме id 0 (Потрачено)
  const active = ud.categoriesLimits.filter(c => c.limit > 0 && c.id !== 0);
  if (active.length === 0) {
    container.innerHTML = '<p class="text-sm py-4" style="color: var(--gray);">Нет установленных лимитов</p>';
    return;
  }
  container.innerHTML = active.map(cat => {
    const cfg = getCategoryById(cat.id);
    const color = getCategoryColor(cat.id);
    const spent = cat.spent || 0;
    const limit = cat.limit;
    const warning = spent > limit ? (spent / limit > 1.15 ? '🔴' : '🟡') : '';
    return `<div class="limit-item" data-id="${cat.id}">
      <div class="limit-item__info">
        <div class="limit-item__dot" style="background-color: ${color};"></div>
        <span class="limit-item__name">${cfg?.name || '—'}</span>
        ${warning ? `<span class="text-xs">${warning}</span>` : ''}
      </div>
      <span class="limit-item__rest">${spent.toLocaleString()} / ${limit.toLocaleString()} ₽</span>
    </div>`;
  }).join('');
}

// ========== МОДАЛКИ ЛИМИТОВ ==========
let editingCategoryId = null;
function openLimitModal(isNew, catId = null) {
  const ud = loadUserData();
  if (isNew) {
    const usedIds = ud.categoriesLimits.map(c => c.id);
    const available = CATEGORIES_CONFIG.filter(c => !usedIds.includes(c.id));
    if (available.length === 0) { alert('Все категории уже добавлены'); return; }
    window._availableCategories = available;
    openCategorySelectModal();
    return;
  } else {
    const cat = ud.categoriesLimits.find(c => c.id === catId);
    if (!cat || cat.id === 0) return; // нельзя редактировать "Потрачено"
    editingCategoryId = catId;
    document.getElementById('limit_category_name').textContent = getCategoryById(catId)?.name || '';
    document.getElementById('limit_value').value = cat.limit;
    document.getElementById('delete_limit_btn').classList.remove('hidden');
  }
  document.getElementById('limit_modal').classList.remove('hidden');
}

function closeLimitModal() { document.getElementById('limit_modal').classList.add('hidden'); editingCategoryId = null; }
function saveLimitChanges() {
  const newLimit = parseFloat(document.getElementById('limit_value').value);
  if (isNaN(newLimit) || newLimit < 0) { alert('Введите корректный лимит'); return; }
  let ud = loadUserData();
  let cat = ud.categoriesLimits.find(c => c.id === editingCategoryId);
  if (!cat) {
    cat = { id: editingCategoryId, limit: newLimit, spent: 0 };
    ud.categoriesLimits.push(cat);
  } else {
    cat.limit = newLimit;
  }
  saveUserData(ud);
  closeLimitModal();
  renderLimitsList();
  drawWheel();
}
function deleteLimitCategory() {
  if (editingCategoryId === null) return;
  let ud = loadUserData();
  const cat = ud.categoriesLimits.find(c => c.id === editingCategoryId);
  if (cat) cat.limit = 0; // убираем лимит, spent остаётся
  saveUserData(ud);
  closeLimitModal();
  renderLimitsList();
  drawWheel();
}

// ========== ВЫБОР КАТЕГОРИИ (модалка) ==========
let selectedCategoryId = null;
function openCategorySelectModal() {
  const ud = loadUserData();
  const usedIds = ud.categoriesLimits.map(c => c.id);
  const available = CATEGORIES_CONFIG.filter(c => !usedIds.includes(c.id));
  const list = document.getElementById('category_select_list');
  list.innerHTML = '';
  selectedCategoryId = null;
  updateConfirmButton();
  if (available.length === 0) { list.innerHTML = '<p class="text-center text-sm" style="color: var(--gray);">Все категории уже добавлены</p>'; return; }
  available.forEach(cat => {
    const el = document.createElement('div');
    el.className = 'flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer';
    el.style.backgroundColor = 'var(--lighter-gray)'; // все светло-серые
    el.style.color = 'var(--dark)';
    el.innerHTML = `<span class="text-lg">${CATEGORY_ICONS[cat.id] || '📁'}</span><span>${cat.name}</span>`;
    el.onclick = () => {
      selectedCategoryId = cat.id;
      document.querySelectorAll('#category_select_list > div').forEach(d => d.style.outline = 'none');
      el.style.outline = '2px solid var(--dark)';
      updateConfirmButton();
    };
    list.appendChild(el);
  });
  document.getElementById('category_select_modal').classList.remove('hidden');
}
function updateConfirmButton() {
  const btn = document.getElementById('confirm_category_btn');
  if (!btn) return;
  btn.disabled = (selectedCategoryId === null);
  btn.classList.toggle('opacity-50', selectedCategoryId === null);
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
function closeCategorySelectModal() { document.getElementById('category_select_modal').classList.add('hidden'); }

// ========== КАЛЕНДАРЬ ==========
function getNextDate(event) {
  const today = new Date(); today.setHours(0,0,0,0);
  if (event.type === 'one-time') return new Date(event.date);
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
function formatShortDate(date) { const d = new Date(date); return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`; }

function renderCalendarEvents() {
  const ud = loadUserData();
  const events = ud.events || [];
  const list = document.getElementById('events_list');
  const withDate = events.map(ev => ({ ev, date: getNextDate(ev) })).sort((a,b) => a.date - b.date);
  list.innerHTML = '';
  if (withDate.length === 0) { list.innerHTML = '<p class="text-center text-sm" style="color: var(--gray);">Нет событий</p>'; return; }
  withDate.forEach(item => {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-3 rounded-xl border cursor-pointer';
    div.style.borderColor = 'var(--light-gray)'; div.style.backgroundColor = 'white';
    div.innerHTML = `<div><span class="text-sm font-medium" style="color: var(--dark);">${formatShortDate(item.date)}</span><span class="ml-2 text-sm" style="color: var(--gray);">${item.ev.name || '—'}</span></div><span class="text-sm font-medium" style="color: var(--dark);">${item.ev.amount || 0} ₽</span>`;
    div.onclick = () => openEditModal(item.ev);
    list.appendChild(div);
  });
}
function openCreateModal() {
  document.getElementById('modal_title').textContent = 'Новый платёж';
  document.getElementById('event_name').value = '';
  document.querySelector('input[name="event_type"][value="one-time"]').checked = true;
  document.getElementById('event_date').value = '';
  document.getElementById('interval_value').value = ''; document.getElementById('interval_unit').value = 'days';
  document.getElementById('start_date').value = ''; document.getElementById('event_amount').value = '';
  document.getElementById('event_reminder').value = 'none';
  document.getElementById('delete_event_btn').classList.add('hidden');
  toggleTypeFields('one-time');
  document.getElementById('event_modal').classList.remove('hidden');
  document.getElementById('event_modal').dataset.editId = '';
}
function openEditModal(ev) {
  document.getElementById('modal_title').textContent = 'Редактировать платёж';
  document.getElementById('event_name').value = ev.name || '';
  document.querySelector(`input[name="event_type"][value="${ev.type}"]`).checked = true;
  if (ev.type === 'one-time') document.getElementById('event_date').value = ev.date || '';
  else { document.getElementById('interval_value').value = ev.intervalValue || ''; document.getElementById('interval_unit').value = ev.intervalUnit || 'days'; document.getElementById('start_date').value = ev.startDate || ''; }
  document.getElementById('event_amount').value = ev.amount || '';
  document.getElementById('event_reminder').value = ev.reminder || 'none';
  document.getElementById('delete_event_btn').classList.remove('hidden');
  toggleTypeFields(ev.type);
  document.getElementById('event_modal').classList.remove('hidden');
  document.getElementById('event_modal').dataset.editId = ev.id;
}
function toggleTypeFields(type) {
  document.getElementById('one_time_fields').classList.toggle('hidden', type !== 'one-time');
  document.getElementById('regular_fields').classList.toggle('hidden', type === 'one-time');
}
function closeModal() { document.getElementById('event_modal').classList.add('hidden'); }
function saveEventFromModal() {
  const name = document.getElementById('event_name').value.trim();
  const type = document.querySelector('input[name="event_type"]:checked').value;
  const amount = parseFloat(document.getElementById('event_amount').value) || 0;
  const reminder = document.getElementById('event_reminder').value;
  const editId = document.getElementById('event_modal').dataset.editId;
  let event = { name: name || 'Без названия', type, amount, reminder };
  if (type === 'one-time') { event.date = document.getElementById('event_date').value; if (!event.date) return alert('Укажите дату'); }
  else { event.intervalValue = document.getElementById('interval_value').value; event.intervalUnit = document.getElementById('interval_unit').value; event.startDate = document.getElementById('start_date').value; if (!event.intervalValue || !event.startDate) return alert('Заполните периодичность и стартовую дату'); }
  let ud = loadUserData();
  if (editId) {
    const idx = ud.events.findIndex(e => e.id === editId);
    if (idx >= 0) { event.id = editId; ud.events[idx] = event; }
  } else { event.id = Date.now().toString(); ud.events.push(event); }
  saveUserData(ud);
  closeModal();
  renderCalendarEvents();
  updateHomeStrip();
}
function deleteEventFromModal() {
  const editId = document.getElementById('event_modal').dataset.editId;
  if (!editId) return;
  let ud = loadUserData();
  ud.events = ud.events.filter(e => e.id !== editId);
  saveUserData(ud);
  closeModal();
  renderCalendarEvents();
  updateHomeStrip();
}

// ========== ЭКРАН ЦЕЛЕЙ ==========
function updateGoalsScreen() {
  const ud = loadUserData();
  const g = ud.goal;
  document.getElementById('goal_title').textContent = g.name;
  document.getElementById('goal_balance').textContent = g.saved.toLocaleString() + ' ₽';
  document.getElementById('goal_total_income').textContent = 'Доход за всё время ' + (g.totalIncome || 0).toFixed(2) + ' ₽';
  const remaining = Math.max(0, g.target - g.saved);
  document.getElementById('goal_remaining').textContent = remaining.toLocaleString() + ' ₽';
  document.getElementById('goal_progress_inner').style.width = Math.min(100, g.saved / g.target * 100) + '%';
  document.getElementById('goal_interest_rate').textContent = (g.interestRate || 13.5) + '%';
  document.getElementById('goal_predicted_income').textContent = '8,51 ₽';
  document.getElementById('goal_income_date').textContent = 'Начислим 31 мая с 20:00';
  document.getElementById('goal_deadline_display').textContent = g.deadline ? 'до ' + new Date(g.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

function openEditGoalModal() {
  const ud = loadUserData();
  document.getElementById('edit_goal_name_input').value = ud.goal.name;
  document.getElementById('edit_goal_target_input').value = ud.goal.target;
  document.getElementById('edit_goal_deadline_input').value = ud.goal.deadline;
  document.getElementById('edit_goal_modal').classList.remove('hidden');
}
function closeEditGoalModal() { document.getElementById('edit_goal_modal').classList.add('hidden'); }
function saveGoalChanges() {
  const name = document.getElementById('edit_goal_name_input').value.trim();
  const target = parseFloat(document.getElementById('edit_goal_target_input').value);
  const deadline = document.getElementById('edit_goal_deadline_input').value;
  if (!name || isNaN(target) || target <= 0) return alert('Заполните все поля корректно');
  let ud = loadUserData();
  ud.goal.name = name;
  ud.goal.target = target;
  ud.goal.deadline = deadline;
  saveUserData(ud);
  closeEditGoalModal();
  updateGoalsScreen();
  updateFinanceBlocks();
}

// Пополнить / вывести
function openGoalTransactionModal(type) {
  const ud = loadUserData();
  document.getElementById('transaction_type').value = type;
  document.getElementById('transaction_balance').textContent = ud.personalBalance.toLocaleString() + ' ₽ (доступно)';
  document.getElementById('transaction_saved').textContent = ud.goal.saved.toLocaleString() + ' ₽ (в копилке)';
  document.getElementById('transaction_amount').value = '';
  document.getElementById('goal_transaction_modal').classList.remove('hidden');
}
function closeGoalTransactionModal() { document.getElementById('goal_transaction_modal').classList.add('hidden'); }
function performGoalTransaction() {
  const type = document.getElementById('transaction_type').value;
  const amount = parseFloat(document.getElementById('transaction_amount').value);
  if (isNaN(amount) || amount <= 0) return alert('Введите сумму');
  let ud = loadUserData();
  if (type === 'deposit') {
    if (ud.personalBalance < amount) return alert('Недостаточно средств на счёте');
    ud.personalBalance -= amount;
    ud.goal.saved += amount;
  } else {
    if (ud.goal.saved < amount) return alert('Недостаточно средств в копилке');
    ud.goal.saved -= amount;
    ud.personalBalance += amount;
  }
  saveUserData(ud);
  checkGoalAchievement();
  updateGoalsScreen();
  closeGoalTransactionModal();
}

// Проверка достижения цели
function checkGoalAchievement() {
  const ud = loadUserData();
  if (ud.goal.saved >= ud.goal.target && ud.goal.target > 0) {
    switchScreen('screen-goal-achieved');
    // Покажем сообщение в стиле общения
    const style = ud.communicationStyle;
    const messages = {
      friendly: '🎉 Ура! Твоя цель достигнута! Ты большой молодец! Хочешь поставить новую цель?',
      business: 'Поздравляем, цель выполнена в срок. Желаете установить новую цель?',
      motivational: 'Ты сделал это! Невероятное достижение! Вперёд к новым вершинам!',
      toxic: 'Ну наконец-то! Смог. Может, теперь новую цель поставишь, или опять лениться?'
    };
    document.getElementById('achievement_message').textContent = messages[style] || messages.friendly;
  }
}
function startNewGoal() {
  let ud = loadUserData();
  ud.goal.saved = 0;
  ud.setupCompleted = false; // запустит анкету заново
  saveUserData(ud);
  switchScreen('screen-home');
  startQuestionnaire();
}

// Автопополнение
function openAutoTopUpModal() {
  const ud = loadUserData();
  document.getElementById('autotopup_type').value = ud.autoTopUp.type;
  document.getElementById('autotopup_percent').value = ud.autoTopUp.percent;
  document.getElementById('autotopup_max').value = ud.autoTopUp.maxAmount;
  document.getElementById('autotopup_modal').classList.remove('hidden');
}
function closeAutoTopUpModal() { document.getElementById('autotopup_modal').classList.add('hidden'); }
function saveAutoTopUp() {
  const ud = loadUserData();
  ud.autoTopUp.type = document.getElementById('autotopup_type').value;
  ud.autoTopUp.percent = parseFloat(document.getElementById('autotopup_percent').value) || 0;
  ud.autoTopUp.maxAmount = parseFloat(document.getElementById('autotopup_max').value) || 0;
  ud.autoTopUp.enabled = ud.autoTopUp.type !== 'none';
  saveUserData(ud);
  closeAutoTopUpModal();
  alert('Настройки автопополнения сохранены');
}

// Стиль общения
function openStyleModal() {
  document.getElementById('style_modal').classList.remove('hidden');
  const ud = loadUserData();
  document.querySelector(`input[name="comm_style"][value="${ud.communicationStyle}"]`).checked = true;
}
function closeStyleModal() { document.getElementById('style_modal').classList.add('hidden'); }
function saveCommunicationStyle() {
  const selected = document.querySelector('input[name="comm_style"]:checked')?.value;
  if (selected) {
    let ud = loadUserData();
    ud.communicationStyle = selected;
    saveUserData(ud);
  }
  closeStyleModal();
}

// ========== ЭКРАН ДРУЗЕЙ ==========
function updateFriendsScreen() {
  const ud = loadUserData();
  document.getElementById('challenge_your_progress').textContent = ud.challenges.yourProgress.toLocaleString() + '₽';
  document.getElementById('challenge_friend_progress').textContent = ud.challenges.friendProgress.toLocaleString() + '₽';
  const your = ud.challenges.yourProgress, friend = ud.challenges.friendProgress;
  const leader = your > friend ? 'Вы' : (friend > your ? 'Друг' : 'Ничья');
  document.getElementById('challenge_leader').textContent = 'Лидирует: ' + leader;
  document.getElementById('joint_saved').textContent = ud.challenges.jointGoal.saved.toLocaleString() + '₽';
  document.getElementById('joint_target').textContent = ud.challenges.jointGoal.target.toLocaleString() + '₽';
}
function contributeJoint(amountStr) {
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return alert('Неверная сумма');
  let ud = loadUserData();
  if (ud.personalBalance < amount) return alert('Недостаточно средств');
  ud.personalBalance -= amount;
  ud.challenges.jointGoal.saved += amount;
  saveUserData(ud);
  updateFriendsScreen();
}
function withdrawJoint(amountStr) {
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return alert('Неверная сумма');
  let ud = loadUserData();
  if (ud.challenges.jointGoal.saved < amount) return alert('Недостаточно средств в копилке');
  ud.challenges.jointGoal.saved -= amount;
  ud.personalBalance += amount;
  saveUserData(ud);
  updateFriendsScreen();
}

// ========== УВЕДОМЛЕНИЯ ==========
function renderNotifications() {
  const ud = loadUserData();
  const list = document.getElementById('notifications_list');
  list.innerHTML = '';
  if (ud.notifications.length === 0) { list.innerHTML = '<p class="text-center text-sm" style="color: var(--gray);">Нет уведомлений</p>'; return; }
  ud.notifications.forEach(n => {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-3 p-3 rounded-xl border cursor-pointer';
    div.style.borderColor = 'var(--light-gray)'; div.style.backgroundColor = 'white';
    const dotColor = n.read ? 'var(--light-gray)' : 'var(--brandRed)';
    div.innerHTML = `<div class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${dotColor};"></div><div class="flex-grow"><p class="text-sm font-medium" style="color: var(--dark);">${n.title}</p><p class="text-xs" style="color: var(--gray);">${n.date}</p></div>`;
    div.onclick = () => {
      if (!n.read) { n.read = true; saveUserData(ud); renderNotifications(); }
      if (n.type === 'monthly_stats') showMonthlyStats();
    };
    list.appendChild(div);
  });
}

// Показ статистики за месяц (модалка)
function showMonthlyStats() {
  const ud = loadUserData();
  const lastCat = ud.categoriesLimits.filter(c => c.id !== 0);
  let statsHtml = '<p class="mb-2"><strong>Потрачено за месяц:</strong> ' + (ud.monthlySpent || 0).toLocaleString() + ' ₽</p>';
  statsHtml += '<p class="mb-2"><strong>Накоплено:</strong> ' + ud.goal.saved.toLocaleString() + ' ₽</p>';
  statsHtml += '<p class="mb-2"><strong>Прогресс копилки:</strong> ' + (ud.goal.saved / ud.goal.target * 100).toFixed(1) + '%</p>';
  statsHtml += '<p class="mb-2"><strong>Осталось накопить:</strong> ' + Math.max(0, ud.goal.target - ud.goal.saved).toLocaleString() + ' ₽</p>';
  if (lastCat.length > 0) {
    statsHtml += '<p class="mt-2 font-semibold">Лимиты:</p>';
    lastCat.forEach(c => {
      const cfg = getCategoryById(c.id);
      statsHtml += `<p>${cfg?.name || 'Категория'}: ${c.spent} / ${c.limit} ₽ `;
      if (c.spent > c.limit) statsHtml += '<span style="color:red;">превышен!</span>';
      else statsHtml += '<span style="color:green;">в норме</span>';
      statsHtml += '</p>';
    });
  }
  document.getElementById('monthly_stats_content').innerHTML = statsHtml;
  // Заголовок в стиле общения
  const style = ud.communicationStyle;
  const titles = {
    friendly: 'Ты отлично поработал в этом месяце! Вот твои успехи:',
    business: 'Отчёт за прошедший месяц:',
    motivational: 'Потрясающий результат! Так держать!',
    toxic: 'Ну что, посмотрим, на что ты способен...'
  };
  document.getElementById('monthly_stats_title').textContent = titles[style] || titles.friendly;
  document.getElementById('monthly_stats_modal').classList.remove('hidden');
}

// ========== ДЕБАГ-ПАНЕЛЬ ==========
function toggleDebugPanel() { document.getElementById('debug_panel').classList.toggle('hidden'); }
function debugAddMoney() {
  const amount = parseFloat(prompt('Сумма пополнения основного счёта', '10000'));
  if (!isNaN(amount) && amount > 0) {
    let ud = loadUserData();
    ud.personalBalance += amount;
    if (ud.autoTopUp.enabled && ud.autoTopUp.type === 'percentOfIncome') {
      const topUp = Math.min(amount * ud.autoTopUp.percent / 100, ud.autoTopUp.maxAmount || Infinity);
      ud.goal.saved += topUp;
    }
    saveUserData(ud);
    alert('Баланс пополнен');
  }
}
function debugSpendMoney() {
  // Показываем панель выбора категории
  const select = document.getElementById('spend_category_select');
  select.innerHTML = '';
  CATEGORIES_CONFIG.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name + (c.id === 0 ? ' (общая)' : '');
    select.appendChild(opt);
  });
  document.getElementById('spend_amount_input').value = '';
  document.getElementById('test_spend_panel').classList.remove('hidden');
}
function performTestSpend() {
  const catId = parseInt(document.getElementById('spend_category_select').value);
  const amount = parseFloat(document.getElementById('spend_amount_input').value);
  if (isNaN(amount) || amount <= 0) return alert('Введите сумму');
  let ud = loadUserData();
  ud.personalBalance -= amount;
  ud.totalSpent += amount;
  ud.monthlySpent += amount;
  // Увеличиваем потрачено для категории "Потрачено" (id 0) если трата на любую категорию с лимитом
  const potracheno = ud.categoriesLimits.find(c => c.id === 0);
  if (potracheno) potracheno.spent += amount;
  else ud.categoriesLimits.push({ id: 0, limit: 0, spent: amount });

  // Если трата по категории с лимитом (не 0), увеличиваем spent у этой категории
  if (catId !== 0) {
    let cat = ud.categoriesLimits.find(c => c.id === catId);
    if (cat) cat.spent += amount;
    else if (getCategoryById(catId)) { ud.categoriesLimits.push({ id: catId, limit: 0, spent: amount }); }
  }
  if (ud.autoTopUp.enabled && ud.autoTopUp.type === 'percentOfExpense') {
    const topUp = Math.min(amount * ud.autoTopUp.percent / 100, ud.autoTopUp.maxAmount || Infinity);
    ud.goal.saved += topUp;
  }
  saveUserData(ud);
  updateFinanceBlocks(); drawWheel(); renderLimitsList();
  document.getElementById('test_spend_panel').classList.add('hidden');
  checkGoalAchievement();
  alert('Расход учтён');
}
function debugResetAll() {
  if (confirm('Удалить ВСЕ данные? Это действие необратимо.')) {
    localStorage.clear();
    location.reload();
  }
}
function debugNewMonth() {
  let ud = loadUserData();
  // Запоминаем процент до сброса
  ud.prevGoalPercent = ud.goal.target > 0 ? ud.goal.saved / ud.goal.target * 100 : 0;
  ud.monthlySpent = 0;
  ud.monthlyProgress = 0;
  ud.categoriesLimits.forEach(c => c.spent = 0);
  // Добавляем уведомление
  ud.notifications.unshift({
    id: Date.now().toString(),
    title: 'Статистика за прошлый месяц',
    date: new Date().toLocaleDateString('ru-RU'),
    read: false,
    type: 'monthly_stats'
  });
  saveUserData(ud);
  showMonthlyStats(); // сразу показываем статистику
  updateFinanceBlocks(); drawWheel(); renderLimitsList();
  alert('Новый месяц начался!');
}

// ========== ЧАТ-АНКЕТА ==========
let chatStep = 0;
const chatQuestions = [
  { field: 'style', text: { friendly: 'Привет! Давай познакомимся. Какой стиль общения тебе ближе?', business: 'Добрый день. Выберите стиль взаимодействия.', motivational: 'Привет! Давай настроимся на успех! Какой стиль тебе по душе?', toxic: 'Ну привет. Как будешь общаться – по-дружески или как обычно?' },
    options: [
      { value: 'friendly', label: 'Дружелюбный' },
      { value: 'business', label: 'Деловой' },
      { value: 'motivational', label: 'Мотивирующий' },
      { value: 'toxic', label: 'Токсичный' }
    ] },
  { field: 'income', text: { friendly: 'Какой у тебя ежемесячный доход? 💰', business: 'Укажите ваш ежемесячный доход.', motivational: 'Сколько ты зарабатываешь? Это будет твоим топливом!', toxic: 'И сколько ты там получаешь? Не стесняйся.' }, type: 'number' },
  { field: 'goalTarget', text: { friendly: 'Сколько хочешь накопить? 🎯', business: 'Введите сумму цели.', motivational: 'Какую вершину покорим? Сколько нужно накопить?', toxic: 'Ну и сколько тебе надо? Миллион? Ага, конечно.' }, type: 'number' },
  { field: 'deadline', text: { friendly: 'К какому сроку планируешь накопить? (выбери дату)', business: 'Крайний срок накопления:', motivational: 'Когда ты хочешь достичь цели?', toxic: 'Дедлайн? Или опять всё растянется?' }, type: 'date' },
  { field: 'categories', text: { friendly: 'Какие категории расходов у тебя основные? (можно несколько)', business: 'Выберите основные статьи расходов.', motivational: 'На что ты обычно тратишь? Выбери главные категории.', toxic: 'Ну и куда деньги уходят? Отмечай.' }, type: 'multi' },
  { field: 'autotopup', text: { friendly: 'Хочешь настроить автопополнение?', business: 'Выберите способ автопополнения.', motivational: 'Автоматизируем накопления! Как будем пополнять?', toxic: 'Автопополнение? Может, хоть что-то само будет откладываться, раз сам не можешь.' },
    options: [
      { value: 'percentOfExpense', label: '% от расходов' },
      { value: 'percentOfIncome', label: '% от доходов' },
      { value: 'percentOfBalance', label: '% от остатка' },
      { value: 'none', label: 'Отключить' }
    ] }
];
function startQuestionnaire() {
  const ud = loadUserData();
  if (ud.setupCompleted) return;
  chatStep = 0;
  window.questionnaireAnswers = {};
  document.getElementById('questionnaire_overlay').classList.remove('hidden');
  document.getElementById('chat_history').innerHTML = '';
  processChatStep();
}
function addChatMessage(text, isBot = true) {
  const history = document.getElementById('chat_history');
  const div = document.createElement('div');
  div.className = `p-2 rounded-xl max-w-[80%] ${isBot ? 'self-start' : 'self-end ml-auto'}`;
  div.style.backgroundColor = isBot ? 'var(--lighter-gray)' : 'var(--brandRed)';
  div.style.color = isBot ? 'var(--dark)' : 'var(--bg)';
  div.textContent = text;
  history.appendChild(div);
  history.scrollTop = history.scrollHeight;
}
function processChatStep() {
  if (chatStep >= chatQuestions.length) { finishQuestionnaire(); return; }
  const q = chatQuestions[chatStep];
  const style = window.questionnaireAnswers.style || 'friendly';
  const text = typeof q.text === 'object' ? q.text[style] : q.text;
  addChatMessage(text);
  const inputArea = document.getElementById('chat_input_area');
  const numInput = document.getElementById('chat_input_number');
  const dateInput = document.getElementById('chat_input_date');
  const buttonsDiv = document.getElementById('chat_buttons');
  numInput.classList.add('hidden');
  dateInput.classList.add('hidden');
  buttonsDiv.innerHTML = '';
  if (q.options) {
    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'px-3 py-1.5 rounded-xl text-sm';
      btn.style.backgroundColor = 'var(--lighter-gray)';
      btn.style.color = 'var(--dark)';
      btn.textContent = opt.label;
      btn.onclick = () => {
        addChatMessage(opt.label, false);
        window.questionnaireAnswers[q.field] = opt.value;
        chatStep++;
        processChatStep();
      };
      buttonsDiv.appendChild(btn);
    });
  } else if (q.type === 'number') {
    numInput.classList.remove('hidden');
    numInput.focus();
    numInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const val = numInput.value;
        addChatMessage(val, false);
        window.questionnaireAnswers[q.field] = val;
        numInput.value = '';
        chatStep++;
        processChatStep();
      }
    };
  } else if (q.type === 'date') {
    dateInput.classList.remove('hidden');
    dateInput.focus();
    dateInput.onchange = () => {
      const val = dateInput.value;
      addChatMessage(val, false);
      window.questionnaireAnswers[q.field] = val;
      chatStep++;
      processChatStep();
    };
  } else if (q.type === 'multi') {
    const btn = document.createElement('button');
    btn.className = 'px-3 py-1.5 rounded-xl text-sm';
    btn.style.backgroundColor = 'var(--brandRed)';
    btn.style.color = 'var(--bg)';
    btn.textContent = 'Сохранить выбор';
    btn.onclick = () => {
      const checked = [...document.querySelectorAll('.q_checkbox:checked')].map(cb => parseInt(cb.value));
      window.questionnaireAnswers[q.field] = checked;
      addChatMessage(checked.length > 0 ? checked.map(id => getCategoryById(id)?.name).join(', ') : 'Нет', false);
      chatStep++;
      processChatStep();
    };
    // Показать чекбоксы (вставляем в chat_history или buttons)
    const checkboxesDiv = document.createElement('div');
    checkboxesDiv.className = 'flex flex-wrap gap-2 mt-2';
    CATEGORIES_CONFIG.forEach(cat => {
      const lbl = document.createElement('label');
      lbl.className = 'flex items-center gap-1 text-sm';
      lbl.style.color = 'var(--dark)';
      lbl.innerHTML = `<input type="checkbox" value="${cat.id}" class="q_checkbox"> ${cat.name}`;
      checkboxesDiv.appendChild(lbl);
    });
    document.getElementById('chat_history').appendChild(checkboxesDiv);
    document.getElementById('chat_history').scrollTop = document.getElementById('chat_history').scrollHeight;
    buttonsDiv.appendChild(btn);
  }
}
function finishQuestionnaire() {
  const ans = window.questionnaireAnswers;
  let ud = loadUserData();
  ud.communicationStyle = ans.style || 'friendly';
  ud.personalBalance = parseFloat(ans.income) || 100000;
  ud.goal.name = 'Моя цель';
  ud.goal.target = parseFloat(ans.goalTarget) || 100000;
  ud.goal.deadline = ans.deadline || '2027-01-10';
  ud.autoTopUp.type = ans.autotopup || 'none';
  ud.autoTopUp.enabled = ud.autoTopUp.type !== 'none';
  const selectedCatIds = ans.categories || [];
  if (selectedCatIds.length > 0) {
    const limitPerCat = Math.floor(ud.goal.target / selectedCatIds.length);
    ud.categoriesLimits = selectedCatIds.map(id => ({ id, limit: limitPerCat, spent: 0 }));
    // Всегда есть "Потрачено" (id 0)
    if (!ud.categoriesLimits.find(c => c.id === 0)) ud.categoriesLimits.push({ id: 0, limit: 0, spent: 0 });
  } else {
    // Если ни одной категории не выбрано, оставляем только "Потрачено"
    ud.categoriesLimits = [{ id: 0, limit: 0, spent: 0 }];
  }
  ud.setupCompleted = true;
  saveUserData(ud);
  document.getElementById('questionnaire_overlay').classList.add('hidden');
  switchScreen('screen-home');
  updateFinanceBlocks(); drawWheel(); renderLimitsList();
}

// ========== ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ==========
document.addEventListener('DOMContentLoaded', () => {
  const ud = loadUserData();
  if (!ud.setupCompleted) { startQuestionnaire(); return; }

  document.getElementById('limits_button')?.addEventListener('click', () => switchScreen('screen-limits'));
  document.getElementById('calendar_strip')?.addEventListener('click', () => switchScreen('screen-calendar'));
  document.getElementById('add_event_btn')?.addEventListener('click', openCreateModal);
  document.getElementById('save_event_btn')?.addEventListener('click', saveEventFromModal);
  document.getElementById('delete_event_btn')?.addEventListener('click', deleteEventFromModal);
  document.getElementById('event_modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
  document.querySelectorAll('input[name="event_type"]').forEach(r => r.addEventListener('change', (e) => toggleTypeFields(e.target.value)));

  document.getElementById('add_category_btn')?.addEventListener('click', () => openLimitModal(true));
  document.getElementById('save_limit_btn')?.addEventListener('click', saveLimitChanges);
  document.getElementById('delete_limit_btn')?.addEventListener('click', deleteLimitCategory);
  document.getElementById('limit_modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeLimitModal(); });
  document.getElementById('confirm_category_btn')?.addEventListener('click', confirmCategorySelection);
  document.getElementById('category_select_modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeCategorySelectModal(); });
  document.addEventListener('click', (e) => {
    if (e.target.closest('#back_button')) switchScreen('screen-home');
    if (e.target.closest('.limit-item')) {
      const id = parseInt(e.target.closest('.limit-item').dataset.id);
      if (id !== 0) openLimitModal(false, id);
    }
  });

  document.getElementById('goal_progress_button')?.addEventListener('click', () => switchScreen('screen-goals'));
  document.getElementById('edit_goal_name_btn')?.addEventListener('click', openEditGoalModal);
  document.getElementById('edit_goal_target_btn')?.addEventListener('click', openEditGoalModal);
  document.getElementById('save_goal_btn')?.addEventListener('click', saveGoalChanges);
  document.getElementById('cancel_goal_btn')?.addEventListener('click', closeEditGoalModal);
  document.getElementById('edit_goal_modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeEditGoalModal(); });
  document.getElementById('goal_deposit_btn')?.addEventListener('click', () => openGoalTransactionModal('deposit'));
  document.getElementById('goal_withdraw_btn')?.addEventListener('click', () => openGoalTransactionModal('withdraw'));
  document.getElementById('goal_transaction_close')?.addEventListener('click', closeGoalTransactionModal);
  document.getElementById('goal_transaction_modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeGoalTransactionModal(); });
  document.getElementById('goal_transaction_confirm')?.addEventListener('click', performGoalTransaction);
  document.getElementById('autotopup_btn')?.addEventListener('click', openAutoTopUpModal);
  document.getElementById('autotopup_close')?.addEventListener('click', closeAutoTopUpModal);
  document.getElementById('autotopup_save')?.addEventListener('click', saveAutoTopUp);
  document.getElementById('autotopup_modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeAutoTopUpModal(); });
  document.getElementById('style_change_btn')?.addEventListener('click', openStyleModal);
  document.getElementById('style_close')?.addEventListener('click', closeStyleModal);
  document.getElementById('style_save')?.addEventListener('click', saveCommunicationStyle);
  document.getElementById('style_modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeStyleModal(); });

  document.getElementById('friends_button')?.addEventListener('click', () => switchScreen('screen-friends'));
  document.getElementById('joint_deposit_btn')?.addEventListener('click', () => contributeJoint(prompt('Сумма внесения')));
  document.getElementById('joint_withdraw_btn')?.addEventListener('click', () => withdrawJoint(prompt('Сумма вывода')));

  document.getElementById('notifications_button')?.addEventListener('click', () => switchScreen('screen-notifications'));

  // Достижение цели
  document.getElementById('new_goal_btn')?.addEventListener('click', startNewGoal);

  // Дебаг
  document.getElementById('debug_toggle')?.addEventListener('click', toggleDebugPanel);
  document.getElementById('debug_add_money')?.addEventListener('click', debugAddMoney);
  document.getElementById('debug_spend_money')?.addEventListener('click', debugSpendMoney);
  document.getElementById('debug_reset')?.addEventListener('click', debugResetAll);
  document.getElementById('debug_new_month')?.addEventListener('click', debugNewMonth);
  document.getElementById('spend_confirm_btn')?.addEventListener('click', performTestSpend);
  document.getElementById('monthly_stats_close')?.addEventListener('click', () => document.getElementById('monthly_stats_modal').classList.add('hidden'));
  document.getElementById('monthly_stats_modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) document.getElementById('monthly_stats_modal').classList.add('hidden'); });

  updateHomeStrip(); updateFinanceBlocks(); drawWheel(); renderLimitsList();
});