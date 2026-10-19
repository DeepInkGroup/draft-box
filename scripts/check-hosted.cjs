const assert = require('node:assert/strict');

const apiBase = new URL(process.env.DRAFTBOX_API_BASE).origin;
const pagesUrl = process.env.DRAFTBOX_PAGES_URL;
const pagesOrigin = new URL(pagesUrl).origin;

async function request(url, verify, options = {}, attempts = 6) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, 200, `${url}: HTTP ${response.status}`);
      await verify(response);
      console.log(`OK ${url}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  throw lastError;
}

(async () => {
  await request(apiBase + '/api/health', async (response) => {
    const health = await response.json();
    assert.equal(health.ok, true);
    assert.equal(health.version, '2.1.3', 'Wait for the updated server deployment');
    assert.equal(health.profileVersion, 2, 'Wait for email editing and clans');
    assert.equal(health.moderationVersion, 1, 'Wait for account moderation');
    assert.equal(health.roomSessionVersion, 2, 'Wait for room lifecycle fixes');
    const origin = response.headers.get('access-control-allow-origin');
    assert.ok(origin === '*' || origin === pagesOrigin, `Server CORS must allow ${pagesOrigin}; received ${origin}`);
  }, { headers: { Origin: pagesOrigin } }, 60);
  await request(apiBase + '/api/teams', async (response) => {
    assert.equal((await response.json()).teams.length, 48);
  });
  await request(apiBase + '/api/about', async (response) => {
    const about = await response.json();
    assert.equal(about.formatVersion, 1, 'Wait for editable About Us deployment');
    assert.ok(about.revision >= 1);
    assert.equal(typeof about.content.title, 'string');
    assert.equal(typeof about.content.body, 'string');
  }, {}, 60);
  await request(apiBase + '/api/tactical-styles', async (response) => {
    const styles = (await response.json()).styles;
    assert.equal(styles.length, 12);
    for (const key of ['vertical', 'overlap', 'catenaccio']) assert.ok(styles.some((style) => style.key === key));
  });
  await request(apiBase + '/api/leagues', async (response) => {
    const pgl = (await response.json()).leagues.find((league) => league.id === 'pgl');
    assert.ok(pgl, 'Persian Gulf League must be available');
    assert.equal(pgl.teamCount, 18);
    assert.equal(pgl.singlePlayerOnly, false);
    assert.equal(pgl.multiplayerVersion, 1);
    assert.equal(pgl.multiplayerMaxPlayers, 18);
    assert.deepEqual(pgl.multiplayerOptions, { aiTransfers: false, midseasonTactics: false, resultsOnly: true, humanTransfers: true, continuousSeasons: true });
    assert.equal(pgl.matchdays, 34);
    assert.ok(pgl.squadModes.includes('real'), 'Real club squads must be available');
    assert.equal(pgl.transferWindowAfterMatchday, 17);
    assert.deepEqual(pgl.transferOptions, { min: 1, max: 3, default: 2, canDisable: true });
    assert.equal(pgl.midseasonTacticsAvailable, true);
    assert.equal(pgl.aiTransfersAvailable, true);
    assert.equal(pgl.continuousSeasons, true);
    assert.equal(pgl.endSeasonTransfersAvailable, true);
    assert.equal(pgl.transferOfferCount, 2);
    assert.equal(pgl.pglRatingBoostAvailable, true);
    assert.equal(pgl.resultsOnlyAvailable, true);
    assert.equal(pgl.resultsOnlyVersion, 2);
    assert.equal(pgl.standingsLayoutVersion, 3);
    assert.equal(pgl.careerOptions?.managerOffers, true);
    assert.equal(pgl.careerOptions.maxManagerOffers, 2);
    assert.equal(pgl.careerOptions.playerDepartures, true);
    assert.equal(pgl.squadBrowserVersion, 2);
  }, {}, 60);
  await request(apiBase + '/', async (response) => {
    assert.match(await response.text(), /Draft Box/);
  });
  await request(apiBase + '/socket.io/?EIO=4&transport=polling', async (response) => {
    const packet = await response.text();
    assert.ok(packet.startsWith('0'), 'Expected Socket.io transport handshake');
    assert.ok(JSON.parse(packet.slice(1)).sid);
  });
  const configUrl = new URL('js/deploy-config.js', pagesUrl);
  configUrl.searchParams.set('check', process.env.GITHUB_RUN_ID || Date.now().toString());
  await request(configUrl, async (response) => {
    assert.ok((await response.text()).includes(JSON.stringify(apiBase)), 'Pages must contain the deployed server address');
  });
  const helpUrl = new URL('js/components/help.js', pagesUrl);
  helpUrl.searchParams.set('check', process.env.GITHUB_RUN_ID || Date.now().toString());
  await request(helpUrl, async (response) => {
    assert.match(await response.text(), /const HelpViews/);
  });
  const tournamentUrl = new URL('js/views/tournament.js', pagesUrl);
  tournamentUrl.searchParams.set('check', process.env.GITHUB_RUN_ID || Date.now().toString());
  await request(tournamentUrl, async response => {
    assert.match(await response.text(), /league:managerDecision/);
  });
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
