<?php
/*
Plugin Name: PosterCard 文章分享海报
Version: 1.1.0
Plugin URL: https://github.com/mengkunsoft/PosterCard
Description: 基于 PosterCard 前端海报库，一键为文章生成精美分享海报（PNG，含二维码）。16 种版式，选项可在后台自定义。
Author: mengkunsoft
Author URL: https://github.com/mengkunsoft
*/

!defined('EMLOG_ROOT') && exit('access denied!');

define('POSTERCARD_EM_VERSION', '1.1.0');
define('POSTERCARD_EM_DEFAULT_ASSET_BASE', 'https://cdn.jsdelivr.net/gh/mengkunsoft/PosterCard@master');

/**
 * 模板清单（name => 中文名）
 */
function postercard_em_templates()
{
    return array(
        'default'   => 'TEPoster',
        'nicetheme' => 'NiceTheme',
        'netease'   => '网易云',
        'minimal'   => '深色卡片',
        'dwqr'      => '闪电博-卡片',
        'dwqr1'     => '闪电博-极光',
        'dwqr2'     => '闪电博-科技蓝',
        'dwqr3'     => '闪电博-绿野仙踪',
        'newspaper' => '经典报纸',
        'classic'   => '经典卡片',
        'collage'   => '杂志拼贴',
        'sidebar'   => '侧边栏',
        'literary'  => '文学',
        'plain'     => '极简白',
        'dark'      => '暗黑科技',
        'doodle'    => '手绘涂鸦',
    );
}

/**
 * 默认配置
 */
function postercard_em_default_config()
{
    return array(
        'template'      => 'default',
        'width'         => 400,
        'auto_insert'   => 1,
        'button_text'   => '生成分享海报',
        'site_name'     => '',
        'logo'          => '',
        'brand_desc'    => '',
        'default_cover' => '',
        'summary_len'   => 120,
        'load_mode'     => 'local',  // local | cdn | custom
        'asset_base'    => '',       // 仅 load_mode=自定义 时使用
    );
}

/**
 * 计算资源基础地址（dist/、tpl/、assets/ 所在目录）
 * - local  ：从插件自身目录加载（插件内已打包 dist/tpl/assets）
 * - cdn    ：jsDelivr CDN（仓库 master）
 * - custom ：用户自定义地址（asset_base 为空时回退 CDN）
 */
function postercard_em_asset_base($cfg)
{
    switch ($cfg['load_mode']) {
        case 'cdn':
            return POSTERCARD_EM_DEFAULT_ASSET_BASE;
        case 'custom':
            $b = trim($cfg['asset_base']);
            return $b !== '' ? rtrim($b, '/') : POSTERCARD_EM_DEFAULT_ASSET_BASE;
        case 'local':
        default:
            return rtrim(BLOG_URL, '/') . '/content/plugins/postercard';
    }
}

/**
 * 读取配置（Storage 存储，键：config）
 */
function postercard_em_get_config()
{
    $storage = Storage::getInstance('postercard');
    $saved   = $storage->getValue('config');
    $config  = postercard_em_default_config();
    if (is_array($saved)) {
        foreach ($config as $k => $v) {
            if (isset($saved[$k])) {
                $config[$k] = $saved[$k];
            }
        }
    }
    return $config;
}

/**
 * 文章内容取第一张图作为封面
 */
function postercard_em_first_image($content)
{
    if ($content && preg_match('/<img[^>]+src=["\']([^"\']+)["\']/i', $content, $m)) {
        return $m[1];
    }
    return '';
}

/**
 * 文章页输出：资源 + 配置 + 按钮 + 绑定脚本（挂载点 log_related）
 */
