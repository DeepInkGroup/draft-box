// Renders a top-down pitch with position dots placed by percentage x/y coordinates.
// renderSlot(slot) returns { text, title, className, nameLabel, badge, onClick } for each dot.
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
      if (info.badge !== undefined && info.badge !== null) {
        const badge = document.createElement('div');
        badge.className = 'pitch-badge';
        badge.textContent = info.badge;
        dot.appendChild(badge);
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

// Shared role -> CSS class mapping used everywhere a pitch dot represents an actual
// player, so Attack/Midfield/Defence/GK read the same color everywhere in the app.
const ROLE_CLASS = { FW: 'role-fw', MF: 'role-mf', DF: 'role-df', GK: 'role-gk' };
function roleClass(group) {
  return ROLE_CLASS[group] || '';
}
