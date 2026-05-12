// === ETAT ===
let ingredients = [];
let meals = [];
let currentMeals = [];
let cart = [];
let stock = [];

let activeTab = 'ingredients';
let editingMealId = null;

// === API ===
const api = {
  get: url => fetch(url).then(r => r.json()),
  post: (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  put: (url, body) => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  delete: url => fetch(url, { method: 'DELETE' }).then(r => r.json()),
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
  return keys.map(k => [k, map[k]]);
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
  return `
    <div class="ing-row" id="ing-row-${ing.id}">
      <span class="ing-name">${escHtml(ing.nom)}</span>
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
  const ing = await api.post('/api/ingredients', {
    nom,
    categorie: catInput.value.trim(),
    lien: lienInput.value.trim(),
  });
  if (ing.error) return alert(ing.error);
  ingredients.push(ing);
  nameInput.value = ''; catInput.value = ''; lienInput.value = '';
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
  if (!nom) return document.getElementById(`ie-nom-${id}`).focus();
  const updated = await api.put(`/api/ingredients/${id}`, { nom, categorie, lien });
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
  list.innerHTML = meals.map(meal => {
    const ingNames = meal.ingredients.map(id => {
      const ing = ingredients.find(i => i.id === id);
      return ing ? escHtml(ing.nom) : '<em>supprime</em>';
    }).join(', ');
    return `
      <div class="meal-card">
        <div class="meal-info">
          <div class="meal-name">${escHtml(meal.nom)}</div>
          <div class="meal-ings">${ingNames || '<em>Aucun ingredient</em>'}</div>
          ${meal.dernierAjout ? `<div class="meal-last-added">Dernier ajout : ${formatDate(meal.dernierAjout)}</div>` : ''}
        </div>
        <div class="meal-actions">
          <button class="btn-menu" onclick="addMealToMenu(${meal.id}, this)">+ Menu</button>
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
  document.getElementById('modal-meal-name').value = mealId ? meals.find(m => m.id === mealId).nom : '';

  const ingGrid = document.getElementById('modal-ingredients');
  const noIng = document.getElementById('modal-no-ing');
  if (!ingredients.length) {
    ingGrid.innerHTML = '';
    noIng.style.display = 'block';
  } else {
    noIng.style.display = 'none';
    const selected = mealId ? (meals.find(m => m.id === mealId)?.ingredients || []) : [];
    // Grouper les ingrédients par catégorie dans la modale
    const groups = groupByCategory(ingredients);
    ingGrid.innerHTML = groups.map(([cat, items]) => `
      ${cat ? `<div class="modal-cat-header">${escHtml(cat)}</div>` : ''}
      ${items.map(ing => {
        const checked = selected.includes(ing.id);
        return `<label class="ing-checkbox-label ${checked ? 'checked' : ''}" id="lbl-${ing.id}">
          <input type="checkbox" value="${ing.id}" ${checked ? 'checked' : ''} onchange="toggleCheckLabel(this)">
          ${escHtml(ing.nom)}
        </label>`;
      }).join('')}
    `).join('');
  }

  modal.style.display = 'flex';
  document.getElementById('modal-meal-name').focus();
}

function toggleCheckLabel(checkbox) {
  document.getElementById(`lbl-${checkbox.value}`).classList.toggle('checked', checkbox.checked);
}

function closeMealModal() {
  document.getElementById('meal-modal').style.display = 'none';
  editingMealId = null;
}

async function saveMeal() {
  const nom = document.getElementById('modal-meal-name').value.trim();
  if (!nom) return document.getElementById('modal-meal-name').focus();
  const ingIds = [...document.querySelectorAll('#modal-ingredients input[type="checkbox"]:checked')].map(c => parseInt(c.value));
  let meal;
  if (editingMealId) {
    meal = await api.put(`/api/meals/${editingMealId}`, { nom, ingredients: ingIds });
    meals[meals.findIndex(m => m.id === editingMealId)] = meal;
  } else {
    meal = await api.post('/api/meals', { nom, ingredients: ingIds });
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

async function addMealToMenu(mealId, btn) {
  const entry = await api.post('/api/current-meals', { repasId: mealId });
  if (entry.error) return alert(entry.error);
  currentMeals.push(entry);
  meals = await api.get('/api/meals');
  cart = await api.get('/api/cart');
  updateBadges();
  const orig = btn.textContent;
  btn.textContent = '✓ Ajoute';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1200);
}

// === MENU EN COURS ===
function renderMenu() {
  const list = document.getElementById('menu-list');
  if (!currentMeals.length) {
    list.innerHTML = '<p class="list-empty">Aucun repas au menu. Ajoutez des repas depuis l\'onglet Repas.</p>';
    return;
  }
  list.innerHTML = currentMeals.map(entry => {
    const meal = meals.find(m => m.id === entry.repasId);
    const chips = meal
      ? meal.ingredients.map(id => {
          const ing = ingredients.find(i => i.id === id);
          return `<span>${ing ? escHtml(ing.nom) : 'supprime'}</span>`;
        }).join('')
      : '';
    return `
      <div class="menu-card">
        <div class="menu-card-header">
          <h3>${escHtml(entry.nom)}</h3>
          <button class="btn-success" onclick="doneMeal(${entry.id})">&#10003; Repas fait</button>
        </div>
        <div class="menu-ings">${chips || '<em>Aucun ingredient</em>'}</div>
      </div>`;
  }).join('');
}

async function doneMeal(id) {
  if (!confirm('Marquer ce repas comme fait ? Ses ingredients seront retires du stock.')) return;
  await api.delete(`/api/current-meals/${id}`);
  currentMeals = currentMeals.filter(c => c.id !== id);
  stock = await api.get('/api/stock');
  updateBadges();
  renderMenu();
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
  return `
    <div class="cart-row" id="cart-row-${item.id}">
      <div style="flex:1">
        <div class="cart-name">${escHtml(item.nom)}</div>
        ${recettesHtml}
      </div>
      <div class="qty-control">
        <button class="btn-qty" onclick="updateCartQty(${item.id}, ${qty - 1})">&#8722;</button>
        <span class="qty-value">${qty}</span>
        <button class="btn-qty" onclick="updateCartQty(${item.id}, ${qty + 1})">+</button>
      </div>
      <div class="cart-actions">
        <button class="btn-success" onclick="buyCartItem(${item.id})">&#10003; Achete</button>
        <button class="btn-icon danger" onclick="deleteCartItem(${item.id})" title="Retirer">&#128465;</button>
      </div>
    </div>`;
}

async function updateCartQty(id, newQty) {
  if (newQty < 1) {
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

async function buyCartItem(id) {
  const item = await api.put(`/api/cart/${id}`, { achete: true });
  if (item.error) return alert(item.error);
  const idx = cart.findIndex(c => c.id === id);
  cart[idx].achete = true;
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
      return `
        <div class="stock-row">
          <span class="stock-name">${escHtml(item.nom)}</span>
          <div class="qty-control">
            <button class="btn-qty" onclick="updateStockQty(${item.id}, ${qty - 1})">&#8722;</button>
            <span class="qty-value">${qty}</span>
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
