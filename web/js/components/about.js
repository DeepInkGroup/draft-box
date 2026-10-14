const AboutUs = (() => {
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fields = [
    ['title', 'Page title', 100], ['subtitle', 'Short introduction', 200], ['body', 'Your story', 10000],
    ['teamName', 'Team or organization', 100], ['contactEmail', 'Contact email', 254],
    ['website', 'Website', 500], ['github', 'GitHub', 500], ['telegram', 'Telegram', 500]
  ];
  function safeLink(value) {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
  }
  function contentMarkup(content) {
    const links = [['website', 'Visit website'], ['github', 'GitHub'], ['telegram', 'Telegram']].map(([key, label]) => {
      const href = safeLink(content[key]);
      return href ? `<a class="about-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}<span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>` : '';
    }).join('');
    const email = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(content.contactEmail || '') ? `<a class="about-link" href="mailto:${esc(encodeURIComponent(content.contactEmail))}">Email us<span aria-hidden="true">↗</span></a>` : '';
    return `<article class="about-story"><div class="about-brand-mark" aria-hidden="true">DB</div><p class="help-eyebrow">${esc(content.teamName || 'DRAFT BOX')}</p><h2>${esc(content.title)}</h2>${content.subtitle ? `<p class="about-intro">${esc(content.subtitle)}</p>` : ''}<div class="about-body">${String(content.body || '').split(/\n\s*\n/).map(p => `<p dir="auto">${esc(p)}</p>`).join('')}</div>${links || email ? `<nav class="about-links" aria-label="About Us links">${links}${email}</nav>` : ''}</article>`;
  }
  function init() {
    const dialog = document.getElementById('aboutDialog'), body = document.getElementById('aboutContent');
    document.getElementById('btnCloseAbout').onclick = () => dialog.close();
    let request = 0;
    async function load() {
      const id = ++request;
      body.innerHTML = '<p class="help-empty" role="status">Loading About Us…</p>';
      try {
        const data = await Api.get('/api/about');
        if (id === request) body.innerHTML = contentMarkup(data.content);
      } catch (error) {
        if (id !== request) return;
        body.innerHTML = `<div class="help-empty"><h2>Could not load About Us</h2><p>${esc(error.message)}</p><button id="aboutRetry" class="btn btn-primary">Try again</button></div>`;
        document.getElementById('aboutRetry').onclick = load;
      }
    }
    document.getElementById('btnAbout').onclick = () => { dialog.showModal(); load(); };
  }
  async function edit(container) {
    let revision, saved, loading = false;
    container.innerHTML = `<div class="about-editor-grid"><section class="card"><div class="admin-section-head"><div><h2>Tell your story</h2><p class="muted">Introduce Draft Box and help players find your community.</p></div><span class="badge">Public page</span></div><form id="aboutEditorForm">${fields.map(([key, label, max]) => `<label class="about-editor-field">${label}${['title', 'body'].includes(key) ? ' *' : '<span class="muted"> · Optional</span>'}${key === 'body' ? `<textarea name="${key}" rows="8" maxlength="${max}" required placeholder="Tell players about Draft Box. Separate paragraphs with a blank line." dir="auto"></textarea><small class="muted">Plain text. Paragraphs are preserved.</small>` : `<input name="${key}" type="${key === 'contactEmail' ? 'email' : ['website', 'github', 'telegram'].includes(key) ? 'url' : 'text'}" maxlength="${max}" ${key === 'title' ? 'required' : ''} ${['website', 'github', 'telegram'].includes(key) ? 'placeholder="https://…"' : ''} dir="auto">`}</label>`).join('')}<p class="muted">Saving publishes these changes to the About Us header section.</p><p id="aboutEditorStatus" role="status" aria-live="polite">Loading saved content…</p><div class="row"><button type="submit" id="aboutSave" class="btn btn-primary" disabled>Save &amp; publish</button><button type="button" id="aboutReload" class="btn btn-ghost" disabled>Reload saved content</button></div></form></section><section class="card about-preview-card"><div class="admin-section-head"><div><span class="help-eyebrow">LIVE PREVIEW</span><h2>What players will see</h2></div><span class="badge" id="aboutPreviewBadge">Saved</span></div><div id="aboutPreview"></div></section></div>`;
    const form = container.querySelector('form'), status = container.querySelector('#aboutEditorStatus'), save = container.querySelector('#aboutSave'), reload = container.querySelector('#aboutReload');
    const read = () => Object.fromEntries(fields.map(([key]) => [key, form.elements[key].value]));
    function preview() {
      const content = read(), dirty = saved && JSON.stringify(content) !== JSON.stringify(saved);
      container.querySelector('#aboutPreview').innerHTML = contentMarkup(content);
      container.querySelector('#aboutPreviewBadge').textContent = dirty ? 'Unsaved changes' : 'Saved';
      save.disabled = loading || !revision || !dirty;
      if (dirty && !loading) { status.textContent = 'Preview updated. Save to publish your changes.'; status.classList.remove('error'); }
    }
    async function load() {
      loading = true; save.disabled = true; reload.disabled = true;
      form.querySelectorAll('input, textarea').forEach(input => input.disabled = true);
      status.textContent = 'Loading saved content…'; status.classList.remove('error');
      try {
        const data = await Api.get('/api/admin/about');
        revision = data.revision; saved = data.content;
        fields.forEach(([key]) => form.elements[key].value = saved[key] || '');
        loading = false; preview();
        status.textContent = `Saved version ${revision}. Ready to edit.`;
      } catch (error) { status.textContent = error.message; status.classList.add('error'); }
      finally { loading = false; reload.disabled = false; form.querySelectorAll('input, textarea').forEach(input => input.disabled = !revision); }
    }
    form.addEventListener('input', preview);
    reload.onclick = load;
    form.onsubmit = async event => {
      event.preventDefault(); if (loading || !revision) return;
      loading = true; save.disabled = true; reload.disabled = true;
      form.querySelectorAll('input, textarea').forEach(input => input.disabled = true);
      status.textContent = 'Publishing…'; status.classList.remove('error');
      try {
        const data = await Api.put('/api/admin/about', { content: read(), revision });
        revision = data.revision; saved = data.content;
        fields.forEach(([key]) => form.elements[key].value = saved[key]);
        loading = false; preview();
        status.textContent = `Published successfully. Version ${revision} is now visible to players.`;
      } catch (error) { status.textContent = error.message; status.classList.add('error'); }
      finally { loading = false; save.disabled = JSON.stringify(read()) === JSON.stringify(saved); reload.disabled = false; form.querySelectorAll('input, textarea').forEach(input => input.disabled = false); }
    };
    await load();
  }
  return { init, edit };
})();
