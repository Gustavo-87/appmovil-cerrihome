// Runs before the page renders, so a saved dark theme never flashes white.
(() => {
  let preference;
  try { preference = localStorage.getItem('cerritos-theme'); } catch { /* Storage may be disabled. */ }
  const theme = preference === 'light' || preference === 'dark'
    ? preference
    : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#10231f' : '#edf3ef');
})();
