// Squad summary card shown once the draft is complete: an overall number plus six
// 0-100 bars — the four classic position-group averages (from real player overalls)
// and two mechanics-driven stats already computed by the match engine: Chemistry and
// Star Power (see server/src/game/ratings.js computeSquadCard).
const RatingsCard = {
  render(container, data) {
    const rows = [
      { key: 'attack', label: 'Attack', cls: 'attack' },
      { key: 'midfield', label: 'Midfield', cls: 'midfield' },
      { key: 'defence', label: 'Defence', cls: 'defence' },
      { key: 'gk', label: 'GK', cls: 'gk' },
      { key: 'chemistry', label: 'Chemistry', cls: 'chemistry' },
      { key: 'starPower', label: 'Star Power', cls: 'starpower' }
    ];

    const rowValue = (row) => row.key === 'starPower' ? `${data.starPower || 0}` : data[row.key];
    const rowWidth = (row) => {
      const value = row.key === 'starPower' ? (data.starPowerPct ?? Math.min(100, (data.starPower || 0) * 33.33)) : data[row.key];
      return Math.max(0, Math.min(100, Number(value) || 0));
    };

    container.innerHTML = `
      <div class="ratings-card">
        <div class="ratings-overall-label">Overall</div>
        <div class="ratings-overall-value">${data.overall}</div>
        <div class="ratings-bars">
          ${rows.map((r) => `
            <div class="ratings-row">
              <div class="ratings-row-label">${r.label}</div>
              <div class="ratings-track"><div class="ratings-fill ratings-fill-${r.cls}" style="width:${rowWidth(r)}%"></div></div>
              <div class="ratings-row-value">${rowValue(r)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
};
