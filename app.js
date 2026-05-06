// ═══════════════════════════════════════════════
// Agile RM Q2 — State-Driven Application Logic
// ═══════════════════════════════════════════════

import {
  collection,
  addDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const App = {
  // ── Central Store ──
  store: { initiatives:[], tasks:[], sprints:[], members:[], streams:[] },
  view: 'roadmap',
  selectedSprint: null,
  filters: { member:'all', stream:'all', status:'all', sprint:'all' },
  sidePanel: null,
  _filtersReady: false,

  // ── Init ──
  _dataVersion: 6, // v6: sync resets empty initiatives

  init() {
    const loaded = this.loadStore();
    const stored = parseInt(localStorage.getItem(this._storageKey + '_v') || '0');

    if (!loaded || stored < this._dataVersion) {
      // Fresh load from DATA (first visit or data version changed)
      console.log('[Store] Loading fresh data (v' + this._dataVersion + ', was v' + stored + ')');
      this.store.members = JSON.parse(JSON.stringify(DATA.members));
      this.store.streams = JSON.parse(JSON.stringify(DATA.streams));
      this.store.sprints = JSON.parse(JSON.stringify(DATA.sprints));
      this.store.initiatives = JSON.parse(JSON.stringify(DATA.initiatives));
      this.store.tasks = JSON.parse(JSON.stringify(DATA.tasks));
      localStorage.setItem(this._storageKey + '_v', String(this._dataVersion));
      this.saveStore();
    }
    this.selectedSprint = this.curSprint;
    this.initTheme();
    this.populateFormSelects();
    this.updateUI();
    document.addEventListener('keydown', e => { if(e.key==='Escape') { this.closePanel(); this.closeModal(); }});
  },

  // ── Theme ──
  initTheme() {
    const saved = localStorage.getItem('agile_theme') || 'dark';
    this._applyTheme(saved);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    this._applyTheme(next);
    localStorage.setItem('agile_theme', next);
    this.toast(next === 'light' ? 'Светлая тема ☀️' : 'Тёмная тема 🌙');
  },

  _applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
  },

  // ── Persistence ──
  _storageKey: 'agile_rm_q2_store',

  saveStore() {
    try {
      const data = {
        members: this.store.members,
        streams: this.store.streams,
        sprints: this.store.sprints,
        initiatives: this.store.initiatives,
        tasks: this.store.tasks,
        _savedAt: new Date().toISOString()
      };
      localStorage.setItem(this._storageKey, JSON.stringify(data));
      console.log('[Store] Saved:', data.tasks.length, 'tasks,', data.initiatives.length, 'initiatives');
    } catch (e) { console.warn('[Store] Save failed:', e); }
  },

  loadStore() {
    try {
      const raw = localStorage.getItem(this._storageKey);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data.tasks || !data.initiatives) return false;
      this.store.members = data.members || [];
      this.store.streams = data.streams || [];
      this.store.sprints = data.sprints || [];
      this.store.initiatives = data.initiatives || [];
      this.store.tasks = data.tasks || [];
      console.log('[Store] Loaded from localStorage:', data.tasks.length, 'tasks, saved at', data._savedAt);
      return true;
    } catch (e) { console.warn('[Store] Load failed:', e); return false; }
  },

  resetStore() {
    localStorage.removeItem(this._storageKey);
    this.store.members = JSON.parse(JSON.stringify(DATA.members));
    this.store.streams = JSON.parse(JSON.stringify(DATA.streams));
    this.store.sprints = JSON.parse(JSON.stringify(DATA.sprints));
    this.store.initiatives = JSON.parse(JSON.stringify(DATA.initiatives));
    this.store.tasks = JSON.parse(JSON.stringify(DATA.tasks));
    this.saveStore();
    this.updateUI();
    this.toast('Данные сброшены к исходным ✓');
    console.log('[Store] Reset to defaults');
  },

  get curSprint() {
    const w = this.weekNum();
    return this.store.sprints.find(s => s.weeks.includes(w)) || this.store.sprints[2];
  },

  weekNum() {
    const d = new Date(), s = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d - s) / 86400000 + s.getDay() + 1) / 7);
  },

  member(id) { return this.store.members.find(m => m.id === id); },
  stream(id) { return this.store.streams.find(s => s.id === id); },
  esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; },
  genId() { return 't' + Date.now() + '_' + Math.random().toString(36).substr(2, 4); },

  // ── Date Formatting ──
  _months: ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'],
  formatSprintDates(start, end) {
    const s = new Date(start + 'T00:00:00'), e = new Date(end + 'T00:00:00');
    const sd = s.getDate(), sm = this._months[s.getMonth()];
    const ed = e.getDate(), em = this._months[e.getMonth()];
    if (sm === em) return `${sd}–${ed} ${sm}`;
    return `${sd} ${sm} – ${ed} ${em}`;
  },

  // ── Progress Calculation ──
  initProgress(ini) {
    const ts = this.store.tasks.filter(t => t.initiative_id === ini.id);
    if (!ts.length) return ini.progress || 0;
    return Math.round(ts.reduce((a, t) => a + t.progress, 0) / ts.length);
  },

  initStatus(ini) {
    const ts = this.store.tasks.filter(t => t.initiative_id === ini.id);
    if (!ts.length) return ini.status;
    if (ts.every(t => t.status === 'done')) return 'done';
    if (ts.some(t => t.status === 'blocked')) return 'blocked';
    if (ts.some(t => t.status === 'in_progress')) return 'in_progress';
    return 'planned';
  },

  // Dynamic timeline from tasks (single source of truth)
  initSpan(ini) {
    const ts = this.store.tasks.filter(t => t.initiative_id === ini.id);
    if (!ts.length) return { s1: ini.s1, s2: ini.s2 };
    const allSprints = ts.flatMap(t => t.sprint_ids);
    return { s1: Math.min(...allSprints), s2: Math.max(...allSprints) };
  },

  // ── Stats from tasks only (single source of truth) ──
  calculateStats() {
    const allT = this.store.tasks;
    const total = allT.length;
    const done = allT.filter(t => t.status === 'done').length;
    const blocked = allT.filter(t => t.status === 'blocked').length;
    const cur = this.curSprint;
    const sprintTasks = allT.filter(t => t.sprint_ids.includes(cur.id));
    const sprintDone = sprintTasks.filter(t => t.status === 'done').length;
    return {
      q2Progress: total ? Math.round(done / total * 100) : 0,
      sprintProgress: sprintTasks.length ? Math.round(sprintDone / sprintTasks.length * 100) : 0,
      total,
      done,
      blocked,
      sprintTasks: sprintTasks.length,
      sprintDone,
      curSprint: cur
    };
  },

  statusLabel(s) {
    return { planned: 'Запланировано', in_progress: 'В работе', done: 'Готово', blocked: 'Заблокировано' }[s] || s;
  },

  statusColor(s) {
    return { planned: '#64748b', in_progress: '#3b82f6', done: '#10b981', blocked: '#ef4444' }[s] || '#64748b';
  },

  // ── Filtering ──
  filteredInits() {
    return this.store.initiatives.filter(i => {
      if (this.filters.stream !== 'all' && i.stream !== this.filters.stream) return false;
      if (this.filters.status !== 'all' && i.status !== this.filters.status) return false;
      if (this.filters.member !== 'all') {
        const ts = this.store.tasks.filter(t => t.initiative_id === i.id);
        if (!ts.some(t => t.assignees.includes(this.filters.member))) return false;
      }
      return true;
    });
  },

  filteredTasks(sprintId) {
    return this.store.tasks.filter(t => {
      if (!t.sprint_ids.includes(sprintId)) return false;
      if (this.filters.status !== 'all' && t.status !== this.filters.status) return false;
      if (this.filters.member !== 'all' && !t.assignees.includes(this.filters.member)) return false;
      if (this.filters.sprint !== 'all' && !t.sprint_ids.includes(parseInt(this.filters.sprint))) return false;
      if (this.filters.stream !== 'all') {
        const taskStream = t.stream || (this.store.initiatives.find(i => i.id === t.initiative_id)?.stream);
        if (taskStream !== this.filters.stream) return false;
      }
      return true;
    });
  },

  // ═══════════════════════
  //  MASTER RENDER
  // ═══════════════════════

  // Sync initiative computed fields from tasks (single source of truth)
  syncInitiatives() {
    this.store.initiatives.forEach(ini => {
      const ts = this.store.tasks.filter(t => t.initiative_id === ini.id);
      if (ts.length) {
        ini.progress = Math.round(ts.reduce((a, t) => a + t.progress, 0) / ts.length);
        if (ts.every(t => t.status === 'done')) ini.status = 'done';
        else if (ts.some(t => t.status === 'blocked')) ini.status = 'blocked';
        else if (ts.some(t => t.status === 'in_progress')) ini.status = 'in_progress';
        else ini.status = 'planned';
        const allSp = ts.flatMap(t => t.sprint_ids);
        ini.s1 = Math.min(...allSp);
        ini.s2 = Math.max(...allSp);
      } else {
        // No tasks → reset to zero
        ini.progress = 0;
        ini.status = 'planned';
      }
    });
  },

  updateUI() {
    this.syncInitiatives();
    this.renderStats();
    if (this.view === 'roadmap') this.renderRoadmap();
    else this.renderSprint();
    if (this.sidePanel) this.renderSidePanel();
  },

  renderStats() {
    const s = this.calculateStats();
    document.getElementById('kpi-q2-pct').textContent = s.q2Progress + '%';
    document.getElementById('kpi-q2-bar').style.width = s.q2Progress + '%';
    document.getElementById('kpi-q2-detail').textContent = `${s.done}/${s.total} задач выполнено`;
    document.getElementById('kpi-sprint-name').textContent = s.curSprint.name;
    document.getElementById('kpi-sprint-pct').textContent = s.sprintProgress + '%';
    document.getElementById('kpi-sprint-bar').style.width = s.sprintProgress + '%';
    document.getElementById('kpi-sprint-detail').textContent = `${s.sprintDone}/${s.sprintTasks} задач`;
    document.getElementById('kpi-blocked').textContent = s.blocked;
    document.getElementById('kpi-initiatives').textContent = s.total;
  },

  // ═══════════════════════
  //  ROADMAP VIEW
  // ═══════════════════════
  renderRoadmap() {
    const board = document.getElementById('board');
    const cur = this.curSprint;
    const inits = this.filteredInits();
    const spLen = this.store.sprints.length;

    if (!this.store.tasks.length) {
      board.innerHTML = '<div class="empty-state"><h2>🚀 Добро пожаловать</h2><p>Добавьте первую задачу через кнопку «+ Задача»</p></div>';
      return;
    }

    let h = '<div class="roadmap">';
    // Timeline header
    h += '<div class="rm-timeline">';
    h += '<div class="rm-stream-hdr">Направления</div>';
    this.store.sprints.forEach(sp => {
      const cls = sp.id === cur.id ? ' rm-current' : sp.id < cur.id ? ' rm-past' : '';
      const dates = this.formatSprintDates(sp.start, sp.end);
      h += `<div class="rm-sprint-col${cls}"><div class="rm-sp-label">${sp.name}</div><div class="rm-sp-dates">${dates}</div><div class="rm-sp-wk">Wk${sp.weeks[0]}–${sp.weeks[1]}</div>${sp.id === cur.id ? '<div class="rm-sp-current-tag">Текущий</div>' : ''}</div>`;
    });
    h += '</div>';

    // Stream rows — render TASKS grouped by stream
    this.store.streams.forEach(stream => {
      // Get tasks: check task.stream directly, fallback to initiative.stream
      const streamTasks = this.store.tasks.filter(t => {
        if (t.stream === stream.id) return true;
        if (!t.stream) {
          const ini = this.store.initiatives.find(i => i.id === t.initiative_id);
          return ini && ini.stream === stream.id;
        }
        return false;
      }).filter(t => {
        // Apply filters
        if (this.filters.status !== 'all' && t.status !== this.filters.status) return false;
        if (this.filters.member !== 'all' && !t.assignees.includes(this.filters.member)) return false;
        if (this.filters.sprint !== 'all' && !t.sprint_ids.includes(parseInt(this.filters.sprint))) return false;
        return true;
      });
      if (!streamTasks.length) return; // skip empty streams

      h += `<div class="rm-stream">`;
      h += `<div class="rm-stream-label"><span class="rm-stream-icon">${stream.icon}</span><span class="rm-stream-name">${stream.name}</span><div class="rm-stream-stats">${streamTasks.length} задач</div></div>`;
      h += '<div class="rm-stream-body">';
      // Grid background
      h += '<div class="rm-grid-bg">';
      this.store.sprints.forEach(sp => {
        const cls = sp.id === cur.id ? ' rm-current' : sp.id < cur.id ? ' rm-past' : '';
        h += `<div class="rm-grid-cell${cls}"></div>`;
      });
      h += '</div>';
      // Task bars
      streamTasks.forEach(task => {
        const s1 = Math.min(...task.sprint_ids);
        const s2 = Math.max(...task.sprint_ids);
        const left = ((s1 - 1) / spLen) * 100;
        const width = ((s2 - s1 + 1) / spLen) * 100;
        const isMulti = s2 - s1 > 0;
        const assignees = task.assignees.map(a => this.member(a)).filter(Boolean);
        const ini = this.store.initiatives.find(i => i.id === task.initiative_id);

        h += `<div class="rm-bar bar-${task.status}${isMulti ? ' bar-multi' : ''}" style="left:${left}%;width:${width}%" onclick="App.openPanel('task','${task.id}')">
          <div class="rm-bar-fill" style="width:${task.progress}%"></div>
          <div class="rm-bar-content">
            <span class="rm-bar-name">${this.esc(task.name)}</span>
            <span class="rm-bar-meta">
              ${isMulti ? '<span class="rm-bar-multi-badge">multi</span>' : ''}
              <span class="rm-bar-status-dot" style="background:${this.statusColor(task.status)}"></span>
              ${assignees.map(m => `<span class="rm-bar-avatar" title="${m.name}">${m.avatar || m.name[0]}</span>`).join('')}
              <span class="rm-bar-pct">${task.progress}%</span>
            </span>
          </div>
          <div class="rm-bar-tooltip">
            <strong>${this.esc(task.name)}</strong>
            ${ini ? `<div class="tt-row"><span class="tt-label">Инициатива</span><span>${this.esc(ini.name)}</span></div>` : ''}
            <div class="tt-row"><span class="tt-label">Исполнители</span><span>${assignees.map(m => m.name + ' <small>(' + m.role + ')</small>').join(', ') || '—'}</span></div>
            <div class="tt-row"><span class="tt-label">Прогресс</span><span>${task.progress}%</span></div>
            <div class="tt-row"><span class="tt-label">Спринты</span><span>S${task.sprint_ids.join(', S')}${isMulti ? ' 🔗' : ''}</span></div>
            <div class="tt-row"><span class="tt-label">Статус</span><span>${this.statusLabel(task.status)}</span></div>
          </div>
        </div>`;
      });
      h += '</div></div>';
    });
    h += '</div>';
    board.innerHTML = h;
  },

  // ═══════════════════════
  //  SPRINT VIEW (Kanban)
  // ═══════════════════════
  renderSprint() {
    const board = document.getElementById('board');
    const sprint = this.selectedSprint || this.curSprint;
    const tasks = this.filteredTasks(sprint.id);
    const cols = ['planned', 'in_progress', 'done', 'blocked'];
    const labels = { planned: '📥 Запланировано', in_progress: '🔄 В работе', done: '✅ Готово', blocked: '⛔ Заблокировано' };

    let h = '<div class="sprint-view">';
    // Sprint tabs
    h += '<div class="sp-tabs">';
    this.store.sprints.forEach(sp => {
      const isCur = sp.id === sprint.id;
      const dates = this.formatSprintDates(sp.start, sp.end);
      h += `<button class="sp-tab${isCur ? ' active' : ''}" onclick="App.selectSprint(${sp.id})">${sp.name}<span class="sp-tab-dates">${dates}</span><span class="sp-tab-wk">Wk${sp.weeks[0]}–${sp.weeks[1]}</span></button>`;
    });
    h += '</div>';

    // Kanban columns
    h += '<div class="kanban">';
    cols.forEach(st => {
      const col = tasks.filter(t => t.status === st);
      h += `<div class="kb-col"><div class="kb-col-hdr"><span class="kb-dot" style="background:${this.statusColor(st)}"></span>${labels[st]}<span class="kb-count">${col.length}</span></div>`;
      h += `<div class="kb-body" data-status="${st}" ondragover="App.dragOver(event)" ondragleave="App.dragLeave(event)" ondrop="App.drop(event)">`;

      if (!col.length) {
        h += '<div class="kb-empty">Перетащите задачу сюда</div>';
      }

      col.forEach(task => {
        const ini = this.store.initiatives.find(i => i.id === task.initiative_id);
        const stream = ini ? this.stream(ini.stream) : null;
        const isMulti = task.sprint_ids.length > 1;

        h += `<div class="kb-card" draggable="true" data-id="${task.id}" ondragstart="App.dragStart(event)" ondragend="App.dragEnd(event)" onclick="App.openPanel('task','${task.id}')">`;
        if (stream) h += `<div class="kb-card-stream" style="background:${stream.color}18;color:${stream.color}">${stream.icon} ${stream.name}</div>`;
        h += `<div class="kb-card-title">${this.esc(task.name)}</div>`;
        if (ini) h += `<div class="kb-card-ini">${this.esc(ini.name)}</div>`;
        h += `<div class="kb-progress"><div class="kb-progress-bar"><div class="kb-progress-fill" style="width:${task.progress}%"></div></div><span class="kb-progress-text">${task.progress}%</span></div>`;
        h += '<div class="kb-card-foot"><div class="kb-avatars">';
        task.assignees.forEach(aid => {
          const m = this.member(aid);
          if (m) h += `<div class="kb-avatar" title="${m.name} — ${m.role}">${m.avatar}</div>`;
        });
        h += '</div>';
        if (isMulti) h += `<span class="kb-multi">🔗 S${task.sprint_ids[0]}→S${task.sprint_ids[task.sprint_ids.length - 1]}</span>`;
        h += '</div></div>';
      });
      h += '</div></div>';
    });
    h += '</div></div>';
    board.innerHTML = h;
  },

  // ═══════════════════════
  //  SIDE PANEL
  // ═══════════════════════
  openPanel(type, id) {
    this.sidePanel = { type, id };
    this.renderSidePanel();
  },

  closePanel() {
    this.sidePanel = null;
    document.getElementById('side-panel').classList.remove('open');
  },

  renderSidePanel() {
    const p = document.getElementById('side-panel');
    const { type, id } = this.sidePanel;
    let h = '<button class="sp-close" onclick="App.closePanel()">✕</button>';

    if (type === 'initiative') {
      const ini = this.store.initiatives.find(i => i.id === id);
      if (!ini) return;
      const stream = this.stream(ini.stream);
      const owner = this.member(ini.owner);
      const prog = this.initProgress(ini);
      const st = this.initStatus(ini);
      const span = this.initSpan(ini);
      const tasks = this.store.tasks.filter(t => t.initiative_id === id);

      h += `<div class="sp-stream-tag" style="background:${stream?.color}18;color:${stream?.color}">${stream?.icon} ${stream?.name}</div>`;
      h += `<h2 class="sp-title">${this.esc(ini.name)}</h2>`;
      h += `<div class="sp-status sp-st-${st}">${this.statusLabel(st)}</div>`;
      // ── Editable Stream ──
      h += '<div class="sp-edit-section"><label class="sp-edit-label">🚀 Направление</label>';
      h += `<select class="fi" onchange="App.updateStream('${ini.id}',this.value)">`;
      this.store.streams.forEach(s => {
        h += `<option value="${s.id}"${ini.stream===s.id?' selected':''}>${s.icon} ${s.name}</option>`;
      });
      h += '</select></div>';
      h += `<div class="sp-meta"><div class="sp-meta-row"><span class="sp-meta-label">Владелец</span><span>${owner?.name || '—'} <small style="color:var(--tx3)">${owner?.role || ''}</small></span></div>`;
      h += `<div class="sp-meta-row"><span class="sp-meta-label">Период</span><span>Sprint ${span.s1} → ${span.s2}</span></div>`;
      h += `<div class="sp-meta-row"><span class="sp-meta-label">Прогресс</span><span>${prog}%</span></div></div>`;
      h += `<div class="sp-progress-bar"><div class="sp-progress-fill" style="width:${prog}%"></div></div>`;
      h += `<h3 class="sp-section">Задачи (${tasks.length})</h3>`;
      tasks.forEach((t, idx) => {
        h += `<div class="sp-task sp-task-${t.status}" onclick="App.openPanel('task','${t.id}')">
          <div class="sp-task-name">${this.esc(t.name)}</div>
          <div class="sp-task-meta">${t.assignees.map(a=>{const m=this.member(a);return m?m.name:''}).filter(Boolean).join(', ')} · ${t.progress}% · S${t.sprint_ids.join(',')}</div>
          <div class="sp-task-bar"><div style="width:${t.progress}%"></div></div>
        </div>`;
      });
    } else if (type === 'task') {
      const task = this.store.tasks.find(t => t.id === id);
      if (!task) return;
      const taskStream = task.stream || (this.store.initiatives.find(i => i.id === task.initiative_id)?.stream);
      const stream = taskStream ? this.stream(taskStream) : null;

      if (stream) h += `<div class="sp-stream-tag" style="background:${stream.color}18;color:${stream.color}">${stream.icon} ${stream.name}</div>`;
      h += `<h2 class="sp-title">${this.esc(task.name)}</h2>`;
      h += `<div class="sp-status sp-st-${task.status}">${this.statusLabel(task.status)}</div>`;

      // ── Editable Stream (swimlane) ──
      h += '<div class="sp-edit-section"><label class="sp-edit-label">🚀 Направление</label>';
      h += `<select class="fi" onchange="App.updateTaskStream('${task.id}',this.value)">`;
      this.store.streams.forEach(s => {
        h += `<option value="${s.id}"${taskStream===s.id?' selected':''}>${s.icon} ${s.name}</option>`;
      });
      h += '</select></div>';

      // ── Editable Assignees ──
      h += '<div class="sp-edit-section"><label class="sp-edit-label">👤 Исполнители</label>';
      h += `<select class="sp-multi-select" id="sp-assignees" multiple size="4" onchange="App.updateAssignees('${task.id}')">`;
      this.store.members.forEach(m => {
        const sel = task.assignees.includes(m.id) ? ' selected' : '';
        h += `<option value="${m.id}"${sel}>${m.name} — ${m.role}</option>`;
      });
      h += '</select>';
      h += '<div class="sp-edit-hint">Ctrl/Cmd+клик для множественного выбора</div></div>';

      // ── Editable Sprints ──
      h += '<div class="sp-edit-section"><label class="sp-edit-label">📅 Спринты</label>';
      h += `<select class="sp-multi-select" id="sp-sprints" multiple size="4" onchange="App.updateSprints('${task.id}')">`;
      this.store.sprints.forEach(sp => {
        const sel = task.sprint_ids.includes(sp.id) ? ' selected' : '';
        h += `<option value="${sp.id}"${sel}>${sp.name} (Wk${sp.weeks[0]}–${sp.weeks[1]})</option>`;
      });
      h += '</select>';
      if (task.sprint_ids.length > 1) h += `<div class="sp-edit-hint">🔗 Multi-sprint: S${task.sprint_ids[0]}→S${task.sprint_ids[task.sprint_ids.length-1]}</div>`;
      h += '</div>';

      // ── Progress ──
      h += `<div class="sp-meta"><div class="sp-meta-row"><span class="sp-meta-label">Прогресс</span><span id="prog-val">${task.progress}%</span></div></div>`;
      h += `<div class="sp-progress-bar"><div class="sp-progress-fill" style="width:${task.progress}%"></div></div>`;
      h += `<div class="sp-edit-progress"><label>Прогресс:</label><input type="range" min="0" max="100" step="5" value="${task.progress}" oninput="App.updateProgress('${task.id}',this.value)"><span id="prog-display">${task.progress}%</span></div>`;

      // ── Status buttons ──
      h += '<div class="sp-status-btns"><label>Статус:</label><div class="sp-btn-group">';
      ['planned', 'in_progress', 'done', 'blocked'].forEach(s => {
        h += `<button class="sp-st-btn${task.status === s ? ' active' : ''}" onclick="App.updateStatus('${task.id}','${s}')">${this.statusLabel(s)}</button>`;
      });
      h += '</div></div>';

      // ── Dependencies ──
      if (task.deps?.length) {
        h += '<h3 class="sp-section">Зависимости</h3>';
        task.deps.forEach(depId => {
          const dep = this.store.tasks.find(t => t.id === depId);
          if (dep) h += `<div class="sp-dep" onclick="App.openPanel('task','${dep.id}')">↗ ${this.esc(dep.name)} <span class="sp-dep-st sp-st-${dep.status}">${dep.progress}%</span></div>`;
        });
      }
      // Delete button
      h += `<button class="btn btn-danger" style="margin-top:16px;width:100%" onclick="App.deleteTask('${task.id}')">🗑 Удалить задачу</button>`;
    }
    p.innerHTML = h;
    p.classList.add('open');
  },

  // ── Stream & Initiative Change ──
  updateStream(iniId, newStreamId) {
    const ini = this.store.initiatives.find(i => i.id === iniId);
    if (!ini) return;
    const oldStream = ini.stream;
    ini.stream = newStreamId;
    console.log('[Store] updateStream:', iniId, oldStream, '->', newStreamId);
    this.saveStore();
    this.updateUI();
    const s = this.stream(newStreamId);
    this.toast(`Перемещено в ${s?.name || newStreamId} ✓`);
  },

  updateTaskStream(taskId, newStreamId) {
    const task = this.store.tasks.find(t => t.id === taskId);
    if (!task) return;
    task.stream = newStreamId;
    console.log('[Store] updateTaskStream:', taskId, '->', newStreamId);
    this.saveStore();
    this.updateUI();
    const s = this.stream(newStreamId);
    this.toast(`Задача перемещена в ${s?.name || newStreamId} ✓`);
  },

  updateTaskInitiative(taskId, newIniId) {
    const task = this.store.tasks.find(t => t.id === taskId);
    if (!task) return;
    task.initiative_id = newIniId;
    console.log('[Store] updateTaskInitiative:', taskId, '->', newIniId);
    this.saveStore();
    this.updateUI();
    if (newIniId) {
      const ini = this.store.initiatives.find(i => i.id === newIniId);
      this.toast(`Задача привязана к «${ini?.name}» ✓`);
    } else {
      this.toast('Задача откреплена от инициативы');
    }
  },

  // ── Inline Edit Handlers ──
  updateAssignees(taskId) {
    const task = this.store.tasks.find(t => t.id === taskId);
    if (!task) return;
    const sel = document.getElementById('sp-assignees');
    const selected = Array.from(sel.selectedOptions).map(o => o.value);
    if (!selected.length) { this.toast('Выберите хотя бы одного исполнителя'); return; }
    console.log('[Store] updateAssignees:', taskId, 'before:', task.assignees, 'after:', selected);
    task.assignees = [...selected];
    this.saveStore();
    this.updateUI();
    this.toast(`Исполнители обновлены (${selected.length})`);
  },

  updateSprints(taskId) {
    const task = this.store.tasks.find(t => t.id === taskId);
    if (!task) return;
    const sel = document.getElementById('sp-sprints');
    const selected = Array.from(sel.selectedOptions).map(o => parseInt(o.value));
    if (!selected.length) { this.toast('Выберите хотя бы один спринт'); return; }
    console.log('[Store] updateSprints:', taskId, 'before:', task.sprint_ids, 'after:', selected);
    task.sprint_ids = [...selected].sort((a, b) => a - b);
    this.saveStore();
    this.updateUI();
    this.toast(`Спринты обновлены: S${task.sprint_ids.join(',')}${task.sprint_ids.length > 1 ? ' 🔗 multi' : ''}`);
  },

  updateProgress(taskId, val) {
    const t = this.store.tasks.find(x => x.id === taskId);
    if (t) { t.progress = parseInt(val); }
    const el = document.getElementById('prog-display');
    if (el) el.textContent = val + '%';
    const el2 = document.getElementById('prog-val');
    if (el2) el2.textContent = val + '%';
    this.saveStore();
    this.updateUI();
  },

  updateStatus(taskId, status) {
    const t = this.store.tasks.find(x => x.id === taskId);
    if (t) { t.status = status; if (status === 'done') t.progress = 100; }
    this.saveStore();
    this.updateUI();
  },

  deleteTask(taskId) {
    const t = this.store.tasks.find(x => x.id === taskId);
    if (!t) { console.warn('deleteTask: task not found', taskId); return; }
    if (!confirm(`Удалить «${t.name}»?`)) return;
    console.log('Deleting task:', taskId, t.name);
    // 1. Remove from store
    this.store.tasks = this.store.tasks.filter(x => x.id !== taskId);
    // 2. Persist
    this.saveStore();
    // 3. Clear side panel state FIRST
    this.sidePanel = null;
    document.getElementById('side-panel').classList.remove('open');
    // 4. Full UI refresh
    this.updateUI();
    this.toast(`Задача «${t.name}» удалена ✓`);
  },

  // ═══════════════════════
  //  DRAG & DROP
  // ═══════════════════════
  _dragId: null,
  dragStart(e) {
    this._dragId = e.target.closest('[data-id]').dataset.id;
    e.target.closest('[data-id]').classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  },
  dragEnd(e) {
    const card = e.target.closest('[data-id]');
    if (card) card.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  },
  dragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); },
  dragLeave(e) { e.currentTarget.classList.remove('drag-over'); },
  drop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const task = this.store.tasks.find(t => t.id === this._dragId);
    if (!task) return;
    const newSt = e.currentTarget.dataset.status;
    task.status = newSt;
    if (newSt === 'done') task.progress = 100;
    this.saveStore();
    this.updateUI();
    this.toast(`«${task.name}» → ${this.statusLabel(newSt)}`);
  },

  // ═══════════════════════
  //  ADD TASK MODAL
  // ═══════════════════════
  openAddModal() {
    document.getElementById('task-form').reset();
    document.getElementById('f-progress').value = 0;
    document.getElementById('modal-overlay').classList.add('active');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
  },

  async saveTask(e) {
    e.preventDefault();
    const name = document.getElementById('f-name').value.trim();
    if (!name) return;
    const s1 = parseInt(document.getElementById('f-s1').value);
    const s2 = parseInt(document.getElementById('f-s2').value);
    const end = Math.max(s1, s2);
    const sprintIds = [];
    for (let i = s1; i <= end; i++) sprintIds.push(i);
    const assigneeSelect = document.getElementById('f-assignee');
    const assignees = Array.from(assigneeSelect.selectedOptions).map(o => o.value);
    if (!assignees.length) assignees.push(this.store.members[0].id);

    const task = {
      id: this.genId(),
      initiative_id: '',
      stream: document.getElementById('f-initiative').value,
      name,
      assignees,
      sprint_ids: sprintIds,
      status: document.getElementById('f-task-status').value,
      progress: parseInt(document.getElementById('f-progress').value) || 0,
      deps: []
    };
    await addDoc(collection(window.db, "tasks"), task);
    this.saveStore();
    this.closeModal();
    this.updateUI();
    this.toast(`Задача «${name}» добавлена ✓`);
  },

  // ═══════════════════════
  //  FORM SELECTS
  // ═══════════════════════
  populateFormSelects() {
    // Filters
    const fm = document.getElementById('f-member');
    this.store.members.forEach(m => fm.innerHTML += `<option value="${m.id}">${m.name} — ${m.role}</option>`);
    const fs = document.getElementById('f-stream');
    this.store.streams.forEach(s => fs.innerHTML += `<option value="${s.id}">${s.icon} ${s.name}</option>`);
    const fsp = document.getElementById('f-sprint');
    this.store.sprints.forEach(sp => fsp.innerHTML += `<option value="${sp.id}">${sp.name} (Wk${sp.weeks[0]}–${sp.weeks[1]})</option>`);

    // Modal form — Stream (direction) selector
    const fi = document.getElementById('f-initiative');
    fi.innerHTML = '';
    this.store.streams.forEach(s => {
      fi.innerHTML += `<option value="${s.id}">${s.icon} ${s.name}</option>`;
    });

    const populateSprints = (id) => {
      const el = document.getElementById(id);
      el.innerHTML = '';
      this.store.sprints.forEach(sp => {
        el.innerHTML += `<option value="${sp.id}">${sp.name} (Wk${sp.weeks[0]}–${sp.weeks[1]})</option>`;
      });
    };
    populateSprints('f-s1');
    populateSprints('f-s2');

    const fa = document.getElementById('f-assignee');
    fa.innerHTML = '';
    this.store.members.forEach(m => fa.innerHTML += `<option value="${m.id}">${m.name} — ${m.role}</option>`);
  },

  // ═══════════════════════
  //  VIEW SWITCHING
  // ═══════════════════════
  switchView(v) {
    this.view = v;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    this.updateUI();
  },

  selectSprint(id) {
    this.selectedSprint = this.store.sprints.find(s => s.id === id);
    this.updateUI();
  },

  // ═══════════════════════
  //  FILTERS
  // ═══════════════════════
  setFilter(key, val) { this.filters[key] = val; this.updateUI(); },
  resetFilters() {
    this.filters = { member: 'all', stream: 'all', status: 'all', sprint: 'all' };
    document.getElementById('f-member').value = 'all';
    document.getElementById('f-stream').value = 'all';
    document.getElementById('f-sprint').value = 'all';
    document.getElementById('f-status').value = 'all';
    this.updateUI();
  },

  // ═══════════════════════
  //  DEBUG
  // ═══════════════════════
  toggleDebug() {
    const p = document.getElementById('debug-panel');
    const vis = p.style.display === 'none';
    p.style.display = vis ? 'block' : 'none';
    if (vis) {
      document.getElementById('debug-stats').innerHTML = `Tasks: ${this.store.tasks.length} · Initiatives: ${this.store.initiatives.length} · Members: ${this.store.members.length}`;
      document.getElementById('debug-json').textContent = JSON.stringify({ tasks: this.store.tasks.length, initiatives: this.store.initiatives.length, filters: this.filters, view: this.view }, null, 2);
    }
  },

  // ═══════════════════════
  //  DEMO DATA
  // ═══════════════════════
  loadDemo() {
    this.store.initiatives = JSON.parse(JSON.stringify(DATA.initiatives));
    this.store.tasks = JSON.parse(JSON.stringify(DATA.tasks));
    this.saveStore();
    this.updateUI();
    this.toast('Демо-данные загружены ✓');
  },

  // ═══════════════════════
  //  TOAST
  // ═══════════════════════
  toast(msg) {
    const c = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = '✦ ' + msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());

function listenTasks() {
  onSnapshot(collection(window.db, "tasks"), (snapshot) => {

    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log("Realtime tasks:", tasks);

    App.store.tasks = tasks;

    App.render();
  });
}

listenTasks();
