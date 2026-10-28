/**
 * Economy UI fix v3 — player attack budget + hide slot steppers.
 * Loaded after js/app.js. Does not change DM map chrome.
 */
(function () {
  'use strict';

  function isPlayer() {
    try {
      if (typeof isPlayerRole === 'function' && isPlayerRole()) return true;
    } catch (e) {}
    return !!(document.body && document.body.classList.contains('vtt-player'))
      || /(?:^|[?&])role=player(?:&|$)/.test(location.search || '');
  }

  function hidePlayerSlotSteppers() {
    if (!isPlayer()) return;
    document.querySelectorAll('.slot-stepper .slot-dec, .slot-stepper .slot-inc').forEach(function (el) {
      el.style.setProperty('display', 'none', 'important');
      el.setAttribute('hidden', 'hidden');
    });
  }

  try {
    if (!document.getElementById('economy-fix-style')) {
      var st = document.createElement('style');
      st.id = 'economy-fix-style';
      st.textContent = 'body.vtt-player .slot-stepper .slot-dec,body.vtt-player .slot-stepper .slot-inc,html.vtt-player .slot-stepper .slot-dec,html.vtt-player .slot-stepper .slot-inc,.vtt-player .slot-stepper .slot-dec,.vtt-player .slot-stepper .slot-inc{display:none!important;visibility:hidden!important;width:0!important;min-width:0!important;padding:0!important;margin:0!important;border:0!important;pointer-events:none!important}';
      (document.head || document.documentElement).appendChild(st);
    }
  } catch (e) {}

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
    return max || 1;
  }

  function patchWeaponAndActions(atkLeft, atkMax, actLeft, actMax, actUsed) {
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

  var localAtkUsed = 0;
  var localActUsed = 0;
  var armed = false;

  function clearLocalEconomy() {
    localAtkUsed = 0;
    localActUsed = 0;
    armed = false;
    try {
      Object.keys(sessionStorage).forEach(function (k) {
        if (k.indexOf('cyber_atk_') === 0 || k.indexOf('cyber_econ_') === 0) sessionStorage.removeItem(k);
      });
    } catch (e) {}
  }

  function paintLocal() {
    var atkMax = readWeaponMaxFromDom();
    if (atkMax < 1) atkMax = 1;
    if (localAtkUsed > atkMax) localAtkUsed = atkMax;
    var atkLeft = Math.max(0, atkMax - localAtkUsed);
    var actMax = 1;
    var actLeft = Math.max(0, actMax - localActUsed);
    patchWeaponAndActions(atkLeft, atkMax, actLeft, actMax, localActUsed);
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;

    if (t.closest('#cd-start-turn') || t.closest('#combat-next-btn') || t.closest('#combat-end-round-btn')) {
      clearLocalEconomy();
      setTimeout(paintLocal, 30);
      return;
    }

    if (!t.closest('#cr-roll-btn')) return;

    if (isPlayer()) {
      armed = true;
      var atkMax = readWeaponMaxFromDom() || 1;
      if (localAtkUsed < atkMax) {
        localAtkUsed += 1;
        localActUsed = 1;
      }
      paintLocal();
      setTimeout(paintLocal, 0);
      setTimeout(paintLocal, 50);
      setTimeout(paintLocal, 150);
      setTimeout(hidePlayerSlotSteppers, 20);
      return;
    }
  }, true);

  try {
    var obs = new MutationObserver(function () {
      hidePlayerSlotSteppers();
      if (isPlayer() && armed) paintLocal();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}

  setInterval(function () {
    hidePlayerSlotSteppers();
    if (isPlayer() && armed) paintLocal();
  }, 400);

  setTimeout(hidePlayerSlotSteppers, 100);
  setTimeout(hidePlayerSlotSteppers, 500);
  console.info('[economy-fix] loaded v3');
})();
