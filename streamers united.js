// --- CONFIG ---
const TWITCH_CLIENT_ID = 'aqsiwhh0et4lwfrcb6qky6dwe8ig4l';
const TWITCH_REDIRECT_URI = 'https://tuusuario.github.io/tu-repo'; // debe coincidir con la app registrada en Twitch
const TWITCH_SCOPES = encodeURIComponent('user:read:email'); // podrías ampliar scopes si necesitas más
const TWITCH_AUTH_URL = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(TWITCH_REDIRECT_URI)}&response_type=token&scope=${TWITCH_SCOPES}`;

// --- UTIL / STATE ---
const selectors = {
    authContainer: () => document.getElementById('auth-container'),
    dashboard: () => document.getElementById('dashboard'),
    loginBtn: () => document.getElementById('twitch-login'),
    contentArea: () => document.getElementById('content-area'),
    navBtns: () => document.querySelectorAll('.nav-btn')
};

let state = {
    token: null,
    tokenInfo: null, // info from validate endpoint (client_id, login, user_id, expires_in)
    user: null, // display name, id ...
    supports: [] // array local de supports {target, hours, date, supporterId}
};

// scoring map (según requisitos)
const SCORE_MAP = {
    1: 40,
    2: 50,
    3: 70,
    4: 80,
    5: 90
};

// --- AUTH FLOW ---
function initTwitchAuth(){
    window.location.href = TWITCH_AUTH_URL;
}

function handleTwitchCallbackFromHash(){
    const hash = window.location.hash || '';
    const m = hash.match(/access_token=([^&]*)/);
    if (m) {
        const token = m[1];
        // limpiar hash para no dejar token en URL
        history.replaceState(null, '', window.location.pathname + window.location.search);
        setToken(token);
        validateTwitchToken(token);
    }
}

function setToken(token){
    state.token = token;
    localStorage.setItem('ss_token', token);
}

function clearToken(){
    state.token = null;
    state.tokenInfo = null;
    localStorage.removeItem('ss_token');
    localStorage.removeItem('ss_token_info');
}

// validar token con Twitch
async function validateTwitchToken(token){
    try {
        const res = await fetch('https://id.twitch.tv/oauth2/validate', {
            headers: { 'Authorization': `OAuth ${token}` } // también funciona 'Bearer'
        });
        if (!res.ok) throw new Error('Token inválido');
        const info = await res.json(); // contiene client_id, login, user_id, expires_in, etc.
        state.tokenInfo = info;
        localStorage.setItem('ss_token_info', JSON.stringify(info));
        // recuperar user info básico (display_name)
        await fetchUserProfile(info.login);
        showDashboard();
    } catch (err) {
        console.error('validateTwitchToken error', err);
        alert('Error validando token. Vuelve a iniciar sesión.');
        clearToken();
        renderAuth();
    }
}

// peticion para obtener data del usuario via Helix:
async function fetchUserProfile(login){
    // Si login disponible en tokenInfo, usarlo
    if (!state.token) return;
    try {
        const res = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(state.tokenInfo.login)}`, {
            headers: {
                'Client-Id': TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${state.token}`
            }
        });
        const js = await res.json();
        if (js.data && js.data.length) {
            state.user = js.data[0];
            // guardar supports local si hay
            loadSupportsFromStorage();
        }
    } catch (e) {
        console.error('fetchUserProfile', e);
    }
}

// check token expiry periodically
function checkTokenExpiry(){
    const infoRaw = localStorage.getItem('ss_token_info');
    if (!infoRaw) return;
    const info = JSON.parse(infoRaw);
    // Twitch devuelve expires_in en segundos desde la validación, pero no fecha exacta.
    // Lo simple: si expires_in es pequeño (<60s) pedir re-login.
    if (info.expires_in && info.expires_in < 60) {
        alert('Tu sesión está por expirar. Vuelve a iniciar sesión para evitar problemas.');
        clearToken();
        renderAuth();
    }
}

// --- UI RENDER ---
function renderAuth(){
    selectors.authContainer().classList.remove('hidden');
    selectors.dashboard().classList.add('hidden');
}

function showDashboard(){
    selectors.authContainer().classList.add('hidden');
    selectors.dashboard().classList.remove('hidden');
    // default view: live streams
    renderLiveStreamsView();
}

function setActiveNav(buttonId){
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(buttonId).classList.add('active');
}

// --- VIEWS ---
function renderLiveStreamsView(){
    setActiveNav('live-streams');
    const container = selectors.contentArea();
    container.innerHTML = `
        <h2>Streams en Vivo</h2>
        <p class="muted">Verifica si tus colaboradores están en directo. Ingresa nombres de usuario (separados por comas).</p>
        <div style="display:flex;gap:8px;margin:12px 0;">
            <input id="usernames-input" placeholder="ej: streamer1, streamer2" style="flex:1;padding:8px;border-radius:8px;border:none" />
            <button id="check-live" class="btn">Chequear</button>
        </div>
        <div id="live-results" class="list"></div>
    `;

    document.getElementById('check-live').addEventListener('click', async () => {
        const input = document.getElementById('usernames-input').value.trim();
        if (!input) return alert('Escribe al menos un username');
        const usernames = input.split(',').map(s => s.trim()).filter(Boolean);
        await checkIfUsersLive(usernames);
    });
}

function renderRankingView(){
    setActiveNav('points-ranking');
    const container = selectors.contentArea();
    const ranking = buildRanking(); // calcular ranking a partir de supports
    container.innerHTML = `
        <h2>Puntos y Ranking</h2>
        <p class="muted">Puntos calculados según horas de apoyo.</p>
        <div id="ranking-list" class="list"></div>
    `;

    const list = document.getElementById('ranking-list');
    if (!ranking.length) {
        list.innerHTML = `<div class="item">No hay apoyos agendados aún. <span class="muted">Sé el primero en agendar.</span></div>`;
        return;
    }
    ranking.forEach((r, idx) => {
        const el = document.createElement('div');
        el.className = 'item';
        el.innerHTML = `<div><strong>#${idx+1} ${r.target}</strong><div class="muted">Apoyos: ${r.count}</div></div><div style="text-align:right"><div>${r.totalPoints} pts</div><div class="muted">${r.percentage}% apoyo</div></div>`;
        list.appendChild(el);
    });
}

