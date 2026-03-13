(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────
  let config = null;
  let editMode = false;
  let draggingCol = null;

  // ── Config ────────────────────────────────────────────────────────
  function fetchConfig() {
    return fetch('config.json').then(r => {
      if (!r.ok) throw new Error('config.json not found');
      return r.json();
    });
  }

  // ── Layout ────────────────────────────────────────────────────────
  // Layout = { sections: { sectionId: [cardId, ...] }, hidden: [cardId, ...] }
  // This is the shareable file teammates import to get the same view.

  function defaultLayout() {
    const sections = {};
    config.sections.forEach(sec => {
      sections[sec.id] = sec.cards.map(c => c.id);
    });
    return { sections, hidden: [] };
  }

  function loadLayout() {
    try {
      const raw = localStorage.getItem('layout');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function saveLayout() {
    const sections = {};
    document.querySelectorAll('.dashboard-section').forEach(sec => {
      sections[sec.dataset.section] = Array.from(
        sec.querySelectorAll('[data-card-id]')
      ).map(c => c.dataset.cardId);
    });
    const hidden = Array.from(document.querySelectorAll('[data-card-id]'))
      .filter(c => c.dataset.hidden === 'true')
      .map(c => c.dataset.cardId);
    const layout = { sections, hidden };
    localStorage.setItem('layout', JSON.stringify(layout));
    return layout;
  }

  // ── Card map ──────────────────────────────────────────────────────
  function buildCardMap() {
    const map = new Map();
    config.sections.forEach(sec => sec.cards.forEach(c => map.set(c.id, c)));
    return map;
  }

  // ── Rendering ─────────────────────────────────────────────────────
  function renderCardCol(card, hidden) {
    const col = document.createElement('div');
    col.className = 'col card-col';
    col.dataset.cardId = card.id;
    if (hidden) {
      col.dataset.hidden = 'true';
      col.style.display = 'none';
    }
    const imgHtml = card.img
      ? `<img src="${card.img}" class="card-img-top" alt="${card.title} logo" />`
      : '';
    col.innerHTML = `
      <div class="card h-100">
        ${imgHtml}
        <div class="card-body d-flex flex-column">
          <h5 class="card-title">${card.title}</h5>
          <p class="card-text text-muted">${card.desc || ''}</p>
        </div>
      </div>`;
    return col;
  }

  function renderSection(secConfig, cardIds, cardMap, hiddenSet) {
    const collapseId = 'section-' + secConfig.id;
    const sec = document.createElement('section');
    sec.className = 'dashboard-section mb-5';
    sec.dataset.section = secConfig.id;
    sec.innerHTML = `
      <div class="section-header d-flex align-items-center gap-2 mb-3">
        <h2 class="mb-0">${secConfig.title}</h2>
        <button
          class="btn btn-sm btn-outline-secondary ms-2 collapse-btn"
          data-bs-toggle="collapse"
          data-bs-target="#${collapseId}"
          aria-expanded="true"
          aria-controls="${collapseId}"
        >Collapse</button>
      </div>
      <div class="collapse show" id="${collapseId}">
        <div class="row g-4 card-grid"></div>
      </div>`;
    const grid = sec.querySelector('.card-grid');
    cardIds.forEach(id => {
      const card = cardMap.get(id);
      if (card) grid.appendChild(renderCardCol(card, hiddenSet.has(id)));
    });
    return sec;
  }

  function renderAll(layout) {
    const main = document.getElementById('main-content');
    main.innerHTML = '';
    const cardMap = buildCardMap();
    const hiddenSet = new Set(layout.hidden || []);
    const placed = new Set();

    config.sections.forEach(sec => {
      // use saved layout order, falling back to config order for new cards
      const savedIds = (layout.sections[sec.id] || []).filter(id => cardMap.has(id));
      savedIds.forEach(id => placed.add(id));
      main.appendChild(renderSection(sec, savedIds, cardMap, hiddenSet));
    });

    // cards in config but not referenced in any saved layout section → original section
    config.sections.forEach(sec => {
      const unplaced = sec.cards.filter(c => !placed.has(c.id));
      if (!unplaced.length) return;
      const grid = main.querySelector(`[data-section="${sec.id}"] .card-grid`);
      if (!grid) return;
      unplaced.forEach(card => {
        grid.appendChild(renderCardCol(card, hiddenSet.has(card.id)));
      });
    });
  }

  // ── Dark mode ─────────────────────────────────────────────────────
  function applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('darkMode', dark ? 'true' : 'false');
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = dark ? 'Light Mode' : 'Dark Mode';
  }

  function initTheme() {
    const stored = localStorage.getItem('darkMode');
    if (stored !== null) {
      applyTheme(stored === 'true');
    } else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      applyTheme(true);
    } else {
      applyTheme(false);
    }
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (localStorage.getItem('darkMode') === null) applyTheme(e.matches);
    });
  }

  // ── Department filtering ──────────────────────────────────────────
  function initDeptSelect() {
    const select = document.getElementById('dept-select');
    if (!select) return;
    select.innerHTML = '<option value="">All Departments</option>';
    Object.keys(config.departments || {}).forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
    const saved = localStorage.getItem('userDept') || '';
    select.value = saved;
    applyDepartment(saved);
    select.addEventListener('change', e => applyDepartment(e.target.value));
  }

  function applyDepartment(dept) {
    const depts = config.departments || {};
    document.querySelectorAll('.dashboard-section').forEach(sec => {
      const visible = !dept || (depts[dept] || []).includes(sec.dataset.section);
      sec.style.display = visible ? '' : 'none';
    });
    if (dept) localStorage.setItem('userDept', dept);
    else localStorage.removeItem('userDept');
  }

  // ── Edit mode ─────────────────────────────────────────────────────
  function toggleEditMode() {
    editMode = !editMode;
    const btn = document.getElementById('edit-toggle');
    if (btn) btn.textContent = editMode ? 'Done' : 'Edit';
    document.querySelectorAll('[data-card-id]').forEach(col => {
      const card = col.querySelector('.card');
      const hideBtn = col.querySelector('.edit-hide-btn');
      if (editMode) {
        col.style.display = '';
        card.classList.add('edit-mode');
        if (hideBtn) hideBtn.style.display = '';
      } else {
        if (col.dataset.hidden === 'true') col.style.display = 'none';
        card.classList.remove('edit-mode');
        if (hideBtn) hideBtn.style.display = 'none';
      }
    });
    updateRestoreBar();
  }

  // ── Hide buttons ──────────────────────────────────────────────────
  function initHideButtons() {
    document.querySelectorAll('[data-card-id]').forEach(col => {
      const card = col.querySelector('.card');
      if (col.dataset.hidden === 'true') card.classList.add('hidden-card');
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-outline-secondary edit-hide-btn';
      btn.style.display = 'none';
      btn.textContent = col.dataset.hidden === 'true' ? 'Unhide' : 'Hide';
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const isHidden = col.dataset.hidden === 'true';
        col.dataset.hidden = isHidden ? 'false' : 'true';
        card.classList.toggle('hidden-card', !isHidden);
        btn.textContent = isHidden ? 'Hide' : 'Unhide';
        saveLayout();
        updateRestoreBar();
      });
      card.style.position = 'relative';
      card.appendChild(btn);
    });
  }

  // ── Restore bar ───────────────────────────────────────────────────
  function updateRestoreBar() {
    const hasHidden = Array.from(document.querySelectorAll('[data-card-id]'))
      .some(col => col.dataset.hidden === 'true');
    const bar = document.getElementById('restore-bar');
    if (bar) bar.classList.toggle('d-none', !hasHidden || editMode);
  }

  // ── Collapse button text ──────────────────────────────────────────
  function initCollapseButtons() {
    document.querySelectorAll('.collapse-btn').forEach(btn => {
      const target = document.querySelector(btn.dataset.bsTarget);
      if (!target) return;
      target.addEventListener('show.bs.collapse', () => { btn.textContent = 'Collapse'; });
      target.addEventListener('hide.bs.collapse', () => { btn.textContent = 'Expand'; });
    });
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────
  function initDrag() {
    document.querySelectorAll('[data-card-id]').forEach(col => {
      col.setAttribute('draggable', 'true');
      col.addEventListener('dragstart', onDragStart);
      col.addEventListener('dragenter', onDragEnter);
      col.addEventListener('dragover', onDragOver);
      col.addEventListener('dragleave', onDragLeave);
      col.addEventListener('drop', onDrop);
      col.addEventListener('dragend', onDragEnd);
    });
    document.querySelectorAll('.card-grid').forEach(grid => {
      grid.addEventListener('dragover', onDragOver);
      grid.addEventListener('dragenter', onGridDragEnter);
      grid.addEventListener('dragleave', onDragLeave);
      grid.addEventListener('drop', onGridDrop);
    });
  }

  function onDragStart(e) {
    draggingCol = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.cardId);
    this.classList.add('dragging');
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
  }

  function onDragEnter(e) {
    e.preventDefault();
    if (this !== draggingCol) this.classList.add('drop-target');
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function onDragLeave(e) {
    const rel = e.relatedTarget;
    if (!rel || !this.contains(rel)) this.classList.remove('drop-target');
  }

  function onDrop(e) {
    e.stopPropagation();
    this.classList.remove('drop-target');
    if (!draggingCol || draggingCol === this) return;
    const targetGrid = this.closest('.card-grid');
    if (!targetGrid) return;
    targetGrid.insertBefore(draggingCol, this);
    saveLayout();
  }

  function onGridDragEnter(e) {
    e.preventDefault();
    if (e.target === this) this.classList.add('drop-target');
  }

  function onGridDrop(e) {
    e.stopPropagation();
    this.classList.remove('drop-target');
    if (!draggingCol) return;
    this.appendChild(draggingCol);
    saveLayout();
  }

  function onDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    draggingCol = null;
  }

  // ── Export / Import / Reset ───────────────────────────────────────
  function exportLayout() {
    const layout = saveLayout();
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard-layout.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importLayout(file) {
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const layout = JSON.parse(evt.target.result);
        if (!layout.sections) throw new Error('Missing "sections" key — is this a layout file?');
        localStorage.setItem('layout', JSON.stringify(layout));
        location.reload();
      } catch (err) {
        alert('Failed to import layout: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function resetLayout() {
    if (!confirm('Reset to default layout from config.json?')) return;
    localStorage.removeItem('layout');
    location.reload();
  }

  // ── Init ──────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    document.getElementById('footer-year')?.textContent === undefined &&
      (document.getElementById('footer-year').textContent = new Date().getFullYear());

    fetchConfig()
      .then(cfg => {
        config = cfg;
        const layout = loadLayout() || defaultLayout();
        renderAll(layout);
        initDeptSelect();
        initCollapseButtons();
        initHideButtons();
        initDrag();
        updateRestoreBar();

        document.getElementById('edit-toggle')
          ?.addEventListener('click', toggleEditMode);
        document.getElementById('theme-toggle')
          ?.addEventListener('click', () => {
            applyTheme(document.documentElement.getAttribute('data-theme') !== 'dark');
          });
        document.getElementById('restore-all-btn')
          ?.addEventListener('click', () => {
            document.querySelectorAll('[data-card-id]').forEach(col => {
              col.dataset.hidden = 'false';
              col.style.display = '';
              col.querySelector('.card')?.classList.remove('hidden-card');
              const btn = col.querySelector('.edit-hide-btn');
              if (btn) btn.textContent = 'Hide';
            });
            saveLayout();
            updateRestoreBar();
          });
        document.getElementById('export-btn')
          ?.addEventListener('click', exportLayout);
        const importInput = document.getElementById('import-input');
        document.getElementById('import-btn')
          ?.addEventListener('click', () => importInput?.click());
        importInput?.addEventListener('change', function () {
          if (this.files?.[0]) importLayout(this.files[0]);
        });
        document.getElementById('reset-btn')
          ?.addEventListener('click', resetLayout);
      })
      .catch(err => {
        document.getElementById('main-content').innerHTML =
          `<div class="alert alert-danger">
            <strong>Could not load config.json.</strong>
            This page must be served from a web server (not opened as a local file).
          </div>`;
        console.error(err);
      });
  });

})();
