let currentUser = null;

// ===== NAVIGACE =====
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  if (name === 'zed') nacistFeed();
  if (name === 'uzivatele') nacistUzivatele();
}

function updateNav() {
  const logged = !!currentUser;
  document.getElementById('nav-zed').style.display = logged ? '' : 'none';
  document.getElementById('nav-uzivatele').style.display = logged ? '' : 'none';
  document.getElementById('nav-logout').style.display = logged ? '' : 'none';
  document.getElementById('nav-login').style.display = logged ? 'none' : '';
  document.getElementById('nav-registrace').style.display = logged ? 'none' : '';
}

// ===== AUTH =====
async function login() {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const res = await fetch('/api/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username, password }) });
  const data = await res.json();
  if (data.ok) {
    currentUser = data;
    const me = await (await fetch('/api/me')).json();
    currentUser = me;
    updateNav();
    showPage('zed');
  } else {
    document.getElementById('login-error').textContent = 'Špatné přihlašovací údaje';
  }
}

async function registrace() {
  const vek = parseInt(document.getElementById('reg-vek').value);
  if (vek < 13) { document.getElementById('reg-error').textContent = 'Musíš mít alespoň 13 let.'; return; }
  const form = new FormData();
  form.append('jmeno', document.getElementById('reg-jmeno').value);
  form.append('prijmeni', document.getElementById('reg-prijmeni').value);
  form.append('vek', vek);
  form.append('pohlavi', document.getElementById('reg-pohlavi').value);
  form.append('username', document.getElementById('reg-username').value);
  form.append('password', document.getElementById('reg-password').value);
  const foto = document.getElementById('reg-foto').files[0];
  if (foto) form.append('foto', foto);
  const res = await fetch('/api/register', { method: 'POST', body: form });
  const data = await res.json();
  if (data.ok) { alert('Registrace úspěšná, přihlas se.'); showPage('login'); }
  else document.getElementById('reg-error').textContent = 'Chyba: ' + data.error;
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  currentUser = null;
  updateNav();
  showPage('login');
}

// ===== ZEĎ =====
async function nacistFeed() {
  const res = await fetch('/api/prispevky');
  if (!res.ok) return;
  const prispevky = await res.json();
  document.getElementById('feed').innerHTML = prispevky.map(renderPrispevek).join('');
}

function renderPrispevek(p) {
  const avatar = p.autor_foto
    ? `<img src="${p.autor_foto}" alt="foto">`
    : `<div class="avatar-placeholder">${p.jmeno[0]}${p.prijmeni[0]}</div>`;
  const obrazek = p.obrazek ? `<img class="post-img" src="${p.obrazek}">` : '';
  return `
    <div class="card" id="post-${p.id}">
      <div class="post-header">
        ${avatar}
        <div>
          <strong>${p.jmeno} ${p.prijmeni}</strong>
          <div class="post-date">${new Date(p.vytvoreno).toLocaleString('cs-CZ')}</div>
        </div>
      </div>
      <div class="post-title">${escHtml(p.nadpis)}</div>
      <div class="post-text">${escHtml(p.text)}</div>
      ${obrazek}
      <div class="post-actions">
        <button class="secondary" onclick="toggleLajk(${p.id})">👍 Lajk</button>
        <span style="align-self:center;font-size:13px;cursor:pointer" onclick="toggleLajkList(${p.id})">
          <strong id="like-count-${p.id}">${p.pocet_lajku}</strong> lajků
        </span>
      </div>
      <div class="like-list" id="like-list-${p.id}">Načítám...</div>
      <div class="comments" id="comments-${p.id}"></div>
      <div class="comment-form">
        <input type="text" id="comment-input-${p.id}" placeholder="Napsat komentář...">
        <button onclick="pridatKomentar(${p.id})">Odeslat</button>
      </div>
    </div>`;
}

async function pridatPrispevek() {
  const form = new FormData();
  form.append('nadpis', document.getElementById('post-nadpis').value);
  form.append('text', document.getElementById('post-text').value);
  const obrazek = document.getElementById('post-obrazek').files[0];
  if (obrazek) form.append('obrazek', obrazek);
  await fetch('/api/prispevky', { method: 'POST', body: form });
  document.getElementById('post-nadpis').value = '';
  document.getElementById('post-text').value = '';
  document.getElementById('post-obrazek').value = '';
  nacistFeed();
}

async function nacistKomentare(prispevek_id) {
  const res = await fetch('/api/komentare/' + prispevek_id);
  const komentare = await res.json();
  document.getElementById('comments-' + prispevek_id).innerHTML = komentare.map(k => `
    <div class="comment">
      <strong>${k.jmeno} ${k.prijmeni}</strong> ${escHtml(k.text)}
      <div class="comment-date">${new Date(k.vytvoreno).toLocaleString('cs-CZ')}</div>
    </div>`).join('');
}

async function pridatKomentar(prispevek_id) {
  const input = document.getElementById('comment-input-' + prispevek_id);
  if (!input.value.trim()) return;
  await fetch('/api/komentare', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ prispevek_id, text: input.value }) });
  input.value = '';
  nacistKomentare(prispevek_id);
}

