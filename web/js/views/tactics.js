const TacticsView = (() => {
  const defaultTactic = {
    name: 'New Tactic',
    attack: 1,
    defense: 1,
    possession: 0,
    passAccuracy: 0,
    foulBias: 0,
    tempo: 1,
    risk: 1,
    press: 1,
    control: 1,
    transition: 1,
    setPiece: 1,
    starMoment: 1,
    midfieldBias: 1,
    finishingBias: 1,
    widthBias: 1,
    highlineBias: 1,
    buildupBias: 1,
    setPieceBias: 1,
    physicalityBias: 1,
    description: '',
    longDescription: '',
    strengths: '',
    weaknesses: ''
  };

  const textFields = [
    { key: 'name', label: 'Tactic Name', placeholder: 'Late Counter Press' },
    { key: 'description', label: 'Short Match Card Text', placeholder: 'Fast transitions with disciplined pressure.' },
    { key: 'longDescription', label: 'Full Guide Note', placeholder: 'Explain when this tactic should be used.' },
    { key: 'strengths', label: 'Strengths', placeholder: 'Good vs high line, tired defenders, narrow shapes.' },
    { key: 'weaknesses', label: 'Weaknesses', placeholder: 'Weak vs deep blocks and elite possession teams.' }
  ];

  const fieldGroups = [
    { title: 'Core Power', hint: 'Direct attack and defensive multipliers used before chance sampling.', fields: [
      ['attack', 'Attack', 'Chance volume before finishing quality.', 0.5, 1.5, 0.01],
      ['defense', 'Defense', 'Shot suppression and pressure resistance.', 0.5, 1.5, 0.01],
      ['tempo', 'Tempo', 'Raises event speed, fatigue and volatility.', 0.5, 1.5, 0.01],
      ['risk', 'Risk', 'More upside, but more counters and cards.', 0.5, 1.5, 0.01]
    ] },
    { title: 'Ball Control', hint: 'How the tactic moves the ball and controls territory.', fields: [
      ['possession', 'Possession +/-', 'Flat possession swing added to the match model.', -10, 10, 1],
      ['passAccuracy', 'Passing +/-', 'Flat passing quality swing.', -6, 6, 1],
      ['press', 'Press', 'Turnovers, late pressure and defensive stamina cost.', 0.5, 1.5, 0.01],
      ['control', 'Control', 'Keeps xG cleaner and lowers chaos.', 0.5, 1.5, 0.01]
    ] },
    { title: 'Chance Engine', hint: 'Midfield creates xG; forwards convert it into goals.', fields: [
      ['midfieldBias', 'Midfield Creation', 'Boosts creator-driven xG production.', 0.5, 1.5, 0.01],
      ['finishingBias', 'Finishing Edge', 'Boosts conversion from striker quality.', 0.5, 1.5, 0.01],
      ['transition', 'Transitions', 'Counter and recovery speed.', 0.5, 1.5, 0.01],
      ['starMoment', 'Star Moments', 'Late-game Game Changer trigger weight.', 0.5, 1.5, 0.01]
    ] },
    { title: 'Shape Bias', hint: 'Formation fit modifiers layered over the selected XI.', fields: [
      ['widthBias', 'Width', 'Wide lanes, wing value and crossing routes.', 0.5, 1.5, 0.01],
      ['highlineBias', 'High Line', 'Press height and space behind defense.', 0.5, 1.5, 0.01],
      ['buildupBias', 'Build-up', 'Short passing and central progression.', 0.5, 1.5, 0.01],
      ['setPiece', 'Set Piece Power', 'Dead-ball chance generation.', 0.5, 1.5, 0.01],
      ['setPieceBias', 'Set Piece Bias', 'Formation-side set-piece multiplier.', 0.5, 1.5, 0.01],
      ['physicalityBias', 'Physicality', 'Duels, pressure and late-game contact.', 0.5, 1.5, 0.01],
      ['foulBias', 'Fouls +/-', 'Discipline swing; positive means more fouls/cards.', -5, 5, 1]
    ] }
  ];

  let tactics = [];
  let selectedTactic = null;

  const percentFields = new Set(['attack', 'defense', 'tempo', 'risk', 'press', 'control', 'transition', 'setPiece', 'starMoment', 'midfieldBias', 'finishingBias', 'widthBias', 'highlineBias', 'buildupBias', 'setPieceBias', 'physicalityBias']);
  const pointFields = new Set(['possession', 'passAccuracy']);

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  function numberValue(key) {
    const fallback = defaultTactic[key];
    const raw = selectedTactic && selectedTactic[key] !== null && selectedTactic[key] !== undefined ? selectedTactic[key] : fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  function formatTacticValue(key, value) {
    if (percentFields.has(key)) {
      const pct = Math.round((Number(value) - 1) * 100);
      return pct === 0 ? 'Base' : `${pct > 0 ? '+' : ''}${pct}%`;
    }
    if (pointFields.has(key)) {
      const n = Math.round(Number(value));
      return n === 0 ? '0 pts' : `${n > 0 ? '+' : ''}${n} pts`;
    }
    if (key === 'foulBias') {
      const n = Math.round(Number(value));
      if (n === 0) return 'Neutral';
      return n > 0 ? `Risk +${n}` : `Safer ${Math.abs(n)}`;
    }
    return String(value);
  }

  function tacticImpact(tactic) {
    const m = (key) => Number(tactic[key] ?? defaultTactic[key]);
    return {
      attack: (m('attack') - 1) * 100 + (m('tempo') - 1) * 15 + (m('risk') - 1) * 12 + (m('transition') - 1) * 14,
      defense: (m('defense') - 1) * 100 + (m('control') - 1) * 16 + (m('press') - 1) * 9 - Math.max(0, m('risk') - 1) * 22,
      control: (m('control') - 1) * 100 + m('possession') * 1.4 + m('passAccuracy') * 2 - Math.max(0, m('risk') - 1) * 18,
      xgCreation: (m('midfieldBias') - 1) * 100 + (m('buildupBias') - 1) * 24 + (m('press') - 1) * 18 + m('possession'),
      finishing: (m('finishingBias') - 1) * 100 + (m('transition') - 1) * 18 + (m('setPiece') - 1) * 7,
      transition: (m('transition') - 1) * 100 + (m('tempo') - 1) * 30 + (m('widthBias') - 1) * 16,
      risk: (m('risk') - 1) * 100 + (m('tempo') - 1) * 35 + (m('highlineBias') - 1) * 30 + m('foulBias') * 5,
      discipline: -(Math.max(0, m('risk') - 1) * 70 + Math.max(0, m('press') - 1) * 35 + Math.max(0, m('physicalityBias') - 1) * 30 + m('foulBias') * 6),
      setPieces: (m('setPiece') - 1) * 100 + (m('setPieceBias') - 1) * 70 + (m('physicalityBias') - 1) * 14,
      starMoment: (m('starMoment') - 1) * 100 + (m('risk') - 1) * 12 + (m('control') - 1) * 8
    };
  }

  function impactCard(key, label, value, inverted = false) {
    const roundedValue = Math.round(value);
    const good = inverted ? roundedValue < -2 : roundedValue > 2;
    const bad = inverted ? roundedValue > 2 : roundedValue < -2;
    const cls = good ? 'good' : bad ? 'bad' : 'neutral';
    const width = Math.min(100, Math.abs(roundedValue));
    const text = roundedValue === 0 ? 'Base' : `${roundedValue > 0 ? '+' : ''}${roundedValue}`;
    return `<div class="impact-card ${cls}" data-impact="${key}"><span>${label}</span><b>${text}</b><div class="impact-meter"><i style="width:${width}%"></i></div></div>`;
  }

  function updateImpactPreview() {
    const panel = document.getElementById('tactic-impact-preview');
    if (!panel || !selectedTactic) return;
    const i = tacticImpact(selectedTactic);
    panel.innerHTML = `
      <div class="tactic-impact-head"><b>Live Tactical Impact</b><span>Moving a control immediately shows what you gain and what you give up.</span></div>
      <div class="impact-grid">
        ${impactCard('attack', 'Attack', i.attack)}
        ${impactCard('defense', 'Defense', i.defense)}
        ${impactCard('control', 'Control', i.control)}
        ${impactCard('xg', 'xG Creation', i.xgCreation)}
        ${impactCard('finish', 'Finishing', i.finishing)}
        ${impactCard('transition', 'Transition', i.transition)}
        ${impactCard('risk', 'Risk', i.risk, true)}
        ${impactCard('discipline', 'Discipline', i.discipline)}
        ${impactCard('set', 'Set Pieces', i.setPieces)}
        ${impactCard('star', 'Star Moment', i.starMoment)}
      </div>`;
  }

  function renderTacticForm() {
    const form = document.getElementById('tactic-form-fields');
    if (!form) return;

    if (!selectedTactic) {
      form.innerHTML = '<div class="tactic-empty"><b>Select or create a tactic</b><span>Build a custom style, then use it from the tactical picker after drafting.</span></div>';
      return;
    }

    const textHtml = textFields.map((field) => {
      const value = selectedTactic[field.key] ?? defaultTactic[field.key];
      const input = field.key === 'longDescription'
        ? `<textarea id="tactic-${field.key}" rows="3" placeholder="${esc(field.placeholder)}">${esc(value)}</textarea>`
        : `<input type="text" id="tactic-${field.key}" value="${esc(value)}" placeholder="${esc(field.placeholder)}">`;
      return `<label class="tactic-text-field" for="tactic-${field.key}"><span>${field.label}</span>${input}</label>`;
    }).join('');

    const groupHtml = fieldGroups.map((group) => `
      <section class="tactic-field-group">
        <div class="tactic-group-head"><b>${group.title}</b><span>${group.hint}</span></div>
        <div class="tactic-control-grid">
          ${group.fields.map(([key, label, help, min, max, step]) => {
            const value = numberValue(key);
            return `<label class="tactic-range-field" for="tactic-${key}">
              <span class="tactic-range-label"><b>${label}</b><em id="tactic-${key}-value">${formatTacticValue(key, value)}</em></span>
              <input type="range" id="tactic-${key}" min="${min}" max="${max}" step="${step}" value="${value}">
              <small>${help}</small>
            </label>`;
          }).join('')}
        </div>
      </section>`).join('');

    form.innerHTML = `<section class="tactic-identity-card">${textHtml}</section><section class="tactic-impact-panel" id="tactic-impact-preview"></section>${groupHtml}`;

    [...textFields.map((f) => f.key), ...fieldGroups.flatMap((g) => g.fields.map((f) => f[0]))].forEach((key) => {
      const input = document.getElementById(`tactic-${key}`);
      if (!input) return;
      input.addEventListener('input', (event) => {
        if (typeof defaultTactic[key] === 'number') {
          selectedTactic[key] = parseFloat(event.target.value);
          const valueEl = document.getElementById(`tactic-${key}-value`);
          if (valueEl) valueEl.textContent = formatTacticValue(key, selectedTactic[key]);
          updateImpactPreview();
        } else {
          selectedTactic[key] = event.target.value;
        }
      });
    });
    updateImpactPreview();
  }

  function renderTacticList() {
    const list = document.getElementById('tactic-list');
    if (!list) return;

    if (!tactics.length) {
      list.innerHTML = '<div class="tactic-list-empty">No custom tactic yet.</div>';
    } else {
      list.innerHTML = tactics.map((tactic) => `
        <button type="button" class="tactic-item ${selectedTactic && selectedTactic.id === tactic.id ? 'selected' : ''}" data-id="${tactic.id}">
          <span><b>${esc(tactic.name)}</b><small>${esc(tactic.description || 'Custom engine style')}</small></span>
          <i class="delete-tactic" data-id="${tactic.id}" title="Delete">x</i>
        </button>
      `).join('');
    }

    document.querySelectorAll('.tactic-item').forEach((item) => {
      item.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-tactic')) return;
        const id = parseInt(event.currentTarget.dataset.id, 10);
        selectedTactic = { ...tactics.find((t) => t.id === id) };
        renderTacticList();
        renderTacticForm();
      });
    });

    document.querySelectorAll('.delete-tactic').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        const id = parseInt(event.target.dataset.id, 10);
        try {
          await Api.delete(`/api/tactics/${id}`);
          tactics = tactics.filter((t) => t.id !== id);
          if (selectedTactic && selectedTactic.id === id) selectedTactic = null;
          App.toast('Tactic deleted.');
          renderTacticList();
          renderTacticForm();
        } catch (e) {
          App.toast(e.message || 'Could not delete tactic.', true);
        }
      });
    });
  }

  function newTacticFromPreset(preset = {}) {
    selectedTactic = { ...defaultTactic, ...preset, id: null };
    renderTacticList();
    renderTacticForm();
  }

  async function init(container) {
    container.innerHTML = `
      <div id="tactics-view" class="tactics-page">
        <div class="tactics-hero card">
          <div><span>Engine Lab</span><h1>Custom Tactics</h1><p class="muted">Create styles that shape xG creation, finishing, risk, pressure and formation fit.</p></div>
          <button id="new-tactic" class="btn btn-primary">New Tactic</button>
        </div>
        <div id="tactics-container" class="tactic-builder-shell">
          <aside id="tactic-list-container" class="tactic-side-card">
            <h2>My Tactics</h2>
            <div class="tactic-preset-row">
              <button type="button" class="btn btn-ghost btn-sm" data-preset="balanced">Balanced</button>
              <button type="button" class="btn btn-ghost btn-sm" data-preset="creator">Creator</button>
              <button type="button" class="btn btn-ghost btn-sm" data-preset="finisher">Finisher</button>
            </div>
            <div id="tactic-list"></div>
          </aside>
          <main id="tactic-form-container" class="tactic-editor-card">
            <div class="tactic-editor-head"><h2>Tactic Editor</h2><button id="save-tactic" class="btn btn-primary">Save Tactic</button></div>
            <div id="tactic-form-fields"></div>
          </main>
        </div>
      </div>
    `;

    const presets = {
      balanced: { name: 'Balanced Custom', attack: 1, defense: 1, possession: 0, passAccuracy: 0, risk: 1, control: 1, description: 'Stable baseline with no extreme weakness.' },
      creator: { name: 'Midfield Creator', attack: 1.06, defense: 0.98, possession: 5, passAccuracy: 3, control: 1.14, midfieldBias: 1.18, finishingBias: 0.96, buildupBias: 1.16, description: 'High creation through midfield control.' },
      finisher: { name: 'Direct Finisher', attack: 1.08, defense: 0.94, tempo: 1.13, risk: 1.18, transition: 1.16, midfieldBias: 0.92, finishingBias: 1.2, highlineBias: 1.08, description: 'Lower build-up, sharper conversion.' }
    };

    document.getElementById('new-tactic').addEventListener('click', () => newTacticFromPreset());
    document.querySelectorAll('[data-preset]').forEach((btn) => btn.addEventListener('click', () => newTacticFromPreset(presets[btn.dataset.preset])));

    document.getElementById('save-tactic').addEventListener('click', async () => {
      if (!selectedTactic) return App.toast('Select or create a tactic first.', true);
      if (!String(selectedTactic.name || '').trim()) return App.toast('Tactic name is required.', true);

      try {
        if (selectedTactic.id) {
          const updatedTactic = await Api.put(`/api/tactics/${selectedTactic.id}`, selectedTactic);
          const index = tactics.findIndex((t) => t.id === selectedTactic.id);
          if (index >= 0) tactics[index] = updatedTactic;
          selectedTactic = { ...updatedTactic };
        } else {
          const newTactic = await Api.post('/api/tactics', selectedTactic);
          tactics.push(newTactic);
          selectedTactic = { ...newTactic };
        }
        App.toast('Tactic saved.');
        renderTacticList();
        renderTacticForm();
      } catch (e) {
        App.toast(e.message || 'Could not save tactic.', true);
      }
    });

    try {
      tactics = await Api.get('/api/tactics');
    } catch (e) {
      tactics = [];
      App.toast(e.message || 'Could not load custom tactics.', true);
    }
    renderTacticList();
    renderTacticForm();
  }

  return { init };
})();
