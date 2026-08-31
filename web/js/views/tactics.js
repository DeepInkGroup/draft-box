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

  let tactics = [];
  let selectedTactic = null;

  function renderTacticForm() {
    const form = document.getElementById('tactic-form-fields');
    if (!form) return;

    if (!selectedTactic) {
        form.innerHTML = '<p class="muted">Select a tactic to edit, or create a new one.</p>';
        return;
    }

    let fields = '';
    for (const key in defaultTactic) {
        const value = selectedTactic[key] !== null && selectedTactic[key] !== undefined ? selectedTactic[key] : defaultTactic[key];
        if (key === 'name' || key === 'description' || key === 'longDescription' || key === 'strengths' || key === 'weaknesses') {
            fields += `
                <label for="tactic-${key}">${key}</label>
                <input type="text" id="tactic-${key}" value="${value}">
            `;
        } else {
            fields += `
                <label for="tactic-${key}">${key}</label>
                <input type="range" id="tactic-${key}" min="0.5" max="1.5" step="0.01" value="${value}">
                <span>${value}</span>
            `;
        }
    }
    form.innerHTML = fields;

    // Add event listeners to update the selectedTactic object on input change
    for (const key in defaultTactic) {
        const input = document.getElementById(`tactic-${key}`);
        if(!input) continue;
        input.addEventListener('input', (event) => {
        if (typeof defaultTactic[key] === 'number') {
            selectedTactic[key] = parseFloat(event.target.value);
            if(event.target.nextElementSibling) {
                event.target.nextElementSibling.textContent = selectedTactic[key];
            }
        } else {
            selectedTactic[key] = event.target.value;
        }
        });
    }
  }

  function renderTacticList() {
    const list = document.getElementById('tactic-list');
    if (!list) return;

    list.innerHTML = tactics.map(tactic => `
        <div class="tactic-item ${selectedTactic && selectedTactic.id === tactic.id ? 'selected' : ''}" data-id="${tactic.id}">
        ${tactic.name}
        <button class="delete-tactic" data-id="${tactic.id}">Delete</button>
        </div>
    `).join('');

    // Add event listeners for selecting and deleting tactics
    document.querySelectorAll('.tactic-item').forEach(item => {
        item.addEventListener('click', (event) => {
        if(event.target.classList.contains('delete-tactic')) return;
        const id = parseInt(event.currentTarget.dataset.id);
        selectedTactic = tactics.find(t => t.id === id);
        renderTacticList();
        renderTacticForm();
        });
    });

    document.querySelectorAll('.delete-tactic').forEach(button => {
        button.addEventListener('click', async (event) => {
            event.stopPropagation();
            const id = parseInt(event.target.dataset.id);
            await Api.delete(`/tactics/${id}`);
            tactics = tactics.filter(t => t.id !== id);
            if (selectedTactic && selectedTactic.id === id) {
                selectedTactic = null;
            }
            renderTacticList();
            renderTacticForm();
        });
    });
  }

  async function init(container) {
    container.innerHTML = `
        <div id="tactics-view">
        <h1>Custom Tactics</h1>
        <div id="tactics-container">
            <div id="tactic-list-container">
            <h2>My Tactics</h2>
            <div id="tactic-list"></div>
            <button id="new-tactic" class="btn btn-primary">New Tactic</button>
            </div>
            <div id="tactic-form-container">
            <h2>Tactic Editor</h2>
            <div id="tactic-form-fields"></div>
            <button id="save-tactic" class="btn btn-primary">Save Tactic</button>
            </div>
        </div>
        </div>
    `;

    document.getElementById('new-tactic').addEventListener('click', () => {
        selectedTactic = { ...defaultTactic, id: null };
        renderTacticList();
        renderTacticForm();
    });

    document.getElementById('save-tactic').addEventListener('click', async () => {
        if (!selectedTactic) return;

        if (selectedTactic.id) {
        // Update existing tactic
        const updatedTactic = await Api.put(`/tactics/${selectedTactic.id}`, selectedTactic);
        const index = tactics.findIndex(t => t.id === selectedTactic.id);
        tactics[index] = updatedTactic;
        } else {
        // Create new tactic
        const newTactic = await Api.post('/tactics', selectedTactic);
        tactics.push(newTactic);
        selectedTactic = newTactic;
        }
        renderTacticList();
    });

    try {
        tactics = await Api.get('/tactics');
    } catch (e) {
        tactics = [];
        console.error(e);
    }
    renderTacticList();
    renderTacticForm();
  }

  return { init };
})();
