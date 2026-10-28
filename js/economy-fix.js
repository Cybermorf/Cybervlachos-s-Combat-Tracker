/**
 * Player UI helpers — hide spell slot DM controls. No DOM mutation loops.
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
  function hidePlayerSlotControls() {
    if (!isPlayer()) return;
    var sels = [
      '.cd-slot-spend', '.cd-slot-restore',
      '#cd-pact-dec', '#cd-pact-inc',
      '.slot-stepper .slot-dec', '.slot-stepper .slot-inc'
    ];
    sels.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.style.setProperty('display', 'none', 'important');
        el.setAttribute('hidden', 'hidden');
        try { if (el.parentNode) el.parentNode.removeChild(el); } catch (e) {}
      });
    });
  }
  try {
    if (!document.getElementById('economy-fix-style')) {
      var st = document.createElement('style');
      st.id = 'economy-fix-style';
      st.textContent = [
        'body.vtt-player .cd-slot-spend, body.vtt-player .cd-slot-restore,',
        'html.vtt-player .cd-slot-spend, html.vtt-player .cd-slot-restore,',
        '.vtt-player .cd-slot-spend, .vtt-player .cd-slot-restore,',
        'body.vtt-player #cd-pact-dec, body.vtt-player #cd-pact-inc,',
        'body.vtt-player .slot-stepper .slot-dec, body.vtt-player .slot-stepper .slot-inc {',
        '  display: none !important; visibility: hidden !important;',
        '  pointer-events: none !important; width: 0 !important; height: 0 !important;',
        '  padding: 0 !important; margin: 0 !important; border: 0 !important;',
        '}'
      ].join('\\n');
      (document.head || document.documentElement).appendChild(st);
    }
  } catch (e) {}
  if (isPlayer()) {
    [0, 50, 150, 400, 1000, 2000].forEach(function (ms) {
      setTimeout(hidePlayerSlotControls, ms);
    });
    document.addEventListener('click', function () {
      setTimeout(hidePlayerSlotControls, 30);
    }, false);
  }
  console.info('[economy-fix] v5 slots+no-loop');
})();
