// Renders a top-down pitch with position dots placed by percentage x/y coordinates.
// renderSlot(slot) returns { text, title, className, nameLabel, onClick } for each dot.
const Pitch = {
  render(container, slotDefs, renderSlot) {
    const pitch = document.createElement('div');
    pitch.className = 'pitch';

    slotDefs.forEach((slot) => {
      const info = renderSlot(slot) || {};
      const dot = document.createElement('div');
      dot.className = `pitch-dot ${info.className || ''}`.trim();
      dot.style.left = slot.x + '%';
      dot.style.top = slot.y + '%';
      dot.textContent = info.text !== undefined ? info.text : slot.short;
      dot.title = info.title || slot.label;
      if (info.onClick) {
        dot.classList.add('clickable');
        dot.addEventListener('click', info.onClick);
      }
      if (info.nameLabel) {
        const nm = document.createElement('div');
        nm.className = 'pitch-name';
        nm.textContent = info.nameLabel;
        dot.appendChild(nm);
      }
      pitch.appendChild(dot);
    });

    container.innerHTML = '';
    container.appendChild(pitch);
  }
};
