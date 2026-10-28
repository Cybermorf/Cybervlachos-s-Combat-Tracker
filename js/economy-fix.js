/**
 * Player-only helpers: hide spell-slot ±, no DOM loops.
 * Attack budget is fixed in app.js (session clear on Start Turn).
 */
(function () {
  'use strict';

  function isPlayer() {
    try {
      if (typeof isPlayerRole === 'function' && isPlayerRole()) return true;
    } catch (e) {}
    try {
      if (/[?&]role=player(?:&|$)/i.test(String(location.search || ''))) return true;
      if (document.body && document.body.classList.contains('vtt-player')) return true;
      if (document.documentElement && document.documentElement.classList.contains('vtt-player')) return true;
    } catch (e) {}
    return false;
  }

  function hidePlayerSlotSteppers() {
    if (!isPlayer()) return;
    var nodes = document.querySelectorAll('.slot-stepper .slot-dec, .slot-stepper .slot-inc');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      el.style.setProperty('display', 'none', 'important');
      el.setAttribute('hidden', 'hidden');
      el.setAttribute('aria-hidden', 'true');
      if (el.parentNode) {
        try { el.parentNode.removeChild(el); } catch (e) {}
      }
    }
  }

  // CSS once
  try {
    if (!document.getElementById('economy-fix-style')) {
      var st = document.createElement('style');
      st.id = 'economy-fix-style';
      st.textContent = 'body.vtt-player .slot-stepper .slot-dec,body.vtt-player .slot-stepper .slot-inc,html.vtt-player .slot-stepper .slot-dec,html.vtt-player .slot-stepper .slot-inc,.vtt-player .slot-stepper .slot-dec,.vtt-player .slot-stepper .slot-inc{display:none!important;visibility:hidden!important;width:0!important;min-width:0!important;padding:0!important;margin:0!important;border:0!important;pointer-events:none!important}';
      (document.head || document.documentElement).appendChild(st);
    }
  } catch (e) {}

  // Hide slots after panel paints (timed only — no MutationObserver)
  if (isPlayer()) {
    [0, 100, 300, 800, 1500].forEach(function (ms) {
      setTimeout(hidePlayerSlotSteppers, ms);
    });
    // After claim / panel open
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      // Any click that might re-render player panel
      if (t.closest('#player-combat-panel') || t.closest('.player-char') || t.closest('[data-claim]') || /Garrick|Thornroot|Captain|Spellblade/i.test(t.textContent || '')) {
        setTimeout(hidePlayerSlotSteppers, 50);
        setTimeout(hidePlayerSlotSteppers, 200);
      }
    }, false);
  }

  console.info('[economy-fix] safe v4');
})();
