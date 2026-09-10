// Run before first paint; this file is only executed by the browser.
(() => {
  let preference = 'system';
  try {
    preference = localStorage.getItem('fantalist-theme') || 'system';
  } catch {
    // Storage may be unavailable in private browsing.
  }
  const dark =
    preference === 'dark' ||
    (preference !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
})();
