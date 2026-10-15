const ClubIdentity = (() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function logo(code, large = false) {
    if (!/^PGL-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code || '')) return '';
    const src = `assets/clubs/pgl/${code.slice(4).toLowerCase()}.png`;
    return `<img class="club-logo${large ? ' club-logo-large' : ''}" src="${src}" alt="" width="${large ? 64 : 24}" height="${large ? 64 : 24}" decoding="async">`;
  }
  function name(code, label) {
    return `<span class="club-identity">${logo(code)}<span>${escape(label)}</span></span>`;
  }
  function profile(club) {
    if (!club) return '';
    return `<div class="club-profile">${logo(club.code, true)}<div><b>${escape(club.name)}</b>${club.headCoach ? `<p class="club-coach">Head coach: <strong>${escape(club.headCoach.name)}</strong></p>` : ''}</div></div>`;
  }
  function bindPreview(select, clubs) {
    let preview = select.parentElement.querySelector('.club-selection-preview');
    if (!preview) { preview = document.createElement('div'); preview.className = 'club-selection-preview'; preview.setAttribute('aria-live', 'polite'); select.after(preview); }
    const update = () => { preview.innerHTML = profile(clubs.find(club => club.code === select.value)); };
    select.onchange = update; update();
  }
  function freeAgents(coaches = []) {
    return coaches.length ? `<details class="coach-directory"><summary>Free-agent Coaches (${coaches.length})</summary><ul class="coach-list">${coaches.map(coach => `<li>${escape(coach.name)}</li>`).join('')}</ul></details>` : '';
  }
  return { logo, name, profile, bindPreview, freeAgents };
})();
