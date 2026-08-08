// Squad summary card shown once the draft is complete: an overall number plus six
// 0-100 bars — the four classic position-group averages (from real player overalls)
// and two mechanics-driven stats already computed by the match engine: Chemistry and
// Star Power (see server/src/game/ratings.js computeSquadCard).
const RatingsCard = {
  render(container, data) {
    const rows = [
      { key: 'attack', label: 'Attack', icon: '⚡', cls: 'attack' },
      { key: 'midfield', label: 'Midfield', icon: '🧭', cls: 'midfield' },
      { key: 'defence', label: 'Defence', icon: '🛡️', cls: 'defence' },
      { key: 'gk', label: 'GK', icon: '🧤', cls: 'gk' },
      { key: 'chemistry', label: 'Chemistry', icon: '🔗', cls: 'chemistry' },
      { key: 'starPower', label: 'Star Power', icon: '⭐', cls: 'starpower' }
    ];

    container.innerHTML = `
      <div class="ratings-card">
        <div class="ratings-overall-label">Overall</div>
        <div class="ratings-overall-value">${data.overall}</div>
        <div class="ratings-bars">
          ${rows.map((r) => `
            <div class="ratings-row">
              <div class="ratings-row-label"><span>${r.icon}</span> ${r.label}</div>
              <div class="ratings-track"><div class="ratings-fill ratings-fill-${r.cls}" style="width:${data[r.key]}%"></div></div>
              <div class="ratings-row-value">${data[r.key]}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
};
