// Concatenate split sources for GitHub Pages size limits
(async function() {
  async function loadParts(prefix, count) {
    const parts = [];
    for (let i = 0; i < count; i++) {
      const r = await fetch('js/' + prefix + '.part' + i + '.js');
      if (!r.ok) throw new Error('Failed to load ' + prefix + ' part ' + i);
      parts.push(await r.text());
    }
    const s = document.createElement('script');
    s.textContent = parts.join('');
    document.head.appendChild(s);
  }
  try {
    await loadParts('bestiary', 2);
    await loadParts('spells', 4);
    await loadParts('app', 5);
  } catch (e) {
    console.error(e);
    document.body.innerHTML = '<pre style="color:#c4a35a;padding:2rem">Failed to load Combat Tracker modules: ' + e.message + '</pre>';
  }
})();
