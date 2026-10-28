/**
 * Economy UI + multi-tab sync fix (post-load).
 * Loaded after js/app.js. Does not remove existing handlers; reinforces UI + storage merges.
 */
(function () {
  'use strict';

  function sessionAtkUsed(cb) {
    if (!cb) return 0;
    try {
      const id = String(cb.id != null ? cb.id : cb.name || '');
      let best = 0;
      Object.keys(sessionStorage).forEach(function (k) {
        if (k.indexOf('cyber_atk_') !== 0) return;
        if (id && k.indexOf(id) === -1) return;
        const n = Number(sessionStorage.getItem(k) || 0) || 0;
        if (n > best) best = n;
      });
      const mir = JSON.parse(sessionStorage.getItem('cyber_econ_' + id) || 'null');
      if (mir && (Number(mir.attacksUsed) || 0) > best) best = Number(mir.attacksUsed) || 0;
      return best;
    } catch (e) { return 0; }
  }

  function patchEconomyDOM(atkLeft, atkMax, actLeft, actMax, actUsed) {
    const atkHtml = '<strong>' + atkLeft + '</strong> / ' + atkMax;
    const actHtml = '<strong>' + actLeft + '</strong> left of ' + actMax + (actUsed ? ' · used ' + actUsed : '');
    document.querySelectorAll('.turn-stage-sub').forEach(function (sub) {
      const head = sub.querySelector('.turn-stage-sub-head');
      if (!head) return;
      const val = sub.querySelector('.combat-res-val');
      if (!val) return;
      if (/Weapon attacks/i.test(head.textContent || '')) val.innerHTML = atkHtml;
      if (/Actions budget/i.test(head.textContent || '')) val.innerHTML = actHtml;
    });
    document.querySelectorAll('#cd-weapon-atk-val, [data-econ-val="weapon-attacks"]').forEach(function (el) {
      el.innerHTML = atkHtml;
    });
    document.querySelectorAll('#cd-actions-val, [data-econ-val="actions"]').forEach(function (el) {
      el.innerHTML = actHtml;
    });
    document.querySelectorAll('.turn-stage[data-stage="action"] .stage-badge').forEach(function (badge) {
      if (actLeft <= 0) {
        badge.textContent = 'Used';
        badge.classList.remove('open');
        badge.classList.add('used');
      } else if (actUsed > 0) {
        badge.textContent = actLeft + ' left';
        badge.classList.add('open');
        badge.classList.remove('used');
      }
    });
  }

  function refreshFromSession() {
    try {
      let atkMax = 1;
      let atkUsed = 0;
      let actUsed = 0;
      let actMax = 1;
      Object.keys(sessionStorage).forEach(function (k) {
        if (k.indexOf('cyber_atk_') === 0) {
          const n = Number(sessionStorage.getItem(k) || 0) || 0;
          if (n > atkUsed) atkUsed = n;
        }
        if (k.indexOf('cyber_econ_') === 0) {
          try {
            const m = JSON.parse(sessionStorage.getItem(k) || 'null');
            if (!m) return;
            if ((Number(m.attacksUsed) || 0) > atkUsed) atkUsed = Number(m.attacksUsed) || 0;
            if (m.attacksMax) atkMax = Math.max(atkMax, Number(m.attacksMax) || 1);
            if ((Number(m.actionsUsed) || 0) > actUsed) actUsed = Number(m.actionsUsed) || 0;
            if (m.actionsMax) actMax = Math.max(actMax, Number(m.actionsMax) || 1);
          } catch (e) {}
        }
      });
      document.querySelectorAll('.turn-stage-sub').forEach(function (sub) {
        const head = sub.querySelector('.turn-stage-sub-head');
        if (!head || !/Weapon attacks/i.test(head.textContent || '')) return;
        const t = (sub.querySelector('.combat-res-val') || {}).textContent || '';
        const m = t.match(/\/\s*(\d+)/);
        if (m) atkMax = Math.max(atkMax, parseInt(m[1], 10) || 1);
      });
      if (atkUsed > 0 && actUsed < 1) actUsed = 1;
      const atkLeft = Math.max(0, atkMax - atkUsed);
      const actLeft = Math.max(0, actMax - actUsed);
      if (atkUsed > 0 || actUsed > 0) {
        patchEconomyDOM(atkLeft, atkMax, actLeft, actMax, actUsed);
      }
    } catch (e) {}
  }

  document.addEventListener('click', function (ev) {
    const t = ev.target;
    if (!t || !t.closest) return;
    if (t.closest('#cr-roll-btn') || t.closest('#cr-roll-dmg')) {
      setTimeout(refreshFromSession, 0);
      setTimeout(refreshFromSession, 50);
      setTimeout(refreshFromSession, 150);
    }
  }, true);

  const STORAGE_KEY = 'cybervlachos_combat_v1';
  window.addEventListener('storage', function (e) {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      setTimeout(refreshFromSession, 0);
    } catch (err) {}
  });

  setInterval(function () {
    if (document.getElementById('cd-weapon-atk-val') || document.querySelector('[data-econ-val="weapon-attacks"]') || document.querySelector('.turn-stage-sub-head')) {
      refreshFromSession();
    }
  }, 500);

  console.info('[economy-fix] loaded');
})();
