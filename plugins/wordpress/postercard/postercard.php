<?php
/**
 * Plugin Name: PosterCard 文章分享海报
 * Plugin URI:  https://github.com/mengkunsoft/PosterCard
 * Description: 基于 PosterCard 前端海报库，一键为文章生成精美分享海报（PNG，含二维码）。支持 16 种版式，选项可在后台自定义。
 * Version:     1.1.0
 * Author:      mengkunsoft
 * Author URI:  https://github.com/mengkunsoft
 * License:     MIT
 * Text Domain: postercard
 */

if (!defined('ABSPATH')) {
    exit;
}

define('POSTERCARD_WP_VERSION', '1.1.0');
define('POSTERCARD_DEFAULT_ASSET_BASE', 'https://cdn.jsdelivr.net/gh/mengkunsoft/PosterCard@master');

/* ------------------------------------------------------------------ */
/* 模板清单（name => 中文名）                                          */
/* ------------------------------------------------------------------ */
function postercard_templates()
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

/* ------------------------------------------------------------------ */
/* 选项                                                                */
/* ------------------------------------------------------------------ */
function postercard_default_options()
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
function postercard_asset_base($o)
{
    switch ($o['load_mode']) {
        case 'cdn':
            return POSTERCARD_DEFAULT_ASSET_BASE;
        case 'custom':
            $b = trim($o['asset_base']);
            return $b !== '' ? untrailingslashit($b) : POSTERCARD_DEFAULT_ASSET_BASE;
        case 'local':
        default:
            return rtrim(plugins_url('', __FILE__), '/');
    }
}

function postercard_get_options()
{
    $opt = get_option('postercard_options', array());
    return wp_parse_args(is_array($opt) ? $opt : array(), postercard_default_options());
}

/* ------------------------------------------------------------------ */
/* 后台设置页                                                          */
/* ------------------------------------------------------------------ */
add_action('admin_menu', function () {
    add_options_page('PosterCard 海报设置', 'PosterCard 海报', 'manage_options', 'postercard', 'postercard_settings_page');
});

add_action('admin_init', function () {
    register_setting('postercard', 'postercard_options', array(
        'type'              => 'array',
        'sanitize_callback' => 'postercard_sanitize_options',
    ));
});

function postercard_sanitize_options($input)
{
    $d   = postercard_default_options();
    $out = array();
    $tpl = isset($input['template']) ? sanitize_key($input['template']) : $d['template'];
    $out['template']      = array_key_exists($tpl, postercard_templates()) ? $tpl : 'default';
    $out['width']         = max(240, min(1200, intval(isset($input['width']) ? $input['width'] : $d['width'])));
    $out['auto_insert']   = empty($input['auto_insert']) ? 0 : 1;
    $out['button_text']   = sanitize_text_field(isset($input['button_text']) ? $input['button_text'] : $d['button_text']);
    if ($out['button_text'] === '') {
        $out['button_text'] = $d['button_text'];
    }
    $out['site_name']     = sanitize_text_field(isset($input['site_name']) ? $input['site_name'] : '');
    $out['logo']          = esc_url_raw(isset($input['logo']) ? $input['logo'] : '');
    $out['brand_desc']    = sanitize_text_field(isset($input['brand_desc']) ? $input['brand_desc'] : '');
    $out['default_cover'] = esc_url_raw(isset($input['default_cover']) ? $input['default_cover'] : '');
    $out['summary_len']   = max(0, min(500, intval(isset($input['summary_len']) ? $input['summary_len'] : $d['summary_len'])));
    $mode                 = isset($input['load_mode']) ? sanitize_key($input['load_mode']) : $d['load_mode'];
    $out['load_mode']     = in_array($mode, array('local', 'cdn', 'custom'), true) ? $mode : 'local';
    $base                 = esc_url_raw(isset($input['asset_base']) ? $input['asset_base'] : $d['asset_base']);
    $out['asset_base']    = $base !== '' ? untrailingslashit($base) : '';
    return $out;
}

