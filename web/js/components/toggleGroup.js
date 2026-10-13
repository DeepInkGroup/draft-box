// Reusable two-(or more)-option toggle, e.g. Show Ratings On/Off. Returns { get value() }.
const ToggleGroup = {
  render(container, { options, selected, onChange } = {}) {
    let current = selected !== undefined ? selected : options[0].value;
    let disabled = false;

    function renderAll() {
      container.innerHTML = `
        <div class="toggle-group">
          ${options.map((o, i) => `
            <button type="button" class="toggle-option ${o.value === current ? 'selected' : ''}" data-idx="${i}" data-value="${o.value}" aria-pressed="${o.value === current}" ${disabled ? 'disabled' : ''}>
              <div class="toggle-title">${o.title}</div>
              <div class="toggle-sub">${o.sub || ''}</div>
            </button>
          `).join('')}
        </div>
      `;
      container.querySelectorAll('.toggle-option').forEach((el) => {
        el.addEventListener('click', () => {
          current = options[Number(el.dataset.idx)].value;
          renderAll();
          if (onChange) onChange(current);
        });
      });
    }

    renderAll();
    return { get value() { return current; }, setDisabled(value) { disabled = !!value; renderAll(); } };
  }
};
