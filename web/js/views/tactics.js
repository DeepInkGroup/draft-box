const TacticsView = (() => {
  const defaultTactic = {
    name: 'New Tactic', attack: 1, defense: 1, possession: 0, passAccuracy: 0, foulBias: 0,
    tempo: 1, risk: 1, press: 1, control: 1, transition: 1, setPiece: 1, starMoment: 1,
    midfieldBias: 1, finishingBias: 1, widthBias: 1, highlineBias: 1, buildupBias: 1,
    setPieceBias: 1, physicalityBias: 1, description: '', longDescription: '', strengths: '', weaknesses: ''
  };

  const sliderMeta = {
    attack: { label: 'Attack Intent', help: 'More pressure forward; defensive cover drops.', min: .72, max: 1.28, step: .01, axis: 'core' },
    defense: { label: 'Defensive Block', help: 'Safer shape; chance volume and tempo fall.', min: .72, max: 1.28, step: .01, axis: 'core' },
    tempo: { label: 'Tempo', help: 'Faster attacks; passing control and discipline suffer.', min: .76, max: 1.24, step: .01, axis: 'control' },
    risk: { label: 'Risk Appetite', help: 'Higher upside; counters, fouls and volatility rise.', min: .72, max: 1.28, step: .01, axis: 'control' },
    possession: { label: 'Possession Swing', help: 'Territory control; direct threat is reduced.', min: -8, max: 8, step: 1, axis: 'control' },
    passAccuracy: { label: 'Passing Quality', help: 'Cleaner moves; slower vertical attacks.', min: -5, max: 5, step: 1, axis: 'control' },
    press: { label: 'Pressing', help: 'Creates turnovers; fatigue and cards increase.', min: .74, max: 1.26, step: .01, axis: 'pressure' },
    control: { label: 'Control', help: 'Reduces chaos; transition speed is lower.', min: .74, max: 1.26, step: .01, axis: 'control' },
    midfieldBias: { label: 'Midfield Creation', help: 'More xG from creators; finishing focus drops.', min: .76, max: 1.24, step: .01, axis: 'chance' },
    finishingBias: { label: 'Finishing Edge', help: 'Better conversion; fewer crafted chances.', min: .76, max: 1.24, step: .01, axis: 'chance' },
    transition: { label: 'Transition Speed', help: 'Counters improve; control and rest defense drop.', min: .74, max: 1.26, step: .01, axis: 'chance' },
    starMoment: { label: 'Star Freedom', help: 'Stars decide late; structure becomes looser.', min: .78, max: 1.22, step: .01, axis: 'chance' },
    widthBias: { label: 'Width', help: 'Wide overloads; central compactness falls.', min: .76, max: 1.24, step: .01, axis: 'shape' },
    highlineBias: { label: 'High Line', help: 'Territory and press improve; space behind grows.', min: .76, max: 1.24, step: .01, axis: 'shape' },
    buildupBias: { label: 'Build-up', help: 'Cleaner midfield xG; directness is lower.', min: .76, max: 1.24, step: .01, axis: 'shape' },
    setPiece: { label: 'Set Piece Power', help: 'Dead balls improve; open-play rhythm drops.', min: .78, max: 1.22, step: .01, axis: 'shape' },
    setPieceBias: { label: 'Set Piece Bias', help: 'Shape leans to restarts; flow chance quality drops.', min: .78, max: 1.22, step: .01, axis: 'shape' },
    physicalityBias: { label: 'Physicality', help: 'Duels improve; fouls and passing errors increase.', min: .78, max: 1.22, step: .01, axis: 'pressure' },
    foulBias: { label: 'Discipline Line', help: 'Positive means harder contact and more cards.', min: -4, max: 4, step: 1, axis: 'pressure' }
  };

  const fieldGroups = [
    { title: 'Game Plan Core', hint: 'Attack, defense, tempo and risk cannot all peak together.', fields: ['attack', 'defense', 'tempo', 'risk'] },
    { title: 'Ball And Pressure', hint: 'Control gives safer xG; pressure gives chaos and turnovers.', fields: ['possession', 'passAccuracy', 'press', 'control'] },
    { title: 'Chance Economy', hint: 'Midfielders create xG, forwards convert it.', fields: ['midfieldBias', 'finishingBias', 'transition', 'starMoment'] },
    { title: 'Shape Details', hint: 'Formation personality and specialist edges.', fields: ['widthBias', 'highlineBias', 'buildupBias', 'setPiece', 'setPieceBias', 'physicalityBias', 'foulBias'] }
  ];
  const textFields = [
    ['name', 'Tactic Name', 'Late Counter Press'], ['description', 'Short Match Card Text', 'Fast transitions with disciplined pressure.'],
    ['longDescription', 'Full Guide Note', 'Explain when this tactic should be used.', true], ['strengths', 'Strengths', 'Good vs high line, tired defenders.'],
    ['weaknesses', 'Weaknesses', 'Weak vs deep blocks and elite possession teams.']
  ];
  const percentFields = new Set(Object.keys(sliderMeta).filter((k) => !['possession', 'passAccuracy', 'foulBias'].includes(k)));
  const pointFields = new Set(['possession', 'passAccuracy']);
  let tactics = [];
  let selectedTactic = null;

  function esc(value) { return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function roundValue(key, value) { return pointFields.has(key) || key === 'foulBias' ? Math.round(value) : Math.round(value * 100) / 100; }
  function getBase(key) { return Number(defaultTactic[key] ?? 0); }
  function tacticValue(tactic, key) { const v = Number(tactic && tactic[key] !== undefined && tactic[key] !== null ? tactic[key] : defaultTactic[key]); return Number.isFinite(v) ? v : getBase(key); }
  function setNumeric(tactic, key, value) { const m = sliderMeta[key]; tactic[key] = roundValue(key, clamp(value, m.min, m.max)); }
  function delta(key) { return tacticValue(selectedTactic, key) - getBase(key); }
  function applyOffset(tactic, key, offset) { setNumeric(tactic, key, tacticValue(tactic, key) + offset); }

  const tradeRules = {
    attack: [['defense', -.42], ['control', -.16], ['risk', .18]], defense: [['attack', -.38], ['tempo', -.14], ['transition', -.18], ['risk', -.12]],
    tempo: [['passAccuracy', -9], ['control', -.28], ['risk', .24], ['foulBias', 3]], risk: [['defense', -.34], ['control', -.2], ['transition', .2], ['starMoment', .12], ['foulBias', 4]],
    possession: [['transition', -.018], ['attack', -.008], ['control', .018]], passAccuracy: [['tempo', -.025], ['risk', -.015], ['control', .025]],
    press: [['foulBias', 5], ['defense', -.12], ['transition', .12], ['control', -.12], ['physicalityBias', .08]], control: [['tempo', -.24], ['risk', -.22], ['transition', -.2], ['passAccuracy', 8]],
    midfieldBias: [['finishingBias', -.45], ['control', .16], ['buildupBias', .12]], finishingBias: [['midfieldBias', -.42], ['control', -.12], ['transition', .08]],
    transition: [['control', -.28], ['possession', -7], ['risk', .14], ['attack', .08]], starMoment: [['control', -.12], ['risk', .12], ['defense', -.06]],
    widthBias: [['control', -.14], ['setPieceBias', .12], ['buildupBias', -.08]], highlineBias: [['defense', -.22], ['press', .16], ['risk', .2], ['foulBias', 2]],
    buildupBias: [['tempo', -.14], ['transition', -.16], ['midfieldBias', .12], ['passAccuracy', 4]], setPiece: [['tempo', -.08], ['attack', -.04], ['setPieceBias', .22]],
    setPieceBias: [['buildupBias', -.1], ['widthBias', .08], ['tempo', -.06]], physicalityBias: [['passAccuracy', -6], ['foulBias', 4], ['press', .08], ['setPiece', .08]],
    foulBias: [['defense', -.018], ['press', .015]]
  };

  function applyTradeoff(changedKey, rawValue) {
    const oldValue = tacticValue(selectedTactic, changedKey);
    setNumeric(selectedTactic, changedKey, Number(rawValue));
    const actualDelta = tacticValue(selectedTactic, changedKey) - oldValue;
    if (!actualDelta) return;
    (tradeRules[changedKey] || []).forEach(([key, weight]) => applyOffset(selectedTactic, key, actualDelta * weight));
  }

  function normalizeTactic(tactic) {
    const copy = { ...defaultTactic, ...(tactic || {}) };
    Object.keys(sliderMeta).forEach((key) => setNumeric(copy, key, tacticValue(copy, key)));
    const heat = Object.keys(sliderMeta).reduce((sum, key) => sum + Math.abs(tacticValue(copy, key) - getBase(key)) * (pointFields.has(key) || key === 'foulBias' ? .04 : 1), 0);
    if (heat > 2.45) {
      const factor = 2.45 / heat;
      Object.keys(sliderMeta).forEach((key) => setNumeric(copy, key, getBase(key) + (tacticValue(copy, key) - getBase(key)) * factor));
    }
    return copy;
  }

  function formatTacticValue(key, value) {
    if (percentFields.has(key)) { const pct = Math.round((Number(value) - 1) * 100); return pct === 0 ? 'Base' : `${pct > 0 ? '+' : ''}${pct}%`; }
    if (pointFields.has(key)) { const n = Math.round(Number(value)); return n === 0 ? '0 pts' : `${n > 0 ? '+' : ''}${n} pts`; }
    const n = Math.round(Number(value)); return n === 0 ? 'Neutral' : n > 0 ? `Hard +${n}` : `Safer ${Math.abs(n)}`;
  }

  function impact(t) {
    const m = (k) => tacticValue(t, k);
    return {
      attack: (m('attack') - 1) * 105 + (m('tempo') - 1) * 18 + (m('risk') - 1) * 14 + (m('transition') - 1) * 20,
      defense: (m('defense') - 1) * 106 + (m('control') - 1) * 18 + (m('press') - 1) * 7 - Math.max(0, m('risk') - 1) * 28 - Math.max(0, m('highlineBias') - 1) * 22,
      xgCreation: (m('midfieldBias') - 1) * 108 + (m('buildupBias') - 1) * 28 + (m('press') - 1) * 16 + m('possession') * 1.1,
      finishing: (m('finishingBias') - 1) * 112 + (m('transition') - 1) * 16 + (m('setPiece') - 1) * 9,
      control: (m('control') - 1) * 102 + m('possession') * 1.7 + m('passAccuracy') * 2.2 - Math.max(0, m('risk') - 1) * 22,
      volatility: (m('risk') - 1) * 90 + (m('tempo') - 1) * 30 + (m('highlineBias') - 1) * 26 + m('foulBias') * 5,
      discipline: -(Math.max(0, m('risk') - 1) * 72 + Math.max(0, m('press') - 1) * 42 + Math.max(0, m('physicalityBias') - 1) * 34 + m('foulBias') * 7),
      setPieces: (m('setPiece') - 1) * 95 + (m('setPieceBias') - 1) * 75 + (m('physicalityBias') - 1) * 18,
      stars: (m('starMoment') - 1) * 96 + (m('risk') - 1) * 12 + (m('finishingBias') - 1) * 10
    };
  }

  function identity(i) {
    const risk = i.volatility - i.discipline * .28;
    if (risk > 45) return ['Volatile', 'High ceiling, real defensive/card tax.'];
    if (i.control > 28 && i.defense > 12) return ['Structured', 'Safer game state and cleaner possessions.'];
    if (i.attack > 26 || i.finishing > 28) return ['Aggressive', 'Creates faster danger with less control.'];
    if (i.xgCreation > 24) return ['Creator Led', 'Midfield quality drives xG before forwards finish.'];
    return ['Balanced', 'Small edges without a major exposed weakness.'];
  }

  function impactCard(label, value, inverted = false) {
    const v = Math.round(value); const good = inverted ? v < -2 : v > 2; const bad = inverted ? v > 2 : v < -2;
    return `<div class="impact-card ${good ? 'good' : bad ? 'bad' : 'neutral'}"><span>${label}</span><b>${v === 0 ? 'Base' : `${v > 0 ? '+' : ''}${v}`}</b><div class="impact-meter"><i style="width:${Math.min(100, Math.abs(v))}%"></i></div></div>`;
  }

  function tradeLedger(t) {
    const rows = Object.keys(sliderMeta).map((key) => [key, tacticValue(t, key) - getBase(key)]).filter(([, d]) => Math.abs(d) > .009);
    if (!rows.length) return '<div class="trade-empty">No trade-offs yet. Move a slider to define an identity.</div>';
    return rows.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 8).map(([key, d]) => {
      const positive = d > 0;
      const label = sliderMeta[key].label;
      return `<span class="trade-chip ${positive ? 'gain' : 'loss'}"><b>${positive ? 'Gain' : 'Cost'}</b>${esc(label)} ${formatTacticValue(key, tacticValue(t, key))}</span>`;
    }).join('');
  }

  function updateSliders() {
    Object.keys(sliderMeta).forEach((key) => {
      const input = document.getElementById(`tactic-${key}`); const valueEl = document.getElementById(`tactic-${key}-value`);
      if (input) input.value = tacticValue(selectedTactic, key); if (valueEl) valueEl.textContent = formatTacticValue(key, tacticValue(selectedTactic, key));
    });
  }

  function updateImpactPreview() {
    const panel = document.getElementById('tactic-impact-preview'); if (!panel || !selectedTactic) return;
    const i = impact(selectedTactic); const [tag, note] = identity(i);
    panel.innerHTML = `<div class="tactic-impact-head"><b>Live Tactical Balance</b><span>Every boost now creates a visible tactical cost.</span></div>
      <div class="tactic-balance-card"><div><span>Identity</span><b>${tag}</b><small>${note}</small></div><div><span>Trade-off Heat</span><b>${Math.min(100, Math.round(Object.values(i).reduce((s, v) => s + Math.abs(v), 0) / 7))}/100</b><small>${i.discipline < -35 ? 'Card risk is high.' : 'Discipline is manageable.'}</small></div></div>
      <div class="impact-grid">${impactCard('Attack', i.attack)}${impactCard('Defense', i.defense)}${impactCard('xG Creation', i.xgCreation)}${impactCard('Finishing', i.finishing)}${impactCard('Control', i.control)}${impactCard('Volatility', i.volatility, true)}${impactCard('Discipline', i.discipline)}${impactCard('Set Pieces', i.setPieces)}${impactCard('Star Moment', i.stars)}</div>
      <div class="trade-ledger"><b>Trade-off Ledger</b><div>${tradeLedger(selectedTactic)}</div></div>`;
  }

  function renderTacticForm() {
    const form = document.getElementById('tactic-form-fields'); if (!form) return;
    if (!selectedTactic) { form.innerHTML = '<div class="tactic-empty"><b>Select or create a tactic</b><span>Build a custom style, then use it from the tactical picker after drafting.</span></div>'; return; }
    selectedTactic = normalizeTactic(selectedTactic);
    const textHtml = textFields.map(([key, label, placeholder, area]) => {
      const value = selectedTactic[key] ?? defaultTactic[key]; const input = area ? `<textarea id="tactic-${key}" rows="3" placeholder="${esc(placeholder)}">${esc(value)}</textarea>` : `<input type="text" id="tactic-${key}" value="${esc(value)}" placeholder="${esc(placeholder)}">`;
      return `<label class="tactic-text-field" for="tactic-${key}"><span>${label}</span>${input}</label>`;
    }).join('');
    const groupHtml = fieldGroups.map((group) => `<section class="tactic-field-group"><div class="tactic-group-head"><b>${group.title}</b><span>${group.hint}</span></div><div class="tactic-control-grid">${group.fields.map((key) => {
      const m = sliderMeta[key]; const value = tacticValue(selectedTactic, key);
      return `<label class="tactic-range-field" for="tactic-${key}"><span class="tactic-range-label"><b>${m.label}</b><em id="tactic-${key}-value">${formatTacticValue(key, value)}</em></span><input type="range" id="tactic-${key}" min="${m.min}" max="${m.max}" step="${m.step}" value="${value}"><small>${m.help}</small></label>`;
    }).join('')}</div></section>`).join('');
    form.innerHTML = `<section class="tactic-identity-card">${textHtml}</section><section class="tactic-impact-panel" id="tactic-impact-preview"></section>${groupHtml}`;
    textFields.forEach(([key]) => { const input = document.getElementById(`tactic-${key}`); if (input) input.addEventListener('input', (e) => { selectedTactic[key] = e.target.value; }); });
    Object.keys(sliderMeta).forEach((key) => { const input = document.getElementById(`tactic-${key}`); if (input) input.addEventListener('input', (e) => { applyTradeoff(key, e.target.value); selectedTactic = normalizeTactic(selectedTactic); updateSliders(); updateImpactPreview(); }); });
    updateImpactPreview();
  }

  function renderTacticList() {
    const list = document.getElementById('tactic-list'); if (!list) return;
    list.innerHTML = tactics.length ? tactics.map((tactic) => `<button type="button" class="tactic-item ${selectedTactic && Number(selectedTactic.id) === Number(tactic.id) ? 'selected' : ''}" data-id="${tactic.id}"><span><b>${esc(tactic.name)}</b><small>${esc(tactic.description || 'Custom engine style')}</small></span><i class="delete-tactic" data-id="${tactic.id}" title="Delete">x</i></button>`).join('') : '<div class="tactic-list-empty">No custom tactic yet.</div>';
    document.querySelectorAll('.tactic-item').forEach((item) => item.addEventListener('click', (event) => { if (event.target.classList.contains('delete-tactic')) return; const id = parseInt(event.currentTarget.dataset.id, 10); selectedTactic = { ...tactics.find((t) => Number(t.id) === id) }; renderTacticList(); renderTacticForm(); }));
    document.querySelectorAll('.delete-tactic').forEach((button) => button.addEventListener('click', async (event) => { event.stopPropagation(); const id = parseInt(event.target.dataset.id, 10); try { await Api.delete(`/api/tactics/${id}`); tactics = tactics.filter((t) => Number(t.id) !== id); if (selectedTactic && Number(selectedTactic.id) === id) selectedTactic = null; App.toast('Tactic deleted.'); renderTacticList(); renderTacticForm(); } catch (e) { App.toast(e.message || 'Could not delete tactic.', true); } }));
  }

  function newTacticFromPreset(preset = {}) { selectedTactic = normalizeTactic({ ...defaultTactic, ...preset, id: null }); renderTacticList(); renderTacticForm(); }

  async function init(container) {
    container.innerHTML = `<div id="tactics-view" class="tactics-page"><div class="tactics-hero card"><div><span>Engine Lab</span><h1>Custom Tactics</h1><p class="muted">Build a personal style with real gains, real costs, and match-engine impact.</p></div><button id="new-tactic" class="btn btn-primary">New Tactic</button></div><div id="tactics-container" class="tactic-builder-shell"><aside id="tactic-list-container" class="tactic-side-card"><h2>My Tactics</h2><div class="tactic-preset-row"><button type="button" class="btn btn-ghost btn-sm" data-preset="balanced">Balanced</button><button type="button" class="btn btn-ghost btn-sm" data-preset="creator">Creator</button><button type="button" class="btn btn-ghost btn-sm" data-preset="finisher">Finisher</button><button type="button" class="btn btn-ghost btn-sm" data-preset="chaos">Chaos</button></div><div id="tactic-list"></div></aside><main id="tactic-form-container" class="tactic-editor-card"><div class="tactic-editor-head"><h2>Tactic Editor</h2><button id="save-tactic" class="btn btn-primary">Save Tactic</button></div><div id="tactic-form-fields"></div></main></div></div>`;
    const presets = {
      balanced: { name: 'Balanced Custom', description: 'Stable baseline with no extreme weakness.' },
      creator: { name: 'Midfield Creator', possession: 5, passAccuracy: 3, control: 1.14, midfieldBias: 1.18, finishingBias: .94, buildupBias: 1.16, tempo: .95, description: 'High creation through midfield control.' },
      finisher: { name: 'Direct Finisher', attack: 1.09, defense: .94, tempo: 1.12, risk: 1.14, transition: 1.17, midfieldBias: .93, finishingBias: 1.18, description: 'Lower build-up, sharper conversion.' },
      chaos: { name: 'Purple Chaos Press', attack: 1.12, defense: .9, tempo: 1.16, risk: 1.2, press: 1.2, control: .88, highlineBias: 1.14, foulBias: 2, description: 'Aggressive press with high volatility and card risk.' }
    };
    document.getElementById('new-tactic').addEventListener('click', () => newTacticFromPreset());
    document.querySelectorAll('[data-preset]').forEach((btn) => btn.addEventListener('click', () => newTacticFromPreset(presets[btn.dataset.preset])));
    document.getElementById('save-tactic').addEventListener('click', async () => {
      if (!selectedTactic) return App.toast('Select or create a tactic first.', true);
      selectedTactic = normalizeTactic(selectedTactic);
      if (!String(selectedTactic.name || '').trim()) return App.toast('Tactic name is required.', true);
      try {
        if (selectedTactic.id) { const updated = await Api.put(`/api/tactics/${selectedTactic.id}`, selectedTactic); const idx = tactics.findIndex((t) => Number(t.id) === Number(selectedTactic.id)); if (idx >= 0) tactics[idx] = updated; selectedTactic = { ...updated }; }
        else { const created = await Api.post('/api/tactics', selectedTactic); tactics.push(created); selectedTactic = { ...created }; }
        App.toast('Tactic saved.'); renderTacticList(); renderTacticForm();
      } catch (e) { App.toast(e.message || 'Could not save tactic.', true); }
    });
    try { tactics = await Api.get('/api/tactics'); } catch (e) { tactics = []; App.toast(e.message || 'Could not load custom tactics.', true); }
    renderTacticList(); renderTacticForm();
  }

  return { init };
})();