function postercard_settings_page()
{
    if (!current_user_can('manage_options')) {
        return;
    }
    $o = postercard_get_options();
    ?>
    <div class="wrap">
        <h1>PosterCard 海报设置</h1>
        <p>基于 <a href="https://github.com/mengkunsoft/PosterCard" target="_blank">PosterCard</a> 前端海报库，为文章生成分享海报（含二维码）。</p>
        <form method="post" action="options.php">
            <?php settings_fields('postercard'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="pc-template">海报版式</label></th>
                    <td>
                        <select id="pc-template" name="postercard_options[template]">
                            <?php foreach (postercard_templates() as $name => $label) : ?>
                                <option value="<?php echo esc_attr($name); ?>" <?php selected($o['template'], $name); ?>>
                                    <?php echo esc_html($name . '（' . $label . '）'); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <p class="description">对应 PosterCard 的 tpl/&lt;模板名&gt;，共 16 种版式。</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="pc-width">海报宽度（px）</label></th>
                    <td><input id="pc-width" type="number" min="240" max="1200" name="postercard_options[width]" value="<?php echo esc_attr($o['width']); ?>" class="small-text"> <span class="description">默认 400，范围 240 - 1200。</span></td>
                </tr>
                <tr>
                    <th scope="row">自动插入按钮</th>
                    <td>
                        <label><input type="checkbox" name="postercard_options[auto_insert]" value="1" <?php checked($o['auto_insert'], 1); ?>> 在文章内容底部自动插入「生成海报」按钮</label>
                        <p class="description">关闭后可在文章中使用短代码 <code>[postercard]</code> 手动放置按钮，或自行给元素加 <code>class="postercard-btn"</code>。</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="pc-btn-text">按钮文字</label></th>
                    <td><input id="pc-btn-text" type="text" name="postercard_options[button_text]" value="<?php echo esc_attr($o['button_text']); ?>" class="regular-text"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="pc-site-name">站点名（siteName）</label></th>
                    <td><input id="pc-site-name" type="text" name="postercard_options[site_name]" value="<?php echo esc_attr($o['site_name']); ?>" class="regular-text" placeholder="<?php echo esc_attr(get_bloginfo('name')); ?>"> <span class="description">留空使用站点标题。</span></td>
                </tr>
                <tr>
                    <th scope="row"><label for="pc-logo">站点 Logo（URL）</label></th>
                    <td><input id="pc-logo" type="url" name="postercard_options[logo]" value="<?php echo esc_attr($o['logo']); ?>" class="regular-text" placeholder="https://example.com/logo.png"> <span class="description">可选，部分版式展示。</span></td>
                </tr>
                <tr>
                    <th scope="row"><label for="pc-brand-desc">品牌描述（brandDesc）</label></th>
                    <td><input id="pc-brand-desc" type="text" name="postercard_options[brand_desc]" value="<?php echo esc_attr($o['brand_desc']); ?>" class="regular-text" placeholder="<?php echo esc_attr(get_bloginfo('description')); ?>"> <span class="description">留空使用站点副标题。</span></td>
                </tr>
                <tr>
                    <th scope="row"><label for="pc-default-cover">默认封面图（URL）</label></th>
                    <td><input id="pc-default-cover" type="url" name="postercard_options[default_cover]" value="<?php echo esc_attr($o['default_cover']); ?>" class="regular-text" placeholder="https://example.com/default.jpg"> <span class="description">文章无特色图片/首图时的兜底封面，可选。</span></td>
                </tr>
                <tr>
                    <th scope="row"><label for="pc-summary-len">摘要截断长度</label></th>
                    <td><input id="pc-summary-len" type="number" min="0" max="500" name="postercard_options[summary_len]" value="<?php echo esc_attr($o['summary_len']); ?>" class="small-text"> <span class="description">0 表示不截断。</span></td>
                </tr>
                <tr>
                    <th scope="row"><label for="pc-load-mode">资源加载方式</label></th>
                    <td>
                        <select id="pc-load-mode" name="postercard_options[load_mode]">
                            <option value="local" <?php selected($o['load_mode'], 'local'); ?>>本地（插件自带资源）</option>
                            <option value="cdn" <?php selected($o['load_mode'], 'cdn'); ?>>jsDelivr CDN</option>
                            <option value="custom" <?php selected($o['load_mode'], 'custom'); ?>>自定义地址</option>
                        </select>
                        <p class="description">默认「本地」：直接读取插件内已打包的 <code>dist/</code>、<code>tpl/</code>、<code>assets/</code>，无需联网 CDN。选「自定义地址」时请在下方填写资源基础地址。</p>
                    </td>
                </tr>
                <tr id="pc-asset-base-row">
                    <th scope="row"><label for="pc-asset-base">自定义资源基础地址</label></th>
                    <td>
                        <input id="pc-asset-base" type="url" name="postercard_options[asset_base]" value="<?php echo esc_attr($o['asset_base']); ?>" class="large-text">
                        <p class="description">加载 PosterCard 库文件（dist/、tpl/、assets/）的基础地址，仅「资源加载方式 = 自定义地址」时生效（留空回退 jsDelivr CDN）。<br>
                        如需自托管，请把 PosterCard 仓库文件放到你的服务器（需支持跨域或同域访问），填写对应地址（末尾不带斜杠）。</p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
        <script>
            (function () {
                var sel = document.getElementById('pc-load-mode');
                var row = document.getElementById('pc-asset-base-row');
                if (!sel || !row) return;
                function toggle() { row.style.display = sel.value === 'custom' ? '' : 'none'; }
                sel.addEventListener('change', toggle);
                toggle();
            })();
        </script>
    </div>
    <?php
}

add_filter('plugin_action_links_' . plugin_basename(__FILE__), function ($links) {
    array_unshift($links, '<a href="' . esc_url(admin_url('options-general.php?page=postercard')) . '">设置</a>');
    return $links;
});

/* ------------------------------------------------------------------ */
/* 前台：资源加载 & 数据注入                                           */
/* ------------------------------------------------------------------ */
function postercard_first_image_in_content($content)
{
    if (preg_match('/<img[^>]+src=["\']([^"\']+)["\']/i', $content, $m)) {
        return $m[1];
    }
    return '';
}

add_action('wp_enqueue_scripts', function () {
    if (!is_singular()) {
        return;
    }
    $o    = postercard_get_options();
    $base = postercard_asset_base($o);

    wp_enqueue_style('postercard', $base . '/dist/postercard.min.css', array(), POSTERCARD_WP_VERSION);
    // full 版已内置 html2canvas 与 qrcode.js
    wp_enqueue_script('postercard', $base . '/dist/postercard.full.min.js', array(), POSTERCARD_WP_VERSION, true);
    wp_enqueue_script('postercard-init', plugins_url('assets/init.js', __FILE__), array('postercard'), POSTERCARD_WP_VERSION, true);

    $post = get_queried_object();
    if (!$post instanceof WP_Post) {
        return;
    }

    $cover = get_the_post_thumbnail_url($post, 'large');
    if (!$cover) {
        $cover = postercard_first_image_in_content($post->post_content);
    }

    $summary = wp_strip_all_tags(get_the_excerpt($post));
    if ($o['summary_len'] > 0 && function_exists('mb_substr') && mb_strlen($summary) > $o['summary_len']) {
        $summary = mb_substr($summary, 0, $o['summary_len']) . '…';
    }

    $config = array(
        'fields' => array(
            'title'        => get_the_title($post),
            'summary'      => $summary,
            'cover'        => $cover ? $cover : '',
            'url'          => get_permalink($post),
            'siteName'     => $o['site_name'] !== '' ? $o['site_name'] : get_bloginfo('name'),
            'logo'         => $o['logo'],
            'author'       => get_the_author_meta('display_name', $post->post_author),
            'authorAvatar' => get_avatar_url($post->post_author, array('size' => 96)),
            'date'         => get_the_date('Y-m-d', $post),
            'brandDesc'    => $o['brand_desc'] !== '' ? $o['brand_desc'] : get_bloginfo('description'),
        ),
        'style' => array(
            'template'     => $o['template'],
            'width'        => intval($o['width']),
            'defaultCover' => $o['default_cover'],
        ),
        'output' => array(
            'showModal' => true,
            'filename'  => 'postercard-' . $post->ID . '.png',
        ),
        'deps' => array(
            'templateBase' => $base . '/tpl',
            'assetsBase'   => $base . '/assets',
        ),
    );
    wp_localize_script('postercard-init', 'PosterCardWP', $config);
});

/* ------------------------------------------------------------------ */
/* 前台：按钮（自动插入 + 短代码）                                     */
/* ------------------------------------------------------------------ */
function postercard_button_html($text = '')
{
    $o = postercard_get_options();
    if ($text === '') {
        $text = $o['button_text'];
    }
    return '<button type="button" class="postercard-btn" style="display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border:1px solid #d0d5da;border-radius:8px;background:#fff;color:#333;font-size:14px;cursor:pointer;">'
        . '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>'
        . esc_html($text) . '</button>';
}

add_filter('the_content', function ($content) {
    $o = postercard_get_options();
    if (!$o['auto_insert'] || !is_singular() || !in_the_loop() || !is_main_query()) {
        return $content;
    }
    return $content . '<p class="postercard-btn-wrap" style="margin-top:16px;">' . postercard_button_html() . '</p>';
});

add_shortcode('postercard', function ($atts) {
    if (!is_singular()) {
        return '';
    }
    $atts = shortcode_atts(array('text' => ''), $atts, 'postercard');
    return postercard_button_html($atts['text']);
});
