const http = require('http');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(process.env.DATA_PATH || __dirname, 'db');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = parseInt(process.env.PORT) || 3000;

// --- DB helpers ---
function readDB(table) {
  const file = path.join(DB_DIR, `${table}.json`);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeDB(table, data) {
  fs.writeFileSync(path.join(DB_DIR, `${table}.json`), JSON.stringify(data, null, 2));
}

function nextId(items) {
  return items.length === 0 ? 1 : Math.max(...items.map(i => i.id)) + 1;
}

function parseBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

function normalizeIngredients(ings) {
  return (ings || []).map(e =>
    typeof e === 'number' ? { id: e, quantite: 1 } : { id: e.id, quantite: Math.max(1, parseInt(e.quantite) || 1) }
  );
}

function sendJSON(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendNotFound(res) {
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Non trouvé' }));
}

// --- Static files ---
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

function serveFile(res, filePath) {
  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Fichier non trouvé');
  }
}

// --- Server ---
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://localhost`);
  const pathname = url.pathname;
  const method = req.method;

  if (!pathname.startsWith('/api/')) {
    const filePath = pathname === '/' ? 'index.html' : pathname.slice(1);
    serveFile(res, path.join(PUBLIC_DIR, filePath));
    return;
  }

  const parts = pathname.slice(5).split('/').filter(Boolean);
  const resource = parts[0];
  const id = parts[1] ? parseInt(parts[1]) : null;

  try {
    // ---- INGREDIENTS ----
    // Modèle : { id, nom, categorie, lien }
    if (resource === 'ingredients') {
      if (method === 'GET') {
        sendJSON(res, readDB('ingredients'));

      } else if (method === 'POST') {
        const body = await parseBody(req);
        if (!body.nom || !body.nom.trim()) return sendJSON(res, { error: 'Nom requis' }, 400);
        const items = readDB('ingredients');
        const item = {
          id: nextId(items),
          nom: body.nom.trim(),
          categorie: body.categorie || '',
          lien: body.lien || '',
          unite: body.unite || '',
        };
        items.push(item);
        writeDB('ingredients', items);
        sendJSON(res, item, 201);

      } else if (method === 'PUT' && id) {
        const body = await parseBody(req);
        const items = readDB('ingredients');
        const idx = items.findIndex(i => i.id === id);
        if (idx === -1) return sendNotFound(res);
        items[idx].nom = body.nom.trim();
        items[idx].categorie = body.categorie !== undefined ? (body.categorie || '') : (items[idx].categorie || '');
        items[idx].lien = body.lien !== undefined ? (body.lien || '') : (items[idx].lien || '');
        items[idx].unite = body.unite !== undefined ? (body.unite || '') : (items[idx].unite || '');
        writeDB('ingredients', items);
        // Sync nom, catégorie et unité dans panier et stock
        const cart = readDB('cart');
        cart.forEach(c => { if (c.ingredientId === id) { c.nom = items[idx].nom; c.categorie = items[idx].categorie; c.unite = items[idx].unite; } });
        writeDB('cart', cart);
        const stock = readDB('stock');
        stock.forEach(s => { if (s.ingredientId === id) { s.nom = items[idx].nom; s.categorie = items[idx].categorie; } });
        writeDB('stock', stock);
        sendJSON(res, items[idx]);

      } else if (method === 'DELETE' && id) {
        const items = readDB('ingredients');
        writeDB('ingredients', items.filter(i => i.id !== id));
        sendJSON(res, { ok: true });
      }

    // ---- REPAS ----
    } else if (resource === 'meals') {
      if (method === 'GET') {
        sendJSON(res, readDB('meals'));

      } else if (method === 'POST') {
        const body = await parseBody(req);
        if (!body.nom || !body.nom.trim()) return sendJSON(res, { error: 'Nom requis' }, 400);
        const items = readDB('meals');
        const item = { id: nextId(items), nom: body.nom.trim(), ingredients: normalizeIngredients(body.ingredients) };
        items.push(item);
        writeDB('meals', items);
        sendJSON(res, item, 201);

      } else if (method === 'PUT' && id) {
        const body = await parseBody(req);
        const items = readDB('meals');
        const idx = items.findIndex(i => i.id === id);
        if (idx === -1) return sendNotFound(res);
        items[idx].nom = body.nom.trim();
        items[idx].ingredients = normalizeIngredients(body.ingredients);
        writeDB('meals', items);
        sendJSON(res, items[idx]);

      } else if (method === 'DELETE' && id) {
        const items = readDB('meals');
        writeDB('meals', items.filter(i => i.id !== id));
        sendJSON(res, { ok: true });
      }

    // ---- MENU EN COURS ----
    } else if (resource === 'current-meals') {
      if (method === 'GET') {
        sendJSON(res, readDB('current_meals'));

      } else if (method === 'POST') {
        const body = await parseBody(req);
        const meals = readDB('meals');
        const meal = meals.find(m => m.id === body.repasId);
        if (!meal) return sendNotFound(res);

        const currentMeals = readDB('current_meals');
        const newEntry = { id: nextId(currentMeals), repasId: meal.id, nom: meal.nom };
        currentMeals.push(newEntry);
        writeDB('current_meals', currentMeals);

        // Enregistrer la date du dernier ajout au menu
        meal.dernierAjout = new Date().toISOString().slice(0, 10);
        writeDB('meals', meals);

        // Ajouter les ingrédients au panier : incrémenter si déjà présent, sinon créer
        const allIngredients = readDB('ingredients');
        const cart = readDB('cart');
        for (const entry of meal.ingredients) {
          const ingId = typeof entry === 'number' ? entry : entry.id;
          const ingQty = typeof entry === 'number' ? 1 : (entry.quantite || 1);
          const existing = cart.find(c => c.ingredientId === ingId && !c.achete);
          if (existing) {
            existing.quantite = (existing.quantite || 1) + ingQty;
            if (!existing.recettes) existing.recettes = [];
            if (!existing.recettes.includes(meal.nom)) existing.recettes.push(meal.nom);
          } else {
            const ing = allIngredients.find(i => i.id === ingId);
            if (ing) {
              cart.push({
                id: nextId(cart),
                ingredientId: ing.id,
                nom: ing.nom,
                categorie: ing.categorie || '',
                unite: ing.unite || '',
                achete: false,
                source: 'Menu',
                recettes: [meal.nom],
                quantite: ingQty,
              });
            }
          }
        }
        writeDB('cart', cart);
        sendJSON(res, newEntry, 201);

      } else if (method === 'DELETE' && id) {
        const currentMeals = readDB('current_meals');
        const entry = currentMeals.find(c => c.id === id);
        if (!entry) return sendNotFound(res);

        // Décrémenter les ingrédients du stock (quantité - 1 par ingrédient)
        const meals = readDB('meals');
        const meal = meals.find(m => m.id === entry.repasId);
        if (meal) {
          let stock = readDB('stock');
          for (const entry of meal.ingredients) {
            const ingId = typeof entry === 'number' ? entry : entry.id;
            const ingQty = typeof entry === 'number' ? 1 : (entry.quantite || 1);
            const sIdx = stock.findIndex(s => s.ingredientId === ingId);
            if (sIdx !== -1) {
              const qty = stock[sIdx].quantite || 1;
              if (qty <= ingQty) stock.splice(sIdx, 1);
              else stock[sIdx].quantite = qty - ingQty;
            }
          }
          writeDB('stock', stock);
        }

        writeDB('current_meals', currentMeals.filter(c => c.id !== id));
        sendJSON(res, { ok: true });
      }

    // ---- PANIER ----
    // Modèle : { id, ingredientId, nom, categorie, achete, source, quantite }
    } else if (resource === 'cart') {
      if (method === 'GET') {
        sendJSON(res, readDB('cart'));

      } else if (method === 'POST') {
        const body = await parseBody(req);
        if (!body.nom || !body.nom.trim()) return sendJSON(res, { error: 'Nom requis' }, 400);
        const cart = readDB('cart');
        const allIngredients = readDB('ingredients');
        const match = allIngredients.find(i => i.nom.toLowerCase() === body.nom.trim().toLowerCase());
        const item = {
          id: nextId(cart),
          ingredientId: match ? match.id : null,
          nom: body.nom.trim(),
          categorie: match ? (match.categorie || '') : '',
          unite: match ? (match.unite || '') : '',
          achete: false,
          source: 'Manuel',
          quantite: Math.max(1, parseInt(body.quantite) || 1),
        };
        cart.push(item);
        writeDB('cart', cart);
        sendJSON(res, item, 201);

      } else if (method === 'PUT' && id) {
        // Accepte { quantite } pour modifier la quantité
        // Accepte { achete: true } pour marquer comme acheté → ajoute au stock
        const body = await parseBody(req);
        const cart = readDB('cart');
        const idx = cart.findIndex(c => c.id === id);
        if (idx === -1) return sendNotFound(res);

        if (body.quantite !== undefined) {
          cart[idx].quantite = Math.max(1, parseInt(body.quantite) || 1);
        }

        if (body.achete === true) {
          cart[idx].achete = true;
          const qty = cart[idx].quantite || 1;
          const stock = readDB('stock');
          if (cart[idx].ingredientId) {
            const sIdx = stock.findIndex(s => s.ingredientId === cart[idx].ingredientId);
            if (sIdx !== -1) {
              stock[sIdx].quantite = (stock[sIdx].quantite || 1) + qty;
            } else {
              stock.push({
                id: nextId(stock),
                ingredientId: cart[idx].ingredientId,
                nom: cart[idx].nom,
                categorie: cart[idx].categorie || '',
                quantite: qty,
              });
            }
          } else {
            stock.push({
              id: nextId(stock),
              ingredientId: null,
              nom: cart[idx].nom,
              categorie: '',
              quantite: qty,
            });
          }
          writeDB('stock', stock);
        }

        writeDB('cart', cart);
        sendJSON(res, cart[idx]);

      } else if (method === 'DELETE' && id) {
        const cart = readDB('cart');
        writeDB('cart', cart.filter(c => c.id !== id));
        sendJSON(res, { ok: true });
      }

    // ---- STOCK ----
    // Modèle : { id, ingredientId, nom, categorie, quantite }
    } else if (resource === 'stock') {
      if (method === 'GET') {
        sendJSON(res, readDB('stock'));

      } else if (method === 'PUT' && id) {
        // Modifier la quantité ; si quantite <= 0, supprime l'entrée
        const body = await parseBody(req);
        const stock = readDB('stock');
        const idx = stock.findIndex(s => s.id === id);
        if (idx === -1) return sendNotFound(res);
        if (body.quantite !== undefined) {
          const newQty = Math.max(0, parseInt(body.quantite) || 0);
          if (newQty === 0) {
            writeDB('stock', stock.filter(s => s.id !== id));
            return sendJSON(res, { removed: true });
          }
          stock[idx].quantite = newQty;
        }
        writeDB('stock', stock);
        sendJSON(res, stock[idx]);

      } else if (method === 'DELETE' && id) {
        const stock = readDB('stock');
        writeDB('stock', stock.filter(s => s.id !== id));
        sendJSON(res, { ok: true });
      }

    } else {
      sendNotFound(res);
    }

  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Erreur serveur' }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Gestionnaire de courses démarré sur le port ${PORT}`);
});
