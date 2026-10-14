const HelpViews = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rules = [
    ['start', 'Getting started', 'Your first game', [
      ['Choose how to play', 'Select Single Player for a solo World Cup or League Games season. Multiplayer lets you create a room or join friends with a room code.'],
      ['Build your game plan', 'Choose a formation, review the lobby rules, then build your squad. Single-player leagues have no pick timer. Lock your tactical style when your lineup is ready. If captain selection is enabled, choose a captain before entering the competition.'],
      ['Continue an existing season', 'Your league progress is saved. Open your active league from the dashboard to continue where you left off.'],
      ['Room settings', 'World Cup rooms support up to 32 human players; PGL rooms support up to 18, with a different club for each player. The host sets the draft rules and tournament length before starting. Check the lobby settings so everyone knows what to expect.']
    ]],
    ['draft', 'Drafting', 'Build a balanced XI', [
      ['How player picks work', 'Teams are revealed during drafting. Choose an available player and a slot in your formation. Fill all 11 positions, paying attention to natural roles as well as overall ratings.'],
      ['Position fit and chemistry', 'Players in suitable positions help your team perform. Chemistry also reflects player links, squad quality and balance between defense, midfield and attack. A team of stars still needs a coherent shape.'],
      ['Captains and Game Changers', 'When captain selection is enabled, the chosen captain receives +6 overall. Starred Game Changers can influence pressure moments, including late chances and knockout matches. They do not guarantee a win.'],
      ['Rerolls and draft options', 'The host can allow 1–3 rerolls or switch them off. Rerolling skips the revealed team, which remains seen. Shared Draft and other draft options depend on the lobby rules. Experimental Auto Draft is available in single player and builds your squad automatically.']
    ]],
    ['cup', 'World Cup', 'From groups to the final', [
      ['Group stage and qualification', 'The full tournament has 48 teams in 12 groups of four. Each team plays three group matches. The top two in each group and the best eight third-placed teams advance to the Round of 32.'],
      ['Knockouts and shorter tournaments', 'The knockout rounds run through the Round of 32, Round of 16, quarter-finals, semi-finals and final. Tied knockout matches go to extra time and then penalties. Blitz starts at the Round of 32; Top 8 starts at the quarter-finals.'],
      ['Live matches and stage progress', 'Your match includes a live clock and events. Other matches have final reports. With Spoiler Mode enabled, active human players must finish the current stage before the next stage is generated.'],
      ['Elimination and awards', 'An eliminated player can spectate the rest of the tournament. The final screen includes the champion, bracket and player awards such as Golden Ball, Golden Boot, Creator Award and Golden Glove.']
    ]],
    ['league', 'League Games', 'Manage more than one season', [
      ['Persian Gulf League and squad modes', 'PGL is available in single player and multiplayer. The league has 18 clubs and 34 matchdays. Choose Real Club Squads to use club players, or Draft Style to build your own XI. The optional PGL boost gives every player +10 overall.'],
      ['Mid-season transfers', 'In the lobby, choose Open or Closed transfers. An open window allows up to 1, 2 or 3 changes, depending on the selected limit. You may release fewer players than the limit. Release your selected players first, then choose a replacement for each empty slot from two randomly offered candidates.'],
      ['Team chemistry after transfers', 'Changing players briefly reduces team coordination and performance. Chemistry recovers gradually over the next few matches. Replacing more players creates more disruption, so weigh immediate upgrades against settling time.'],
      ['Tactics at the halfway point', 'In single player, enable Mid-season Tactics in the lobby to change your tactical style during the mid-season break. Multiplayer league styles stay locked for the season. If disabled, the season continues with your locked style.'],
      ['AI and end-of-season transfers', 'The lobby lets you allow AI clubs to make transfers when a window opens in single player. Multiplayer league lobbies omit AI transfer and mid-season tactic options. Each player completes or skips their own transfers before the next matchday. The transfer section records team changes. End-of-season transfers have their own Open or Closed setting and 1–3 player limit.'],
      ['Results only and season shortcuts', 'Results only runs matches automatically with no live commentary or manual match decisions. Results appear matchday by matchday until the mid-season break and then the end. The season shortcuts take you to transfers or complete the season.'],
      ['Standings, awards and another season', 'Standings show points and the bottom two clubs with a relegation arrow. Teams & Player Stats lets you inspect other squads. At the end, review the table, player awards and season results, then choose another season if you want to continue.']
    ]],
    ['faq', 'Common questions', 'A little extra help', [
      ['Why did the stronger team lose?', 'Ratings, positions, chemistry, formation and tactical style all affect expected goals. Match outcomes also include randomness. A strong squad is more likely to win, but no result is guaranteed. Use the match report to see how the game developed.'],
      ['Where are Custom Tactics?', 'Custom Tactics are available to administrators in the Tactics Lab. Players use the built-in tactical styles shown in the Formations & Tactics guide.'],
      ['How do I add friends?', 'Open Profile, then Friends. Share your friend code or enter a friend’s code to send a request. Incoming requests appear in your friends list.'],
      ['Where are my stats and preferences?', 'Profile has tabs for your career overview, friends, draft layout preferences and account security. Completed competitions update your career statistics.'],
      ['Can I change the game server?', 'Use the settings icon in the header to set the backend address. Leave it blank to use the default server. Your browser connects to that server for accounts and games.']
    ]]
  ];
  function tabs(root, name) {
    const buttons = [...root.querySelectorAll(`[data-${name}-tab]`)];
    function select(id, focus = false) {
      buttons.forEach(button => {
        const active = button.dataset[`${name}Tab`] === id;
        button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
        if (active && focus) button.focus();
      });
      root.querySelectorAll(`[data-${name}-panel]`).forEach(panel => panel.classList.toggle('hidden', panel.dataset[`${name}Panel`] !== id));
    }
    buttons.forEach((button, index) => {
      button.onclick = () => select(button.dataset[`${name}Tab`]);
      button.onkeydown = event => {
        let target;
        if (event.key === 'ArrowRight') target = (index + 1) % buttons.length;
        if (event.key === 'ArrowLeft') target = (index + buttons.length - 1) % buttons.length;
        if (event.key === 'Home') target = 0;
        if (event.key === 'End') target = buttons.length - 1;
        if (target !== undefined) { event.preventDefault(); select(buttons[target].dataset[`${name}Tab`], true); }
      };
    });
    return select;
  }
  function init() {
    AboutUs.init();
    const profile = document.getElementById('profileDialog'), selectProfile = tabs(profile, 'profile');
    document.getElementById('btnProfile').addEventListener('click', () => selectProfile('overview'));
    document.getElementById('profileCopyCode').onclick = async () => {
      const code = document.getElementById('profileFriendCode').textContent;
      if (!/^[A-Z]\d{4}$/.test(code)) return;
      try { await navigator.clipboard.writeText(code); App.toast('Friend code copied'); }
      catch { App.toast('Copy your friend code: ' + code); }
    };
    const guide = document.getElementById('gameGuideDialog');
    tabs(guide, 'guide');
    const formation = document.getElementById('guideFormation');
    formation.innerHTML = FORMATION_NAMES.map(name => `<option>${esc(name)}</option>`).join('');
    function renderFormation() {
      const slots = getSlots(formation.value);
      document.getElementById('guideFormationName').textContent = formation.value;
      document.getElementById('guideFormationDescription').textContent = getDescription(formation.value);
      document.getElementById('guideLineCounts').innerHTML = ['DF', 'MF', 'FW'].map(group => `<div><b>${slots.filter(s => s.group === group).length}</b><span>${esc(POS_LABEL[group])}s</span></div>`).join('');
      document.getElementById('guideRoles').innerHTML = slots.map(slot => `<span class="guide-role"><i class="${roleClass(slot.group)}" aria-hidden="true"></i>${esc(slot.short)}<span>${esc(slot.label)}</span></span>`).join('');
      Pitch.render(document.getElementById('guidePitch'), slots, slot => ({ text: slot.short, title: slot.label, className: roleClass(slot.group) }));
    }
    formation.onchange = renderFormation; renderFormation();
    document.getElementById('btnGameGuide').onclick = () => { guide.showModal(); loadStyles(); };
    document.getElementById('btnCloseGameGuide').onclick = () => guide.close();
    let styles = null, stylesLoading = false;
    function renderStyles() {
      if (!styles) return;
      const query = document.getElementById('guideStyleSearch').value.trim().toLowerCase();
      const filtered = styles.filter(style => [style.label, style.desc, ...(style.strengths || []), ...(style.weaknesses || [])].join(' ').toLowerCase().includes(query));
      document.getElementById('guideStyleCount').textContent = `${filtered.length} of ${styles.length} styles`;
      document.getElementById('guideStyles').innerHTML = filtered.length ? filtered.map(style => `<article class="help-card tactic-explorer-card"><h3>${esc(style.label)}</h3><p>${esc(style.desc)}</p><div class="tactic-tradeoffs"><div><span class="help-eyebrow">Strengths</span><ul>${(style.strengths || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul></div><div><span class="help-eyebrow">Watch out for</span><ul>${(style.weaknesses || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul></div></div><details><summary>How it plays</summary><p>${esc(style.longDesc)}</p>${style.synergyBest?.length ? `<p><b>Best formation fits:</b> ${style.synergyBest.map(esc).join(', ')}</p>` : ''}${style.strongAgainst?.length ? `<p><b>Favorable matchups:</b> ${style.strongAgainst.map(esc).join(', ')}</p>` : ''}${style.weakAgainst?.length ? `<p><b>Difficult matchups:</b> ${style.weakAgainst.map(esc).join(', ')}</p>` : ''}</details></article>`).join('') : '<div class="help-empty"><h3>No styles found</h3><p>Try “press”, “counter” or “passing”.</p><button class="btn btn-ghost" id="guideClearSearch">Clear search</button></div>';
      const clear = document.getElementById('guideClearSearch');
      if (clear) clear.onclick = () => { document.getElementById('guideStyleSearch').value = ''; renderStyles(); };
    }
    async function loadStyles() {
      if (styles) return renderStyles();
      if (stylesLoading) return;
      stylesLoading = true;
      document.getElementById('guideStyles').innerHTML = '<p class="help-empty" role="status">Loading tactical styles…</p>';
      try { styles = (await Api.get('/api/tactical-styles')).styles; renderStyles(); }
      catch (error) {
        document.getElementById('guideStyles').innerHTML = `<div class="help-empty"><h3>Could not load styles</h3><p>${esc(error.message)}</p><button class="btn btn-primary" id="guideRetry">Try again</button></div>`;
        document.getElementById('guideRetry').onclick = loadStyles;
      } finally { stylesLoading = false; }
    }
    document.getElementById('guideStyleSearch').oninput = renderStyles;
    const rulebook = document.getElementById('rulebookDialog');
    let category = 'start';
    const nav = document.getElementById('rulebookNav'), search = document.getElementById('rulebookSearch');
    nav.innerHTML = rules.map(([id, label]) => `<button class="rule-nav-button" data-rule-category="${id}" ${id === category ? 'aria-current="page"' : ''}>${esc(label)}<span aria-hidden="true">→</span></button>`).join('');
    function renderRules() {
      const query = search.value.trim().toLowerCase();
      const categories = query ? rules : rules.filter(([id]) => id === category);
      let count = 0;
      document.getElementById('rulebookTopics').innerHTML = categories.map(([id, label, subtitle, topics]) => {
        const found = topics.filter(([title, body]) => !query || `${label} ${title} ${body}`.toLowerCase().includes(query));
        count += found.length;
        return found.length ? `<section class="rule-topic-group"><span class="help-eyebrow">${esc(label)}</span><h2>${esc(subtitle)}</h2>${found.map(([title, body], index) => `<details class="rule-topic" ${query || index === 0 ? 'open' : ''}><summary>${esc(title)}</summary><p>${esc(body)}</p></details>`).join('')}</section>` : '';
      }).join('') || '<div class="help-empty"><h2>No matching rules</h2><p>Try “transfers”, “captain” or “friends”.</p><button class="btn btn-ghost" id="rulebookClearSearch">Clear search</button></div>';
      document.getElementById('rulebookResultCount').textContent = query ? `${count} matching ${count === 1 ? 'topic' : 'topics'}` : `${count} topics · ${rules.find(r => r[0] === category)[1]}`;
      const clear = document.getElementById('rulebookClearSearch');
      if (clear) clear.onclick = () => { search.value = ''; renderRules(); search.focus(); };
      nav.querySelectorAll('button').forEach(button => {
        if (!query && button.dataset.ruleCategory === category) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
      });
    }
    nav.querySelectorAll('button').forEach(button => button.onclick = () => { category = button.dataset.ruleCategory; search.value = ''; renderRules(); });
    search.oninput = renderRules; renderRules();
    document.getElementById('btnRulebook').onclick = () => rulebook.showModal();
    document.getElementById('btnCloseRulebook').onclick = () => rulebook.close();
  }
  return { init };
})();