async function toggleLajk(prispevek_id) {
  const res = await fetch('/api/lajky', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ prispevek_id }) });
  const data = await res.json();
  // Obnov počet
  const countRes = await fetch('/api/prispevky');
  const prispevky = await countRes.json();
  const p = prispevky.find(x => x.id === prispevek_id);
  if (p) document.getElementById('like-count-' + prispevek_id).textContent = p.pocet_lajku;
}

async function toggleLajkList(prispevek_id) {
  const el = document.getElementById('like-list-' + prispevek_id);
  if (el.classList.toggle('open')) {
    const res = await fetch('/api/lajky/' + prispevek_id);
    const lajky = await res.json();
    el.innerHTML = lajky.length === 0 ? 'Žádné lajky' :
      lajky.map(l => `${l.jmeno} ${l.prijmeni} – <span class="comment-date">${new Date(l.vytvoreno).toLocaleString('cs-CZ')}</span>`).join('<br>');
  }
}

// Načti komentáře pro všechny příspěvky po renderu feedu
const origNacistFeed = nacistFeed;

// ===== UŽIVATELÉ =====
async function nacistUzivatele() {
  const res = await fetch('/api/uzivatele');
  const uzivatele = await res.json();
  document.getElementById('user-list').innerHTML = uzivatele.map(u => `
    <div class="user-item" onclick="showUzivatel(${u.id})">
      ${u.foto ? `<img src="${u.foto}" alt="foto">` : `<div class="avatar-placeholder">${u.jmeno[0]}${u.prijmeni[0]}</div>`}
      <span>${u.prijmeni} ${u.jmeno}</span>
    </div>`).join('');
}

async function showUzivatel(id) {
  const [uRes, pRes, aRes] = await Promise.all([
    fetch('/api/uzivatele/' + id),
    fetch('/api/uzivatele/' + id + '/prispevky'),
    fetch('/api/uzivatele/' + id + '/aktivita')
  ]);
  const u = await uRes.json();
  const prispevky = await pRes.json();
  const aktivita = await aRes.json();

  const avatar = u.foto
    ? `<img src="${u.foto}" style="width:70px;height:70px;border-radius:50%;object-fit:cover">`
    : `<div style="width:70px;height:70px;border-radius:50%;background:#1877f2;color:white;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:bold">${u.jmeno[0]}${u.prijmeni[0]}</div>`;

  document.getElementById('uzivatel-info').innerHTML = `
    <div style="display:flex;align-items:center;gap:16px">
      ${avatar}
      <div>
        <h2>${u.jmeno} ${u.prijmeni}</h2>
        <div>Věk: ${u.vek} | Pohlaví: ${u.pohlavi}</div>
      </div>
    </div>`;

  document.getElementById('uzivatel-prispevky').innerHTML = `
    <h3>Vlastní příspěvky</h3>
    ${prispevky.map(renderPrispevek).join('') || '<div class="card">Žádné příspěvky</div>'}
    <h3>Aktivita (lajky a komentáře)</h3>
    ${aktivita.map(renderPrispevek).join('') || '<div class="card">Žádná aktivita</div>'}`;

  showPage('uzivatel');
}

// ===== HELPER =====
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Init
(async () => {
  const me = await fetch('/api/me').then(r => r.json());
  if (me) {
    currentUser = me;
    updateNav();
    showPage('zed');
  }
})();