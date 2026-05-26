
// Frontend script for DEV.STATION dashboard

const isLoggedIn = localStorage.getItem("loggedIn");

if (!isLoggedIn) {
    window.location.href = "login.html";
}

function logout() {
    localStorage.removeItem("loggedIn");
    window.location.href = "login.html";
}

const API_BASE = "https://9c361e9itb.execute-api.us-east-1.amazonaws.com/dev";

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function setLoading(elId, btnId, label) {
    const el = document.getElementById(elId);
    const btn = btnId ? document.getElementById(btnId) : null;
    if (btn) btn.disabled = true;
    if (el) el.innerHTML = `<div class="status-msg"><span class="ascii-loader">[ &gt;&gt;&gt; ]</span><span>${escapeHtml(label)}</span></div>`;
}

function setError(elId, btnId, msg) {
    const el = document.getElementById(elId);
    const btn = btnId ? document.getElementById(btnId) : null;
    if (btn) btn.disabled = false;
    if (el) el.innerHTML = `<div class="status-msg error"><span>ERR //</span><span>${escapeHtml(msg)}</span></div>`;
}

function clearLoading(btnId) { const btn = document.getElementById(btnId); if (btn) btn.disabled = false; }

function formatDuration(sec) {
    const s = Number(sec) || 0;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatReview(text) {
    const t0 = String(text || '');
    let t = escapeHtml(t0);
    t = t.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, _lang, code) => `<pre>${escapeHtml(code.trim())}</pre>`);
    t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/^###?\s+(.+)$/gm, '<h3>$1</h3>');
    t = t.replace(/\n{2,}/g, '</p><p>');
    t = t.replace(/\n/g, '<br>');
    return `<p>${t}</p>`;
}

function tickClock() {
    const el = document.getElementById('clock');
    if (!el) return;
    const d = new Date();
    const t = [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()].map(n => String(n).padStart(2, '0')).join(':');
    el.textContent = t + ' UTC';
}

setInterval(tickClock, 1000);
tickClock();

// Editor synchronization (defensive)
function safeSyncEditor() {
    const codeInput = document.getElementById('codeInput');
    const lineGutter = document.getElementById('lineGutter');
    const codeStats = document.getElementById('codeStats');
    const highlightingCode = document.getElementById('highlightingCode');
    const highlightingPane = document.getElementById('highlighting');
    if (!codeInput) return;

    function syncEditor() {
        const code = codeInput.value || '';
        const lines = code.split('\n').length || 1;
        if (lineGutter) lineGutter.textContent = Array.from({length: lines}, (_, i) => i + 1).join('\n');
        if (codeStats) codeStats.textContent = `${lines} line${lines === 1 ? '' : 's'} \u00b7 ${code.length} chars`;

        if (highlightingCode) {
            let escaped = escapeHtml(code);
            if (code.endsWith('\n')) escaped += ' ';
            highlightingCode.innerHTML = escaped;
            if (window.Prism && typeof window.Prism.highlightElement === 'function') {
                try { window.Prism.highlightElement(highlightingCode); } catch (_) {}
            }
        }
    }

    codeInput.removeEventListener && codeInput.removeEventListener('input', syncEditor);
    codeInput.addEventListener('input', syncEditor);
    codeInput.addEventListener('scroll', () => {
        if (lineGutter) lineGutter.scrollTop = codeInput.scrollTop;
        if (highlightingPane) {
            highlightingPane.scrollTop = codeInput.scrollTop;
            highlightingPane.scrollLeft = codeInput.scrollLeft;
        }
    });
    codeInput.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); reviewCode(); }
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = codeInput.selectionStart;
            const end = codeInput.selectionEnd;
            codeInput.value = codeInput.value.substring(0, start) + '    ' + codeInput.value.substring(end);
            codeInput.selectionStart = codeInput.selectionEnd = start + 4;
            syncEditor();
        }
    });
    syncEditor();
}

