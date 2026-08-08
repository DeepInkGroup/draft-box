const DashboardView = {
  render(container) {
    container.innerHTML = `
      <div class="card center">
        <h2>🌍 جام جهانی ۲۰۲۶</h2>
        <p class="muted">تنها حالت فعال در حال حاضر. لیگ باشگاهی به‌زودی.</p>
      </div>

      <div class="card">
        <h3>⚡ بازی تک‌نفره</h3>
        <p class="muted">بلافاصله درفت را شروع کن و در جام جهانی با ۴۷ تیم بات رقابت کن.</p>
        <div class="field">
          <label>فرمیشن</label>
          <select id="spFormation">${FORMATIONS.map((f) => `<option value="${f}">${f}</option>`).join('')}</select>
        </div>
        <button id="btnSingleplayer" class="btn btn-primary btn-block">شروع بازی تک‌نفره</button>
      </div>

      <div class="row">
        <div class="card">
          <h3>➕ ساخت روم جدید</h3>
          <div class="field">
            <label>نام روم</label>
            <input type="text" id="crName" placeholder="روم دوستان" />
          </div>
          <div class="field">
            <label>حداکثر بازیکن حقیقی (۱ تا ۳۲)</label>
            <input type="number" id="crSlots" min="1" max="32" value="8" />
          </div>
          <div class="field">
            <label>فرمیشن تو</label>
            <select id="crFormation">${FORMATIONS.map((f) => `<option value="${f}">${f}</option>`).join('')}</select>
          </div>
          <button id="btnCreateRoom" class="btn btn-primary btn-block">ساخت روم و دریافت کد</button>
        </div>

        <div class="card">
          <h3>🔑 پیوستن با کد</h3>
          <div class="field">
            <label>کد روم</label>
            <input type="text" id="joinCode" placeholder="مثلاً AB12CD" style="text-transform:uppercase" />
          </div>
          <div class="field">
            <label>فرمیشن تو</label>
            <select id="joinFormation">${FORMATIONS.map((f) => `<option value="${f}">${f}</option>`).join('')}</select>
          </div>
          <button id="btnJoinRoom" class="btn btn-primary btn-block">پیوستن</button>
        </div>
      </div>
      <div class="error-text hidden" id="dashError"></div>
    `;

    const errorBox = container.querySelector('#dashError');
    const showErr = (e) => { errorBox.textContent = e.message; errorBox.classList.remove('hidden'); };

    container.querySelector('#btnSingleplayer').addEventListener('click', async () => {
      try {
        const room = await Api.createSingleplayer(container.querySelector('#spFormation').value);
        App.goDraft(room.code);
      } catch (e) { showErr(e); }
    });

    container.querySelector('#btnCreateRoom').addEventListener('click', async () => {
      try {
        const name = container.querySelector('#crName').value.trim();
        const slots = Number(container.querySelector('#crSlots').value) || 8;
        const formation = container.querySelector('#crFormation').value;
        const room = await Api.createRoom(name, slots, formation);
        App.goLobby(room.code);
      } catch (e) { showErr(e); }
    });

    container.querySelector('#btnJoinRoom').addEventListener('click', async () => {
      try {
        const code = container.querySelector('#joinCode').value.trim().toUpperCase();
        const formation = container.querySelector('#joinFormation').value;
        if (!code) return showErr(new Error('کد روم را وارد کن'));
        await Api.joinRoom(code, formation);
        App.goLobby(code);
      } catch (e) { showErr(e); }
    });
  }
};
