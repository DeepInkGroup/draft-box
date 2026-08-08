const AuthView = {
  render(container) {
    container.innerHTML = `
      <div class="card" style="max-width:380px;margin:40px auto;">
        <div class="tabs">
          <div class="tab active" data-tab="login">Log in</div>
          <div class="tab" data-tab="register">Sign up</div>
        </div>
        <form id="authForm">
          <div class="field regOnly hidden">
            <label>Email</label>
            <input type="email" id="authEmail" placeholder="you@example.com" />
          </div>
          <div class="field">
            <label>Username</label>
            <input type="text" id="authUsername" placeholder="e.g. artin" required />
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" id="authPassword" placeholder="at least 6 characters" required />
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="authSubmit">Log in</button>
          <div class="error-text hidden" id="authError"></div>
        </form>
      </div>
    `;

    let mode = 'login';
    const tabs = container.querySelectorAll('.tab');
    const regOnly = container.querySelector('.regOnly');
    const submitBtn = container.querySelector('#authSubmit');
    const errorBox = container.querySelector('#authError');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        mode = tab.dataset.tab;
        regOnly.classList.toggle('hidden', mode !== 'register');
        submitBtn.textContent = mode === 'register' ? 'Sign up' : 'Log in';
        errorBox.classList.add('hidden');
      });
    });

    container.querySelector('#authForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.classList.add('hidden');
      const username = container.querySelector('#authUsername').value.trim();
      const password = container.querySelector('#authPassword').value;
      const email = container.querySelector('#authEmail').value.trim();
      submitBtn.disabled = true;
      try {
        const data = mode === 'register'
          ? await Api.register(username, email, password)
          : await Api.login(username, password);
        App.onAuthed(data.user, data.token);
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }
};
