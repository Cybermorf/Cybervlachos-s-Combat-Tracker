/**
 * Economy UI + multi-tab sync fix (post-load).
 * Loaded after js/app.js.
 */
(function () {
  'use strict';

  function isPlayer() {
    try {
      if (typeof isPlayerRole === 'function' && isPlayerRole()) return true;
    } catch (e) {}
    return !!(document.body && document.body.classList.contains('vtt-player'))
      || /role=player/.test(location.search || '');
  }

  function hidePlayerSlotSteppers() {
    if (!isPlayer()) return;
    document.querySelectorAll('.slot-stepper .slot-dec, .slot-stepper .slot-inc').forEach(function (el) {
      el.style.display = 'none';
      el.setAttribute('hidden', 'hidden');
      el.setAttribute('aria-hidden', 'true');
    });
  }

  try {
    if (!document.getElementById('economy-fix-style')) {
      var st = document.createElement('style');
      st.id = 'economy-fix-style';
      st.textContent = [
        'body.vtt-player .slot-stepper .slot-dec,',
        'body.vtt-player .slot-stepper .slot-inc,',
        'html.vtt-player .slot-stepper .slot-dec,',
        'html.vtt-player .slot-stepper .slot-inc,',
        '.vtt-player .slot-stepper .slot-dec,',
        '.vtt-player .slot-stepper .slot-inc { display: none !important; visibility: hidden !important; width: 0 !important; padding: 0 !important; margin: 0 !important; border: 0 !important; }'
      ].join('\n');
      (document.head || document.documentElement).appendChild(st);
    }
  } catch (e) {}

  function currentCombatantHint() {
    var name = '';
    try {
      var hdr = document.querySelector('.player-combat-header, [data-player-detail] h2, #combat-detail .combat-detail-name, .combatant-row.selected .name');
      if (hdr) name = (hdr.textContent || '').trim().split('\n')[0];
    } catch (e) {}
    try {
      var claim = sessionStorage.getItem('vtt_claim') || localStorage.getItem('vtt_claim') || '';
      if (claim) return { id: claim, name: name };
    } catch (e) {}
    return { id: '', name: name };
  }

  function readSessionAttacks() {
    var hint = currentCombatantHint();
    var best = 0;
    var maxFromMirror = 0;
    var actFromMirror = 0;
    try {
      Object.keys(sessionStorage).forEach(function (k) {
        if (k.indexOf('cyber_atk_') === 0) {
          var match = true;
          if (hint.id) match = k.indexOf(hint.id) !== -1;
          if (!match) return;
          var n = Number(sessionStorage.getItem(k) || 0) || 0;
          if (n >= best) best = n;
        }
        if (k.indexOf('cyber_econ_') === 0) {
          if (hint.id && k.indexOf(hint.id) === -1) return;
          try {
            var m = JSON.parse(sessionStorage.getItem(k) || 'null');
            if (!m) return;
            if ((Number(m.attacksUsed) || 0) > best) best = Number(m.attacksUsed) || 0;
            if (m.attacksMax) maxFromMirror = Math.max(maxFromMirror, Number(m.attacksMax) || 0);
            if ((Number(m.actionsUsed) || 0) > actFromMirror) actFromMirror = Number(m.actionsUsed) || 0;
          } catch (e) {}
        }
      });
    } catch (e) {}
    return { used: best, maxHint: maxFromMirror, actUsed: actFromMirror };
  }

  function readWeaponMaxFromDom() {
    var max = 1;
    document.querySelectorAll('.turn-stage-sub').forEach(function (sub) {
      var head = sub.querySelector('.turn-stage-sub-head');
      if (!head || !/Weapon attacks/i.test(head.textContent || '')) return;
      var t = (sub.querySelector('.combat-res-val') || {}).textContent || '';
      var m = t.match(/\/\s*(\d+)/);
      if (m) max = Math.max(max, parseInt(m[1], 10) || 1);
    });
    var el = document.getElementById('cd-weapon-atk-max');
    if (el) max = Math.max(max, parseInt(el.textContent, 10) || 1);
    return max;
  }

  function patchEconomyDOM(atkLeft, atkMax, actLeft, actMax, actUsed) {
    var atkHtml = '<strong>' + atkLeft + '</strong> / ' + atkMax;
    var actHtml = '<strong>' + actLeft + '</strong> left of ' + actMax + (actUsed ? ' · used ' + actUsed : '');
    document.querySelectorAll('.turn-stage-sub').forEach(function (sub) {
      var head = sub.querySelector('.turn-stage-sub-head');
      if (!head) return;
      var val = sub.querySelector('.combat-res-val');
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

  var lastPaintedUsed = -1;

  function refreshFromSession() {
    try {
      hidePlayerSlotSteppers();
      var sess = readSessionAttacks();
      var atkMax = Math.max(1, sess.maxHint || 0, readWeaponMaxFromDom());
      var atkUsed = Math.max(0, sess.used || 0);
      if (atkUsed > atkMax) atkUsed = atkMax;
      var actUsed = Math.max(0, sess.actUsed || 0);
      if (atkUsed > 0 && actUsed < 1) actUsed = 1;
      var atkLeft = Math.max(0, atkMax - atkUsed);
      var actMax = 1;
      var actLeft = Math.max(0, actMax - actUsed);
      if (atkUsed > 0 || lastPaintedUsed >= 0) {
        lastPaintedUsed = atkUsed;
        patchEconomyDOM(atkLeft, atkMax, actLeft, actMax, actUsed);
      }
    } catch (e) {}
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    if (t.closest('#cr-roll-btn') || t.closest('#cr-roll-dmg') || t.closest('#cd-start-turn') || t.closest('#combat-next-btn') || t.closest('#combat-end-round-btn')) {
      if (t.closest('#cd-start-turn') || t.closest('#combat-next-btn') || t.closest('#combat-end-round-btn')) {
        try {
          Object.keys(sessionStorage).forEach(function (k) {
            if (k.indexOf('cyber_atk_') === 0 || k.indexOf('cyber_econ_') === 0) sessionStorage.removeItem(k);
          });
          lastPaintedUsed = -1;
        } catch (e) {}
      }
      setTimeout(refreshFromSession, 0);
      setTimeout(refreshFromSession, 40);
      setTimeout(refreshFromSession, 120);
      setTimeout(hidePlayerSlotSteppers, 50);
    }
  }, true);

  try {
    var obs = new MutationObserver(function () { hidePlayerSlotSteppers(); });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}

  setInterval(function () {
    hidePlayerSlotSteppers();
    if (document.getElementById('cd-weapon-atk-val') || document.querySelector('[data-econ-val="weapon-attacks"]') || document.querySelector('.turn-stage-sub-head')) {
      refreshFromSession();
    }
  }, 600);

  setTimeout(hidePlayerSlotSteppers, 100);
  setTimeout(hidePlayerSlotSteppers, 500);
  console.info('[economy-fix] loaded v2');
})();