function postercard_em_show_button($logData)
{
    if (!is_array($logData)) {
        return;
    }
    $cfg  = postercard_em_get_config();
    $base = postercard_em_asset_base($cfg);

    // 兼容不同版本的字段名
    $logid   = isset($logData['logid']) ? intval($logData['logid']) : (isset($logData['gid']) ? intval($logData['gid']) : 0);
    $title   = isset($logData['log_title']) ? $logData['log_title'] : (isset($logData['title']) ? $logData['title'] : '');
    $content = isset($logData['log_content']) ? $logData['log_content'] : (isset($logData['content']) ? $logData['content'] : '');

    // 文章链接
    if (class_exists('Url') && method_exists('Url', 'log')) {
        $permalink = Url::log($logid);
    } else {
        $permalink = BLOG_URL . '?post=' . $logid;
    }

    // 日期（date 可能是时间戳或已格式化字符串）
    $date = '';
    if (isset($logData['date'])) {
        if (is_numeric($logData['date'])) {
            $date = date('Y-m-d', (int)$logData['date']);
        } else {
            $ts = strtotime($logData['date']);
            $date = $ts ? date('Y-m-d', $ts) : '';
        }
    }

    // 摘要：正文去标签后截断
    $summary = trim(preg_replace('/\s+/', ' ', strip_tags($content)));
    $len     = intval($cfg['summary_len']);
    if ($len > 0 && function_exists('mb_substr') && mb_strlen($summary, 'UTF-8') > $len) {
        $summary = mb_substr($summary, 0, $len, 'UTF-8') . '…';
    }

    // 封面：文章首图
    $cover = postercard_em_first_image($content);

    $siteName  = $cfg['site_name'] !== '' ? $cfg['site_name'] : Option::get('blogname');
    $brandDesc = $cfg['brand_desc'] !== '' ? $cfg['brand_desc'] : Option::get('bloginfo');

    $config = array(
        'fields' => array(
            'title'     => $title,
            'summary'   => $summary,
            'cover'     => $cover,
            'url'       => $permalink,
            'siteName'  => $siteName,
            'logo'      => $cfg['logo'],
            'date'      => $date,
            'brandDesc' => $brandDesc,
        ),
        'style' => array(
            'template'     => $cfg['template'],
            'width'        => intval($cfg['width']),
            'defaultCover' => $cfg['default_cover'],
        ),
        'output' => array(
            'showModal' => true,
            'filename'  => 'postercard-' . $logid . '.png',
        ),
        'deps' => array(
            'templateBase' => $base . '/tpl',
            'assetsBase'   => $base . '/assets',
        ),
    );
    $configJson = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);

    // 资源：full 版已内置 html2canvas 与 qrcode.js
    // 这两个标签输出在 log_related（正文容器内）。PJAX 主题建议把它们移到
    // 主题的 head/footer（pjax 容器之外），保证整站只加载一次。
    echo '<link id="postercard-css" rel="stylesheet" href="' . htmlspecialchars($base, ENT_QUOTES) . '/dist/postercard.min.css?v=' . POSTERCARD_EM_VERSION . '">' . "\n";
    echo '<script id="postercard-lib" src="' . htmlspecialchars($base, ENT_QUOTES) . '/dist/postercard.full.min.js?v=' . POSTERCARD_EM_VERSION . '"></script>' . "\n";

    // 配置随按钮输出：pjax 替换正文后，新按钮自带新文章的数据。
    $btnData = ' data-postercard="' . htmlspecialchars($configJson, ENT_QUOTES) . '"';
    if (intval($cfg['auto_insert']) === 1) {
        echo '<p class="postercard-btn-wrap" style="margin-top:16px;">'
            . '<button type="button" class="postercard-btn"' . $btnData . ' style="display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border:1px solid #d0d5da;border-radius:8px;background:#fff;color:#333;font-size:14px;cursor:pointer;">'
            . '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>'
            . htmlspecialchars($cfg['button_text'], ENT_QUOTES) . '</button></p>' . "\n";
    }

    $libUrl = htmlspecialchars($base, ENT_QUOTES) . '/dist/postercard.full.min.js?v=' . POSTERCARD_EM_VERSION;
    // 幂等初始化：pjax 重复执行本段脚本时不会重复绑定 click（否则点一次生成多张海报）。
    // 主题也可在 pjax 完成回调里主动调用 window.PosterCardEMInit()。
    echo <<<PCJS
<script>
window.PosterCardEM = {$configJson};
window.PosterCardEMInit = function () {
  if (window.__postercardBound) return;
  window.__postercardBound = true;
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('.postercard-btn') : null;
    if (!btn) return;
    e.preventDefault();
    if (btn.getAttribute('data-pc-busy') === '1') return;
    var cfg = window.PosterCardEM;
    var raw = btn.getAttribute('data-postercard');
    if (raw) { try { cfg = JSON.parse(raw); } catch (err) {} }
    else if (cfg && cfg.fields) {
      var copy = {}, f = {}, k;
      for (k in cfg) if (Object.prototype.hasOwnProperty.call(cfg, k)) copy[k] = cfg[k];
      for (k in cfg.fields) if (Object.prototype.hasOwnProperty.call(cfg.fields, k)) f[k] = cfg.fields[k];
      f.url = window.location.href;
      copy.fields = f;
      cfg = copy;
    }
    if (!cfg) { console.warn('[PosterCard] 配置未加载'); return; }
    btn.setAttribute('data-pc-busy', '1');
    var done = function () { btn.removeAttribute('data-pc-busy'); };
    var run = function () {
      if (typeof window.PosterCard === 'undefined') { console.warn('[PosterCard] 库未加载'); done(); return; }
      var p = window.PosterCard.generate(cfg);
      if (p && typeof p.finally === 'function') p.finally(done);
      else if (p && typeof p.then === 'function') p.then(done, done);
      else done();
    };
    if (typeof window.PosterCard !== 'undefined') { run(); return; }
    // pjax 从非文章页进入时，正文里的 <script src> 可能未被执行，这里按需补加载一次
    var s = document.getElementById('postercard-lib-dynamic');
    if (!s) {
      s = document.createElement('script');
      s.id = 'postercard-lib-dynamic';
      s.src = '{$libUrl}';
      s.onload = run;
      s.onerror = done;
      document.head.appendChild(s);
    } else {
      s.addEventListener('load', run, { once: true });
    }
  });
};
window.PosterCardEMInit();
</script>
PCJS;
    echo "\n";
}

addAction('log_related', 'postercard_em_show_button');
