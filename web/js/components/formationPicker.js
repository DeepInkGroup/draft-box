// Reusable formation grid + description + pitch preview. Returns { get value() }.
const FormationPicker = {
  render(container, { selected, onChange } = {}) {
    const names = Object.keys(FORMATIONS);
    let current = selected && FORMATIONS[selected] ? selected : '4-3-3';

    container.innerHTML = `
      <div class="field"><label>Formation</label></div>
      <div class="formation-grid" id="fpGrid"></div>
      <div class="formation-description" id="fpDesc"></div>
      <div id="fpPitch"></div>
    `;
    const grid = container.querySelector('#fpGrid');
    const desc = container.querySelector('#fpDesc');
    const pitchEl = container.querySelector('#fpPitch');

    function renderAll() {
      grid.innerHTML = names.map((n) => `
        <div class="formation-btn ${n === current ? 'selected' : ''}" data-f="${n}">${n}</div>
      `).join('');
      desc.textContent = getDescription(current);
      Pitch.render(pitchEl, getSlots(current), (slot) => ({ text: slot.short, title: slot.label }));

      grid.querySelectorAll('.formation-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          current = btn.dataset.f;
          renderAll();
          if (onChange) onChange(current);
        });
      });
    }

    renderAll();
    return { get value() { return current; } };
  }
};