function renderScheduleView(){
    setActiveNav('schedule-support');
    const container = selectors.contentArea();
    container.innerHTML = `
        <h2>Agendar Apoyo</h2>
        <p class="muted">Agrega a quién vas a apoyar y cuántas horas.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;">
            <input id="target-user" placeholder="username del streamer" style="padding:8px;border-radius:8px;border:none;flex:1" />
            <select id="hours-select" style="padding:8px;border-radius:8px;border:none;width:130px">
                <option value="1">1 hora</option>
                <option value="2">2 horas</option>
                <option value="3">3 horas</option>
                <option value="4">4 horas</option>
                <option value="5">5 horas</option>
            </select>
            <button id="save-support" class="btn">Guardar</button>
        </div>
        <div id="upcoming-list" class="list"></div>
    `;
    document.getElementById('save-support').addEventListener('click', () => {
        const target = document.getElementById('target-user').value.trim();
        const hours = parseInt(document.getElementById('hours-select').value, 10);
        if (!target) return alert('Indica el usuario al que apoyar.');
        saveSupport({ target, hours, date: new Date().toISOString(), supporterId: state.user ? state.user.id : 'anon' });
        renderScheduleView();
    });
    renderUpcomingSupports();
}

function renderUpcomingSupports(){
    const list = document.getElementById('upcoming-list');
    list.innerHTML = '';
    if (!state.supports.length) {
        list.innerHTML = `<div class="item">No hay apoyos agendados.</div>`;
        return;
    }
    state.supports.forEach((s, i) => {
        const el = document.createElement('div');
        el.className = 'item';
        el.innerHTML = `<div><strong>${s.target}</strong><div class="muted">${new Date(s.date).toLocaleString()} • ${s.hours} horas</div></div>
                        <div><button class="btn" data-idx="${i}" style="padding:6px 8px">Eliminar</button></div>`;
        list.appendChild(el);
    });
    list.querySelectorAll('button[data-idx]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.idx, 10);
            state.supports.splice(idx, 1);
            saveSupportsToStorage();
            renderScheduleView();
        });
    });
}

