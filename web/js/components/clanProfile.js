const ClanProfile = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let request = 0, clan = null;
  function badge(value) {
    const element = document.getElementById('profileClanBadge');
    element.classList.toggle('hidden', !value);
    element.textContent = value ? `[${value.tag}] ${value.name}` : '';
    if (App.state.user) App.state.user.clan = value ? { id: value.id, tag: value.tag, name: value.name, ownerId: value.ownerId } : null;
  }
  function init() {
    document.getElementById('btnProfile').addEventListener('click', refresh);
  }
  async function refresh() {
    const root = document.getElementById('profileClanContent'), id = ++request, userId = App.state.user?.id;
    root.innerHTML = '<p class="help-empty" role="status">Loading your clan…</p>';
    badge(App.state.user?.clan || null);
    try {
      const data = await Api.get('/api/clans/me');
      if (id !== request || userId !== App.state.user?.id) return;
      clan = data.clan; badge(clan); render(root);
    } catch (error) {
      if (id !== request || userId !== App.state.user?.id) return;
      root.innerHTML = `<div class="help-empty"><h3>Could not load your clan</h3><p>${esc(error.message)}</p><button class="btn btn-ghost" id="clanRetry">Try again</button></div>`;
      root.querySelector('#clanRetry').onclick = refresh;
    }
  }
  function render(root, message = '') {
    const owner = clan?.ownerId === App.state.user?.id;
    root.innerHTML = `<div class="help-section-heading"><div><h3>${clan ? 'Your clan' : 'Find your football community'}</h3><p class="muted">One clan per player. Share a tag, build a group and play together.</p></div><button id="clanRefresh" class="btn btn-ghost">Refresh</button></div><p id="clanMessage" role="status" aria-live="polite">${esc(message)}</p>${clan ? `<section class="help-card clan-summary"><div class="clan-title"><span class="clan-tag">[${esc(clan.tag)}]</span><div><h3 dir="auto">${esc(clan.name)}</h3><span class="muted">${owner ? 'Clan leader' : 'Member'} · ${clan.members.length}/${clan.maxMembers} members</span></div></div>${clan.description ? `<p class="clan-description" dir="auto">${esc(clan.description)}</p>` : ''}<div class="clan-actions"><button id="clanCopyTag" class="btn btn-ghost">Copy clan tag</button><button id="clanLeave" class="btn btn-ghost">${clan.members.length === 1 ? 'Close clan &amp; leave' : 'Leave clan'}</button></div><p class="muted clan-note">Join by entering ${esc(clan.tag)} in Profile → Clan. ${owner && clan.members.length > 1 ? 'If you leave, the earliest remaining member becomes the leader.' : clan.members.length === 1 ? 'Leaving closes this empty clan and frees its tag.' : ''}</p></section><div class="clan-member-layout"><section class="help-card"><h3>Members</h3><ul class="clan-members">${clan.members.map(member => `<li><span class="clan-member-avatar" aria-hidden="true">${esc(member.username[0].toUpperCase())}</span><div><b>${esc(member.username)}${member.userId === App.state.user.id ? ' (you)' : ''}</b><span class="muted">${member.leader ? 'Leader' : 'Member'}</span></div></li>`).join('')}</ul></section>${owner ? `<section class="help-card"><h3>Clan details</h3><form id="clanEditForm"><label class="help-field">Clan name<input name="name" value="${esc(clan.name)}" minlength="3" maxlength="40" required dir="auto"></label><label class="help-field">Description<textarea name="description" maxlength="240" rows="4" dir="auto">${esc(clan.description)}</textarea></label><p class="muted">Your tag stays fixed so members can always find the clan.</p><button class="btn btn-primary" type="submit">Save details</button></form></section>` : ''}</div>` : `<div class="profile-friends-grid"><section class="help-card"><span class="help-eyebrow">START A GROUP</span><h3>Create a clan</h3><form id="clanCreateForm"><label class="help-field">Clan name<input name="name" minlength="3" maxlength="40" placeholder="Your group name" required dir="auto"></label><label class="help-field">Tag<input name="tag" minlength="2" maxlength="6" pattern="[A-Za-z0-9]{2,6}" placeholder="e.g. PGL" required autocapitalize="characters" autocomplete="off" spellcheck="false"></label><p class="muted clan-note">2–6 letters or numbers. Each tag belongs to one clan.</p><label class="help-field">Description (optional)<textarea name="description" maxlength="240" rows="3" placeholder="Tell players about your group" dir="auto"></textarea></label><button class="btn btn-primary" type="submit">Create clan</button></form></section><section class="help-card"><span class="help-eyebrow">PLAY TOGETHER</span><h3>Join a clan</h3><p class="muted">Ask a friend for their clan tag. Joining makes you a member and displays the tag on your profile.</p><form id="clanJoinForm"><label class="help-field">Clan tag<input name="tag" minlength="2" maxlength="6" pattern="[A-Za-z0-9]{2,6}" placeholder="Enter a tag" required autocapitalize="characters" autocomplete="off" spellcheck="false"></label><button class="btn btn-primary" type="submit">Join clan</button></form></section></div>`}`;
    root.querySelector('#clanRefresh').onclick = refresh;
    async function action(path, body, method, success) {
      const userId = App.state.user?.id, buttons = [...root.querySelectorAll('button, input, textarea')];
      buttons.forEach(button => button.disabled = true);
      const status = root.querySelector('#clanMessage'); status.textContent = 'Saving…'; status.classList.remove('error');
      try {
        const data = await Api[method](path, body);
        if (userId !== App.state.user?.id || !document.getElementById('profileDialog').contains(root)) return;
        clan = data.clan; badge(clan); render(root, success);
      } catch (error) { status.textContent = error.message; status.classList.add('error'); }
      finally { buttons.forEach(button => button.disabled = false); }
    }
    function form(id, path, method, success) {
      const element = root.querySelector('#' + id); if (!element) return;
      element.onsubmit = event => { event.preventDefault(); action(path, Object.fromEntries(new FormData(element)), method, success); };
    }
    form('clanCreateForm', '/api/clans', 'post', 'Clan created. Share your tag so friends can join.');
    form('clanJoinForm', '/api/clans/join', 'post', 'You joined the clan.');
    form('clanEditForm', '/api/clans/me', 'put', 'Clan details saved.');
    if (clan) {
      root.querySelector('#clanLeave').onclick = () => action('/api/clans/leave', {}, 'post', 'You left the clan.');
      root.querySelector('#clanCopyTag').onclick = async () => {
        try { await navigator.clipboard.writeText(clan.tag); App.toast('Clan tag copied'); } catch { App.toast('Share this clan tag: ' + clan.tag); }
      };
    }
  }
  return { init, refresh, badge };
})();
