// === ETAT ===
let ingredients = [];
let meals = [];
let currentMeals = [];
let cart = [];
let stock = [];

let activeTab = 'ingredients';
let editingMealId = null;
let menuWeekOffset = 0;

// === API ===
const BASE = window.location.pathname.replace(/\/+$/, '');
const api = {
  get: url => fetch(BASE + url).then(r => r.json()),
  post: (url, body) => fetch(BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  put: (url, body) => fetch(BASE + url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  delete: url => fetch(BASE + url, { method: 'DELETE' }).then(r => r.json()),
  deleteWithBody: (url, body) => fetch(BASE + url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
};

async function loadAll() {
  [ingredients, meals, currentMeals, cart, stock] = await Promise.all([
    api.get('/api/ingredients'),
    api.get('/api/meals'),
    api.get('/api/current-meals'),
    api.get('/api/cart'),
    api.get('/api/stock'),
  ]);
  updateBadges();
  renderTab(activeTab);
}

// === TABS ===
function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
  activeTab = name;
  renderTab(name);
}

function renderTab(name) {
  if (name === 'ingredients') renderIngredients();
  else if (name === 'meals') renderMeals();
  else if (name === 'menu') renderMenu();
  else if (name === 'cart') renderCart();
  else if (name === 'stock') renderStock();
}

function updateBadges() {
  setBadge('ingredients', ingredients.length);
  setBadge('meals', meals.length);
  setBadge('menu', currentMeals.length);
  setBadge('cart', cart.filter(c => !c.achete).length);
  setBadge('stock', stock.length);
}

function setBadge(tab, count) {
  const el = document.getElementById(`badge-${tab}`);
  if (!el) return;
  el.textContent = count;
  el.classList.toggle('visible', count > 0);
}

// === UTILITAIRES ===
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(str) { return String(str ?? '').replace(/"/g, '&quot;'); }
function ingEntry(e) { return typeof e === 'number' ? { id: e, quantite: 1 } : e; }

function fmtQty(quantite, unite) {
  const q = quantite || 1;
  const u = (unite || '').trim();
  if (!u || u === 'unité') return q > 1 ? `x${q}` : '';
  return `${q} ${u}`;
}

function parseQty(val) {
  return parseFloat(String(val).replace(',', '.'));
}

function groupByCategory(items) {
  const map = {};
  items.forEach(item => {
    const cat = item.categorie || '';
    if (!map[cat]) map[cat] = [];
    map[cat].push(item);
  });
  const keys = Object.keys(map).sort((a, b) => {
    if (!a && b) return 1;   // sans catégorie en dernier
    if (a && !b) return -1;
    return a.localeCompare(b, 'fr');
  });
  return keys.map(k => [k, map[k].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))]);
}

function categoryHeader(cat) {
  return cat
    ? `<div class="category-header">${escHtml(cat)}</div>`
    : `<div class="category-header category-none">Sans categorie</div>`;
}

// === INGREDIENTS ===

function updateCategoriesDatalist() {
  const dl = document.getElementById('cat-datalist');
  if (!dl) return;
  const cats = [...new Set(ingredients.map(i => i.categorie).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  dl.innerHTML = cats.map(c => `<option value="${escAttr(c)}">`).join('');
}

function updateCartDatalist() {
  const dl = document.getElementById('cart-datalist');
  if (!dl) return;
  dl.innerHTML = ingredients.map(i => `<option value="${escAttr(i.nom)}">`).join('');
}

function renderIngredients() {
  updateCategoriesDatalist();
  const list = document.getElementById('ingredients-list');
  if (!ingredients.length) {
    list.innerHTML = '<p class="list-empty">Aucun ingredient. Ajoutez-en un ci-dessus.</p>';
    return;
  }
  const groups = groupByCategory(ingredients);
  list.innerHTML = groups.map(([cat, items]) =>
    categoryHeader(cat) + items.map(ingRowHtml).join('')
  ).join('');
}

function ingRowHtml(ing) {
  const linkBtn = ing.lien
    ? `<a href="${escAttr(ing.lien)}" target="_blank" rel="noopener" class="ing-link" title="Voir sur Drive">&#128279;</a>`
    : '';
  const uniteTag = ing.unite ? `<span class="ing-unite-tag">${escHtml(ing.unite)}</span>` : '';
  return `
    <div class="ing-row" id="ing-row-${ing.id}">
      <span class="ing-name">${escHtml(ing.nom)}</span>
      ${uniteTag}
      ${linkBtn}
      <div class="ing-actions">
        <button class="btn-icon" onclick="editIngredient(${ing.id})" title="Modifier">&#9998;</button>
        <button class="btn-icon danger" onclick="deleteIngredient(${ing.id})" title="Supprimer">&#128465;</button>
      </div>
    </div>`;
}

async function addIngredient() {
  const nameInput = document.getElementById('ing-name');
  const catInput  = document.getElementById('ing-categorie');
  const lienInput = document.getElementById('ing-lien');
  const nom = nameInput.value.trim();
  if (!nom) return nameInput.focus();
  const uniteInput = document.getElementById('ing-unite');
  const ing = await api.post('/api/ingredients', {
    nom,
    categorie: catInput.value.trim(),
    lien: lienInput.value.trim(),
    unite: uniteInput ? uniteInput.value.trim() : '',
  });
  if (ing.error) return alert(ing.error);
  ingredients.push(ing);
  nameInput.value = ''; catInput.value = ''; lienInput.value = ''; if (uniteInput) uniteInput.value = '';
  updateBadges();
  renderIngredients();
  updateCartDatalist();
}

function editIngredient(id) {
  const row = document.getElementById(`ing-row-${id}`);
  const ing = ingredients.find(i => i.id === id);
  const cats = [...new Set(ingredients.map(i => i.categorie).filter(Boolean))];
  row.innerHTML = `
    <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
      <input class="edit-input" id="ie-nom-${id}" value="${escAttr(ing.nom)}" placeholder="Nom">
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <input class="edit-input" id="ie-cat-${id}" value="${escAttr(ing.categorie||'')}" list="ie-catdl-${id}" placeholder="Categorie" style="flex:1; min-width:120px;">
        <datalist id="ie-catdl-${id}">${cats.map(c => `<option value="${escAttr(c)}">`).join('')}</datalist>
        <input class="edit-input" id="ie-unite-${id}" value="${escAttr(ing.unite||'')}" list="unite-datalist" placeholder="Unité" style="flex:0 0 80px;">
        <input class="edit-input" id="ie-lien-${id}" value="${escAttr(ing.lien||'')}" placeholder="Lien Drive" style="flex:2; min-width:180px;">
      </div>
    </div>
    <div class="ing-actions">
      <button class="btn-icon" onclick="saveIngredient(${id})">&#10003;</button>
      <button class="btn-icon danger" onclick="renderIngredients()">&#10007;</button>
    </div>`;
  document.getElementById(`ie-nom-${id}`).focus();
}

async function saveIngredient(id) {
  const nom = document.getElementById(`ie-nom-${id}`).value.trim();
  const categorie = document.getElementById(`ie-cat-${id}`).value.trim();
  const lien = document.getElementById(`ie-lien-${id}`).value.trim();
  const unite = (document.getElementById(`ie-unite-${id}`)?.value || '').trim();
  if (!nom) return document.getElementById(`ie-nom-${id}`).focus();
  const updated = await api.put(`/api/ingredients/${id}`, { nom, categorie, lien, unite });
  if (updated.error) return alert(updated.error);
  const idx = ingredients.findIndex(i => i.id === id);
  ingredients[idx] = updated;
  cart.forEach(c => { if (c.ingredientId === id) { c.nom = updated.nom; c.categorie = updated.categorie; } });
  stock.forEach(s => { if (s.ingredientId === id) { s.nom = updated.nom; s.categorie = updated.categorie; } });
  renderIngredients();
  updateCartDatalist();
}

async function deleteIngredient(id) {
  if (!confirm('Supprimer cet ingredient ?')) return;
  await api.delete(`/api/ingredients/${id}`);
  ingredients = ingredients.filter(i => i.id !== id);
  updateBadges();
  renderIngredients();
  updateCartDatalist();
}

// === REPAS ===
function renderMeals() {
  const list = document.getElementById('meals-list');
  if (!meals.length) {
    list.innerHTML = '<p class="list-empty">Aucun repas. Cliquez sur "+ Nouveau repas" pour en creer un.</p>';
    return;
  }
  const query = (document.getElementById('meals-search')?.value || '').toLowerCase().trim();
  const filtered = [...meals]
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    .filter(meal => {
      if (!query) return true;
      if (meal.nom.toLowerCase().includes(query)) return true;
      return meal.ingredients.some(e => {
        const ing = ingredients.find(i => i.id === ingEntry(e).id);
        return ing && ing.nom.toLowerCase().includes(query);
      });
    });
  if (!filtered.length) {
    list.innerHTML = '<p class="list-empty">Aucun repas ne correspond à la recherche.</p>';
    return;
  }
  list.innerHTML = filtered.map(meal => {
    const ingNames = meal.ingredients.map(e => {
      const { id, quantite } = ingEntry(e);
      const ing = ingredients.find(i => i.id === id);
      const name = ing ? escHtml(ing.nom) : '<em>supprime</em>';
      const qty = fmtQty(quantite, ing?.unite);
      return qty ? `${name} <span class="meal-ing-qty">${escHtml(qty)}</span>` : name;
    }).join(', ');
    return `
      <div class="meal-card">
        <div class="meal-info">
          <div class="meal-name">${escHtml(meal.nom)} <span class="meal-portions-badge">${meal.portions || 2} pers.</span></div>
          <div class="meal-ings">${ingNames || '<em>Aucun ingredient</em>'}</div>
          ${meal.dernierAjout ? `<div class="meal-last-added">Dernier ajout : ${formatDate(meal.dernierAjout)}</div>` : ''}
        </div>
        <div class="meal-actions">
          <button class="btn-menu" onclick="openPersonnesModal(${meal.id}, this)">+ Menu</button>
          <button class="btn-icon" onclick="openMealModal(${meal.id})" title="Modifier">&#9998;</button>
          <button class="btn-icon danger" onclick="deleteMeal(${meal.id})" title="Supprimer">&#128465;</button>
        </div>
      </div>`;
  }).join('');
}

function openMealModal(mealId) {
  editingMealId = mealId;
  const modal = document.getElementById('meal-modal');
  document.getElementById('modal-title').textContent = mealId ? 'Modifier le repas' : 'Nouveau repas';
  const foundMeal = mealId ? meals.find(m => m.id === mealId) : null;
  document.getElementById('modal-meal-name').value = foundMeal ? foundMeal.nom : '';
  document.getElementById('modal-meal-portions').value = foundMeal ? (foundMeal.portions || 2) : 2;

  const ingSearch = document.getElementById('modal-ing-search');
  if (ingSearch) ingSearch.value = '';

  const ingList = document.getElementById('modal-ingredients');
  const noIng = document.getElementById('modal-no-ing');
  if (!ingredients.length) {
    ingList.innerHTML = '';
    noIng.style.display = 'block';
  } else {
    noIng.style.display = 'none';
    const selectedEntries = (mealId ? (meals.find(m => m.id === mealId)?.ingredients || []) : []).map(e => ingEntry(e));
    const selectedMap = Object.fromEntries(selectedEntries.map(e => [e.id, e.quantite]));
    const groups = groupByCategory(ingredients);
    ingList.innerHTML = groups.map(([cat, items]) =>
      (cat ? `<div class="modal-cat-header">${escHtml(cat)}</div>` : '') +
      items.map(ing => {
        const checked = ing.id in selectedMap;
        const qty = selectedMap[ing.id] || 1;
        return `<div class="ing-modal-row${checked ? ' checked' : ''}" id="ing-row-modal-${ing.id}" data-ing-id="${ing.id}" data-name="${escAttr(ing.nom)}" onclick="toggleIngRow(${ing.id})">
          <div class="ing-modal-check">${checked ? '&#10003;' : ''}</div>
          <div class="ing-modal-name">${escHtml(ing.nom)}${ing.unite ? ` <span class="ing-modal-unite">${escHtml(ing.unite)}</span>` : ''}</div>
          <div class="ing-modal-qty" id="qty-wrap-${ing.id}"${!checked ? ' style="display:none"' : ''}>
            <input type="number" id="qty-${ing.id}" min="0.1" step="any" value="${qty}" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()">
            ${ing.unite ? `<span class="ing-modal-unite">${escHtml(ing.unite)}</span>` : ''}
          </div>
        </div>`;
      }).join('')
    ).join('');
    updateModalIngCount();
  }

  modal.style.display = 'flex';
  document.getElementById('modal-meal-name').focus();
}

function toggleIngRow(ingId) {
  const row = document.getElementById(`ing-row-modal-${ingId}`);
  if (!row) return;
  const isChecked = row.classList.toggle('checked');
  const check = row.querySelector('.ing-modal-check');
  if (check) check.innerHTML = isChecked ? '&#10003;' : '';
  const qtyWrap = document.getElementById(`qty-wrap-${ingId}`);
  if (qtyWrap) qtyWrap.style.display = isChecked ? '' : 'none';
  updateModalIngCount();
}

function updateModalIngCount() {
  const count = document.querySelectorAll('#modal-ingredients .ing-modal-row.checked').length;
  const el = document.getElementById('modal-ing-count');
  if (el) el.textContent = count > 0 ? count : '';
}

function filterModalIngredients() {
  const q = (document.getElementById('modal-ing-search')?.value || '').toLowerCase().trim();
  document.querySelectorAll('#modal-ingredients .ing-modal-row').forEach(row => {
    const name = (row.dataset.name || '').toLowerCase();
    row.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
}

function closeMealModal() {
  document.getElementById('meal-modal').style.display = 'none';
  editingMealId = null;
}

async function saveMeal() {
  const nom = document.getElementById('modal-meal-name').value.trim();
  if (!nom) return document.getElementById('modal-meal-name').focus();
  const portions = Math.max(1, parseInt(document.getElementById('modal-meal-portions').value) || 2);
  const ingData = [...document.querySelectorAll('#modal-ingredients .ing-modal-row.checked')].map(row => {
    const ingId = parseInt(row.dataset.ingId);
    const qtyInput = document.getElementById(`qty-${ingId}`);
    return { id: ingId, quantite: Math.max(0.1, parseQty(qtyInput?.value) || 1) };
  });
  let meal;
  if (editingMealId) {
    meal = await api.put(`/api/meals/${editingMealId}`, { nom, portions, ingredients: ingData });
    meals[meals.findIndex(m => m.id === editingMealId)] = meal;
  } else {
    meal = await api.post('/api/meals', { nom, portions, ingredients: ingData });
    meals.push(meal);
  }
  closeMealModal();
  updateBadges();
  renderMeals();
}

async function deleteMeal(id) {
  if (!confirm('Supprimer ce repas ?')) return;
  await api.delete(`/api/meals/${id}`);
  meals = meals.filter(m => m.id !== id);
  updateBadges();
  renderMeals();
}

function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

let personnesMealId = null;
let personnesBtn = null;
let doneMealId = null;

function openPersonnesModal(mealId, btn) {
  const meal = meals.find(m => m.id === mealId);
  if (!meal) return;
  personnesMealId = mealId;
  personnesBtn = btn;
  document.getElementById('menu-persons-title').textContent = meal.nom;
  document.getElementById('menu-persons-base').textContent = `Recette prévue pour ${meal.portions || 2} personne(s)`;
  const qtyInput = document.getElementById('menu-persons-qty');
  qtyInput.value = meal.portions || 2;
  document.getElementById('menu-persons-modal').style.display = 'flex';
  qtyInput.focus();
  qtyInput.select();
}

function closePersonnesModal() {
  document.getElementById('menu-persons-modal').style.display = 'none';
  personnesMealId = null;
  personnesBtn = null;
}

async function confirmAddToMenu() {
  if (!personnesMealId) return;
  const personnes = Math.max(1, parseInt(document.getElementById('menu-persons-qty').value) || 1);
  const mealId = personnesMealId;
  const btn = personnesBtn;
  closePersonnesModal();
  await addMealToMenu(mealId, btn, personnes);
}

async function addMealToMenu(mealId, btn, personnes) {
  const entry = await api.post('/api/current-meals', { repasId: mealId, personnes });
  if (entry.error) return alert(entry.error);
  currentMeals.push(entry);
  meals = await api.get('/api/meals');
  cart = await api.get('/api/cart');
  updateBadges();
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ Ajoute';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1200);
  }
}

// === MENU EN COURS ===
function changeMenuWeek(delta) {
  menuWeekOffset += delta;
  renderMenu();
}

function getWeekDays() {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + menuWeekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isoDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function renderMenu() {
  const list = document.getElementById('menu-list');
  if (!currentMeals.length) {
    list.innerHTML = '<p class="list-empty">Aucun repas au menu. Ajoutez des repas depuis l\'onglet Repas.</p>';
    return;
  }
  list.innerHTML = [...currentMeals].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map(entry => {
    const meal = meals.find(m => m.id === entry.repasId);
    const chips = meal
      ? meal.ingredients.map(e => {
          const { id, quantite } = ingEntry(e);
          const ing = ingredients.find(i => i.id === id);
          const qty = fmtQty(quantite, ing?.unite);
          return `<span>${ing ? escHtml(ing.nom) : 'supprime'}${qty ? ` ${escHtml(qty)}` : ''}</span>`;
        }).join('')
      : '';
    return `
      <div class="menu-card">
        <div class="menu-card-header">
          <h3>${escHtml(entry.nom)} <span class="meal-portions-badge">${entry.personnes || 2} pers.</span></h3>
          <button class="btn-success" onclick="doneMeal(${entry.id})">&#10003; Repas fait</button>
        </div>
        ${['midi', 'soir'].map(moment => {
          const slotEntries = currentMeals.filter(c => c.date === dateStr && c.moment === moment);
          return `<div class="menu-slot"
            ondragover="event.preventDefault()"
            ondragenter="this.classList.add('drag-over')"
            ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove('drag-over')"
            ondrop="dropToSlot(event,'${dateStr}','${moment}')">
            <div class="menu-slot-label">${moment === 'midi' ? 'Midi' : 'Soir'}</div>
            ${slotEntries.length
              ? slotEntries.map(e => menuMealCardHtml(e, false)).join('')
              : '<div class="menu-slot-empty">Déposer ici</div>'}
          </div>`;
        }).join('')}
      </div>`;
    }).join('');
  }

  const hint = document.getElementById('menu-hint');
  const unscheduledList = document.getElementById('menu-unscheduled-list');
  if (hint) hint.style.display = currentMeals.length === 0 ? '' : 'none';
  if (unscheduledList) {
    unscheduledList.innerHTML = unscheduled.length
      ? unscheduled.map(e => menuMealCardHtml(e, true)).join('')
      : currentMeals.length > 0 ? '<p class="list-empty">Tous les repas sont planifiés !</p>' : '';
  }
}

function menuMealCardHtml(entry, large) {
  return `<div class="menu-meal-card${large ? ' menu-meal-card-lg' : ''}"
    draggable="true"
    ondragstart="dragCurrentMeal(event,${entry.id})">
    <span class="menu-drag-handle">&#8942;&#8942;</span>
    <div class="menu-meal-info">
      <span class="menu-meal-name">${escHtml(entry.nom)}</span>
      <span class="meal-portions-badge">${entry.personnes || 2} pers.</span>
    </div>
    <div class="menu-meal-actions">
      ${entry.date ? `<button class="btn-icon" onclick="unscheduleCurrentMeal(${entry.id})" title="Retirer du planning">&#10006;</button>` : ''}
      <button class="btn-icon" onclick="openDoneModal(${entry.id})" title="Repas fait">&#10003;</button>
    </div>
  </div>`;
}

function dragCurrentMeal(event, id) {
  event.dataTransfer.setData('text/plain', String(id));
  event.dataTransfer.effectAllowed = 'move';
}

async function dropToSlot(event, date, moment) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  const id = parseInt(event.dataTransfer.getData('text/plain'));
  if (!id) return;
  const entry = currentMeals.find(c => c.id === id);
  if (entry && entry.date === date && entry.moment === moment) return;
  await api.put(`/api/current-meals/${id}`, { date, moment });
  const idx = currentMeals.findIndex(c => c.id === id);
  if (idx !== -1) { currentMeals[idx].date = date; currentMeals[idx].moment = moment; }
  renderMenu();
}

async function dropToUnscheduled(event) {
  event.preventDefault();
  document.getElementById('menu-unscheduled-list')?.classList.remove('drag-over-list');
  const id = parseInt(event.dataTransfer.getData('text/plain'));
  if (!id) return;
  await api.put(`/api/current-meals/${id}`, { date: null, moment: null });
  const idx = currentMeals.findIndex(c => c.id === id);
  if (idx !== -1) { currentMeals[idx].date = null; currentMeals[idx].moment = null; }
  renderMenu();
}

async function unscheduleCurrentMeal(id) {
  await api.put(`/api/current-meals/${id}`, { date: null, moment: null });
  const idx = currentMeals.findIndex(c => c.id === id);
  if (idx !== -1) { currentMeals[idx].date = null; currentMeals[idx].moment = null; }
  renderMenu();
}

function openDoneModal(id) {
  const entry = currentMeals.find(c => c.id === id);
  if (!entry) return;
  const meal = meals.find(m => m.id === entry.repasId);
  if (!meal) return;
  doneMealId = id;
  document.getElementById('done-modal-title').textContent = meal.nom;
  document.getElementById('done-modal-subtitle').textContent = `${entry.personnes || meal.portions || 2} personne(s)`;
  const multiplier = (entry.personnes || meal.portions || 2) / (meal.portions || 2);
  const ingsEl = document.getElementById('done-modal-ings');
  ingsEl.innerHTML = meal.ingredients.map(e => {
    const { id: ingId, quantite: baseQty } = ingEntry(e);
    const ing = ingredients.find(i => i.id === ingId);
    if (!ing) return '';
    const qty = Math.round(baseQty * multiplier * 10) / 10;
    return `<div class="done-ing-row">
      <span class="done-ing-name">${escHtml(ing.nom)}</span>
      <div class="qty-control">
        <button class="btn-qty" onclick="changeDoneQty(${ingId}, -1)">&#8722;</button>
        <input type="number" class="qty-value done-ing-qty" data-ing-id="${ingId}" value="${qty}" min="0" step="any">
        <button class="btn-qty" onclick="changeDoneQty(${ingId}, 1)">+</button>
      </div>
      ${ing.unite ? `<span class="done-ing-unite">${escHtml(ing.unite)}</span>` : ''}
    </div>`;
  }).join('');
  document.getElementById('done-modal').style.display = 'flex';
}

function changeDoneQty(ingId, delta) {
  const input = document.querySelector(`#done-modal-ings .done-ing-qty[data-ing-id="${ingId}"]`);
  if (!input) return;
  const current = parseQty(input.value) || 0;
  input.value = Math.max(0, Math.round((current + delta) * 10) / 10);
}

function closeDoneModal() {
  document.getElementById('done-modal').style.display = 'none';
  doneMealId = null;
}

async function confirmDoneMeal() {
  if (!doneMealId) return;
  const quantities = {};
  document.querySelectorAll('#done-modal-ings .done-ing-qty').forEach(input => {
    const ingId = parseInt(input.dataset.ingId);
    quantities[ingId] = Math.max(0, parseQty(input.value) || 0);
  });
  const id = doneMealId;
  closeDoneModal();
  await api.deleteWithBody(`/api/current-meals/${id}`, { quantities });
  currentMeals = currentMeals.filter(c => c.id !== id);
  stock = await api.get('/api/stock');
  updateBadges();
  renderMenu();
  if (activeTab === 'stock') renderStock();
}

// === PANIER ===
function renderCart() {
  updateCartDatalist();
  const pending = cart.filter(c => !c.achete);
  const bought  = cart.filter(c => c.achete);

  const pendingEl  = document.getElementById('cart-list-pending');
  const boughtEl   = document.getElementById('cart-list-bought');
  const boughtCard = document.getElementById('card-cart-bought');

  if (!pending.length) {
    pendingEl.innerHTML = '<p class="list-empty">Panier vide.</p>';
  } else {
    const groups = groupByCategory(pending);
    pendingEl.innerHTML = groups.map(([cat, items]) =>
      categoryHeader(cat) + items.map(cartRowHtml).join('')
    ).join('');
  }

  boughtCard.style.display = bought.length ? 'block' : 'none';
  if (bought.length) {
    const groups = groupByCategory(bought);
    boughtEl.innerHTML = groups.map(([cat, items]) =>
      categoryHeader(cat) + items.map(item => `
        <div class="cart-row bought">
          <span class="cart-check">&#10003;</span>
          <div style="flex:1">
            <div class="cart-name">${escHtml(item.nom)}</div>
            ${item.recettes && item.recettes.length
              ? `<div class="cart-recettes">${item.recettes.map(r => `<span class="recette-tag">${escHtml(r)}</span>`).join('')}${(item.quantite||1) > 1 ? `<span class="cart-qty-badge">x${item.quantite}</span>` : ''}</div>`
              : `<div class="cart-source">${escHtml(item.source)}${(item.quantite||1) > 1 ? ` · x${item.quantite}` : ''}</div>`}
          </div>
          <div class="cart-actions">
            <button class="btn-icon danger" onclick="deleteCartItem(${item.id})" title="Retirer">&#128465;</button>
          </div>
        </div>`).join('')
    ).join('');
  }
}

function cartRowHtml(item) {
  const qty = item.quantite || 1;
  const recettesHtml = item.recettes && item.recettes.length
    ? `<div class="cart-recettes">${item.recettes.map(r => `<span class="recette-tag">${escHtml(r)}</span>`).join('')}</div>`
    : `<div class="cart-source">${escHtml(item.source)}</div>`;
  const stockItem = item.ingredientId ? stock.find(s => s.ingredientId === item.ingredientId) : null;
  const stockQty = stockItem ? stockItem.quantite : 0;
  const u = (item.unite || '').trim();
  const fmtU = q => (u && u !== 'unité') ? `${q} ${u}` : `${q}`;
  let neededByMenu = 0;
  if (item.ingredientId) {
    for (const cm of currentMeals) {
      const meal = meals.find(m => m.id === cm.repasId);
      if (!meal) continue;
      const e = meal.ingredients.find(e2 => ingEntry(e2).id === item.ingredientId);
      if (!e) continue;
      const multiplier = (cm.personnes || meal.portions || 2) / (meal.portions || 2);
      neededByMenu += ingEntry(e).quantite * multiplier;
    }
    neededByMenu = Math.round(neededByMenu * 10) / 10;
  }
  const availableQty = Math.max(0, Math.round((stockQty - neededByMenu) * 10) / 10);
  const deficit = Math.max(0, Math.round((neededByMenu - stockQty) * 10) / 10);
  const stockColorClass = deficit > 0 ? ' cart-stock-low' : availableQty > 0 ? ' cart-stock-ok' : '';
  const stockHtml = item.ingredientId
    ? `<div class="cart-stock-info${stockColorClass}">${deficit > 0 ? `En stock : manque ${fmtU(deficit)}` : `En stock : ${fmtU(availableQty)} disponible`}</div>`
    : '';
  return `
    <div class="cart-row" id="cart-row-${item.id}">
      <div style="flex:1">
        <div class="cart-name">${escHtml(item.nom)}</div>
        ${recettesHtml}
        ${stockHtml}
      </div>
      <div class="qty-control">
        <button class="btn-qty" onclick="updateCartQty(${item.id}, ${qty - 1})">&#8722;</button>
        <input type="number" class="qty-value" value="${qty}" min="0.1" step="any"
          onchange="updateCartQty(${item.id}, parseQty(this.value)||0)"
          onkeydown="if(event.key==='Enter')this.blur()">
        ${item.unite ? `<span class="qty-unite">${escHtml(item.unite)}</span>` : ''}
        <button class="btn-qty" onclick="updateCartQty(${item.id}, ${qty + 1})">+</button>
      </div>
      <div class="cart-actions">
        <button class="btn-success" onclick="openBuyModal(${item.id})">&#10003; Achete</button>
        <button class="btn-icon danger" onclick="deleteCartItem(${item.id})" title="Retirer">&#128465;</button>
      </div>
    </div>`;
}

async function updateCartQty(id, newQty) {
  if (newQty <= 0) {
    if (!confirm('Retirer cet article du panier ?')) return;
    return deleteCartItem(id);
  }
  await api.put(`/api/cart/${id}`, { quantite: newQty });
  const idx = cart.findIndex(c => c.id === id);
  cart[idx].quantite = newQty;
  renderCart();
}

async function addToCart() {
  const input = document.getElementById('cart-input');
  const nom = input.value.trim();
  if (!nom) return input.focus();
  const item = await api.post('/api/cart', { nom });
  if (item.error) return alert(item.error);
  cart.push(item);
  input.value = '';
  updateBadges();
  renderCart();
}

let buyingCartItemId = null;

function openBuyModal(id) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  buyingCartItemId = id;
  document.getElementById('buy-modal-name').textContent = item.nom;
  const qtyInput = document.getElementById('buy-modal-qty');
  qtyInput.value = item.quantite || 1;
  document.getElementById('buy-modal-unite').textContent = item.unite || '';
  document.getElementById('buy-modal').style.display = 'flex';
  qtyInput.focus();
  qtyInput.select();
}

function closeBuyModal() {
  document.getElementById('buy-modal').style.display = 'none';
  buyingCartItemId = null;
}

async function confirmBuy() {
  if (!buyingCartItemId) return;
  const qty = Math.max(0.1, parseQty(document.getElementById('buy-modal-qty').value) || 0.1);
  const id = buyingCartItemId;
  closeBuyModal();
  await buyCartItem(id, qty);
}

async function buyCartItem(id, actualQty) {
  const item = await api.put(`/api/cart/${id}`, { achete: true, quantite: actualQty });
  if (item.error) return alert(item.error);
  const idx = cart.findIndex(c => c.id === id);
  cart[idx].achete = true;
  cart[idx].quantite = actualQty;
  stock = await api.get('/api/stock');
  updateBadges();
  renderCart();
}

async function deleteCartItem(id) {
  await api.delete(`/api/cart/${id}`);
  cart = cart.filter(c => c.id !== id);
  updateBadges();
  renderCart();
}

async function clearBought() {
  const bought = cart.filter(c => c.achete);
  await Promise.all(bought.map(c => api.delete(`/api/cart/${c.id}`)));
  cart = cart.filter(c => !c.achete);
  updateBadges();
  renderCart();
}

// === STOCK ===
function renderStock() {
  const list = document.getElementById('stock-list');
  if (!stock.length) {
    list.innerHTML = '<p class="list-empty">Stock vide. Les ingredients achetes apparaissent ici.</p>';
    return;
  }
  const groups = groupByCategory(stock);
  list.innerHTML = groups.map(([cat, items]) =>
    categoryHeader(cat) + items.map(item => {
      const qty = item.quantite || 1;
      const linkedMeals = item.ingredientId
        ? currentMeals
            .filter(cm => {
              const meal = meals.find(m => m.id === cm.repasId);
              return meal && meal.ingredients.some(e => ingEntry(e).id === item.ingredientId);
            })
            .map(cm => cm.nom)
        : [];
      let neededQty = 0;
      if (item.ingredientId) {
        for (const cm of currentMeals) {
          const meal = meals.find(m => m.id === cm.repasId);
          if (!meal) continue;
          const e = meal.ingredients.find(e2 => ingEntry(e2).id === item.ingredientId);
          if (!e) continue;
          const multiplier = (cm.personnes || meal.portions || 2) / (meal.portions || 2);
          neededQty += ingEntry(e).quantite * multiplier;
        }
        neededQty = Math.round(neededQty * 10) / 10;
      }
      const deficit = Math.max(0, Math.round((neededQty - qty) * 10) / 10);
      const freeQty = Math.max(0, Math.round((qty - neededQty) * 10) / 10);
      const u = (item.unite || '').trim();
      const fmtU = q => (u && u !== 'unité') ? `${q} ${u}` : `${q}`;
      return `
        <div class="stock-row">
          <div style="flex:1;min-width:0">
            <span class="stock-name">${escHtml(item.nom)}</span>
            ${linkedMeals.length ? `<div class="cart-recettes">${linkedMeals.map(n => `<span class="recette-tag">${escHtml(n)}</span>`).join('')}</div>` : ''}
            ${neededQty > 0 ? `<div class="stock-free-qty${deficit > 0 ? ' stock-low' : ''}">${deficit > 0 ? `Manque ${fmtU(deficit)}` : `${fmtU(freeQty)} disponible`} · ${fmtU(neededQty)} au menu</div>` : ''}
          </div>
          <div class="qty-control">
            <button class="btn-qty" onclick="updateStockQty(${item.id}, ${qty - 1})">&#8722;</button>
            <input type="number" class="qty-value" value="${qty}" min="0.1" step="any"
              onchange="updateStockQty(${item.id}, parseQty(this.value)||0)"
              onkeydown="if(event.key==='Enter')this.blur()">
            ${item.unite ? `<span class="qty-unite">${escHtml(item.unite)}</span>` : ''}
            <button class="btn-qty" onclick="updateStockQty(${item.id}, ${qty + 1})">+</button>
          </div>
          <button class="btn-danger" onclick="deleteStockItem(${item.id})">Retirer tout</button>
        </div>`;
    }).join('')
  ).join('');
}

async function updateStockQty(id, newQty) {
  const result = await api.put(`/api/stock/${id}`, { quantite: newQty });
  if (result.removed) {
    stock = stock.filter(s => s.id !== id);
  } else {
    const idx = stock.findIndex(s => s.id === id);
    if (idx !== -1) stock[idx].quantite = result.quantite;
  }
  updateBadges();
  renderStock();
}

async function deleteStockItem(id) {
  await api.delete(`/api/stock/${id}`);
  stock = stock.filter(s => s.id !== id);
  updateBadges();
  renderStock();
}

// === INIT ===
loadAll();
