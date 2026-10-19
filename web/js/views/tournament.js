const TournamentView = {
  async render(container, code) {
    container.innerHTML = `<div class="card center muted">Loading your competition...</div>`;

    const socket = App.ensureSocket();

    let viewedStep = 0;
    let historyLength = 0;
    let tournamentStage = 'group';
    let newResultsPing = false;
    let isCreator = false;
    let lineupRevealShown = false;
    let myCode = null;
    let advanceReady = null;
    let isSpectator = false;
    let advancePending = false;
    let isLeague = false;
    let singlePlayer = false;
    let leagueName = '';
    let leagueState = null;
    let transferState = null;
    let transferPending = false;
    let skipPending = false;
    let tacticPending = false;
    let nextSeasonPending = false;
    let careerState = null;
    let managerDecisionPending = false;
    let midseasonStyle = null;
    let clubRoster = null;
    let clubRequest = 0;
    let clubPage = 1;
    let resultsOnly = false;
    let resultRounds = [];
    let resultMatchday = null;
    let hasJoinedRoom = false;
    let automaticTimer = null;
    let activeReport = null;
    App.onViewCleanup(() => { clearAutomaticTimer(); stopLiveReport(); });
    let leagueFullStats = false;
    const releaseSelection = new Set();
    const offerSelection = new Map();

    container.innerHTML = `
      <div class="card league-career" id="leagueCareerZone" style="display:none;"></div>
      <div id="championZone"></div>
      <div class="center"><span class="stage-pill" id="stagePill">...</span></div>
      <div class="card transfer-window" id="transferZone" style="display:none;"></div>
      <div class="card" id="midseasonTacticsZone" style="display:none;"></div>
      <div class="card" id="leagueTransferLogZone" style="display:none;"></div>
      <div class="card" id="leagueSeasonHistoryZone" style="display:none;"></div>
      <div class="card league-tools" id="leagueTools" style="display:none;"></div>
      <div class="card" id="leagueZone" style="display:none;"></div>
      <div class="card" id="liveZone" style="display:none;"></div>
      <div class="card" id="stepCard"></div>
      <div class="card center" id="continueZone">
        <button class="btn btn-primary" id="btnContinue">▶ Continue</button>
        <p class="muted" id="newPing" style="display:none;margin-top:8px;">🔔 New results are ready</p>
        <div class="advance-ready-panel" id="advanceReadyPanel" style="display:none;"></div>
      </div>
    `;

    const stagePill = container.querySelector('#stagePill');
    const liveZone = container.querySelector('#liveZone');
    const stepCard = container.querySelector('#stepCard');
    const championZone = container.querySelector('#championZone');
    const continueZone = container.querySelector('#continueZone');
    const btnContinue = container.querySelector('#btnContinue');
    const newPing = container.querySelector('#newPing');
    const advanceReadyPanel = container.querySelector('#advanceReadyPanel');
    const leagueZone = container.querySelector('#leagueZone');
    const transferZone = container.querySelector('#transferZone');
    const tacticsZone = container.querySelector('#midseasonTacticsZone');
    const logZone = container.querySelector('#leagueTransferLogZone');
    const seasonHistoryZone = container.querySelector('#leagueSeasonHistoryZone');
    const leagueTools = container.querySelector('#leagueTools');
    const careerZone = container.querySelector('#leagueCareerZone');

    async function loadClubSquad() {
      const select = leagueTools.querySelector('#leagueClubSelect');
      if (!select) return;
      const requestId = ++clubRequest;
      const body = leagueTools.querySelector('#leagueClubPlayers');
      clubRoster = null;clubPage=1;
      body.setAttribute('aria-busy','true');
      leagueTools.querySelector('#leagueClubPrevPage').disabled=true;leagueTools.querySelector('#leagueClubNextPage').disabled=true;
      leagueTools.querySelector('#leaguePlayerCount').textContent='Loading players...';
      body.innerHTML = '<p class="muted">Loading players and season statistics...</p>';
      leagueTools.querySelector('#leagueClubOverview').innerHTML = '';
      try {
        const data = await Api.clubSquad(code,select.value);
        if (requestId !== clubRequest || !container.contains(leagueTools)) return;
        clubRoster = data;
        body.setAttribute('aria-busy','false');
        leagueTools.querySelector('#leagueClubMeta').textContent = data.formation + ' / ' + data.tacticalStyle + ' / Stats through matchday ' + data.matchday;
        renderClubOverview(); renderClubPlayers();
      } catch(error) {
        if (requestId !== clubRequest) return;
        body.setAttribute('aria-busy','false');
        body.textContent = error.message;
        const retry = document.createElement('button'); retry.className='btn btn-ghost';retry.textContent='Try Again';retry.onclick=loadClubSquad;body.append(retry);
      }
    }
    function renderClubOverview() {
      const data = clubRoster, row = leagueState.table.find(row => row.code === data.code);
      const xi = data.players.filter(player => player.status === 'Starting XI');
      const goals = data.players.filter(player => player.stats.goals > 0).sort((a,b) => b.stats.goals - a.stats.goals);
      const metrics = [['Position',row ? '#' + row.rank : '-'],['Points',row?.pts ?? 0],['Played',row?.played ?? 0],['Goals for / against',(row?.gf ?? 0) + ' / ' + (row?.ga ?? 0)],['Average XI OVR',xi.length ? (xi.reduce((sum,p) => sum+p.overall,0)/xi.length).toFixed(1) : '-'],['Squad players',data.players.filter(p => ['Starting XI','Club roster'].includes(p.status)).length]];
      leagueTools.querySelector('#leagueClubOverview').innerHTML = `<div class="club-overview-heading">${ClubIdentity.logo(data.code, true)}<div><h3>${escapeLeagueText(data.name)}</h3>${data.headCoach ? `<p class="club-coach">Head coach: <strong>${escapeLeagueText(data.headCoach.name)}</strong></p>` : ''}<p>${data.code === myCode ? 'Your club' : data.isHuman ? 'Managed by ' + escapeLeagueText(data.username) : 'AI club'}<span class="badge">${xi.length} in starting XI</span></p></div></div><div class="club-overview-metrics">${metrics.map(([label,value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}</div>${goals.length ? `<p class="club-top-player">Top scorer: <b>${escapeLeagueText(goals[0].name)}</b> / ${goals[0].stats.goals} goals</p>` : '<p class="club-top-player muted">Player statistics build up as the season progresses.</p>'}`;
    }
    function clearClubFilters() {
      clubPage=1;
      leagueTools.querySelector('#leaguePlayerSearch').value='';
      leagueTools.querySelector('#leaguePlayerPosition').value='all';
      leagueTools.querySelector('#leaguePlayerStatus').value='all';
      leagueTools.querySelector('#leaguePlayerSort').value='squad';
      renderClubPlayers();
    }
    function renderClubPlayers() {
      if (!clubRoster) return;
      const query = leagueTools.querySelector('#leaguePlayerSearch').value.trim().toLowerCase();
      const position = leagueTools.querySelector('#leaguePlayerPosition').value;
      const status = leagueTools.querySelector('#leaguePlayerStatus').value;
      const sort = leagueTools.querySelector('#leaguePlayerSort').value;
      const order = {GK:0,DF:1,MF:2,FW:3};
      const players = clubRoster.players.filter(player => (!query || (player.name + ' ' + (player.rawPos || player.pos) + ' ' + player.clubName).toLowerCase().includes(query))
        && (position==='all' || player.pos===position)
        && (status==='all' || status==='xi' && player.status==='Starting XI' || status==='bench' && player.status==='Club roster' || status==='departed' && ['Released','Transferred out'].includes(player.status)));
      players.sort((a,b) => sort==='name' ? a.name.localeCompare(b.name) : sort==='squad' ? Number(b.status==='Starting XI') - Number(a.status==='Starting XI') || order[a.pos]-order[b.pos] || b.overall-a.overall || a.name.localeCompare(b.name) : (sort==='overall' ? b.overall-a.overall : (b.stats[sort] || 0)-(a.stats[sort] || 0)) || a.name.localeCompare(b.name));
      const pageCount=Math.max(1,Math.ceil(players.length/12));clubPage=Math.min(clubPage,pageCount);
      leagueTools.querySelector('#leagueClubPageNumber').textContent='Page '+clubPage+' of '+pageCount;
      leagueTools.querySelector('#leagueClubPrevPage').disabled=clubPage<=1;
      leagueTools.querySelector('#leagueClubNextPage').disabled=clubPage>=pageCount;
      leagueTools.querySelector('#leaguePlayerCount').textContent = players.length + ' of ' + clubRoster.players.length + ' players';
      leagueTools.querySelector('#leagueClearFilters').disabled = !query && position==='all' && status==='all' && sort==='squad';
      leagueTools.querySelector('#leagueClubPlayers').innerHTML = players.length ? players.slice((clubPage-1)*12,clubPage*12).map(player => `<article class="transfer-player-card club-player-card ${player.status==='Starting XI' ? 'club-starter' : ''}"><div class="club-player-header"><span class="club-position club-position-${player.pos.toLowerCase()}">${player.pos}</span><div><h4>${escapeLeagueText(player.name)}</h4><span class="muted">${escapeLeagueText(player.rawPos || player.pos)}${player.slotCode ? ' / ' + escapeLeagueText(player.slotCode) : ''}</span></div><span class="club-overall">${player.overall}<small>OVR</small></span></div><div class="club-player-badges"><span class="badge">${player.status==='Club roster' ? 'Club roster / Reserve' : player.status}</span>${player.isStar ? '<span class="badge">Star</span>' : ''}${player.isCaptain ? '<span class="badge">Captain</span>' : ''}</div><p class="club-source">Source club: ${escapeLeagueText(player.clubName)}</p><dl class="transfer-player-stats club-player-stats">${[['Apps',player.stats.appearances],['Goals',player.stats.goals],['Assists',player.stats.assists],['Saves',player.stats.saves],['Yellow',player.stats.yellowCards],['Red',player.stats.redCards],['Star moments',player.stats.starMoments]].map(([label,value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl></article>`).join('') : '<div class="club-empty"><b>No matching players</b><p>Try another name, position or squad filter. Clear filters to see the full club.</p></div>';
    }
    function automaticResultsReady() {
      return resultsOnly && container.contains(leagueTools) && App.state.roomCode===code && (viewedStep < historyLength || tournamentStage!=='done') && !advancePending && socket.connected && !['release','sign'].includes(transferState?.phase) && transferState?.tactics?.phase!=='choose';
    }
    function clearAutomaticTimer() {
      if (automaticTimer!==null) clearTimeout(automaticTimer);
      automaticTimer=null;
    }
    function requestAutomaticResults() {
      clearAutomaticTimer();
      if (!automaticResultsReady()) return;
      advancePending=true;renderButton();socket.emit('league:autoplay',{code,afterMatchday:viewedStep});
    }
    function scheduleAutomaticResults() {
      clearAutomaticTimer();
      if (!automaticResultsReady()) return;
      automaticTimer=setTimeout(()=>{automaticTimer=null;requestAutomaticResults();},2000);
    }
    function renderScoreRounds() {
      const target=stepCard.querySelector('#leagueScoreResults');
      if (!target || !resultRounds.length) return;
      if (!resultRounds.some(round => round.matchday===resultMatchday)) resultMatchday=resultRounds[resultRounds.length-1].matchday;
      const round=resultRounds.find(round => round.matchday===resultMatchday);
      const matches=round.matches.slice().sort((a,b)=>Number(b.aCode===myCode || b.bCode===myCode)-Number(a.aCode===myCode || a.bCode===myCode));
      target.innerHTML=`<div class="score-round-picker"><label for="leagueResultMatchday">Completed matchday</label><select id="leagueResultMatchday">${resultRounds.map(round => `<option value="${round.matchday}" ${round.matchday===resultMatchday ? 'selected' : ''}>Matchday ${round.matchday}</option>`).join('')}</select><span class="muted">Final scores</span></div><div class="matchlog">${matches.map(match => `<div class="match-row result-only-row ${match.aCode===myCode || match.bCode===myCode ? 'my-fixture' : ''}"><span>${nameTag(match.aName, match.aHuman, match.aUsername, match.aCode)}</span><b>${match.goalsA} - ${match.goalsB}</b><span>${nameTag(match.bName, match.bHuman, match.bUsername, match.bCode)}</span></div>`).join('')}</div>`;
      target.querySelector('#leagueResultMatchday').onchange=event => {resultMatchday=Number(event.target.value);renderScoreRounds();};
    }

    function renderLeagueTools() {
      if (!isLeague || !leagueState) return;
      renderMidseasonTactics();
      renderTransferLog();
      const seasons = leagueState.previousSeasons || [];
      seasonHistoryZone.style.display = seasons.length ? '' : 'none';
      seasonHistoryZone.innerHTML = seasons.length ? `<details><summary>Previous Seasons</summary>${seasons.map(season => `<div class="league-season-history"><span>Season ${season.seasonNumber} · Champion: ${escapeLeagueText(season.champion)} · Your position: ${season.userPositions?.[App.state.user.id] ?? season.positions?.[myCode] ?? season.position}</span><button class="btn btn-ghost btn-sm" data-season-code="${season.roomCode}">View Results</button></div>`).join('')}</details>` : '';
      seasonHistoryZone.querySelectorAll('[data-season-code]').forEach(button => button.onclick = () => App.goTournament(button.dataset.seasonCode));
      leagueTools.style.display = '';
      if (!leagueTools.querySelector('#btnSkipToTransfers')) {
        const clubs = leagueState.table.slice().sort((a, b) => a.name.localeCompare(b.name));
        leagueTools.innerHTML = `${ClubIdentity.freeAgents(leagueState.freeAgentCoaches)}<div class="league-season-settings" id="leagueTransferRules"></div><div class="league-cohesion hidden" id="leagueCohesion"></div><p id="leagueTransferWaiting" class="help-callout hidden" role="status"></p><div class="league-skip"><button class="btn btn-primary" id="btnSkipToTransfers">Simulate to Transfer Window</button><p class="muted" id="leagueSkipNote">Simulate the remaining first-half fixtures and stop at mid-season transfers.</p></div>
          <div class="league-finish" style="display:none"><button class="btn btn-primary" id="btnFinishLeague">Finish Season &amp; View Results</button><p class="muted">Play all remaining fixtures and see the champion, final standings, relegation and player awards.</p></div>
          <div id="leagueAutoStatus" class="league-auto-status" role="status" style="display:none"></div>
          <details id="leagueSquadBrowser" class="club-browser"><summary>Teams &amp; Player Stats<span class="club-browser-hint">Explore clubs, squads and season leaders</span></summary><div class="club-picker"><div class="field"><label for="leagueClubSelect">Browse a club</label><select id="leagueClubSelect">${clubs.map(club => `<option value="${club.code}">${escapeLeagueText(club.name)}</option>`).join('')}</select></div><div class="club-picker-actions"><button class="btn btn-ghost" id="leagueClubPrev" aria-label="Previous club">&larr;</button><button class="btn btn-ghost" id="leagueMyClub">My Club</button><button class="btn btn-ghost" id="leagueClubNext" aria-label="Next club">&rarr;</button><button class="btn btn-ghost" id="leagueRefreshClub" aria-label="Refresh club statistics">Refresh</button></div></div>
          <p class="muted" id="leagueClubMeta"></p><div id="leagueClubOverview"></div><div class="club-player-filters"><div class="field club-search"><label for="leaguePlayerSearch">Find a player</label><input id="leaguePlayerSearch" type="search" placeholder="Name, position or source club"/></div><div class="field"><label for="leaguePlayerPosition">Position</label><select id="leaguePlayerPosition"><option value="all">All positions</option><option value="GK">Goalkeepers</option><option value="DF">Defenders</option><option value="MF">Midfielders</option><option value="FW">Forwards</option></select></div><div class="field"><label for="leaguePlayerStatus">Squad</label><select id="leaguePlayerStatus"><option value="all">All players</option><option value="xi">Starting XI</option><option value="bench">Reserves</option><option value="departed">Departed players</option></select></div><div class="field"><label for="leaguePlayerSort">Sort by</label><select id="leaguePlayerSort"><option value="squad">Squad order</option><option value="overall">Overall rating</option><option value="goals">Goals</option><option value="assists">Assists</option><option value="saves">Saves</option><option value="appearances">Appearances</option><option value="name">Name</option></select></div></div><div class="club-player-list-heading"><span id="leaguePlayerCount" role="status" aria-live="polite"></span><button id="leagueClearFilters" class="btn btn-ghost btn-sm">Clear Filters</button></div><div class="transfer-player-grid league-squad-players" id="leagueClubPlayers" aria-busy="false"></div><div class="club-pagination"><button class="btn btn-ghost" id="leagueClubPrevPage">Previous Players</button><span id="leagueClubPageNumber" role="status" aria-live="polite"></span><button class="btn btn-ghost" id="leagueClubNextPage">Next Players</button></div></details>`;
        const clubSelect=leagueTools.querySelector('#leagueClubSelect');
        clubSelect.value = clubs.find(club => club.code===myCode)?.code || clubs[0].code;
        clubSelect.addEventListener('change',loadClubSquad);
        const navigateClub=delta => {clubSelect.selectedIndex=(clubSelect.selectedIndex+delta+clubs.length)%clubs.length;loadClubSquad();};
        leagueTools.querySelector('#leagueClubPrev').onclick=()=>navigateClub(-1);
        leagueTools.querySelector('#leagueClubNext').onclick=()=>navigateClub(1);
        leagueTools.querySelector('#leagueMyClub').onclick=()=>{clubSelect.value=myCode;clearClubFilters();loadClubSquad();};
        leagueTools.querySelector('#leagueRefreshClub').onclick=loadClubSquad;
        for (const id of ['leaguePlayerSearch','leaguePlayerPosition','leaguePlayerStatus','leaguePlayerSort']) leagueTools.querySelector('#'+id).addEventListener(id==='leaguePlayerSearch'?'input':'change',()=>{clubPage=1;renderClubPlayers();});
        leagueTools.querySelector('#leagueClearFilters').onclick=clearClubFilters;
        leagueTools.querySelector('#leagueClubPrevPage').onclick=()=>{clubPage--;renderClubPlayers();leagueTools.querySelector('.club-player-filters').scrollIntoView({block:'start'});};
        leagueTools.querySelector('#leagueClubNextPage').onclick=()=>{clubPage++;renderClubPlayers();leagueTools.querySelector('.club-player-filters').scrollIntoView({block:'start'});};
        leagueTools.querySelector('#leagueSquadBrowser').addEventListener('toggle',()=>{if(leagueTools.querySelector('#leagueSquadBrowser').open)loadClubSquad();});
        leagueTools.querySelector('#btnSkipToTransfers').addEventListener('click', () => {
          if (advancePending || skipPending) return;
          skipPending = true;
          advancePending = true;
          renderButton();
          renderLeagueTools();
          socket.emit('league:skipToTransfers', { code });
        });
        leagueTools.querySelector('#btnFinishLeague').addEventListener('click', () => {
          if (advancePending || transferPending) return;
          advancePending = true;
          renderButton();
          socket.emit('league:finishSeason', { code });
        });
      }
      const button = leagueTools.querySelector('#btnSkipToTransfers');
      const halfway = Math.floor(leagueState.totalMatchdays / 2);
      leagueTools.querySelector('.league-skip').style.display = singlePlayer && !resultsOnly && viewedStep < halfway && tournamentStage !== 'done' ? '' : 'none';
      button.disabled = advancePending || skipPending || transferPending || (transferState?.windowType === 'endseason' && ['release', 'sign'].includes(transferState.phase));
      button.textContent = skipPending ? 'Simulating to Mid-season...' : transferState?.phase === 'disabled' ? 'Simulate to Mid-season' : 'Simulate to Transfer Window';
      leagueTools.querySelector('#leagueSkipNote').textContent = transferState?.windowType === 'endseason' && ['release', 'sign'].includes(transferState.phase) ? 'Complete or skip end-of-season transfers before playing the new season.' : transferState?.phase === 'disabled' ? 'Simulate the remaining first-half fixtures. Transfers are closed for this season.' : 'Simulate the remaining first-half fixtures and stop at mid-season transfers.';
      leagueTools.querySelector('#leagueTransferRules').textContent = transferState?.enabled === false ? 'Transfers closed for this season' : `${transferState?.windowType === 'endseason' ? 'End-of-season' : 'Mid-season'} transfers - Maximum ${transferState?.maxChanges ?? 2} player changes`;
      const waiting = leagueTools.querySelector('#leagueTransferWaiting');
      const pendingPlayers = transferState?.waitingFor || [];
      waiting.classList.toggle('hidden', !pendingPlayers.length);
      waiting.textContent = pendingPlayers.length ? 'Waiting for ' + pendingPlayers.map(player=>player.username+' ('+player.clubName+')').join(', ') + ' to complete or skip transfers.' : '';
      const cohesion = transferState?.cohesion;
      const panel = leagueTools.querySelector('#leagueCohesion');
      panel.classList.toggle('hidden', !cohesion?.changedPlayers);
      if (cohesion?.changedPlayers) panel.innerHTML = cohesion.matchesRemaining ? `<b>Team Coordination · Settling In</b><p>${cohesion.changedPlayers} new signing${cohesion.changedPlayers === 1 ? '' : 's'} · Attack and defense currently −${cohesion.penaltyPercent}%. Recovery: ${cohesion.matchesPlayed}/${cohesion.recoveryMatches} matches played.</p><progress max="${cohesion.recoveryMatches}" value="${cohesion.matchesPlayed}" aria-label="Team coordination recovery"></progress>` : '<b>Team Coordination · Fully Settled</b><p>Your new signings have settled in. The temporary transfer penalty has ended.</p>';
      leagueTools.querySelector('.league-finish').style.display = singlePlayer && !resultsOnly && tournamentStage !== 'done' && viewedStep >= halfway && transferState?.tactics?.phase !== 'choose' && ['complete', 'skipped', 'disabled'].includes(transferState?.phase) ? '' : 'none';
      const finishButton = leagueTools.querySelector('#btnFinishLeague');
      const autoStatus=leagueTools.querySelector('#leagueAutoStatus');
      autoStatus.style.display=resultsOnly && tournamentStage!=='done' ? '' : 'none';
      autoStatus.textContent=advancePending ? 'Preparing the next final result...' : automaticResultsReady() ? 'Next matchday follows automatically in 2 seconds.' : 'Complete your enabled transfer or tactic choices. Matches then resume automatically.';
      finishButton.disabled = advancePending || transferPending;
      finishButton.textContent = advancePending ? 'Simulating Remaining Fixtures...' : 'Finish Season & View Results';
    }

    const escapeLeagueText = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

    function renderCareer() {
      const departures = careerState?.departures || leagueState?.seasonDepartures || [];
      const changes = leagueState?.managerChanges || [];
      careerZone.style.display = careerState || departures.length || changes.length ? '' : 'none';
      const currentClub = leagueState?.table.find(club => club.code === careerState?.selectedClubCode)?.name || '';
      careerZone.innerHTML = `${careerState ? `<h2>Between Seasons</h2><p class="muted">Review your next-season club before the host starts the season. Changing managers does not move footballers between clubs.</p>${careerState.phase === 'choose' ? `<h3>Your Manager Offers</h3><p>You have ${careerState.offers.length} ${careerState.offers.length === 1 ? 'offer' : 'offers'} from AI clubs. Your current club is yours to keep.</p><div class="manager-offer-grid">${careerState.offers.map(offer => `<article class="manager-offer"><span class="badge">AI club</span><h3>${ClubIdentity.name(offer.code, offer.name)}</h3><p class="muted">Take charge of this club's existing squad · ${escapeLeagueText(offer.formation)}</p><button class="btn btn-primary btn-block" data-manager-club="${offer.code}" ${managerDecisionPending ? 'disabled' : ''}>Accept Offer</button></article>`).join('')}</div><button class="btn btn-ghost" id="btnKeepManagerClub" ${managerDecisionPending ? 'disabled' : ''}>Decline Offers &amp; Stay</button>` : `<p class="manager-decision-status" role="status">${careerState.offers.length ? 'Decision saved.' : 'No AI club offers this summer.'} Your next club: <b>${escapeLeagueText(currentClub)}</b>.</p>`}<p class="muted" role="status">${careerState.waitingFor.length ? 'Waiting for manager decisions: ' + careerState.waitingFor.map(user => escapeLeagueText(user.username)).join(', ') : isCreator ? 'Everyone is ready. Start the next season below.' : 'Everyone is ready. Waiting for the host to start the next season.'}</p>` : ''}
        ${changes.length ? `<details><summary>Manager Moves (${changes.length})</summary>${changes.map(change => `<p><b>${escapeLeagueText(change.username)}</b>: ${escapeLeagueText(change.fromName)} &rarr; ${escapeLeagueText(change.toName)}</p>${(change.squadUpdates || []).map(update => `<p class="muted">Squad update: ${escapeLeagueText(update.player.name)} is signed to another club. ${escapeLeagueText(update.replacement.name)} steps into the starting XI.</p>`).join('')}`).join('')}</details>` : ''}
        ${departures.length ? `<details id="seasonDepartures"><summary>Squad Departures (${departures.length})</summary><p class="muted">These footballers left bottom-third clubs after poor season results. Reserves replace them automatically, and team chemistry recovers over four matches.</p><div class="season-departure-list">${departures.map(entry => `<article><b>${escapeLeagueText(entry.clubName)}</b><span>Finished ${entry.rank}${entry.rank === 1 ? 'st' : entry.rank === 2 ? 'nd' : entry.rank === 3 ? 'rd' : 'th'}</span><p>Left: ${escapeLeagueText(entry.player.name)} (${escapeLeagueText(entry.player.rawPos || entry.player.pos)})</p><p class="muted">Replacement: ${escapeLeagueText(entry.replacement.name)}</p></article>`).join('')}</div></details>` : careerState ? '<p class="muted">No footballers departed after poor results this summer.</p>' : ''}`;
      const decide = clubCode => {
        if (managerDecisionPending) return;
        managerDecisionPending = true;
        socket.emit('league:managerDecision', { code, clubCode });
        renderCareer();
      };
      careerZone.querySelectorAll('[data-manager-club]').forEach(button => button.onclick = () => decide(button.dataset.managerClub));
      const stay = careerZone.querySelector('#btnKeepManagerClub');
      if (stay) stay.onclick = () => decide(null);
      const next = championZone.querySelector('#btnNextLeagueSeason');
      if (next && careerState) {
        next.disabled = nextSeasonPending || !careerState.ready;
        next.textContent = careerState.ready ? 'Start Next Season' : 'Waiting for Manager Decisions';
      }
    }
    function renderMidseasonTactics() {
      const choice = transferState?.tactics;
      tacticsZone.style.display = choice?.phase === 'choose' ? '' : 'none';
      if (choice?.phase !== 'choose') { midseasonStyle = null; return; }
      if (!midseasonStyle) midseasonStyle = choice.current;
      tacticsZone.innerHTML = `<h3>Mid-season Tactics</h3><p class="muted">Choose a tactic for the second half, or keep your current plan. Your first-half results remain unchanged.</p><div class="field"><label for="midseasonStyle">Tactical Style</label><select id="midseasonStyle" ${tacticPending ? 'disabled' : ''}>${choice.styles.map(style => `<option value="${style.key}">${style.label}</option>`).join('')}</select></div><p class="muted" id="midseasonStyleDescription"></p><div class="dialog-actions"><button class="btn btn-ghost" id="btnKeepLeagueTactic" ${tacticPending ? 'disabled' : ''}>Keep Current Tactic</button><button class="btn btn-primary" id="btnChangeLeagueTactic" ${tacticPending ? 'disabled' : ''}>Apply Tactic</button></div>`;
      const select = tacticsZone.querySelector('#midseasonStyle'); select.value = midseasonStyle;
      const describe = () => { midseasonStyle = select.value; tacticsZone.querySelector('#midseasonStyleDescription').textContent = choice.styles.find(style => style.key === select.value)?.desc || ''; };
      select.onchange = describe; describe();
      const send = (action) => { if (tacticPending) return; tacticPending = true; renderMidseasonTactics(); socket.emit('league:tactics',{ code, action, tacticalStyle: midseasonStyle }); };
      tacticsZone.querySelector('#btnKeepLeagueTactic').onclick = () => send('keep');
      tacticsZone.querySelector('#btnChangeLeagueTactic').onclick = () => send('change');
    }
    function renderTransferLog() {
      if (!transferState) return;
      const entries = transferState.log || [];
      logZone.style.display = transferState.aiEnabled || entries.length ? '' : 'none';
      if (!logZone.querySelector('#leagueTransferLog')) {
        logZone.innerHTML = `<details id="leagueTransferLog"><summary>Transfer Center <span class="badge" id="leagueDealCount"></span></summary><p class="muted">Completed mid-season and end-of-season deals, including AI player exchanges.</p><div class="field"><label for="leagueDealSearch">Search players or clubs</label><input type="search" id="leagueDealSearch" placeholder="Player or club name"></div><div class="league-deals" id="leagueDealRows"></div></details>`;
        logZone.querySelector('#leagueDealSearch').oninput = renderTransferLog;
      }
      logZone.querySelector('#leagueDealCount').textContent = `${entries.length} deals`;
      const query = logZone.querySelector('#leagueDealSearch').value.trim().toLowerCase();
      const matches = entries.filter(entry => `${entry.player.name} ${entry.fromName} ${entry.toName} ${entry.exchangedPlayer?.name || ''} ${entry.releasedPlayer?.name || ''}`.toLowerCase().includes(query));
      logZone.querySelector('#leagueDealRows').innerHTML = matches.map(entry => `<article class="league-deal"><span class="badge">${entry.type === 'ai' ? 'AI exchange' : entry.to === myCode ? 'Your signing' : 'Player signing'} · MD ${entry.windowType === 'endseason' ? '0 / End-of-season' : entry.matchday}</span><h4>${escapeLeagueText(entry.player.name)} <span class="muted">OVR ${entry.player.overall}</span></h4><p>${escapeLeagueText(entry.fromName)} → ${escapeLeagueText(entry.toName)}</p>${entry.exchangedPlayer ? `<p class="muted">In exchange: ${escapeLeagueText(entry.exchangedPlayer.name)} (OVR ${entry.exchangedPlayer.overall}) → ${escapeLeagueText(entry.fromName)}</p>` : entry.releasedPlayer ? `<p class="muted">Released: ${escapeLeagueText(entry.releasedPlayer.name)}</p>` : ''}</article>`).join('') || `<p class="muted">${query ? 'No deals match this search.' : viewedStep < Math.floor(leagueState.totalMatchdays / 2) ? 'Transfers will appear at mid-season.' : 'No completed transfers in this window.'}</p>`;
    }

    function transferPlayerHtml(player) {
      const stats = player.stats;
      return `<div class="transfer-player-head"><b>${player.name}</b><span class="badge">OVR ${player.overall}</span></div>
        <p>${player.clubName} · ${player.rawPos || player.pos}${player.slotCode ? ' · Slot ' + player.slotCode : ''}</p>
        <div class="transfer-player-tags"><span>${player.status}</span>${player.isStar ? '<span>★ Star</span>' : ''}${player.isCaptain ? '<span>Captain</span>' : ''}</div>
        <dl class="transfer-player-stats">${[['Apps', stats.appearances], ['Goals', stats.goals], ['Assists', stats.assists], ['Saves', stats.saves], ['Yellow', stats.yellowCards], ['Red', stats.redCards], ['Star moments', stats.starMoments]].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
    }

    function sendTransfer(action, extra = {}) {
      if (transferPending) return;
      transferPending = true;
      renderTransfers();
      socket.emit('league:transfer', { code, action, ...extra });
    }

    function renderTransfers() {
      const open = transferState && ['release', 'sign'].includes(transferState.phase);
      transferZone.style.display = open ? '' : 'none';
      if (!open) return;
      if (transferState.phase === 'release') {
        transferZone.innerHTML = `<h3>${transferState.windowType === 'endseason' ? 'End-of-season' : 'Mid-season'} Transfer Window</h3><p class="muted">First release 1 to ${transferState.maxChanges ?? 2} players from your XI (maximum ${transferState.maxChanges ?? 2}). Then choose a replacement for each vacant position. The season pauses until your XI is complete.</p>
          <p id="releaseCount">${releaseSelection.size} selected · maximum ${transferState.maxChanges ?? 2}</p>
          <div class="transfer-player-grid">${transferState.squad.map((player) => `<button class="transfer-player-card ${releaseSelection.has(player.id) ? 'selected' : ''}" data-release="${player.id}" aria-pressed="${releaseSelection.has(player.id)}" ${transferPending ? 'disabled' : ''}>${transferPlayerHtml(player)}</button>`).join('')}</div>
          <div class="dialog-actions"><button class="btn btn-ghost" id="btnSkipTransfers" ${transferPending ? 'disabled' : ''}>Keep Current Squad</button><button class="btn btn-primary" id="btnReleasePlayers" ${releaseSelection.size === 0 || transferPending ? 'disabled' : ''}>${releaseSelection.size ? `Release ${releaseSelection.size} Player${releaseSelection.size === 1 ? '' : 's'}` : 'Release Players'}</button></div>`;
        transferZone.querySelectorAll('[data-release]').forEach((button) => button.addEventListener('click', () => {
          const id = button.dataset.release;
          if (releaseSelection.has(id)) releaseSelection.delete(id);
          else if (releaseSelection.size < (transferState.maxChanges ?? 2)) releaseSelection.add(id);
          renderTransfers();
        }));
        transferZone.querySelector('#btnReleasePlayers').addEventListener('click', () => sendTransfer('release', { playerIds: [...releaseSelection] }));
        transferZone.querySelector('#btnSkipTransfers').addEventListener('click', () => sendTransfer('skip'));
      } else {
        const count = transferState.vacancies.length;
        const playerLabel = count === 1 ? '1 Player' : `${count} Players`;
        transferZone.innerHTML = `<h3>Transfer Window - Sign ${playerLabel}</h3><p class="muted">Choose one of two random players for each vacant position. Offers stay fixed when you reload. Ratings do not affect which players are offered.</p>
          <details><summary>Released players</summary><div class="transfer-player-grid">${transferState.outgoing.map(player => `<article class="transfer-player-card">${transferPlayerHtml(player)}</article>`).join('')}</div></details>
          <div class="transfer-sign-grid">${transferState.vacancies.map((slot, index) => `<section id="transferPick${index}" class="transfer-offer-group"><h4>${slot.label} (${slot.code})${slot.isCaptain ? ' - Captain' : ''}</h4><div class="transfer-offer-options">${transferState.market.filter(player => player.eligibleSlots.includes(slot.code)).map(player => `<button type="button" class="transfer-player-card transfer-offer-card ${offerSelection.get(slot.code) === player.id ? 'selected' : ''}" data-offer-slot="${slot.code}" data-player="${player.id}" aria-pressed="${offerSelection.get(slot.code) === player.id}" ${transferPending ? 'disabled' : ''}>${transferPlayerHtml(player)}<span class="transfer-offer-choice">${offerSelection.get(slot.code) === player.id ? 'Selected' : 'Choose Player'}</span></button>`).join('')}</div></section>`).join('')}</div>
          <button class="btn btn-primary btn-block" id="btnSignPlayers" ${transferPending || transferState.vacancies.some(slot => !offerSelection.has(slot.code)) ? 'disabled' : ''}>Sign ${playerLabel} &amp; Continue Season</button>`;
        transferZone.querySelectorAll('[data-offer-slot]').forEach(button => button.onclick = () => {
          offerSelection.set(button.dataset.offerSlot, button.dataset.player);
          renderTransfers();
        });
        transferZone.querySelector('#btnSignPlayers').onclick = () => sendTransfer('sign', {
          picks: transferState.vacancies.map(slot => ({ slotCode: slot.code, playerId: offerSelection.get(slot.code) }))
        });
      }
    }

    function renderLeagueTable() {
      if (!leagueState) return;
      const previousScroll=leagueZone.querySelector('.league-table-scroll')?.scrollLeft || 0;
      leagueZone.style.display = '';
      const next = (leagueState.nextFixtures || []).find((match) => match.aCode === myCode || match.bCode === myCode);
      leagueZone.innerHTML = `<div class="league-table-heading"><h3>${leagueState.name} - Season ${leagueState.seasonNumber || 1}</h3>${leagueState.pglRatingBoost ? '<span class="badge">All players +10 OVR</span>' : ''}<span class="badge">Matchday ${leagueState.matchday} / ${leagueState.totalMatchdays}</span></div>
        ${next ? `<p class="muted league-next-fixture">Next: ${nameTag(next.aName, next.aHuman, next.aUsername, next.aCode)} vs ${nameTag(next.bName, next.bHuman, next.bUsername, next.bCode)} · ${next.aCode === myCode ? 'Home' : 'Away'}</p>` : ''}
        <button class="btn btn-ghost league-table-toggle" id="leagueTableToggleStats" aria-pressed="${leagueFullStats}">${leagueFullStats ? 'Compact standings' : 'Show all stats'}</button><div class="league-table-scroll ${leagueFullStats ? 'league-full-stats' : ''}" tabindex="0" role="region" aria-label="League standings${leagueFullStats ? ', scroll horizontally for all statistics' : ''}"><table class="group-table league-table"><caption class="sr-only">League standings</caption>
          <thead><tr><th scope="col">#</th><th scope="col">Club</th><th scope="col" title="Played">P</th><th scope="col">W</th><th scope="col">D</th><th scope="col">L</th><th scope="col">GF</th><th scope="col">GA</th><th scope="col">GD</th><th scope="col" title="Points">Pts</th></tr></thead>
          <tbody>${leagueState.table.map((row, index) => {
            const bottomTwo = index >= leagueState.table.length - 2;
            const status = leagueState.matchday === leagueState.totalMatchdays ? 'Relegated' : 'Relegation zone';
            return `<tr class="${row.code === myCode ? 'human' : ''} ${bottomTwo ? 'league-relegation' : ''}"><td>${row.rank}</td><td><span class="league-club-name">${nameTag(row.name, row.isHuman, row.username, row.code)}${bottomTwo ? ` <span class="relegation-mark" role="img" aria-label="${status}" title="${status}">↓</span>` : ''}</span><span class="league-club-meta">${row.code === myCode ? '<b>You</b><span class="league-mobile-gd"> · </span>' : ''}<span class="league-mobile-gd">GD ${row.gd > 0 ? '+' : ''}${row.gd}</span></span></td><td>${row.played}</td><td>${row.w}</td><td>${row.d}</td><td>${row.l}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.gd > 0 ? '+' : ''}${row.gd}</td><td><b>${row.pts}</b></td></tr>`;
          }).join('')}</tbody>
        </table></div><p class="league-table-note relegation-legend"><span class="relegation-mark" aria-hidden="true">↓</span> ${leagueState.matchday === leagueState.totalMatchdays ? 'Bottom two teams are relegated.' : 'Bottom two teams are in the relegation zone.'}</p><p class="muted league-table-note league-table-hint">P = Played · Pts = Points · GD = Goal difference.<br>${leagueFullStats ? 'Swipe the table to see every statistic.' : 'Goal difference appears below each club. Tap Show all stats for the full table.'}</p><p class="muted league-table-note">Win: 3 points · Draw: 1 point · Ranked by points, goal difference, then goals scored.</p>`;
      leagueZone.querySelector('.league-table-scroll').scrollLeft=leagueFullStats ? previousScroll : 0;
      leagueZone.querySelector('#leagueTableToggleStats').onclick=()=>{leagueFullStats=!leagueFullStats;renderLeagueTable();};
    }

    function scoreText(m) {
      let s = `${m.goalsA} - ${m.goalsB}`;
      if (m.wentToExtraTime) s += ' (AET)';
      if (m.wentToPenalties) s += ` (pens: ${m.penalties.A}-${m.penalties.B})`;
      return s;
    }

    function penaltyShootoutHtml(m) {
      if (!m.wentToPenalties || !m.penaltyKicks) return '';
      const rows = m.penaltyKicks.map((k) => `
        <div class="pen-kick-line ${k.scored ? 'scored' : 'missed'}">
          <span>${k.side === 'A' ? '←' : '→'} ${k.player}</span>
          <span class="pen-kick-result">${k.scored ? 'Scored' : 'Missed'}</span>
        </div>
      `).join('');
      return `
        <div class="pen-shootout">
          <div class="pen-shootout-title">Penalty Shootout — ${m.penalties.A}-${m.penalties.B}</div>
          ${rows}
        </div>
      `;
    }

    // Online league clubs keep their identity alongside their human manager.
    function nameTag(name, isHuman, username, clubCode) {
      if (isLeague) return ClubIdentity.name(clubCode, name, !singlePlayer && isHuman ? username : null);
      return isHuman ? username : name;
    }

    function eventIcon(e) {
      if (e.type === 'goal') return '<span class="event-symbol ball" title="Goal">&#9917;</span>';
      if (e.type === 'yellow') return '<span class="match-card-icon yellow" title="Yellow card"></span>';
      if (e.type === 'red') return '<span class="match-card-icon red" title="Red card"></span>';
      if (e.type === 'star') return '<span class="event-symbol star" title="Star moment">&#9733;</span>';
      if (e.type === 'chance') return '<span class="event-symbol chance" title="Big chance">!</span>';
      if (e.type === 'woodwork') return '<span class="event-symbol post" title="Woodwork">POST</span>';
      if (e.type === 'pressure') return '<span class="event-symbol pressure" title="Pressure">PRESS</span>';
      return '<span class="match-card-icon red" title="Red card"></span>';
    }

    function eventTone(e) {
      return ['star', 'chance', 'woodwork', 'pressure'].includes(e.type) ? e.type : '';
    }

    function eventLine(e) {
      const icon = eventIcon(e);
      let text = `${icon} ${e.minute}' ${e.player}`;
      if (e.type === 'goal' && e.assistBy) text += ` <span class="muted">(assist: ${e.assistBy})</span>`;
      if (e.type === 'star' && e.effect) text += ` <span class="muted">(${e.effect}, +${e.boost} xG)</span>`;
      if (['chance', 'woodwork', 'pressure'].includes(e.type) && e.effect) text += ` <span class="muted">(${e.effect})</span>`;
      if (e.type === 'red') text += e.reason === 'second-yellow' ? ` <span class="muted">(2nd yellow)</span>` : ` <span class="muted">(straight red)</span>`;
      return `<div class="report-line ${eventTone(e)}">${text}</div>`;
    }

    function teamEventsHtml(m) {
      const visibleEvents = (m.events || []).filter((e) => e.type !== 'save');
      const bySide = {
        A: visibleEvents.filter((e) => e.side === 'A'),
        B: visibleEvents.filter((e) => e.side === 'B')
      };
      const column = (side, teamName) => `
        <div class="team-event-col">
          <div class="team-event-title">${teamName}</div>
          <div class="team-event-list">
            ${bySide[side].length ? bySide[side].map(eventLine).join('') : '<p class="muted">No notable events.</p>'}
          </div>
        </div>
      `;
      if (!visibleEvents.length) return '<p class="muted" style="margin:6px 0;">No notable events.</p>';
      return `<div class="team-events-grid">${column('A', nameTag(m.aName, m.aHuman, m.aUsername, m.aCode))}${column('B', nameTag(m.bName, m.bHuman, m.bUsername, m.bCode))}</div>`;
    }

    function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

    // Final, already-decided stats for a match — used for every static ("final report")
    // display, where there's no clock to animate against.
    function finalMatchStats(m) {
      if (!m.stats) return null;
      return { A: m.stats.A, B: m.stats.B, xgA: m.xgA, xgB: m.xgB };
    }

    function statProgressFraction(m, side, clock, matchLenMinutes, statKey) {
      const final = m.stats && m.stats[side] ? Number(m.stats[side][statKey] || 0) : 0;
      if (!final) return 0;
      const base = clamp(clock / matchLenMinutes, 0, 1);
      if (base >= 0.995) return 1;
      const sideBias = side === 'A' ? 0.31 : 0.57;
      const wave = Math.sin((base * Math.PI * 2.6) + sideBias) * 0.055 + Math.sin((base * Math.PI * 5.1) + sideBias * 2) * 0.025;
      const tacticalTempo = ((m.tactical && m.tactical[side] && m.tactical[side].mods && m.tactical[side].mods.tempo) || 1) - 1;
      const urgency = tacticalTempo * 0.075 * (1 - base);
      const curve = statKey === 'passes' ? Math.pow(base, 0.9) : Math.pow(base, 1.04) + wave + urgency;
      return clamp(curve, 0, 1);
    }

    function liveXgForSide(m, side, clock, matchLenMinutes, timeline) {
      const finalXg = side === 'A' ? Number(m.xgA || 0) : Number(m.xgB || 0);
      const baseFrac = clamp(clock / matchLenMinutes, 0, 1);
      if (baseFrac >= 0.995) return finalXg;
      const base = finalXg * Math.pow(baseFrac, 1.08) * 0.58;
      const eventXg = timeline.filter((e) => e.side === side && e.minute <= clock).reduce((sum, e) => {
        if (e.type === 'goal') return sum + 0.3;
        if (e.type === 'star') return sum + Number(e.boost || 0.12);
        if (e.type === 'chance') return sum + 0.22;
        if (e.type === 'woodwork') return sum + 0.16;
        if (e.type === 'pressure') return sum + 0.08;
        return sum;
      }, 0);
      const lateCatchup = finalXg * Math.pow(baseFrac, 2.25) * 0.2;
      return clamp(Math.min(finalXg, base + eventXg + lateCatchup), 0, finalXg);
    }

    // Builds live stats with tempo waves and event-driven xG jumps, so shots/xG do not
    // rise in a perfectly straight line while the match clock runs.
    function liveStatsAtClock(m, clock, possessionJitter, matchLenMinutes, cardCounts) {
      if (!m.stats) return null;
      const frac = clamp(clock / matchLenMinutes, 0, 1);
      const decay = 1 - frac;
      const possA = Math.round(clamp(m.stats.A.possession + possessionJitter * decay, 20, 80));
      const possB = 100 - possA;
      const timeline = (m.events || []).filter((e) => e.type !== 'save');
      const eventShots = (sideKey) => timeline.filter((e) => e.side === sideKey && e.minute <= clock && ['goal', 'chance', 'woodwork'].includes(e.type)).length;
      const eventSot = (sideKey) => timeline.filter((e) => e.side === sideKey && e.minute <= clock && e.type === 'goal').length;
      const scale = (n, sideKey, statKey) => Math.round(n * statProgressFraction(m, sideKey, clock, matchLenMinutes, statKey));
      const side = (s, sideKey) => ({
        possession: sideKey === 'A' ? possA : possB,
        passAccuracy: s.passAccuracy,
        passes: scale(s.passes, sideKey, 'passes'),
        shots: Math.max(eventShots(sideKey), scale(s.shots, sideKey, 'shots')),
        shotsOnTarget: Math.max(eventSot(sideKey), scale(s.shotsOnTarget, sideKey, 'shotsOnTarget')),
        corners: scale(s.corners, sideKey, 'corners'),
        fouls: scale(s.fouls, sideKey, 'fouls'),
        yellowCards: cardCounts ? cardCounts.A_yellow : 0,
        redCards: cardCounts ? cardCounts.A_red : 0,
        saves: scale(s.saves, sideKey, 'saves')
      });
      return {
        A: side(m.stats.A, 'A'),
        B: { ...side(m.stats.B, 'B'), yellowCards: cardCounts ? cardCounts.B_yellow : 0, redCards: cardCounts ? cardCounts.B_red : 0 },
        xgA: liveXgForSide(m, 'A', clock, matchLenMinutes, timeline),
        xgB: liveXgForSide(m, 'B', clock, matchLenMinutes, timeline)
      };
    }

    function matchStatsHtml(stats) {
      if (!stats) return '';
      const row = (label, a, b) => `
        <div class="stat-row">
          <span class="stat-val">${a}</span>
          <span class="stat-label">${label}</span>
          <span class="stat-val">${b}</span>
        </div>
      `;
      const cardsText = (s) => {
        const parts = [];
        if (s.yellowCards) parts.push(`<span class="card-stat">${s.yellowCards}<span class="match-card-icon yellow small"></span></span>`);
        if (s.redCards) parts.push(`<span class="card-stat">${s.redCards}<span class="match-card-icon red small"></span></span>`);
        return parts.length ? parts.join(' ') : '-';
      };
      return `
        <div class="match-stats">
          ${row('Possession', `${stats.A.possession}%`, `${stats.B.possession}%`)}
          ${row('Shots (on target)', `${stats.A.shots} (${stats.A.shotsOnTarget})`, `${stats.B.shots} (${stats.B.shotsOnTarget})`)}
          ${row('Passes (acc.)', `${stats.A.passes} (${stats.A.passAccuracy}%)`, `${stats.B.passes} (${stats.B.passAccuracy}%)`)}
          ${row('Corners', stats.A.corners, stats.B.corners)}
          ${row('Fouls', stats.A.fouls, stats.B.fouls)}
          ${row('Cards', cardsText(stats.A), cardsText(stats.B))}
          ${row('Saves', stats.A.saves, stats.B.saves)}
          ${row('xG', stats.xgA.toFixed(2), stats.xgB.toFixed(2))}
        </div>
      `;
    }

    function renderAdvanceReady() {
      if (!advanceReady || !advanceReady.spoilerMode || tournamentStage === 'done') {
        advanceReadyPanel.style.display = 'none';
        advanceReadyPanel.innerHTML = '';
        return;
      }
      const members = advanceReady.members || [];
      const requiredMembers = members.filter((m) => m.required !== false);
      const readyCount = requiredMembers.filter((m) => m.ready).length;
      advanceReadyPanel.style.display = 'block';
      advanceReadyPanel.innerHTML = [
        '<div class="advance-ready-head"><span>Ready for next stage</span><span class="muted">' + readyCount + '/' + requiredMembers.length + '</span></div>',
        '<div class="advance-ready-list">',
        members.map((m) => '<div class="advance-ready-row ' + (m.ready ? 'ready' : '') + '"><span class="advance-ready-check">' + (m.ready ? '✓' : '') + '</span><span class="advance-ready-name">' + m.username + '</span>' + (m.required === false ? '<span class="advance-ready-badge">Watching</span>' : '') + '</div>').join(''),
        '</div>'
      ].join('');
    }

    function renderButton() {
      renderLeagueTools();
      if (resultsOnly) {continueZone.style.display='none';return;}
      if (transferState && (['release', 'sign'].includes(transferState.phase) || transferState.tactics?.phase === 'choose')) {
        continueZone.style.display = 'none';
        return;
      }
      newPing.style.display = newResultsPing ? 'block' : 'none';
      if (tournamentStage === 'done' && viewedStep >= historyLength) {
        continueZone.style.display = 'none';
        return;
      }
      continueZone.style.display = 'block';
      btnContinue.style.display = '';
      btnContinue.disabled = advancePending;
      if (isLeague && viewedStep >= historyLength && transferState?.waitingFor?.length) { btnContinue.disabled = true; btnContinue.textContent = 'Waiting for player transfers'; renderAdvanceReady(); return; }
      const me = advanceReady && (advanceReady.members || []).find((m) => Number(m.userId) === Number(App.state.user.id));
      if (me) isSpectator = me.required === false;
      if (viewedStep === 0) {
        btnContinue.textContent = advanceReady ? '✓ Ready to Start Matchday 1' : '▶ Start Matchday 1';
      } else if (historyLength > viewedStep) {
        btnContinue.textContent = '▶ See Next Results';
      } else if (advanceReady && isSpectator && Number(advanceReady.requiredMemberCount) > 0) {
        btnContinue.style.display = 'none';
      } else {
        btnContinue.textContent = isLeague ? '▶ Play Next Matchday' : me && me.ready ? '✓ Ready - waiting for players' : '✓ Ready for Next Stage';
        btnContinue.disabled = advancePending || !!(me && me.ready);
      }
      renderAdvanceReady();
    }

    function countCardsSoFar(timeline, cursor) {
      const counts = { A_yellow: 0, A_red: 0, B_yellow: 0, B_red: 0 };
      for (let i = 0; i < cursor; i++) {
        const e = timeline[i];
        if (e.type === 'yellow') counts[`${e.side}_yellow`] += 1;
        else if (e.type === 'red') counts[`${e.side}_red`] += 1;
      }
      return counts;
    }

    // --- Live match report: only the viewer's own match plays out on a ticking clock
    // (through extra time and, if needed, a kick-by-kick penalty shootout — never an
    // instant jump to a final penalty score); every other match in the step is already
    // decided, offered as a static "final report" via the picker. Skippable. Hands off
    // to the normal, permanent results view (renderStep) when done.
    function playLiveReport(step, forCode, onDone) {
      stopLiveReport();
      const myMatchIdx = step.matches.findIndex((m) => m.aCode === forCode || m.bCode === forCode);
      if (myMatchIdx === -1) { onDone(); return; } // no match of mine this round — nothing to watch live

      const m = step.matches[myMatchIdx];
      const matchLenMinutes = m.wentToExtraTime ? 120 : 90;
      const myTimeline = (m.events || []).filter((e) => e.type !== 'save').slice().sort((a, b) => a.minute - b.minute);
      const myScore = { a: 0, b: 0 };
      let viewIdx = myMatchIdx;
      let clock = 0;
      let cursor = 0;
      let finished = false;
      let penaltyPhase = false;
      let penIdx = 0;
      const penScore = { a: 0, b: 0 };
      const possessionJitter = (Math.random() - 0.5) * 20; // settles to 0 by full time

      stepCard.style.display = 'none';
      continueZone.style.display = 'none';
      liveZone.style.display = 'block';

      function finish() {
        if (finished) return;
        finished = true;
        clearInterval(timer);
        clearInterval(penaltyTimer);
        activeReport = null;
        liveZone.style.display = 'none';
        stepCard.style.display = 'block';
        continueZone.style.display = 'block';
        onDone();
      }

      function myMatchBody() {
        const clockLabel = penaltyPhase ? 'PENS' : `${Math.min(clock, matchLenMinutes)}'${clock > 90 ? ' ET' : ''}`;
        return `
          <div class="center"><span class="live-clock" id="liveClock">${clockLabel}</span></div>
          <div class="live-final-score">${nameTag(m.aName, m.aHuman, m.aUsername, m.aCode)} <b id="liveMyScore">${myScore.a} - ${myScore.b}</b> ${nameTag(m.bName, m.bHuman, m.bUsername, m.bCode)}</div>
          ${m.wentToPenalties ? `<div class="center muted" id="livePenScore" style="${penaltyPhase ? '' : 'display:none;'}margin-bottom:10px;">Penalties: <b>${penScore.a} - ${penScore.b}</b></div>` : ''}
          <div id="liveStatsZone" style="${penaltyPhase ? 'display:none;' : ''}">${matchStatsHtml(liveStatsAtClock(m, clock, possessionJitter, matchLenMinutes, countCardsSoFar(myTimeline, cursor)))}</div>
          <div class="live-feed" id="liveFeed"></div>
        `;
      }

      function otherMatchBody(idx) {
        const om = step.matches[idx];
        return `
          <div class="live-final-score">${nameTag(om.aName, om.aHuman, om.aUsername, om.aCode)} <b>${scoreText(om)}</b> ${nameTag(om.bName, om.bHuman, om.bUsername, om.bCode)}</div>
          ${matchStatsHtml(finalMatchStats(om))}
          ${penaltyShootoutHtml(om)}
          ${teamEventsHtml(om)}
        `;
      }

      function renderFeedUpToNow() {
        const feedEl = liveZone.querySelector('#liveFeed');
        if (!feedEl) return;
        feedEl.innerHTML = '';
        for (let i = cursor - 1; i >= 0; i--) {
          const e = myTimeline[i];
          const icon = eventIcon(e);
          const line = document.createElement('div');
          line.className = `live-feed-line ${eventTone(e)}`;
          line.innerHTML = `<b>${e.minute}'</b> ${icon} ${e.player}${e.assistBy ? ` <span class="muted">(assist: ${e.assistBy})</span>` : ''}${e.effect ? ` <span class="muted">(${e.effect})</span>` : ''}`;
          feedEl.appendChild(line);
        }
      }

      function renderPenaltyFeed() {
        const feedEl = liveZone.querySelector('#liveFeed');
        if (!feedEl) return;
        feedEl.innerHTML = '';
        for (let i = penIdx - 1; i >= 0; i--) {
          const k = m.penaltyKicks[i];
          const line = document.createElement('div');
          line.className = 'live-feed-line';
          line.innerHTML = `${k.side === 'A' ? '←' : '→'} ${k.scored ? '⚽' : '❌'} ${k.player} <span class="muted">${k.scored ? 'scored' : 'missed'}</span>`;
          feedEl.appendChild(line);
        }
      }

      function renderView() {
        const picker = `
          <div class="live-picker-row">
            <span class="muted">Watching:</span>
            <select id="liveMatchSelect">
              ${step.matches.map((sm, idx) => `<option value="${idx}" ${idx === viewIdx ? 'selected' : ''}>${escapeLeagueText(sm.aName + (isLeague && !singlePlayer && sm.aHuman ? ' @' + sm.aUsername : ''))} vs ${escapeLeagueText(sm.bName + (isLeague && !singlePlayer && sm.bHuman ? ' @' + sm.bUsername : ''))}${idx === myMatchIdx ? ' — Your Match' : ''}</option>`).join('')}
            </select>
          </div>
        `;
        liveZone.innerHTML = `${picker}<div id="liveBody">${viewIdx === myMatchIdx ? myMatchBody() : otherMatchBody(viewIdx)}</div><button class="btn btn-block" id="btnSkipLive" style="margin-top:12px;">⏭ Skip to Full Results</button>`;
        liveZone.querySelector('#liveMatchSelect').addEventListener('change', (e) => {
          viewIdx = Number(e.target.value);
          renderView();
        });
        liveZone.querySelector('#btnSkipLive').addEventListener('click', finish);
        if (viewIdx === myMatchIdx) { if (penaltyPhase) renderPenaltyFeed(); else renderFeedUpToNow(); }
      }

      renderView();

      function startPenaltyPhase() {
        penaltyPhase = true;
        clearInterval(timer);
        if (viewIdx === myMatchIdx) renderView();
        penaltyTimer = setInterval(() => {
          if (penIdx >= m.penaltyKicks.length) { clearInterval(penaltyTimer); finish(); return; }
          const k = m.penaltyKicks[penIdx];
          if (k.scored) { if (k.side === 'A') penScore.a += 1; else penScore.b += 1; }
          penIdx += 1;
          if (viewIdx === myMatchIdx) {
            const scoreEl = liveZone.querySelector('#livePenScore b');
            if (scoreEl) scoreEl.textContent = `${penScore.a} - ${penScore.b}`;
            renderPenaltyFeed();
          }
          if (penIdx >= m.penaltyKicks.length) { clearInterval(penaltyTimer); finish(); }
        }, 650);
      }

      let penaltyTimer = null;
      const timer = setInterval(() => {
        clock += 2;
        while (cursor < myTimeline.length && myTimeline[cursor].minute <= clock) {
          const e = myTimeline[cursor];
          if (e.type === 'goal') { if (e.side === 'A') myScore.a += 1; else myScore.b += 1; }
          cursor += 1;
        }
        if (viewIdx === myMatchIdx) {
          const clockEl = liveZone.querySelector('#liveClock');
          const scoreEl = liveZone.querySelector('#liveMyScore');
          const statsEl = liveZone.querySelector('#liveStatsZone');
          if (clockEl) clockEl.textContent = `${Math.min(clock, matchLenMinutes)}'${clock > 90 ? ' ET' : ''}`;
          if (scoreEl) scoreEl.textContent = `${myScore.a} - ${myScore.b}`;
          if (statsEl) statsEl.innerHTML = matchStatsHtml(liveStatsAtClock(m, clock, possessionJitter, matchLenMinutes, countCardsSoFar(myTimeline, cursor)));
          renderFeedUpToNow();
        }
        if (clock >= matchLenMinutes) {
          if (m.wentToPenalties) startPenaltyPhase();
          else finish();
        }
      }, 180);
      activeReport = () => { finished = true; clearInterval(timer); clearInterval(penaltyTimer); };
    }

    function stopLiveReport() {
      if (!activeReport) return;
      activeReport(); activeReport = null;
      liveZone.style.display = 'none'; stepCard.style.display = ''; continueZone.style.display = '';
    }

    // --- One-time reveal of the drafted XI, styled as a real lineup card, shown once
    // right when the tournament begins (before Matchday 1).
    function renderLineupReveal(lineup) {
      stagePill.textContent = 'Your Squad';
      championZone.innerHTML = '';
      continueZone.style.display = 'none';

      const slotDefs = getSlots(lineup.formation);
      const bySlot = {};
      for (const p of lineup.xi) bySlot[p.slotCode] = p;
      const avgOverall = Math.round(lineup.xi.reduce((s, p) => s + p.overall, 0) / lineup.xi.length);
      const chancePct = lineup.championshipChance * 100;
      const chanceText = chancePct >= 0.1 ? `${chancePct.toFixed(1)}%` : '<0.1%';
      const prediction = lineup.prediction || {};
      const predictionIdeas = Array.isArray(prediction.ideas) ? prediction.ideas : [];
      const predictionCards = [
        ['Engine power', prediction.enginePower || '-'],
        ['Average OVR', prediction.avgOverall || avgOverall],
        ['Chemistry', prediction.chemistryPct != null ? `${prediction.chemistryPct}%` : '-'],
        ['Star threat', prediction.starThreatPct != null ? `${prediction.starThreatPct}%` : '-'],
        ['Tactical style', prediction.tacticalStyleLabel || 'Balanced'],
        ['Risk profile', prediction.riskLabel || 'Controlled']
      ];

      stepCard.innerHTML = `
        <h3 class="center">You're representing ${lineup.countryName}!</h3>
        <p class="muted center">${isLeague ? `${leagueName} &middot; ${leagueState.totalMatchdays} matchdays &middot; ` : ''}${lineup.formation} &middot; OVR ${avgOverall}</p>
        <div id="lineupPitch"></div>
        <div class="lineup-predictions">
          <div class="lineup-prediction-stat wide">
            <span class="lineup-prediction-value">${chanceText}</span>
            <span class="muted">predicted title chance</span>
          </div>
          ${predictionCards.map(([label, value]) => `<div class="lineup-prediction-card"><span>${label}</span><b>${value}</b></div>`).join('')}
          <div class="lineup-prediction-card wide trio">
            ${prediction.topScorer ? `<div><span>Goal focus</span><b>${prediction.topScorer}</b></div>` : ''}
            ${prediction.topAssist ? `<div><span>Creator focus</span><b>${prediction.topAssist}</b></div>` : ''}
            ${prediction.pressurePlayer ? `<div><span>Pressure player</span><b>${prediction.pressurePlayer}</b></div>` : ''}
          </div>
          ${predictionIdeas.length ? `<div class="lineup-prediction-ideas wide">${predictionIdeas.map((idea) => `<span>${idea}</span>`).join('')}</div>` : ''}
        </div>
        <button class="btn btn-primary btn-block" id="btnEnterTournament" style="margin-top:16px;">${isLeague ? 'Enter the League' : 'Enter the World Cup'}</button>
      `;
      Pitch.render(stepCard.querySelector('#lineupPitch'), slotDefs, (slot) => {
        const p = bySlot[slot.code];
        if (!p) return { text: slot.short, title: slot.label };
        return {
          className: `${roleClass(slot.group)} ${p.isCaptain ? 'captain' : ''}`,
          text: p.isCaptain ? 'C' : slot.short,
          title: `${p.name} (${slot.label}) — OVR ${p.overall}`,
          badge: p.overall,
          nameLabel: p.name.split(' ').slice(-1)[0]
        };
      });
      stepCard.querySelector('#btnEnterTournament').addEventListener('click', () => {
        lineupRevealShown = true;
        renderStep(null);
      });
    }

    function myRecordCardHtml(record) {
      if (!record) return '';
      const POS_ORDER = { FW: 0, MF: 1, DF: 2, GK: 3 };
      const orderedSquad = record.squad.slice().sort((a, b) => POS_ORDER[a.pos] - POS_ORDER[b.pos]);
      const half = Math.ceil(orderedSquad.length / 2);
      const left = orderedSquad.slice(0, half);
      const right = orderedSquad.slice(half);
      const playerRow = (p) => `<div class="myteam-player"><span class="myteam-pos ${roleClass(p.pos)}">${p.pos}</span> ${p.name}${p.isCaptain ? ' <b>(C)</b>' : ''}</div>`;
      const avgOvr = Math.round(record.squad.reduce((s, p) => s + p.overall, 0) / record.squad.length);
      return `
        <div class="myteam-card">
          <div class="myteam-header">
            <span>${record.countryName}</span>
            <span class="badge">${record.formation} &middot; OVR ${avgOvr}</span>
          </div>
          <div class="myteam-record">${record.w}-${record.d}-${record.l} W-D-L &middot; ${record.gf}-${record.ga} goals${record.topScorer ? ` &middot; Top scorer: ${record.topScorer} (${record.topGoals})` : ''}</div>
          <div class="myteam-players">
            <div class="myteam-col">${left.map(playerRow).join('')}</div>
            <div class="myteam-col">${right.map(playerRow).join('')}</div>
          </div>
        </div>
      `;
    }

    function tournamentSummaryLine(summary) {
      if (!summary || !summary.totalMatches) return '';
      let line = `${summary.totalMatches} matches played, ${summary.totalGoals} goals scored (${summary.avgGoalsPerMatch} per match)`;
      if (summary.biggest && summary.biggest.margin > 0) {
        const b = summary.biggest;
        const winnerFirst = b.goalsA >= b.goalsB;
        line += ` — biggest result: ${winnerFirst ? b.aName : b.bName} ${Math.max(b.goalsA, b.goalsB)}-${Math.min(b.goalsA, b.goalsB)} ${winnerFirst ? b.bName : b.aName}`;
      }
      return `<p class="muted tournament-summary-line">${line}</p>`;
    }

    function awardTeamLabel(entry) {
      if (!entry) return '';
      const teamDisplay = entry.isHuman && entry.username ? entry.username : (entry.teamName || entry.teamCode || '');
      if (!teamDisplay) return '';
      return ` <span class="muted" style="font-size:0.78em;font-weight:500;opacity:0.8;">(${teamDisplay})</span>`;
    }

    function tournamentAwardsHtml(awards, summary) {
      if (!awards) return '';
      const detailText = (entry, unit) => entry ? `${entry.count} ${unit}` : '';
      const potm = awards.playerOfTournament;
      const potmDetail = potm ? [
        potm.goals ? `${potm.goals} goal${potm.goals === 1 ? '' : 's'}` : null,
        potm.assists ? `${potm.assists} assist${potm.assists === 1 ? '' : 's'}` : null,
        potm.saves ? `${potm.saves} save${potm.saves === 1 ? '' : 's'}` : null,
        potm.isChampion ? 'champion bonus' : null
      ].filter(Boolean).join(' · ') : '';
      const card = (label, entry, detail, tone = '') => entry ? `
        <article class="award-card ${tone}">
          <span class="award-kicker">${label}</span>
          <b>${entry.player}</b>
          <span class="award-meta">${awardTeamLabel(entry)}</span>
          <span class="award-pill">${detail}</span>
        </article>
      ` : '';
      const pulse = [];
      if (summary && summary.totalMatches) {
        pulse.push(['Matches', summary.totalMatches]);
        pulse.push(['Goals', summary.totalGoals]);
        pulse.push(['Avg Goals', summary.avgGoalsPerMatch]);
        if (summary.biggest && summary.biggest.margin > 0) {
          const b = summary.biggest;
          const winnerFirst = b.goalsA >= b.goalsB;
          pulse.push(['Biggest Win', `${winnerFirst ? b.aName : b.bName} ${Math.max(b.goalsA, b.goalsB)}-${Math.min(b.goalsA, b.goalsB)}`]);
        }
      }
      const body = [
        card('Golden Ball', potm, potmDetail || `${potm ? potm.score : ''} engine score`, 'primary'),
        card('Golden Boot', awards.topScorer, detailText(awards.topScorer, 'goals')),
        card('Creator Award', awards.topAssist, detailText(awards.topAssist, 'assists')),
        card('Golden Glove', awards.mostSaves, detailText(awards.mostSaves, 'saves')),
        card('Knockout Hero', awards.knockoutHero, detailText(awards.knockoutHero, 'KO goals')),
        card('Heat Check', awards.mostBooked, detailText(awards.mostBooked, 'card pts'))
      ].join('');
      if (!body.trim() && !pulse.length) return '';
      return `
        <div class="myteam-card awards-card">
          <div class="myteam-header"><span>Tournament Awards</span><span class="badge">Engine recap</span></div>
          ${pulse.length ? `<div class="award-pulse-grid">${pulse.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>` : ''}
          <div class="awards-grid">${body}</div>
        </div>
      `;
    }

    function bracketScoreHtml(m) {
      if (!m.result) return '<span class="bracket-node-score">TBD</span>';
      const extras = [
        m.result.wentToExtraTime ? 'AET' : null,
        m.result.wentToPenalties && m.result.penalties ? `pens ${m.result.penalties.A}-${m.result.penalties.B}` : null
      ].filter(Boolean).join(' · ');
      return `<span class="bracket-node-score">${scoreText(m.result)}</span>${extras ? `<span class="bracket-node-extra">${extras}</span>` : ''}`;
    }

    function bracketNodeHtml(m, isTerminal) {
      const aWin = m.winnerCode && m.winnerCode === m.aCode;
      const bWin = m.winnerCode && m.winnerCode === m.bCode;
      return `
        <article class="bracket-node ${isTerminal ? 'terminal' : ''}">
          <div class="bracket-node-team ${aWin ? 'winner' : ''}"><span>${nameTag(m.aName, m.aHuman, m.aUsername, m.aCode)}</span><b>${m.result ? m.result.goalsA : '-'}</b></div>
          <div class="bracket-node-mid">${bracketScoreHtml(m)}</div>
          <div class="bracket-node-team ${bWin ? 'winner' : ''}"><span>${nameTag(m.bName, m.bHuman, m.bUsername, m.bCode)}</span><b>${m.result ? m.result.goalsB : '-'}</b></div>
        </article>
      `;
    }

    function completedBracketHtml(rounds) {
      if (!rounds || !rounds.length) return '';
      const finalRound = rounds[rounds.length - 1];
      const sideRounds = rounds.slice(0, -1).map((round) => {
        const splitAt = Math.ceil(round.matches.length / 2);
        return {
          round,
          leftMatches: round.matches.slice(0, splitAt),
          rightMatches: round.matches.slice(splitAt)
        };
      });
      const isSplitBracket = rounds.length >= 5;
      const roundSection = (round, matches, idx, sideClass = '', isTerminal = false) => `
        <section class="bracket-chart-round ${sideClass} stage-${round.stage || idx}">
          <h4>${round.label}</h4>
          <div class="bracket-stack">
            ${matches.map((m) => bracketNodeHtml(m, isTerminal)).join('')}
          </div>
        </section>
      `;
      return `
        <div class="myteam-card bracket-recap-card">
          <div class="myteam-header">
            <span>Knockout Bracket Chart</span>
            <button class="btn btn-ghost btn-sm" id="btnToggleBracket">Show Full Bracket</button>
          </div>
          <div class="bracket-recap hidden" id="bracketRecap">
            <div class="bracket-chart ${isSplitBracket ? 'split' : 'compact'}" style="--side-round-count:${sideRounds.length};--round-count:${rounds.length};">
              ${isSplitBracket ? `
                <div class="bracket-wing bracket-wing-left">
                  ${sideRounds.map((x, idx) => roundSection(x.round, x.leftMatches, idx, 'side-left')).join('')}
                </div>
                <section class="bracket-chart-round bracket-final-center stage-${finalRound.stage || 'final'}">
                  <h4>${finalRound.label}</h4>
                  <div class="bracket-stack">
                    ${finalRound.matches.map((m) => bracketNodeHtml(m, true)).join('')}
                  </div>
                </section>
                <div class="bracket-wing bracket-wing-right">
                  ${sideRounds.map((x, idx) => roundSection(x.round, x.rightMatches, idx, 'side-right')).join('')}
                </div>
              ` : rounds.map((round, idx) => roundSection(round, round.matches, idx, idx === rounds.length - 1 ? 'terminal-round' : '', idx === rounds.length - 1)).join('')}
            </div>
          </div>
        </div>
      `;
    }

    function matchAnalysisRecapHtml(analyses) {
      if (!analyses || !analyses.length) return '';
      const outcomeLabel = { w: 'Win', d: 'Draw', l: 'Loss' };
      const toneIcon = { good: '+', bad: '-', neutral: '=' };
      const analysisData = (m) => typeof m.analysis === 'string' ? { summary: m.analysis, verdict: '', metrics: [], factors: [] } : (m.analysis || { summary: '', verdict: '', metrics: [], factors: [] });
      const metricGrid = (metrics) => metrics && metrics.length ? `<div class="engine-metric-grid">${metrics.map((x) => `
        <div class="engine-metric"><span>${x.label}</span><b>${x.mine}</b><em>${x.opponent}</em></div>
      `).join('')}</div>` : '';
      const factorList = (factors) => factors && factors.length ? `<div class="engine-factor-list">${factors.slice(0, 6).map((f) => `
        <div class="engine-factor ${f.tone || 'neutral'}"><span>${toneIcon[f.tone] || '='}</span><div><b>${f.label}: ${f.value}</b><small>${f.detail}</small></div></div>
      `).join('')}</div>` : '';
      return `
        <div class="myteam-card engine-recap-card">
          <div class="myteam-header">
            <span>Engine Match Review</span>
            <span class="badge">Data model</span>
          </div>
          <p class="muted tournament-summary-line">A richer post-match model built from xG, player quality, chemistry, tactical style, star moments, shot pressure, possession, saves, cards, extra time and penalties.</p>
          <div class="engine-recap-list">
            ${analyses.map((m) => {
              const data = analysisData(m);
              return `
              <article class="engine-recap-match ${m.outcome === 'w' ? 'win' : m.outcome === 'l' ? 'loss' : 'draw'}">
                <div class="engine-recap-topline">
                  <span class="history-outcome ${m.outcome === 'w' ? 'win' : m.outcome === 'l' ? 'loss' : 'draw'}">${m.outcome.toUpperCase()}</span>
                  <div class="engine-recap-meta">
                    <b>${m.label} vs ${m.opponentName}</b>
                    <span>${outcomeLabel[m.outcome] || 'Result'} &middot; ${m.score}</span>
                  </div>
                </div>
                ${metricGrid(data.metrics)}
                ${factorList(data.factors)}
                <p>${data.summary || ''}</p>
                ${data.verdict ? `<div class="engine-verdict">${data.verdict}</div>` : ''}
              </article>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    function renderStep(step) {
      stopLiveReport();
      renderLeagueTools();
      renderLeagueTable();
      renderTransfers();
      if (tournamentStage === 'done') {
        stagePill.parentElement.style.display = 'none';
      } else {
        stagePill.parentElement.style.display = '';
        stagePill.textContent = isLeague ? leagueName : STAGE_LABEL[tournamentStage] || tournamentStage;
      }
      newResultsPing = false;

      if (!step) {
        stepCard.innerHTML = resultsOnly ? '<p class="muted center">League fixtures play automatically. Only final scores are shown.</p>' : `<p class="muted center">${isLeague ? 'Your league fixtures are ready.' : 'The World Cup draw is complete.'} Click below to kick off Matchday 1.</p>`;
        championZone.innerHTML = '';
        renderButton();
        return;
      }

      const chevronIcon = '<svg class="match-expand-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

      const matchesHtml = resultsOnly ? '' : step.matches.map((m, idx) => {
        const aWin = m.winnerCode && m.winnerCode === m.aCode;
        const bWin = m.winnerCode && m.winnerCode === m.bCode;
        return `
        <div class="match-row match-row-clickable" data-idx="${idx}">
          <div class="match-team ${aWin ? 'winner' : ''}"><span class="match-team-name">${nameTag(m.aName, m.aHuman, m.aUsername, m.aCode)}</span></div>
          <div class="match-score-box">
            <span class="match-score-val">${m.goalsA} - ${m.goalsB}</span>
            ${m.wentToExtraTime ? `<span class="match-score-pens">AET</span>` : ''}
            ${m.wentToPenalties ? `<span class="match-score-pens">pens ${m.penalties.A}-${m.penalties.B}</span>` : ''}
          </div>
          <div class="match-team side-b ${bWin ? 'winner' : ''}"><span class="match-team-name">${nameTag(m.bName, m.bHuman, m.bUsername, m.bCode)}</span></div>
          ${chevronIcon}
        </div>
        <div class="match-report hidden" id="report-${idx}">
          ${matchStatsHtml(finalMatchStats(m))}
          ${penaltyShootoutHtml(m)}
          ${teamEventsHtml(m)}
        </div>
      `;
      }).join('');

      let groupFinalHtml = '';
      if (step.groupFinal) {
        groupFinalHtml = `
          <h3 style="margin-top:18px;">Final Group Standings</h3>
          <div class="group-grid">
            ${Object.entries(step.groupFinal.groups).map(([label, rows]) => `
              <div>
                <h4>Group ${label}</h4>
                <table class="group-table">
                  <thead><tr><th>Team</th><th>P</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead>
                  <tbody>
                    ${rows.map((r) => `
                      <tr class="${r.isHuman ? 'human' : ''} ${r.advanced ? '' : 'eliminated'}">
                        <td>${r.isHuman ? r.username : r.name}</td>
                        <td>${r.played}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `).join('')}
          </div>
        `;
      }

      stepCard.innerHTML = `
        <h3>${step.label}</h3>
        <p class="muted" style="margin-top:-8px;">Tap a match for the full report — stats, goals, assists, cards.</p>
        <div class="matchlog" style="max-height:none;">${matchesHtml}</div>
        ${groupFinalHtml}
      `;
      if (resultsOnly) {
        stepCard.innerHTML='<h3>Match Results - Matchday '+viewedStep+'</h3><div id="leagueScoreResults"></div>';
        renderScoreRounds();
      }
      stepCard.querySelectorAll('.match-row-clickable').forEach((row) => {
        row.addEventListener('click', () => {
          const report = stepCard.querySelector(`#report-${row.dataset.idx}`);
          if (report) report.classList.toggle('hidden');
          row.classList.toggle('expanded');
        });
      });

      if (step.champion) {
        const championTitle = isLeague ? step.champion.name : step.champion.isHuman ? step.champion.username : step.champion.name;
        const championSub = step.champion.isHuman ? (isLeague ? step.champion.username : step.champion.name) : (isLeague ? 'Bot-controlled club' : 'Bot-controlled nation');
        championZone.innerHTML = `
          <div class="champion-banner">
            <div class="champion-label">${isLeague ? leagueName : 'World Cup'} Champion</div>
            <h2>${isLeague ? ClubIdentity.name(step.champion.code, championTitle) : championTitle}</h2>
            <p class="champion-team-name">${championSub}</p>
            <div class="row" style="margin-top:16px;justify-content:center;">
              <button class="btn btn-ghost" id="btnBackHome">Back to Dashboard</button>
              <button class="btn btn-ghost" id="btnViewHistoryFromChampion">My Match History</button>
              ${isCreator ? `<button class="btn btn-ghost" id="btnNewRoom">${isLeague ? 'Create New League' : 'Start New Room'}</button>` : ''}
              ${isCreator && isLeague ? '<button class="btn btn-primary" id="btnNextLeagueSeason">Continue to Next Season</button>' : ''}
              ${isCreator ? '<button class="btn btn-primary" id="btnRematch">Rematch — Same Players</button>' : ''}
            </div>
          </div>
          ${myRecordCardHtml(step.myRecord)}
          ${resultsOnly ? '' : matchAnalysisRecapHtml(step.myMatchAnalyses)}
          ${completedBracketHtml(step.completedBracket)}
          ${tournamentAwardsHtml(step.tournamentAwards, step.tournamentSummary)}
          ${seasonResultsHtml(step.seasonResults)}`;
        championZone.querySelector('#btnBackHome').addEventListener('click', () => App.goDashboard());
        championZone.querySelector('#btnViewHistoryFromChampion').addEventListener('click', () => App.goMatchHistory());
        const bracketBtn = championZone.querySelector('#btnToggleBracket');
        const bracketRecap = championZone.querySelector('#bracketRecap');
        if (bracketBtn && bracketRecap) {
          bracketBtn.addEventListener('click', () => {
            bracketRecap.classList.toggle('hidden');
            bracketBtn.textContent = bracketRecap.classList.contains('hidden') ? 'Show Full Bracket' : 'Hide Full Bracket';
          });
        }
        const nextSeasonBtn = championZone.querySelector('#btnNextLeagueSeason');
        if (nextSeasonBtn) nextSeasonBtn.onclick = () => { if (nextSeasonPending) return; nextSeasonPending = true; nextSeasonBtn.disabled = true; nextSeasonBtn.textContent = 'Preparing Next Season...'; socket.emit('league:nextSeason',{ code }); };
        const newRoomBtn = championZone.querySelector('#btnNewRoom');
        if (newRoomBtn) newRoomBtn.addEventListener('click', () => App.goDashboard(isLeague ? singlePlayer ? 'league' : 'online-league' : 'create'));
        const rematchBtn = championZone.querySelector('#btnRematch');
        if (rematchBtn) rematchBtn.addEventListener('click', () => {
          rematchBtn.disabled = true;
          rematchBtn.textContent = 'Setting up rematch...';
          socket.emit('room:rematch', { code });
        });
      } else {
        championZone.innerHTML = '';
      }

      renderCareer();
      renderButton();
    }

    App.onSocket('room:state', (s) => {
      if (s.stage === 'drafting') return App.goDraft(code);
      if (s.stage === 'lobby') return App.goLobby(code);
      if (s.stage !== 'tournament') return;
      clearAutomaticTimer();
      stopLiveReport();
      const firstJoin=!hasJoinedRoom;
      advancePending = false;
      isLeague = s.mode === 'league';
      singlePlayer = !!s.singlePlayer;
      hasJoinedRoom=true;resultsOnly=isLeague && !!s.resultsOnly;resultRounds=s.results || [];
      leagueName = s.leagueName || '';
      leagueState = s.league || null;
      transferState = s.transfers || null;
      careerState = s.career || null;
      managerDecisionPending = false;
      transferPending = false;
      skipPending = false;
      tacticPending = false;
      nextSeasonPending = false;
      const savedViewedStep = s.viewedStep || 0;
      if (savedViewedStep !== viewedStep) resultMatchday = null;
      viewedStep = savedViewedStep;
      historyLength = s.historyLength || 0;
      tournamentStage = s.tournamentStage || 'group';
      advanceReady = s.advanceReady || null;
      isSpectator = !!s.spectator;
      isCreator = s.creatorId === App.state.user.id;
      if (s.myLineup) myCode = s.myLineup.code;
      if (resultsOnly) stagePill.parentElement.after(stepCard);
      renderLeagueTools();
      if (isLeague) renderLeagueTable();
      if (viewedStep === 0 && s.myLineup && !lineupRevealShown && transferState?.windowType !== 'endseason' && !resultsOnly) {
        renderLineupReveal(s.myLineup);
      } else {
        renderStep(s.myStep || null);
      }
      renderCareer();
      if(resultsOnly && firstJoin)stepCard.scrollIntoView({block:'start'});
      if(viewedStep===0)requestAutomaticResults();else scheduleAutomaticResults();
    });

    App.onSocket('tournament:step', (payload) => {
      advancePending = false;
      leagueState = payload.league || leagueState;
      transferState = payload.transfers || transferState;
      viewedStep = payload.viewedStep;
      historyLength = payload.historyLength;
      tournamentStage = payload.stage;
      isSpectator = !!payload.spectator;
      renderLeagueTools();
      if (leagueTools.querySelector('#leagueSquadBrowser')?.open) loadClubSquad();
      if (!resultsOnly && payload.step && payload.step.matches && payload.step.matches.length && myCode) {
        playLiveReport(payload.step, myCode, () => renderStep(payload.step));
      } else {
        renderStep(payload.step);
      }
    });

    App.onSocket('tournament:newStepAvailable', (payload) => {
      if (resultsOnly) return;
      historyLength = Math.max(historyLength, payload.historyLength);
      if (historyLength > viewedStep) {
        newResultsPing = true;
        renderButton();
      }
    });

    App.onSocket('tournament:advanceReady', (payload) => {
      advancePending = false;
      advanceReady = payload;
      const me = (payload.members || []).find((m) => Number(m.userId) === Number(App.state.user.id));
      if (me) isSpectator = me.required === false;
      renderButton();
    });

    App.onSocket('tournament:started', () => {
      advancePending = false;
      viewedStep = 0;
      historyLength = 0;
      tournamentStage = 'group';
      if (!lineupRevealShown) return; // room:state (personalized, with myLineup) will handle the reveal
      renderStep(null);
    });

    App.onSocket('room:rematchReady', ({ newCode }) => {
      App.toast('Rematch room ready — joining now');
      App.goLobby(newCode);
    });

    App.onSocket('tournament:waiting', () => {
      advancePending = false;
      renderButton();
    });

    function seasonResultsHtml(results) {
      if (!results) return '';
      const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
      const leaderboard = (title, players, key) => `<section><h3>${title}</h3><div class="table-scroll"><table class="table"><thead><tr><th>Player</th><th>Club</th><th>Apps</th><th>${title === 'Top Scorers' ? 'Goals' : title === 'Top Creators' ? 'Assists' : title === 'Top Goalkeepers' ? 'Saves' : 'Star moments'}</th></tr></thead><tbody>${players.map((player) => `<tr><td>${escape(player.name)}${player.isStar ? ' ★' : ''}</td><td>${escape(player.club)}</td><td>${player.appearances}</td><td>${player[key]}</td></tr>`).join('') || '<tr><td colspan="4">No recorded events.</td></tr>'}</tbody></table></div></section>`;
      return `<div class="card" id="seasonResults"><h2>Season Results</h2><p>${results.matchdays} matchdays · ${results.matches} matches · ${results.totalGoals} goals</p><p><b>Best attack:</b> ${escape(results.bestAttack.name)} (${results.bestAttack.gf} goals) · <b>Best defense:</b> ${escape(results.bestDefense.name)} (${results.bestDefense.ga} conceded)</p><p class="relegation-note"><b>↓ Relegated:</b> ${results.relegated.map((team) => escape(team.name)).join(' · ')}</p><div class="season-leaderboards">${leaderboard('Top Scorers', results.scorers, 'goals')}${leaderboard('Top Creators', results.creators, 'assists')}${leaderboard('Top Goalkeepers', results.goalkeepers, 'saves')}${leaderboard('Star Moments', results.stars, 'starMoments')}</div></div>`;
    }

    App.onSocket('league:seasonFinished', (payload) => {
      advancePending = false;
      lineupRevealShown = true;
      leagueState = payload.league;
      transferState = payload.transfers;
      viewedStep = payload.viewedStep;
      historyLength = payload.historyLength;
      tournamentStage = payload.stage;
      renderStep(payload.step);
      if (leagueTools.querySelector('#leagueSquadBrowser')?.open) loadClubSquad();
      championZone.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    App.onSocket('league:midseason', (payload) => {
      advancePending = false;
      skipPending = false;
      lineupRevealShown = true;
      leagueState = payload.league;
      transferState = payload.transfers;
      viewedStep = payload.viewedStep;
      historyLength = payload.historyLength;
      tournamentStage = payload.stage;
      renderStep(payload.step);
      if (leagueTools.querySelector('#leagueSquadBrowser')?.open) loadClubSquad();
      (transferState.phase === 'disabled' ? leagueZone : transferZone).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    App.onSocket('league:autoResults',payload => {
      if (!container.contains(leagueTools) || App.state.roomCode!==code) return;
      advancePending=false;lineupRevealShown=true;
      leagueState=payload.league;transferState=payload.transfers;viewedStep=payload.viewedStep;
      historyLength=payload.historyLength;tournamentStage=payload.stage;
      resultRounds=payload.results;resultMatchday=null;liveZone.style.display='none';
      renderStep(payload.step);
      if(leagueTools.querySelector('#leagueSquadBrowser')?.open)loadClubSquad();
      scheduleAutomaticResults();
    });

    App.onSocket('league:nextSeasonReady', (payload) => App.goTournament(payload.newCode));

    App.onSocket('league:careerState', (payload) => {
      careerState = payload.career;
      managerDecisionPending = false;
      nextSeasonPending = false;
      renderCareer();
      careerZone.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    App.onSocket('league:transferState', (payload) => {
      const ownUpdate = !payload.userId || payload.userId === App.state.user.id;
      const signing = ownUpdate && transferPending;
      if (ownUpdate) { transferPending = false; tacticPending = false; }
      if (transferState?.phase !== 'sign' || payload.transfers.phase !== 'sign') offerSelection.clear();
      transferState = payload.transfers;
      if (ownUpdate) releaseSelection.clear();
      renderTransfers();
      renderLeagueTools();
      renderButton();
      if (leagueTools.querySelector('#leagueSquadBrowser')?.open) loadClubSquad();
      requestAutomaticResults();
      if (signing && transferState.phase === 'complete') App.toast(`${transferState.incoming.length === 1 ? 'One player' : `${transferState.incoming.length} players`} signed. Your XI is complete.`, false);
    });

    App.onSocket('error:message', (e) => {
      clearAutomaticTimer();
      tacticPending = false; nextSeasonPending = false; managerDecisionPending = false; renderCareer();
      const nextButton = championZone.querySelector('#btnNextLeagueSeason'); if (nextButton) { nextButton.disabled = false; nextButton.textContent = 'Continue to Next Season'; }
      advancePending = false;
      skipPending = false;
      renderLeagueTools();
      if (transferPending) { transferPending = false; renderTransfers(); }
      renderButton();
      App.toast(e.error, true);
    });

    btnContinue.addEventListener('click', () => {
      if (advancePending) return;
      advancePending = true;
      renderButton();
      socket.emit('tournament:advance', { code });
    });

    App.watchRoom(code, () => {
      clearAutomaticTimer(); stopLiveReport();
      advancePending = transferPending = skipPending = tacticPending = nextSeasonPending = managerDecisionPending = false;
    });
  }
};