// --- SUPPORTS / RANKING (local storage for demo) ---
function loadSupportsFromStorage(){
    const raw = localStorage.getItem('ss_supports');
    state.supports = raw ? JSON.parse(raw) : [];
}

function saveSupport(support){
    state.supports.unshift(support);
    saveSupportsToStorage();
}

function saveSupportsToStorage(){
    localStorage.setItem('ss_supports', JSON.stringify(state.supports));
}

function buildRanking(){
    // agrupar por target
    const map = {};
    state.supports.forEach(s => {
        if (!map[s.target]) map[s.target] = { target: s.target, count: 0, totalPoints: 0 };
        map[s.target].count += 1;
        const pct = SCORE_MAP[s.hours] || 0;
        // sumar puntos: podemos normalizar como puntos = pct (ej: 40) por cada support
        map[s.target].totalPoints += pct;
    });
    const arr = Object.values(map).map(r => {
        // porcentaje de apoyo: promedio de porcentaje redondeado
        r.percentage = Math.round(r.totalPoints / (r.count || 1));
        return r;
    });
    arr.sort((a,b) => b.totalPoints - a.totalPoints);
    return arr;
}

// --- LIVE CHECK (Twitch Helix Get Streams) ---
async function checkIfUsersLive(usernames){
    const resultsContainer = document.getElementById('live-results');
    resultsContainer.innerHTML = 'Cargando...';
    try {
        // la API acepta user_login param repetido, transformamos:
        const params = usernames.map(u => `user_login=${encodeURIComponent(u)}`).join('&');
        const url = `https://api.twitch.tv/helix/streams?${params}`;
        const res = await fetch(url, {
            headers: {
                'Client-Id': TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${state.token}`
            }
        });
        const js = await res.json();
        // js.data contiene streams en vivo. Si username no está en la respuesta es que no está en vivo.
        const liveUsers = (js.data || []).map(s => s.user_login.toLowerCase());
        resultsContainer.innerHTML = '';
        usernames.forEach(u => {
            const isLive = liveUsers.includes(u.toLowerCase());
            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = `<div><strong>${u}</strong><div class="muted">${isLive ? 'EN VIVO' : 'Offline'}</div></div>
                             <div>${isLive ? '<a target="_blank" rel="noopener" href="https://twitch.tv/'+encodeURIComponent(u)+'" class="btn">Ver</a>' : ''}</div>`;
            resultsContainer.appendChild(div);
        });
    } catch (err) {
        console.error('checkIfUsersLive error', err);
        resultsContainer.innerHTML = `<div class="item">Error consultando Twitch API. Re-intenta y verifica token.</div>`;
    }
}

// --- Session / Logout ---
function logout(){
    clearToken();
    state.supports = [];
    localStorage.removeItem('ss_supports');
    renderAuth();
}

// --- INIT / ROUTING / EVENTS ---
document.addEventListener('DOMContentLoaded', async () => {
    // botones
    selectors.loginBtn().addEventListener('click', initTwitchAuth);
    document.getElementById('live-streams').addEventListener('click', renderLiveStreamsView);
    document.getElementById('points-ranking').addEventListener('click', renderRankingView);
    document.getElementById('schedule-support').addEventListener('click', renderScheduleView);
    document.getElementById('logout').addEventListener('click', logout);

    // restaurar token si existe
    const savedToken = localStorage.getItem('ss_token');
    const savedInfo = localStorage.getItem('ss_token_info');
    if (savedToken && savedInfo) {
        state.token = savedToken;
        state.tokenInfo = JSON.parse(savedInfo);
        await fetchUserProfile(state.tokenInfo.login);
        showDashboard();
    } else if (window.location.hash.includes('access_token')) {
        handleTwitchCallbackFromHash();
    } else {
        renderAuth();
    }

    // cargar supports
    loadSupportsFromStorage();

    // chequear expiry cada minuto (simple)
    setInterval(checkTokenExpiry, 60_000);
});

