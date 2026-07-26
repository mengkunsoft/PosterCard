/* PosterCard WordPress 插件前台脚本：点击 .postercard-btn 生成海报 */
(function () {
  'use strict';

  function bind() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.postercard-btn') : null;
      if (!btn) return;
      if (typeof window.PosterCard === 'undefined' || typeof window.PosterCardWP === 'undefined') {
        console.warn('[PosterCard] 库或配置未加载');
        return;
      }
      e.preventDefault();
      if (btn.getAttribute('data-pc-busy') === '1') return;
      btn.setAttribute('data-pc-busy', '1');
      var done = function () { btn.removeAttribute('data-pc-busy'); };
      var p = window.PosterCard.generate(window.PosterCardWP);
      if (p && typeof p.finally === 'function') p.finally(done);
      else if (p && typeof p.then === 'function') p.then(done, done);
      else done();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
