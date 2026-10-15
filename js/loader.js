// Concatenate split sources for GitHub Pages / API size limits
(async function() {
  async function loadParts(prefix, count, dir, ext) {
    dir = dir || 'js/';
    ext = ext || '.js';
    const parts = [];
    for (let i = 0; i < count; i++) {
      const r = await fetch(dir + prefix + '.part' + i + ext);
      if (!r.ok) throw new Error('Failed to load ' + prefix + ' part ' + i + ' (' + r.status + ')');
      parts.push(await r.text());
    }
    return parts.join('');
  }
  try {
    const cssText = await loadParts('styles', 2, 'css/', '.css');
    const style = document.createElement('style');
    style.textContent = cssText;
    document.head.appendChild(style);

    async function inject(prefix, count) {
      const code = await loadParts(prefix, count, 'js/', '.js');
      const s = document.createElement('script');
      s.textContent = code;
      document.head.appendChild(s);
    }
    await inject('phb-data', 3);
    await inject('equipment-data', 2);
    await inject('extensions', 2);
    await inject('bestiary', 7);
    await inject('spells', 13);
    await inject('app', 17);
  } catch (e) {
    console.error(e);
    document.body.innerHTML = '<pre style="color:#c4a35a;padding:2rem;font-family:sans-serif">Failed to load Combat Tracker: ' + e.message +
      '\n\nWait a minute for GitHub Pages to finish deploying, then hard-refresh (Ctrl+Shift+R).</pre>';
  }
})();
