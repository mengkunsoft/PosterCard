/* PosterCard WordPress 插件前台脚本：点击 .postercard-btn 生成海报
 *
 * PJAX 兼容要点：
 *  1) 事件委托绑在 document（pjax 不会替换 document），且只绑定一次；
 *  2) 文章数据由按钮的 data-postercard 属性携带，随正文一起被 pjax 替换，
 *     不依赖只在整页渲染时注入一次的 window.PosterCardWP；
 *  3) 因此无需监听任何 pjax 事件，局部刷新后按钮天然可用。
 */
(function () {
  'use strict';

  if (window.__postercardBound) return;
  window.__postercardBound = true;

  function readConfig(btn) {
    var raw = btn.getAttribute('data-postercard');
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* 回退到全局配置 */ }
    }
    // 兼容主题里手写的 .postercard-btn（无 data 属性）与旧版按钮：
    // 回退到整页渲染时注入的配置，并把二维码链接纠正为当前页地址，
    // 避免 pjax 跳转后仍指向首次加载的那篇文章。
    var cfg = window.PosterCardWP;
    if (!cfg) return null;
    var copy = {};
    for (var k in cfg) if (Object.prototype.hasOwnProperty.call(cfg, k)) copy[k] = cfg[k];
    var f = {};
    for (var j in (cfg.fields || {})) if (Object.prototype.hasOwnProperty.call(cfg.fields, j)) f[j] = cfg.fields[j];
    f.url = window.location.href;
    copy.fields = f;
    return copy;
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('.postercard-btn') : null;
    if (!btn) return;
    if (typeof window.PosterCard === 'undefined') {
      console.warn('[PosterCard] 库未加载');
      return;
    }
    e.preventDefault();
    if (btn.getAttribute('data-pc-busy') === '1') return;
    var cfg = readConfig(btn);
    if (!cfg) {
      console.warn('[PosterCard] 配置未加载');
      return;
    }
    btn.setAttribute('data-pc-busy', '1');
    var done = function () { btn.removeAttribute('data-pc-busy'); };
    var p = window.PosterCard.generate(cfg);
    if (p && typeof p.finally === 'function') p.finally(done);
    else if (p && typeof p.then === 'function') p.then(done, done);
    else done();
  });
})();