// PROFILE (GitHub) -------------------------------------------------
async function getProfile() {
    try {
        const input = document.getElementById('username');
        const result = document.getElementById('result');
        const btn = document.getElementById('ghBtn');
        const username = input ? String(input.value || '').trim() : '';
        if (!username) { if (result) setError('result', 'ghBtn', 'username required'); return; }
        setLoading('result', 'ghBtn', `scanning github://${username}...`);

        const res = await fetch(`${API_BASE}/github?username=${encodeURIComponent(username)}`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = await res.json();
        if (!body || body.error) throw new Error(body?.error || 'user not found');

        renderProfileResult(body, username, false);
    } catch (err) {
        setError('result', 'ghBtn', err?.message || 'failed to fetch profile');
    }
}

function renderProfileResult(body, username, isOffline) {
    const result = document.getElementById('result');
    if (!result) return;
    const avatarUrl = `https://github.com/${encodeURIComponent(username)}.png?size=240`;
    result.innerHTML = `
        <div class="result-block">
            ${isOffline ? `<div style="margin-bottom: 12px; display:flex;align-items:center;gap:8px;"><span class="resilient-badge">OFFLINE MODE</span><span style="font-family:var(--mono);font-size:11px;color:var(--ink-soft);">LOADED FROM CACHE</span></div>` : ''}
            <div class="gh-card">
                <div class="gh-avatar"><img src="${avatarUrl}" alt="" onerror="this.style.display='none'"></div>
                <div>
                    <div class="gh-name">${escapeHtml(body.name || username)}</div>
                    <div class="gh-username">${escapeHtml(body.username || username)}</div>
                    <div class="gh-stats">
                        <div><div class="gh-stat-label">Followers</div><div class="gh-stat-value">${body.followers ?? '—'}</div></div>
                        <div><div class="gh-stat-label">Repos</div><div class="gh-stat-value">${body.public_repos ?? '—'}</div></div>
                    </div>
                    ${body.profile_url ? `<a class="gh-link" href="${escapeHtml(body.profile_url)}" target="_blank" rel="noopener">Visit Profile &rarr;</a>` : ''}
                </div>
            </div>
        </div>`;
    clearLoading('ghBtn');
}

// CONTESTS ---------------------------------------------------------
async function getContests() {
    try {
        setLoading('contestResult', 'contestBtn', 'fetching upcoming contests...');
        const res = await fetch(`${API_BASE}/contests`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const contests = await res.json();
        if (!Array.isArray(contests) || contests.length === 0) throw new Error('no contests returned');
        renderContestsResult(contests, false);
    } catch (err) {
        // try to recover with cache or mock data
        try {
            const cached = localStorage.getItem('cache_contests');
            if (cached) { renderContestsResult(JSON.parse(cached), true); return; }
        } catch (_) {}
        const mockContests = [
            { name: 'Codeforces Round 985 (Div. 2)', duration: 7200, phase: 'BEFORE' },
            { name: 'LeetCode Weekly Contest 410', duration: 5400, phase: 'BEFORE' },
            { name: 'AtCoder Beginner Contest 360', duration: 6000, phase: 'FINISHED' }
        ];
        renderContestsResult(mockContests, true);
    }
}

function renderContestsResult(contests, isOffline) {
    const el = document.getElementById('contestResult');
    if (!el) return;
    const cards = (contests || []).slice(0,8).map(c => {
        const phaseClass = `phase-${(c.phase || 'default')}`;
        return `
            <div class="contest-card">
                <div class="contest-phase ${phaseClass}">${escapeHtml(c.phase || 'PENDING')}</div>
                <div class="contest-name">${escapeHtml(c.name || 'Untitled')}</div>
                <div class="contest-duration">DURATION<b>${formatDuration(c.duration || 0)}</b></div>
            </div>`;
    }).join('');
    el.innerHTML = `<div class="result-block">${isOffline ? `<div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;"><span class="resilient-badge">RESILIENT NODE ACTIVE</span><span style="font-family:var(--mono);font-size:11px;color:var(--ink-soft);">LOCAL DATA FAILOVER</span></div>` : ''}<div class="contest-rail">${cards}</div></div>`;
    clearLoading('contestBtn');
}

// AI REVIEW -------------------------------------------------------
async function reviewCode() {
    const codeInput = document.getElementById('codeInput');
    const out = document.getElementById('reviewResult');
    const stat = document.getElementById('reviewStat');
    const reviewBtn = document.getElementById('reviewBtn');
    if (!codeInput || !out || !stat || !reviewBtn) return;

    const rawCode = String(codeInput.value || '');
    if (!rawCode.trim()) { out.innerHTML = `<div class="status-msg error inline"><span>ERR //</span><span>paste some code first</span></div>`; return; }

    reviewBtn.disabled = true; stat.textContent = 'analyzing...';
    out.innerHTML = `<div class="empty-output"><div class="icon" style="animation: blink 1.4s infinite;">AI</div><h4>Groq is thinking...</h4><p>Your code is being analyzed. This usually takes 2&ndash;5 seconds.</p></div>`;

    try {
        const res = await fetch(`${API_BASE}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: rawCode }) });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        if (data?.error) throw new Error(data.error);
        const reviewText = data?.review || (typeof data === 'string' ? data : JSON.stringify(data, null, 2));
        out.innerHTML = formatReview(reviewText);
        stat.textContent = `${String(reviewText).length} chars`;
    } catch (err) {
        // fallback to local heuristic
        try {
            const local = runLocalHeuristicReview(rawCode);
            out.innerHTML = `<div style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px dashed var(--border);padding-bottom:12px;"><span class="resilient-badge">LOCAL HEURISTICS MODE</span><span style="font-family:var(--mono);font-size:11px;color:var(--ink-soft);">OFFLINE SYNTAX ENGINE V1.0</span></div>` + formatReview(local);
            stat.textContent = `${String(local).length} chars (local)`;
        } catch (e) {
            out.innerHTML = `<div class="status-msg error inline"><span>ERR //</span><span>${escapeHtml(err?.message || 'analysis failed')}</span></div>`;
            stat.textContent = 'error';
        }
    } finally {
        reviewBtn.disabled = false;
    }
}

function runLocalHeuristicReview(code) {
    // keep original lightweight heuristics
    const issues = [];
    if (/\bvar\b/.test(code)) issues.push({ title: 'Legacy Style: var detected', desc: 'Use let/const' });
    if (/console\.log|debugger/.test(code)) issues.push({ title: 'Debug traces', desc: 'Remove console logs' });
    let md = '### Local Heuristic Review\n\n';
    if (issues.length === 0) md += 'No obvious issues detected.'; else issues.forEach((it, i) => md += `**${i+1}. ${it.title}**\n> ${it.desc}\n\n`);
    return md;
}

// LEETCODE --------------------------------------------------------
async function fetchLeetCodeStats() {
    const input = document.getElementById('leetcodeUsername');
    const resultDiv = document.getElementById('leetcodeResult');
    if (!input || !resultDiv) return;
    const username = String(input.value || '').trim();
    if (!username) { resultDiv.innerHTML = `<div class="error-message">Enter a username</div>`; return; }
    resultDiv.innerHTML = `<div class="loading">Fetching developer analytics...</div>`;
    try {
        const res = await fetch(`${API_BASE}/leetcode?username=${encodeURIComponent(username)}`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        if (data?.error) { resultDiv.innerHTML = `<div class="error-message">${escapeHtml(data.error)}</div>`; return; }
        resultDiv.innerHTML = `
            <div class="leetcode-card">
                <h3>${escapeHtml(username)}</h3>
                <div class="leetcode-stats">
                    <div class="stat-box">Total Solved<span>${data.totalSolved ?? 0}</span></div>
                    <div class="stat-box">Easy<span>${data.easySolved ?? 0}</span></div>
                    <div class="stat-box">Medium<span>${data.mediumSolved ?? 0}</span></div>
                    <div class="stat-box">Hard<span>${data.hardSolved ?? 0}</span></div>
                    <div class="stat-box">Ranking<span>${data.ranking ?? '—'}</span></div>
                    <div class="stat-box">Acceptance<span>${data.acceptanceRate ?? '—'}%</span></div>
                </div>
            </div>`;
    } catch (err) {
        resultDiv.innerHTML = `<div class="error-message">Failed to fetch LeetCode stats</div>`;
        console.error(err);
    }
}

// SCAN DEVELOPER (stabilized) ------------------------------------
async function scanDeveloper(github, leetcode, codeforces, isManualSearch = false) {
    // Support both direct-params and DOM-reading calls
    try {
        const isDomCall = (typeof github === 'undefined');
        if (isDomCall) {
            const gEl = document.getElementById('scanGithub');
            const lEl = document.getElementById('scanLeetcode');
            const cEl = document.getElementById('scanCodeforces');
            github = gEl ? String(gEl.value || '').trim() : '';
            leetcode = lEl ? String(lEl.value || '').trim() : '';
            codeforces = cEl ? String(cEl.value || '').trim() : '';
            isManualSearch = true;
        }

        const resultDiv = document.getElementById(isManualSearch ? 'scanResult' : 'myDashboardResult');
        const scanBtn = document.getElementById(isManualSearch ? 'exploreScanBtn' : null);
        if (scanBtn) { scanBtn.disabled = true; scanBtn.textContent = 'Scanning...'; }
        if (resultDiv) resultDiv.innerHTML = `<div class="loading">SYSTEM // scanning developer identity nodes...</div>`;

        const cacheKey = `cache_scan_${github || ''}_${leetcode || ''}_${codeforces || ''}`;

        let response, data;
        try {
            response = await fetch(`${API_BASE}/scan?github=${encodeURIComponent(github || '')}&leetcode=${encodeURIComponent(leetcode || '')}&codeforces=${encodeURIComponent(codeforces || '')}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            data = await response.json();
        } catch (err) {
            console.warn('scanDeveloper fetch failed:', err?.message || err);
            try { const cached = localStorage.getItem(cacheKey); if (cached) data = JSON.parse(cached); }
            catch (_) { data = null; }
            if (!data) data = generateMockDeveloper(github, leetcode, codeforces);
        }

        try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (_) {}
        renderScanResult(data, isManualSearch ? document.getElementById('scanResult') : document.getElementById('myDashboardResult'), github, leetcode, codeforces, isManualSearch, false);
        if (scanBtn) { scanBtn.disabled = false; scanBtn.innerHTML = 'Scan Developer Profile &rarr;'; }
    } catch (err) {
        console.error('scanDeveloper unexpected error:', err);
        const target = document.getElementById('scanResult'); if (target) target.innerHTML = `<div class="error-message">failed to scan developer</div>`;
        const scanBtn = document.getElementById('exploreScanBtn'); if (scanBtn) { scanBtn.disabled = false; scanBtn.innerHTML = 'Scan Developer Profile &rarr;'; }
    }
}

function renderScanResult(data, resultDiv, github, leetcode, codeforces, isManualSearch, isOffline) {
    if (!resultDiv) return;
    const gh = data?.github || {};
    const lc = data?.leetcode || {};
    const cf = data?.codeforces || {};
    const persona = Array.isArray(data?.persona) ? data.persona : [];

    resultDiv.innerHTML = `
        <div class="scan-card">
            ${isOffline ? `<div style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;"><span class="resilient-badge">RESILIENT CACHE NODE</span><span style="font-family:var(--mono);font-size:11px;color:var(--ink-soft);">FAILOVER SIMULATOR ACTIVE</span></div>` : ''}
            <div class="scan-top">
                <div class="scan-avatar"><img src="${escapeHtml(gh.avatar || `https://github.com/${encodeURIComponent(github || 'dev')}.png?size=240`)}" alt="" onerror="this.src='https://avatars.githubusercontent.com/u/9919?v=4'"></div>
                <div>
                    <div class="scan-name">${escapeHtml(gh.name || github || 'Developer')}</div>
                    <div class="scan-username">@${escapeHtml(gh.username || github || 'anonymous')}</div>
                </div>
            </div>
            <div class="scan-stats">
                <div class="scan-stat"><div class="scan-stat-label">Followers</div><div class="scan-stat-value">${gh.followers ?? 0}</div></div>
                <div class="scan-stat"><div class="scan-stat-label">Repositories</div><div class="scan-stat-value">${gh.repos ?? 0}</div></div>
                <div class="scan-stat"><div class="scan-stat-label">LeetCode Solved</div><div class="scan-stat-value">${lc.totalSolved ?? 0}</div></div>
                <div class="scan-stat"><div class="scan-stat-label">Codeforces Rating</div><div class="scan-stat-value">${cf.rating ?? 'N/A'}</div></div>
            </div>
            <div class="persona-list">${persona.map(p => `<div class="persona-badge">${escapeHtml(p)}</div>`).join('')}</div>
        </div>`;

    // If rendering the main dashboard, show GitHub readme stats
    if (!isManualSearch) {
        const statsImg = document.getElementById('ghStatsImg');
        const langsImg = document.getElementById('ghLangsImg');
        const statsGrid = document.getElementById('myReadmeStats');
        if (gh.username) {
            if (statsImg) statsImg.src = `https://github-readme-stats.vercel.app/api?username=${encodeURIComponent(gh.username)}&show_icons=true&theme=tokyonight`;
            if (langsImg) langsImg.src = `https://github-readme-stats.vercel.app/api/top-langs/?username=${encodeURIComponent(gh.username)}&layout=compact&theme=tokyonight`;
            if (statsGrid) statsGrid.style.display = 'grid';
        } else if (statsGrid) {
            statsGrid.style.display = 'none';
        }
    } else {
        try { localStorage.setItem('explore_github', github || ''); localStorage.setItem('explore_leetcode', leetcode || ''); localStorage.setItem('explore_codeforces', codeforces || ''); } catch (_) {}
    }
}

function generateMockDeveloper(github, leetcode, codeforces) {
    const hash = (str) => { let h = 0; for (let i=0;i<str.length;i++) h = (h<<5)-h+str.charCodeAt(i)|0; return Math.abs(h); };
    const ghVal = github || 'dev'; const lcVal = leetcode || 'dev'; const cfVal = codeforces || 'dev';
    const ghHash = hash(ghVal); const lcHash = hash(lcVal); const cfHash = hash(cfVal);
    const followers = (ghHash % 89) + 12; const repos = (ghHash % 42) + 8; const totalSolved = (lcHash % 450) + 75; const cfRating = (cfHash % 1100) + 1000;
    const personas = [];
    if (totalSolved > 350) personas.push('Algo Master'); else if (totalSolved > 150) personas.push('LeetCoder'); else personas.push('Script Wizard');
    if (cfRating > 1800) personas.push('Grandmaster'); else if (cfRating > 1400) personas.push('Specialist'); else personas.push('Competitor');
    if (repos > 30) personas.push('Git Pioneer'); else personas.push('Open Source Contributor');
    personas.push('Resilient Node');
    return { github: { avatar: `https://github.com/${encodeURIComponent(ghVal)}.png?size=240`, name: `${ghVal.charAt(0).toUpperCase()+ghVal.slice(1)} (Offline)`, username: ghVal, followers, repos }, leetcode: { totalSolved }, codeforces: { rating: cfRating }, persona: personas };
}

function triggerManualSearch() {
    const g = document.getElementById('scanGithub');
    const l = document.getElementById('scanLeetcode');
    const c = document.getElementById('scanCodeforces');
    const github = g ? String(g.value || '').trim() : '';
    const leetcode = l ? String(l.value || '').trim() : '';
    const codeforces = c ? String(c.value || '').trim() : '';
    if (!github && !leetcode && !codeforces) {
        const target = document.getElementById('scanResult'); if (target) target.innerHTML = `<div class="error-message">ERR // please enter at least one developer handle</div>`; return;
    }
    scanDeveloper(github, leetcode, codeforces, true);
}

// INITIALIZER -----------------------------------------------------
function initDashboard() {
    try {
        // Safe editor setup
        safeSyncEditor();

        // Bind simple listeners (if not already bound)
        const usernameInput = document.getElementById('username');
        if (usernameInput) usernameInput.addEventListener('keydown', e => { if (e.key === 'Enter') getProfile(); });

        const scanGhInput = document.getElementById('scanGithub'); if (scanGhInput) scanGhInput.addEventListener('keydown', e => { if (e.key === 'Enter') triggerManualSearch(); });
        const scanLcInput = document.getElementById('scanLeetcode'); if (scanLcInput) scanLcInput.addEventListener('keydown', e => { if (e.key === 'Enter') triggerManualSearch(); });
        const scanCfInput = document.getElementById('scanCodeforces'); if (scanCfInput) scanCfInput.addEventListener('keydown', e => { if (e.key === 'Enter') triggerManualSearch(); });

        // Restore explore fields
        try {
            const eg = localStorage.getItem('explore_github'); if (eg && document.getElementById('scanGithub')) document.getElementById('scanGithub').value = eg;
            const el = localStorage.getItem('explore_leetcode'); if (el && document.getElementById('scanLeetcode')) document.getElementById('scanLeetcode').value = el;
            const ec = localStorage.getItem('explore_codeforces'); if (ec && document.getElementById('scanCodeforces')) document.getElementById('scanCodeforces').value = ec;
        } catch (_) {}

        // Load saved developerUser for My Dashboard, if present
        try {
            const userStr = localStorage.getItem('developerUser');
            if (userStr) {
                const user = JSON.parse(userStr);
                const meta = document.getElementById('myDashboardMeta'); if (meta && user?.name) meta.textContent = `LOADED: ${String(user.name).toUpperCase()}`;
                // call scanDeveloper with user handles (do not crash if missing)
                scanDeveloper(user?.github || '', user?.leetcode || '', user?.codeforces || '', false);
            } else {
                // show placeholder in myDashboardResult
                const myRes = document.getElementById('myDashboardResult'); if (myRes) myRes.innerHTML = `<div class="placeholder">// enter a developer profile in Explore Developers to populate your dashboard</div>`;
            }
        } catch (err) {
            console.error('initDashboard load user error', err);
        }

    } catch (err) {
        console.error('initDashboard failed', err);
    }
}

// Expose key functions to global scope (defensive)
window.getProfile = getProfile;
window.getContests = getContests;
window.reviewCode = reviewCode;
window.fetchLeetCodeStats = fetchLeetCodeStats;
window.scanDeveloper = scanDeveloper;
window.triggerManualSearch = triggerManualSearch;

document.addEventListener('DOMContentLoaded', () => { initDashboard(); });