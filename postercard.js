/**
 * PosterCard —— 通用前端海报生成库（模板化版本）
 *
 * 模板化工作方式：
 *   - 每个模板是一个独立、可直接打开预览的 HTML 文件：tpl/<模板名>/index.html
 *   - 模板自带 CSS（<style>），内部用「占位符 / 行为属性」描述可替换内容
 *   - 生成时库会 fetch 对应模板文件，替换占位符、执行行为属性，再用 html2canvas 出图
 *
 * 占位符语法：
 *   - 文本：<div data-pg-text="title"></div>  元素内写入示例文本即可直接预览
 *   - 行内：在文本或属性里写 {{field}}，例如 <p>{{summary}}</p> 或 alt="{{siteName}}"
 *   - 扩展函数（管道）：{{summary | truncate:80}} 、 {{author | default:@siteName}}
 *       * 参数以逗号分隔；以 @ 开头的参数表示引用另一个字段，如 default:@siteName
 *       * 内置函数：truncate / default / trim / upper / lower / date
 *       * 模板可通过内联 <script> 注册自定义扩展函数（见各模板文件）
 *
 * 行为属性（data-pg-*）：
 *   data-pg-text="field | fn:arg"   文本绑定（可被扩展函数处理），生成时覆盖元素文本
 *   data-pg-if="field"              字段为空则隐藏元素；支持 !field 取反、逗号分隔多字段(AND)
 *   data-pg-cover                   封面图：<img> 设 src，容器则设 backgroundImage；含缺省/占位回退
 *   data-pg-img="field"             普通图片（logo 等）：设 src，字段为空则隐藏
 *   data-pg-qr [data-pg-qr-size] [data-pg-qr-color] [data-pg-qr-bg]   生成二维码（内容取 fields.url；color 前景色、bg 背景色，缺省黑/白）
 *   data-pg-date [data-pg-date-variant]  日期徽标；子元素用 data-pg-date-day / data-pg-date-monthyear
 *   data-pg-favicon                 站点图标/作者头像（minimal 用）
 *
 * 用法：
 *   PosterCard.generate({
 *     fields: { title, summary, cover, url, siteName, logo, author, authorAvatar, date, brandDesc },
 *     style: { template: 'default', width: 400, defaultCover: '' },
 *     output: { showModal: true, filename: 'postercard.png' },
 *     deps: { templateBase: 'tpl', assetsBase: 'assets' }
 *   }).then(function (result) { // result: { canvas, blob, dataUrl, url, download() } });
 *
 *   圆角透明边角：模板根节点(.pg-root)自带非 0 圆角时，导出 PNG 自动让圆角外区域透明
 *   （不再有白色矩形边角）。该行为由模板自身设计决定，无需额外参数。
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PosterCard = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 基础工具                                                            */
  /* ------------------------------------------------------------------ */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }

  function createEl(tag, cls) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }

  function clampWidth(w) {
    var n = parseInt(w, 10);
    if (!isFinite(n) || n <= 0) n = 400;
    return Math.max(240, n);
  }

  function showToast(message, ms) {
    var toast = $('.pg-toast');
    if (!toast) {
      toast = createEl('div', 'pg-toast');
      document.body.appendChild(toast);
    }
    toast.textContent = message || '';
    toast.style.display = 'block';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toast.style.display = 'none'; }, ms || 1600);
  }

  /* ------------------------------------------------------------------ */
  /* 加载遮罩 & 预览弹窗                                                 */
  /* ------------------------------------------------------------------ */
  function ensureLoadingScaffold() {
    var wrap = $('.pg-loading-backdrop');
    if (wrap) return wrap;
    wrap = createEl('div', 'pg-loading-backdrop');
    wrap.appendChild(createEl('div', 'pg-loading-spinner'));
    var text = createEl('div', 'pg-loading-text');
    text.textContent = '海报生成中...';
    wrap.appendChild(text);
    document.body.appendChild(wrap);
    return wrap;
  }

  function setLoading(active, text) {
    var wrap = ensureLoadingScaffold();
    var textEl = wrap.querySelector('.pg-loading-text');
    if (textEl && text) textEl.textContent = text;
    wrap.style.display = active ? 'flex' : 'none';
  }

  function fitPosterPreview(backdrop, img, styleName, label, posterWidth) {
    var modal = backdrop.querySelector('.pg-modal');
    var body = backdrop.querySelector('.pg-modal-body');
    var meta = backdrop.querySelector('.pg-preview-meta');
    if (!modal || !body || !img) return;

    var naturalWidth = img.naturalWidth || 800;
    var naturalHeight = img.naturalHeight || 1200;
    var ratio = naturalWidth / Math.max(1, naturalHeight);
    var viewportWidth = document.documentElement.clientWidth || window.innerWidth || 400;
    var viewportHeight = document.documentElement.clientHeight || window.innerHeight || 720;
    // 预览宽度使用海报实际宽度（style.width），与生成结果一致；未指定则回退默认 400
    var preferredWidth = posterWidth || 400;
    var maxImageWidth = Math.max(120, viewportWidth - 64);
    var maxImageHeight = Math.max(120, viewportHeight - 184);
    var scaledWidth = Math.max(96, Math.min(preferredWidth, maxImageWidth, maxImageHeight * ratio));

    modal.style.width = Math.ceil(scaledWidth + 34) + 'px';
    body.style.setProperty('--pg-preview-width', Math.floor(scaledWidth) + 'px');
    body.style.setProperty('--pg-preview-height', Math.floor(maxImageHeight) + 'px');
    backdrop.setAttribute('data-postercard-style', styleName || 'default');
    if (meta) meta.textContent = (label || styleName || '默认样式') + ' · ' + naturalWidth + ' × ' + naturalHeight;
  }

  function ensureModalScaffold() {
    var backdrop = $('.pg-modal-backdrop');
    if (backdrop) return backdrop;
    backdrop = createEl('div', 'pg-modal-backdrop');
    var modal = createEl('div', 'pg-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'pg-preview-title');
    modal.tabIndex = -1;

    var header = createEl('div', 'pg-modal-header');
    var title = createEl('div', 'pg-modal-title');
    title.id = 'pg-preview-title';
    title.textContent = '海报预览';
    var closeBtn = createEl('button', 'pg-close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', '关闭预览');
    closeBtn.title = '关闭预览';
    closeBtn.innerHTML = '✕';

    function closePreview() {
      backdrop.style.display = 'none';
    }

    closeBtn.addEventListener('click', closePreview);
    header.appendChild(title);
    header.appendChild(closeBtn);

    var body = createEl('div', 'pg-modal-body');
    var footer = createEl('div', 'pg-modal-footer');
    var previewMeta = createEl('div', 'pg-preview-meta');
    previewMeta.textContent = '海报生成完成';
    var downloadBtn = createEl('button', 'pg-download');
    downloadBtn.type = 'button';
    downloadBtn.textContent = '下载海报';
    downloadBtn.addEventListener('click', function () {
      var img = body.querySelector('img');
      if (!img) return;
      var a = document.createElement('a');
      a.href = img.src;
      a.download = (ensureModalScaffold._filename || 'postercard.png');
      a.click();
    });
    footer.appendChild(previewMeta);
    footer.appendChild(downloadBtn);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop) closePreview();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && backdrop.style.display === 'flex') closePreview();
    });
    window.addEventListener('resize', function () {
      if (backdrop.style.display === 'flex' && typeof backdrop._pgFit === 'function') {
        backdrop._pgFit();
      }
    });
    return backdrop;
  }

  /* ------------------------------------------------------------------ */
  /* 依赖检查（html2canvas / qrcode 由调用方自行引入）                   */
  /* ------------------------------------------------------------------ */
  function checkDepsReady() {
    var missing = [];
    if (typeof window.html2canvas === 'undefined') missing.push('html2canvas');
    if (typeof window.QRCode === 'undefined') missing.push('qrcode');
    if (missing.length) {
      var msg = '缺少依赖：' + missing.join('、') + '。请在页面中先引入对应脚本。';
      showToast(msg);
      throw new Error(msg);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 图片加载工具                                                        */
  /* ------------------------------------------------------------------ */
  function waitForImage(img, timeoutMs) {
    return new Promise(function (resolve) {
      var done = false;
      function finish() { if (!done) { done = true; resolve(); } }
      if (!img) return resolve();
      if (img.complete && img.naturalWidth > 0) return resolve();
      img.addEventListener('load', finish, { once: true });
      img.addEventListener('error', finish, { once: true });
      if (timeoutMs) setTimeout(finish, timeoutMs);
    });
  }

  // 等待 root 内所有 <img> 真正加载完成（含 decode），再交给 html2canvas 截图。
  // 否则封面/头像等使用「宽度 100% + 高度自适应」的 <img> 在图片尚未布局时，
  // 根节点高度会偏小，导致生成图底部被截断（部分模板/主题表现异常）。
  function waitForImages(root, timeoutMs) {
    var imgs = root ? root.querySelectorAll('img') : [];
    var tasks = [];
    Array.prototype.forEach.call(imgs, function (img) {
      if (!img) return;
      // 仅等待“有真实 src 且未成功加载”的图，已完成的直接跳过
      if (img.complete && img.naturalWidth > 0) return;
      tasks.push(waitForImage(img, timeoutMs || 8000).then(function () {
        try { if (img.decode) return img.decode(); } catch (_) { }
        return undefined;
      }).catch(function () { /* 单图失败不应阻断整体 */ }));
    });
    return Promise.all(tasks);
  }

  // html2canvas 不识别 CSS aspect-ratio，会把这些元素重排塌陷为 ~0 高度，
  // 造成生成图整体偏矮、底部被截断。这里把浏览器已算好的确定高度写死成内联样式，
  // 让 html2canvas 能按正确高度截图。已在模板中使用的有 default/dwqr*/minimal/netease/nicetheme 等。
  function freezeAspectRatioHeights(root) {
    if (!root || typeof window.getComputedStyle === 'undefined') return;
    var list = [root];
    try {
      var found = root.querySelectorAll('*');
      for (var i = 0; i < found.length; i++) list.push(found[i]);
    } catch (_) { /* ignore */ }
    list.forEach(function (el) {
      var cs;
      try { cs = window.getComputedStyle(el); } catch (_) { return; }
      if (!cs) return;
      var ar = cs.aspectRatio;
      if (!ar || ar === 'auto' || ar === 'normal') return;
      var h = parseFloat(cs.height);
      if (h > 0) el.style.height = Math.round(h) + 'px';
    });
  }

  var MIN_COVER_SHORT_EDGE = 180;
  var MIN_COVER_LONG_EDGE = 320;
  var MIN_COVER_AREA = 120000;

  function isUsableCoverDimensions(img, allowSmall) {
    if (allowSmall) return true;
    var width = Number(img && img.naturalWidth) || 0;
    var height = Number(img && img.naturalHeight) || 0;
    if (!width || !height) return false;
    var shortEdge = Math.min(width, height);
    var longEdge = Math.max(width, height);
    return shortEdge >= MIN_COVER_SHORT_EDGE
      && longEdge >= MIN_COVER_LONG_EDGE
      && width * height >= MIN_COVER_AREA;
  }

  function normalizeUrlMaybe(url) {
    if (!url) return '';
    var str = String(url).trim();
    if (!str) return '';
    try { return new URL(str, location.href).href; } catch (_) { }
    return str;
  }

  function setImageCorsMode(img, url) {
    try {
      var parsed = new URL(url, location.href);
      if (parsed.origin === location.origin) {
        img.removeAttribute('crossorigin');
      } else {
        img.crossOrigin = 'anonymous';
      }
    } catch (_) {
      img.removeAttribute('crossorigin');
    }
  }

  function optimizeRemoteImageUrl(url, posterWidth) {
    if (!url) return '';
    var s = String(url);
    if (!/^https?:\/\//i.test(s)) return s;
    try {
      var u = new URL(s, location.href);
      var host = (u.hostname || '').toLowerCase();
      var maxW = Math.max(900, Math.min(1400, Math.round((parseInt(posterWidth, 10) || 400) * 2.2)));
      if (host.indexOf('unsplash.com') !== -1) {
        if (!u.searchParams.has('auto')) u.searchParams.set('auto', 'format');
        if (!u.searchParams.has('fit')) u.searchParams.set('fit', 'max');
        u.searchParams.set('w', String(maxW));
        u.searchParams.set('q', '70');
        u.searchParams.set('fm', 'jpg');
      }
      return u.toString();
    } catch (_) {
      return s;
    }
  }

  function svgPlaceholder(w, h, from, to) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' +
      '<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1">' +
      '<stop stop-color="' + from + '" offset="0"/><stop stop-color="' + to + '" offset="1"/>' +
      '</linearGradient></defs><rect fill="url(#g)" width="' + w + '" height="' + h + '"/></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ------------------------------------------------------------------ */
  /* 日期                                                                */
  /* ------------------------------------------------------------------ */
  function parseDate(iso) {
    if (!iso) return null;
    try {
      var d = new Date(iso);
      if (!isNaN(d.getTime())) return d;
    } catch (_) { }
    return null;
  }

  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_UP = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  function formatDate(d, fmt) {
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    switch (fmt) {
      case 'cn': return y + '年' + p(m) + '月' + p(day) + '日';
      case 'iso': return y + '-' + p(m) + '-' + p(day);
      case 'ym': return y + '.' + p(m);
      case 'md': return p(m) + '-' + p(day);
      case 'upper': return MONTHS_UP[d.getMonth()] + '.' + y;
      case 'default':
      default: return MONTHS_SHORT[d.getMonth()] + '.' + y;
    }
  }

  /* ------------------------------------------------------------------ */
  /* 占位符 / 扩展函数引擎                                              */
  /* ------------------------------------------------------------------ */
  var builtinHelpers = {
    truncate: function (v, n, ellipsis) {
      n = parseInt(n, 10) || 0;
      // 注意：evalExpr 调用 helper 时会把 ctx 作为最后一个参数传入，
      // 此处 ellipsis 可能收到 ctx 对象；只有字符串才当作省略号，否则回落默认 '…'
      ellipsis = (ellipsis == null || typeof ellipsis !== 'string') ? '…' : ellipsis;
      v = String(v == null ? '' : v);
      if (n > 0 && v.length > n) return v.slice(0, n) + ellipsis;
      return v;
    },
    default: function (v, fb) {
      return (v == null || String(v).trim() === '') ? (fb == null ? '' : fb) : v;
    },
    trim: function (v) { return String(v == null ? '' : v).trim(); },
    upper: function (v) { return String(v == null ? '' : v).toUpperCase(); },
    lower: function (v) { return String(v == null ? '' : v).toLowerCase(); },
    date: function (v, fmt) {
      var d = parseDate(v);
      return d ? formatDate(d, fmt || 'default') : '';
    }
  };

  function resolveArg(a, data) {
    a = String(a == null ? '' : a).trim();
    if (a.charAt(0) === '@') {
      var k = a.slice(1);
      return data.hasOwnProperty(k) ? data[k] : '';
    }
    if ((a.charAt(0) === '"' && a.charAt(a.length - 1) === '"') ||
        (a.charAt(0) === "'" && a.charAt(a.length - 1) === "'")) {
      return a.slice(1, -1);
    }
    return a;
  }

  function evalExpr(expr, data, helpers) {
    var parts = String(expr).split('|');
    var field = parts.shift().trim();
    var value = data.hasOwnProperty(field) ? data[field] : '';
    if (value == null) value = '';
    value = String(value);

    parts.forEach(function (p) {
      var seg = p.trim();
      if (!seg) return;
      var m = seg.match(/^([A-Za-z_$][\w$]*)(?:\s*:\s*(.*))?$/);
      if (!m) return;
      var fn = helpers[m[1]];
      if (typeof fn !== 'function') return;
      var argStr = m[2];
      var args = [];
      if (argStr != null && argStr !== '') {
        args = argStr.split(',').map(function (a) { return resolveArg(a, data); });
      }
      var ctx = { data: data, helpers: helpers, field: field };
      value = fn.apply(null, [value].concat(args).concat([ctx]));
      if (value == null) value = '';
      value = String(value);
    });
    return value;
  }

  function replaceTokens(str, data, helpers) {
    return str.replace(/\{\{\s*([\s\S]+?)\s*\}\}/g, function (_, expr) {
      return evalExpr(expr, data, helpers);
    });
  }

  function applyTokens(root, data, helpers) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var textNodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.indexOf('{{') !== -1) textNodes.push(walker.currentNode);
    }
    textNodes.forEach(function (node) {
      node.nodeValue = replaceTokens(node.nodeValue, data, helpers);
    });

    var all = root.querySelectorAll('*');
    Array.prototype.forEach.call(all, function (el) {
      Array.prototype.forEach.call(el.attributes, function (attr) {
        var v = attr.value;
        if (v && v.indexOf('{{') !== -1) {
          attr.value = replaceTokens(v, data, helpers);
        }
      });
    });
  }

  function evalCondition(expr, data) {
    var tokens = String(expr).split(',').map(function (t) { return t.trim(); }).filter(Boolean);
    return tokens.every(function (tok) {
      if (tok.charAt(0) === '!') {
        return !(data[tok.slice(1)] || '').toString().trim();
      }
      return !!(data[tok] || '').toString().trim();
    });
  }

  function mergeHelpers(builtin, custom) {
    var h = {};
    var k;
    for (k in builtin) if (builtin.hasOwnProperty(k)) h[k] = builtin[k];
    for (k in custom) if (custom.hasOwnProperty(k)) h[k] = custom[k];
    return h;
  }

  /* ------------------------------------------------------------------ */
  /* 行为属性处理                                                        */
  /* ------------------------------------------------------------------ */
  function applyCover(el, data, cfg) {
    return new Promise(function (resolve) {
      var primary = optimizeRemoteImageUrl(data.cover || '', cfg.posterWidth);
      var fallback = cfg.defaultImage || '';
      function placeholder() {
        if (el.tagName === 'IMG') {
          el.crossOrigin = 'anonymous';
          el.referrerPolicy = 'no-referrer';
          el.src = svgPlaceholder(800, 600, '#eef1f3', '#dfe5ea');
        } else {
          el.style.backgroundImage = 'url("' + svgPlaceholder(1600, 900, '#d9dde3', '#aeb6c2') + '")';
        }
        resolve();
      }
      function attempt(url, allowSmall) {
        return new Promise(function (res) {
          if (!url) { res(false); return; }
          var probe = new Image();
          var settled = false, timer = null;
          function done(ok) {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            probe.onload = null; probe.onerror = null;
            res(ok);
          }
          timer = setTimeout(function () { done(false); }, 6000);
          probe.onload = function () {
            if (!allowSmall && !isUsableCoverDimensions(probe, false)) { done(false); return; }
            if (el.tagName === 'IMG') {
              el.crossOrigin = 'anonymous';
              el.referrerPolicy = 'no-referrer';
              el.src = url;
            } else {
              el.style.backgroundImage = 'url("' + url + '")';
            }
            done(true);
          };
          probe.onerror = function () { done(false); };
          setImageCorsMode(probe, url);
          probe.referrerPolicy = 'no-referrer';
          probe.src = url;
          if (probe.complete) setTimeout(probe.onload, 0);
        });
      }
      attempt(primary, false).then(function (ok) {
        if (ok) return resolve();
        return attempt(fallback, true).then(function (ok2) {
          if (!ok2) placeholder();
          resolve();
        });
      });
    });
  }

  function applyQr(el, data) {
    var size = parseInt(el.getAttribute('data-pg-qr-size'), 10);
    if (!size || size < 10) size = el.clientWidth || 120;
    size = Math.max(40, size);
    // 二维码配色：模板可用 data-pg-qr-color（前景）/ data-pg-qr-bg（背景）指定，缺省黑/白
    var colorDark = (el.getAttribute('data-pg-qr-color') || '#000000').trim();
    var colorLight = (el.getAttribute('data-pg-qr-bg') || '#ffffff').trim();
    try {
      el.innerHTML = '';
      new QRCode(el, {
        text: data.url || location.href,
        width: size, height: size,
        colorDark: colorDark, colorLight: colorLight,
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      console.error('QRCode error', e);
    }
  }

  function applyDate(el, data) {
    var d = parseDate(data.date);
    if (!d) return;
    var variant = el.getAttribute('data-pg-date-variant') || 'default';
    var arr = variant === 'upper' ? MONTHS_UP : MONTHS_SHORT;
    var dayEl = el.querySelector('[data-pg-date-day]');
    var myEl = el.querySelector('[data-pg-date-monthyear]');
    if (dayEl) dayEl.textContent = String(d.getDate());
    if (myEl) myEl.textContent = arr[d.getMonth()] + '.' + d.getFullYear();
  }

  function applyFavicon(el, data) {
    return new Promise(function (resolve) {
      var useAuthor = !!(data.author || '').trim() && !!(data.authorAvatar || '').trim();
      var url, type;
      if (useAuthor) { url = data.authorAvatar; type = 'avatar'; }
      else if (data.logo) { url = data.logo; type = 'favicon'; }
      else { el.style.display = 'none'; return resolve(); }

      var settled = false, timer = null;
      function finish(ok) {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        el.onload = null; el.onerror = null;
        if (ok) {
          el.className = ((el.className || '').replace(/\bis-(avatar|favicon)\b/g, '') + (type === 'avatar' ? ' is-avatar' : ' is-favicon')).trim();
          el.alt = type === 'avatar' ? (data.author || '作者') : (data.siteName || '站点');
          el.style.display = 'block';
        } else {
          el.style.display = 'none';
        }
        resolve();
      }
      el.onload = function () { finish(el.naturalWidth > 0); };
      el.onerror = function () { finish(false); };
      timer = setTimeout(function () { finish(false); }, 2200);
      setImageCorsMode(el, url);
      el.referrerPolicy = 'no-referrer';
      el.src = url;
      if (el.complete) setTimeout(el.onload, 0);
    });
  }

  function applyBehaviors(root, data, cfg, helpers) {
    var promises = [];

    root.querySelectorAll('[data-pg-text]').forEach(function (el) {
      el.textContent = evalExpr(el.getAttribute('data-pg-text'), data, helpers);
      el.removeAttribute('data-pg-text');
    });

    root.querySelectorAll('[data-pg-if]').forEach(function (el) {
      if (!evalCondition(el.getAttribute('data-pg-if'), data)) el.style.display = 'none';
      el.removeAttribute('data-pg-if');
    });

    root.querySelectorAll('[data-pg-cover]').forEach(function (el) {
      promises.push(applyCover(el, data, cfg));
      el.removeAttribute('data-pg-cover');
    });

    root.querySelectorAll('[data-pg-img]').forEach(function (el) {
      var f = el.getAttribute('data-pg-img');
      var v = data[f] || '';
      if (!v) {
        el.style.display = 'none';
      } else {
        el.setAttribute('crossorigin', 'anonymous');
        el.src = v;
      }
      el.removeAttribute('data-pg-img');
    });

    root.querySelectorAll('[data-pg-qr]').forEach(function (el) {
      applyQr(el, data);
      el.removeAttribute('data-pg-qr');
      el.removeAttribute('data-pg-qr-size');
      el.removeAttribute('data-pg-qr-color');
      el.removeAttribute('data-pg-qr-bg');
    });

    root.querySelectorAll('[data-pg-date]').forEach(function (el) {
      applyDate(el, data);
      el.removeAttribute('data-pg-date');
      el.removeAttribute('data-pg-date-variant');
    });

    root.querySelectorAll('[data-pg-favicon]').forEach(function (el) {
      promises.push(applyFavicon(el, data));
      el.removeAttribute('data-pg-favicon');
    });

    return promises;
  }

  /* ------------------------------------------------------------------ */
  /* 模板加载 & 渲染                                                     */
  /* ------------------------------------------------------------------ */
  var templateCache = {};

  // 把 CSS/HTML 中的相对资源路径改写为基于模板目录的绝对路径，
  // 解决模板注入主页面后，相对路径按主页面 URL 解析、在二级路径下加载错位的问题。
  function isAbsRef(ref) {
    return /^(https?:|data:|blob:|#|\/\/|\/)/i.test(ref);
  }
  function absolutizeUrls(css, dir) {
    return css.replace(/url\(\s*(['"]?)([^'")#?]+)\1\s*\)/g, function (m, q, ref) {
      if (isAbsRef(ref)) return m;
      return 'url(' + q + dir + ref + q + ')';
    });
  }
  function absolutizeHtmlRefs(html, dir) {
    return html.replace(/(\s(?:src|href|poster)\s*=\s*)(["'])([^"']+)\2/gi, function (m, pre, q, ref) {
      if (isAbsRef(ref)) return m;
      return pre + q + dir + ref + q;
    });
  }

  function fetchTemplate(name, base) {
    base = base || 'tpl';
    var key = base + '/' + name;
    if (templateCache[key]) return Promise.resolve(templateCache[key]);

    if (typeof fetch === 'undefined') {
      return Promise.reject(new Error('当前环境不支持 fetch，无法加载模板文件（请用 http 服务访问）'));
    }
    var url = base + '/' + encodeURIComponent(name) + '/index.html';
    // 模板目录绝对 URL：把模板内相对图片路径改写为基于该目录的绝对路径
    var tplDir = (typeof location !== 'undefined' && location.href)
      ? new URL(url, location.href).href.replace(/index\.html$/, '')
      : base + '/' + name + '/';
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('模板文件不存在或加载失败: ' + url + ' (' + r.status + ')');
      return r.text();
    }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var styleText = '';
      doc.querySelectorAll('style').forEach(function (s) { styleText += s.textContent + '\n'; });
      styleText = absolutizeUrls(styleText, tplDir);   // 相对 url(...) -> 绝对路径

      var rootEl = doc.querySelector('.pg-root');
      if (!rootEl) throw new Error('模板缺少 .pg-root 根元素: ' + name);
      var rootHtml = absolutizeHtmlRefs(rootEl.outerHTML, tplDir);   // 相对 src/href/poster -> 绝对路径

      // 执行模板内联脚本，注册自定义扩展函数 / onRender 钩子
      doc.querySelectorAll('script:not([src])').forEach(function (sc) {
        try { (0, eval)(sc.textContent); } catch (e) { console.warn('模板脚本执行失败', name, e); }
      });

      var entry = (window.PosterCardTpl && window.PosterCardTpl[name]) || {};
      var tpl = {
        name: name,
        label: entry.label || name,
        backgroundColor: entry.backgroundColor || null,
        styleText: styleText,
        rootHtml: rootHtml,
        helpers: entry.helpers || {},
        onRender: entry.onRender || null
      };
      templateCache[key] = tpl;
      return tpl;
    });
  }

  function renderTemplate(name, data, style, cfg, templateBase) {
    return fetchTemplate(name, templateBase).then(function (tpl) {
      var styleTag = document.createElement('style');
      styleTag.setAttribute('data-pg-tpl', name);
      styleTag.textContent = tpl.styleText;
      document.head.appendChild(styleTag);

      var tmp = document.createElement('div');
      tmp.innerHTML = tpl.rootHtml;
      var root = tmp.firstElementChild;
      if (!root) throw new Error('模板解析失败: ' + name);

      var width = clampWidth(style && style.width);
      if (width) root.style.width = width + 'px';

      var helpers = mergeHelpers(builtinHelpers, tpl.helpers);
      applyTokens(root, data, helpers);
      var promises = applyBehaviors(root, data, cfg, helpers);

      if (typeof tpl.onRender === 'function') {
        // onRender 可能需要读取真实布局（offsetTop / offsetHeight / offsetParent 等）。
        // 若在游离节点上调用，这些值全为 0（如票根缺口 --notch-y 会算成 0px）。
        // 因此先把 root 挂到离屏容器（保留布局、不可见）再测量；
        // onRender 写入的内联 CSS 变量（--u / --notch-y 等）会随节点移动保留。
        var measureMount = createEl('div');
        measureMount.style.cssText = 'position:fixed;top:-10000px;left:-10000px;opacity:1;pointer-events:none;z-index:-1;';
        measureMount.appendChild(root);
        document.body.appendChild(measureMount);
        try { tpl.onRender(root, data, { helpers: helpers }); } catch (e) { console.warn(e); }
        try { measureMount.removeChild(root); } catch (_) { }
        try { document.body.removeChild(measureMount); } catch (_) { }
      }

      return {
        root: root,
        ready: Promise.all(promises),
        styleTag: styleTag,
        name: name,
        label: tpl.label,
        backgroundColor: tpl.backgroundColor
      };
    });
  }

  /* ------------------------------------------------------------------ */
  /* 配置 & 下载                                                         */
  /* ------------------------------------------------------------------ */
  function buildConfig(options) {
    var style = options.style || {};
    var deps = options.deps || {};
    var assetsBase = (deps.assetsBase || 'assets').replace(/\/+$/, '');
    var defaultCover = style.defaultCover || '';
    return {
      posterWidth: clampWidth(style.width),
      defaultImage: defaultCover || (assetsBase + '/postercard.webp'),
      assetsBase: assetsBase
    };
  }

  function triggerDownload(dataUrl, filename) {
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename || 'postercard.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // 解析元素的 4 个角圆角半径(px)：topLeft / topRight / bottomRight / bottomLeft
  function parseBorderRadii(cs) {
    if (!cs) return [0, 0, 0, 0];
    var tl = parseFloat(cs.borderTopLeftRadius) || 0;
    var tr = parseFloat(cs.borderTopRightRadius) || 0;
    var br = parseFloat(cs.borderBottomRightRadius) || 0;
    var bl = parseFloat(cs.borderBottomLeftRadius) || 0;
    return [tl, tr, br, bl];
  }

  // 在 ctx 上描绘一个「四角半径可不同」的圆角矩形子路径（不闭合填充，由调用方决定）
  function roundRectPath(ctx, x, y, w, h, r) {
    var tl = r[0] || 0, tr = r[1] || 0, br = r[2] || 0, bl = r[3] || 0;
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    if (tr) ctx.arcTo(x + w, y, x + w, y + tr, tr);
    ctx.lineTo(x + w, y + h - br);
    if (br) ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    ctx.lineTo(x + bl, y + h);
    if (bl) ctx.arcTo(x, y + h, x, y + h - bl, bl);
    ctx.lineTo(x, y + tl);
    if (tl) ctx.arcTo(x, y, x + tl, y, tl);
    ctx.closePath();
  }

  // 将画布四角擦成透明，使其与根节点的 border-radius 完全吻合。
  // html2canvas 不会对根元素背景做圆角裁剪，故需手动处理。
  function eraseCanvasCorners(canvas, radii, scale) {
    try {
      var ctx = canvas.getContext('2d');
      if (!ctx) return;
      var W = canvas.width, H = canvas.height;
      var r = radii.map(function (v) { return Math.max(0, v * scale); });
      // 四角均为 0 则无需处理
      if (!(r[0] || r[1] || r[2] || r[3])) return;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.rect(0, 0, W, H);            // 外框（整个画布）
      roundRectPath(ctx, 0, 0, W, H, r); // 内框（圆角矩形，与根节点边角一致）
      ctx.fill('evenodd');            // evenodd：仅保留外框与内框之间的「角」区域并擦除
      ctx.restore();
    } catch (_) { /* 擦除失败不应阻断导出 */ }
  }

  /* ------------------------------------------------------------------ */
  /* 生成主流程                                                          */
  /* ------------------------------------------------------------------ */
  function generate(options) {
    options = options || {};
    var fields = options.fields || {};
    var style = options.style || {};
    var output = options.output || {};
    var deps = options.deps || {};
    var template = style.template || 'default';
    var templateBase = deps.templateBase || 'tpl';
    var resolvedLabel = template;
    var resolvedBg = '#ffffff';
    // 圆角透明边角：模板根节点自带非 0 圆角时，导出画布背景置透明并擦除四角，
    // 使圆角外为透明（html2canvas 不会对根元素背景做圆角裁剪，需手动擦除）。
    var scale = 1;
    var rootRadii = [0, 0, 0, 0];      // 根节点实际生效的四角半径(px)
    var forceTransparent = false;      // 是否需要把画布背景设为透明并擦除圆角

    var cfg = buildConfig(options);
    var filename = output.filename || 'postercard.png';

    try {
      checkDepsReady();
    } catch (err) {
      setLoading(false);
      return Promise.reject(err);
    }

    setLoading(true, '海报生成中...');

    var data = {
      title: fields.title || '',
      summary: fields.summary || '',
      cover: fields.cover || '',
      url: fields.url || location.href,
      siteName: fields.siteName || '',
      logo: fields.logo || '',
      author: fields.author || '',
      authorAvatar: fields.authorAvatar || '',
      date: fields.date || '',
      brandDesc: fields.brandDesc || ''
    };

    var dom;
    return renderTemplate(template, data, style, cfg, templateBase).then(function (rendered) {
      var staging = createEl('div', 'pg-staging');
      staging.appendChild(rendered.root);
      document.body.appendChild(staging);
      dom = { staging: staging, root: rendered.root, ready: rendered.ready, styleTag: rendered.styleTag };
      resolvedLabel = rendered.label || template;
      resolvedBg = rendered.backgroundColor || '#ffffff';

      // 圆角透明边角：读取根节点实际圆角（模板自带），随后在导出画布上手动擦除四角。
      // html2canvas 不会对根元素背景做圆角裁剪，故需手动擦除使圆角外透明。
      var cs = (window.getComputedStyle && rendered.root) ? window.getComputedStyle(rendered.root) : null;
      if (cs) {
        var tr = parseBorderRadii(cs);
        if (tr[0] || tr[1] || tr[2] || tr[3]) rootRadii = tr;
      }
      forceTransparent = !!(rootRadii[0] || rootRadii[1] || rootRadii[2] || rootRadii[3]);

      return Promise.resolve(dom.ready).then(function () {
        // 等待所有图片（封面/头像/logo 等）真正布局完成，避免根节点高度偏小导致底部被截断
        return waitForImages(dom.root, 8000).then(function () {
          // 写死 aspect-ratio 元素的确定高度，避免 html2canvas 重排塌陷（部分主题底部被截断）
          freezeAspectRatioHeights(dom.root);

          // 缩放在最终布局确定后再算：图片加载 / aspect-ratio 写死后才能量到真实高度，
          // 否则会按塌陷前的矮高度估算，导致导出分辨率或尺寸偏差。
          var dpr = (window.devicePixelRatio || 1);
          // 缩放倍数直接采用设备像素比：标准屏(dpr=1)导出宽度与设定宽度 1:1 一致；
          // HiDPI 屏按设备分辨率渲染更清晰。不再强制 1.5 倍，否则设定宽度会被静默放大。
          var baseScale = dpr;
          var maxPixels = 2.5e6;
          var rect = dom.root.getBoundingClientRect();
          var estPixels = rect.width * rect.height * baseScale * baseScale;
          scale = baseScale;
          if (estPixels > maxPixels) {
            scale = Math.max(1, Math.sqrt(maxPixels / (rect.width * rect.height)));
          }

          return html2canvas(dom.root, {
            useCORS: true,
            backgroundColor: forceTransparent ? null : resolvedBg,
            scale: scale,
            willReadFrequently: true
          });
        });
      });
    }).then(function (canvas) {
      // 圆角透明边角：手动擦除四角，保证与根节点 border-radius 完全吻合
      if (forceTransparent) eraseCanvasCorners(canvas, rootRadii, scale);
      return new Promise(function (resolve) {
        function done(blob, dataUrl, objectUrl) {
          resolve({
            canvas: canvas,
            blob: blob,
            dataUrl: dataUrl,
            url: objectUrl ? URL.createObjectURL(blob) : dataUrl,
            download: function (fn) { triggerDownload(objectUrl ? URL.createObjectURL(blob) : dataUrl, fn || filename); }
          });
        }
        try {
          if (canvas.toBlob) {
            canvas.toBlob(function (blob) {
              if (blob) return done(blob, canvas.toDataURL('image/png'), true);
              done(null, canvas.toDataURL('image/png'), false);
            }, 'image/png');
            return;
          }
        } catch (_) { }
        done(null, canvas.toDataURL('image/png'), false);
      });
    }).then(function (result) {
      if (output.showModal !== false) {
        var backdrop = ensureModalScaffold();
        ensureModalScaffold._filename = filename;
        var body = backdrop.querySelector('.pg-modal-body');
        var oldImg = body.querySelector('img');
        if (oldImg && oldImg.getAttribute('data-pg-object-url') === '1') {
          try { URL.revokeObjectURL(oldImg.src); } catch (_) { }
        }
        body.innerHTML = '';
        var img = createEl('img');
        img.alt = '生成的海报';
        img.src = result.dataUrl;
        backdrop._pgFit = function () { fitPosterPreview(backdrop, img, template, resolvedLabel, cfg.posterWidth); };
        img.addEventListener('load', backdrop._pgFit);
        body.appendChild(img);
        backdrop._pgFit();
        backdrop.style.display = 'flex';
        var modal = backdrop.querySelector('.pg-modal');
        if (modal && modal.focus) modal.focus();
      }
      return result;
    }).catch(function (err) {
      console.error(err);
      showToast('生成失败');
      throw err;
    }).finally(function () {
      try { if (dom) { dom.staging.remove(); if (dom.styleTag) dom.styleTag.remove(); } } catch (_) { }
      setLoading(false);
    });
  }

  /* ------------------------------------------------------------------ */
  /* 公共 API                                                            */
  /* ------------------------------------------------------------------ */
  function registerHelpers(name, def) {
    window.PosterCardTpl = window.PosterCardTpl || {};
    window.PosterCardTpl[name] = window.PosterCardTpl[name] || {};
    if (def && def.helpers) window.PosterCardTpl[name].helpers = Object.assign({}, window.PosterCardTpl[name].helpers, def.helpers);
    if (def && typeof def.onRender === 'function') window.PosterCardTpl[name].onRender = def.onRender;
    // 模板显示名也可通过此 API 声明，保持与库解耦
    if (def && def.label) window.PosterCardTpl[name].label = def.label;
    return PosterCard;
  }

  return {
    generate: generate,
    renderTemplate: renderTemplate,
    fetchTemplate: fetchTemplate,
    registerHelpers: registerHelpers,
    buildConfig: buildConfig,
    version: '2.0.0'
  };
}));
