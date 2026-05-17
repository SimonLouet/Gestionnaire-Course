/**
 * Gestionnaire Menu Card — Custom Lovelace card for Home Assistant
 *
 * Installation :
 *   1. Dans HA → Paramètres → Tableaux de bord → ⋮ → Ressources
 *      Ajoutez : /local/gestionnaire-menu-card.js  (type: Module JavaScript)
 *      Le fichier est copié automatiquement dans /config/www/ au démarrage de l'add-on.
 *   2. Ajoutez la carte dans un tableau de bord :
 *
 *      type: custom:gestionnaire-menu-card
 *      # api_url est optionnel si l'add-on tourne avec ingress
 *      api_url: /api/hassio_ingress/gestionnaire_course
 */

class GestionnaireMenuCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._refreshTimer = null;
  }

  connectedCallback() {
    this._connected = true;
    if (this._hass) this._fetchAndRender();
    this._refreshTimer = setInterval(() => this._fetchAndRender(), 5 * 60 * 1000);
  }

  disconnectedCallback() {
    clearInterval(this._refreshTimer);
    this._connected = false;
  }

  /* HA appelle setConfig avant de monter l'élément */
  setConfig(config) {
    this._apiUrl = (config.api_url || '/api/hassio_ingress/gestionnaire_course').replace(/\/$/, '');
    this._title  = config.title || 'Menu du jour';
  }

  set hass(hass) {
    const firstLoad = !this._hass;
    this._hass = hass;
    if (firstLoad && this._connected) this._fetchAndRender();
  }

  /* ---- Fetch ---- */
  async _fetchAndRender() {
    try {
      const [currentMeals, meals, ingredients] = await Promise.all([
        this._get('/api/current-meals'),
        this._get('/api/meals'),
        this._get('/api/ingredients'),
      ]);
      this._render(currentMeals, meals, ingredients);
    } catch (err) {
      this._renderError(err.message);
    }
  }

  async _get(path) {
    const url = this._apiUrl + path;
    const res = this._hass
      ? await this._hass.fetchWithAuth(url)
      : await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${path}`);
    return res.json();
  }

  /* ---- Helpers ---- */
  _ingEntry(e) {
    return typeof e === 'number' ? { id: e, quantite: 1 } : e;
  }

  _fmtQty(q, unite) {
    const u = (unite || '').trim();
    if (!u || u === 'unité') return q > 1 ? `×${q}` : '';
    return `${q} ${u}`;
  }

  /* ---- Render ---- */
  _render(currentMeals, meals, ingredients) {
    const today     = new Date().toISOString().slice(0, 10);
    const dateLabel = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });

    const buildSlot = (moment) =>
      currentMeals
        .filter(c => c.date === today && c.moment === moment)
        .map(entry => {
          const meal = meals.find(m => m.id === entry.repasId);
          if (!meal) return null;
          const ings = meal.ingredients
            .map(e => {
              const { id, quantite } = this._ingEntry(e);
              const ing = ingredients.find(i => i.id === id);
              if (!ing) return null;
              return { nom: ing.nom, qty: this._fmtQty(quantite, ing.unite) };
            })
            .filter(Boolean);
          return { nom: meal.nom, personnes: entry.personnes || meal.portions || 2, ings };
        })
        .filter(Boolean);

    const midi = buildSlot('midi');
    const soir = buildSlot('soir');
    const rien = !midi.length && !soir.length;

    const mealHtml = (entry) => `
      <div class="meal">
        <div class="meal-name">
          ${this._esc(entry.nom)}
          <span class="portions">${entry.personnes}&nbsp;pers.</span>
        </div>
        ${entry.ings.length ? `
        <ul class="ing-list">
          ${entry.ings.map(i => `
            <li>
              ${this._esc(i.nom)}
              ${i.qty ? `<span class="qty">${this._esc(i.qty)}</span>` : ''}
            </li>`).join('')}
        </ul>` : ''}
      </div>`;

    const slotHtml = (label, entries) => `
      <div class="slot">
        <div class="slot-label">${label}</div>
        ${entries.length
          ? entries.map(mealHtml).join('')
          : '<div class="slot-empty">—</div>'}
      </div>`;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 16px; box-sizing: border-box; }

        .card-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 14px;
        }
        .card-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--primary-text-color);
        }
        .card-date {
          font-size: 0.75rem;
          color: var(--secondary-text-color);
          text-transform: capitalize;
          white-space: nowrap;
        }

        .slots {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .slot {
          background: var(--secondary-background-color, #f5f5f5);
          border-radius: 10px;
          padding: 10px 12px;
        }
        .slot-label {
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          color: var(--primary-color);
          margin-bottom: 8px;
        }
        .slot-empty {
          font-size: 0.85rem;
          color: var(--disabled-text-color, #bbb);
          font-style: italic;
        }

        .meal { margin-bottom: 8px; }
        .meal:last-child { margin-bottom: 0; }
        .meal-name {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--primary-text-color);
          line-height: 1.3;
        }
        .portions {
          font-size: 0.68rem;
          font-weight: 400;
          color: var(--secondary-text-color);
          margin-left: 4px;
        }

        .ing-list {
          margin: 5px 0 0 14px;
          padding: 0;
          list-style: disc;
        }
        .ing-list li {
          font-size: 0.78rem;
          color: var(--secondary-text-color);
          padding: 1px 0;
          line-height: 1.4;
        }
        .qty {
          font-size: 0.72rem;
          color: var(--primary-color);
          font-weight: 500;
          margin-left: 2px;
        }

        .rien {
          font-size: 0.85rem;
          color: var(--secondary-text-color);
          font-style: italic;
          text-align: center;
          padding: 8px 0;
        }

        .error {
          font-size: 0.82rem;
          color: var(--error-color, #db4437);
          padding: 4px 0;
        }
      </style>

      <ha-card>
        <div class="card-header">
          <span class="card-title">🍽 ${this._esc(this._title)}</span>
          <span class="card-date">${dateLabel}</span>
        </div>
        ${rien
          ? '<div class="rien">Aucun repas planifié aujourd\'hui.</div>'
          : `<div class="slots">
               ${slotHtml('Midi', midi)}
               ${slotHtml('Soir', soir)}
             </div>`}
      </ha-card>`;
  }

  _renderError(msg) {
    this.shadowRoot.innerHTML = `
      <ha-card>
        <div style="padding:16px">
          <div style="font-weight:600;margin-bottom:6px">🍽 Menu du jour</div>
          <div class="error">Impossible de joindre le gestionnaire&nbsp;: ${this._esc(msg)}</div>
        </div>
      </ha-card>`;
  }

  _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---- Config UI (optionnel, éditeur visuel) ---- */
  static getStubConfig() {
    return {
      api_url: '/api/hassio_ingress/gestionnaire_course',
      title: 'Menu du jour',
    };
  }

  getCardSize() { return 3; }
}

customElements.define('gestionnaire-menu-card', GestionnaireMenuCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'gestionnaire-menu-card',
  name: 'Gestionnaire – Menu du jour',
  description: 'Affiche le menu midi et soir du jour avec les ingrédients.',
  preview: false,
});
