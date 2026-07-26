<?php
/**
 * PosterCard 文章分享海报 - 后台设置页（仅管理员可见）
 * 访问地址：/admin/plugin.php?plugin=postercard
 */

!defined('EMLOG_ROOT') && exit('access denied!');

function plugin_setting_view()
{
    require_once dirname(__FILE__) . '/postercard.php';

    $storage = Storage::getInstance('postercard');
    $saved   = false;

    // 保存
    if (!empty($_POST['postercard_save'])) {
        if (class_exists('LoginAuth') && method_exists('LoginAuth', 'checkToken')) {
            LoginAuth::checkToken();
        }
        $templates = postercard_em_templates();
        $template  = isset($_POST['template']) ? trim($_POST['template']) : 'default';
        if (!isset($templates[$template])) {
            $template = 'default';
        }
        $width = isset($_POST['width']) ? intval($_POST['width']) : 400;
        $width = max(240, min(1200, $width));
        $summaryLen = isset($_POST['summary_len']) ? intval($_POST['summary_len']) : 120;
        $summaryLen = max(0, min(500, $summaryLen));
        $buttonText = isset($_POST['button_text']) ? trim(strip_tags($_POST['button_text'])) : '';
        if ($buttonText === '') {
            $buttonText = '生成分享海报';
        }
        $loadMode = isset($_POST['load_mode']) ? trim($_POST['load_mode']) : 'local';
        if (!in_array($loadMode, array('local', 'cdn', 'custom'), true)) {
            $loadMode = 'local';
        }
        $assetBase = isset($_POST['asset_base']) ? trim($_POST['asset_base']) : '';
        $assetBase = rtrim($assetBase, '/');
        if ($assetBase !== '' && !preg_match('#^(https?:)?//#i', $assetBase)) {
            $assetBase = '';
        }

        $config = array(
            'template'      => $template,
            'width'         => $width,
            'auto_insert'   => empty($_POST['auto_insert']) ? 0 : 1,
            'button_text'   => $buttonText,
            'site_name'     => isset($_POST['site_name']) ? trim(strip_tags($_POST['site_name'])) : '',
            'logo'          => isset($_POST['logo']) ? trim(strip_tags($_POST['logo'])) : '',
            'brand_desc'    => isset($_POST['brand_desc']) ? trim(strip_tags($_POST['brand_desc'])) : '',
            'default_cover' => isset($_POST['default_cover']) ? trim(strip_tags($_POST['default_cover'])) : '',
            'summary_len'   => $summaryLen,
            'load_mode'     => $loadMode,
            'asset_base'    => $assetBase,
        );
        $storage->setValue('config', $config, 'array');
        $saved = true;
    }

    $cfg       = postercard_em_get_config();
    $templates = postercard_em_templates();
    $token     = (class_exists('LoginAuth') && method_exists('LoginAuth', 'genToken')) ? LoginAuth::genToken() : '';
    ?>
    <div class="container-fluid p-0">
        <?php if ($saved) : ?>
            <div class="alert alert-success">设置已保存。</div>
        <?php endif; ?>
        <h5 class="mb-3">PosterCard 文章分享海报</h5>
        <p class="text-muted">基于 <a href="https://github.com/mengkunsoft/PosterCard" target="_blank">PosterCard</a> 前端海报库，为文章生成分享海报（含二维码），纯前端出图，不占服务器资源。</p>
        <form method="post" action="./plugin.php?plugin=postercard">
            <?php if ($token !== '') : ?>
                <input type="hidden" name="token" value="<?php echo htmlspecialchars($token, ENT_QUOTES); ?>">
            <?php endif; ?>
            <input type="hidden" name="postercard_save" value="1">

            <div class="form-group row">
                <label class="col-sm-2 col-form-label">海报版式</label>
                <div class="col-sm-6">
                    <select name="template" class="form-control">
                        <?php foreach ($templates as $name => $label) : ?>
                            <option value="<?php echo htmlspecialchars($name, ENT_QUOTES); ?>" <?php echo $cfg['template'] === $name ? 'selected' : ''; ?>>
                                <?php echo htmlspecialchars($name . '（' . $label . '）'); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                    <small class="form-text text-muted">对应 PosterCard 的 tpl/&lt;模板名&gt;，共 16 种版式。</small>
                </div>
            </div>

            <div class="form-group row">
                <label class="col-sm-2 col-form-label">海报宽度（px）</label>
                <div class="col-sm-6">
                    <input type="number" name="width" class="form-control" min="240" max="1200" value="<?php echo intval($cfg['width']); ?>">
                    <small class="form-text text-muted">默认 400，范围 240 - 1200。</small>
                </div>
            </div>

            <div class="form-group row">
                <label class="col-sm-2 col-form-label">自动插入按钮</label>
                <div class="col-sm-6">
                    <div class="form-check mt-2">
                        <input type="checkbox" class="form-check-input" id="pc-auto-insert" name="auto_insert" value="1" <?php echo intval($cfg['auto_insert']) === 1 ? 'checked' : ''; ?>>
                        <label class="form-check-label" for="pc-auto-insert">在文章页自动插入「生成海报」按钮</label>
                    </div>
                    <small class="form-text text-muted">关闭后可在模板中自行放置带 <code>class="postercard-btn"</code> 的按钮。</small>
                </div>
            </div>

            <div class="form-group row">
                <label class="col-sm-2 col-form-label">按钮文字</label>
                <div class="col-sm-6">
                    <input type="text" name="button_text" class="form-control" value="<?php echo htmlspecialchars($cfg['button_text'], ENT_QUOTES); ?>">
                </div>
            </div>

            <div class="form-group row">
                <label class="col-sm-2 col-form-label">站点名（siteName）</label>
                <div class="col-sm-6">
                    <input type="text" name="site_name" class="form-control" value="<?php echo htmlspecialchars($cfg['site_name'], ENT_QUOTES); ?>" placeholder="留空使用博客名称">
                </div>
            </div>

            <div class="form-group row">
                <label class="col-sm-2 col-form-label">站点 Logo（URL）</label>
                <div class="col-sm-6">
                    <input type="url" name="logo" class="form-control" value="<?php echo htmlspecialchars($cfg['logo'], ENT_QUOTES); ?>" placeholder="https://example.com/logo.png（可选）">
                </div>
            </div>

            <div class="form-group row">
                <label class="col-sm-2 col-form-label">品牌描述（brandDesc）</label>
                <div class="col-sm-6">
                    <input type="text" name="brand_desc" class="form-control" value="<?php echo htmlspecialchars($cfg['brand_desc'], ENT_QUOTES); ?>" placeholder="留空使用博客副标题">
                </div>
            </div>

            <div class="form-group row">
                <label class="col-sm-2 col-form-label">默认封面图（URL）</label>
                <div class="col-sm-6">
                    <input type="url" name="default_cover" class="form-control" value="<?php echo htmlspecialchars($cfg['default_cover'], ENT_QUOTES); ?>" placeholder="文章无图时的兜底封面（可选）">
                </div>
            </div>

            <div class="form-group row">
                <label class="col-sm-2 col-form-label">摘要截断长度</label>
                <div class="col-sm-6">
                    <input type="number" name="summary_len" class="form-control" min="0" max="500" value="<?php echo intval($cfg['summary_len']); ?>">
                    <small class="form-text text-muted">0 表示不截断。</small>
                </div>
            </div>

            <div class="form-group row">
                <label class="col-sm-2 col-form-label">资源加载方式</label>
                <div class="col-sm-6">
                    <select name="load_mode" id="pc-load-mode" class="form-control">
                        <option value="local" <?php echo $cfg['load_mode'] === 'local' ? 'selected' : ''; ?>>本地（插件自带资源）</option>
                        <option value="cdn" <?php echo $cfg['load_mode'] === 'cdn' ? 'selected' : ''; ?>>jsDelivr CDN</option>
                        <option value="custom" <?php echo $cfg['load_mode'] === 'custom' ? 'selected' : ''; ?>>自定义地址</option>
                    </select>
                    <small class="form-text text-muted">默认「本地」：直接读取插件内已打包的 dist/、tpl/、assets/，无需联网 CDN。选「自定义地址」时请在下方填写资源基础地址。</small>
                </div>
            </div>

            <div class="form-group row" id="pc-asset-base-row">
                <label class="col-sm-2 col-form-label">自定义资源基础地址</label>
                <div class="col-sm-6">
                    <input type="url" name="asset_base" class="form-control" value="<?php echo htmlspecialchars($cfg['asset_base'], ENT_QUOTES); ?>">
                    <small class="form-text text-muted">加载 PosterCard 库文件（dist/、tpl/、assets/）的基础地址，仅「资源加载方式 = 自定义地址」时生效（留空回退 jsDelivr CDN）。如需自托管请填自己服务器上 PosterCard 仓库文件的地址（末尾不带斜杠）。</small>
                </div>
            </div>

            <div class="form-group row">
                <div class="col-sm-6 offset-sm-2">
                    <button type="submit" class="btn btn-primary">保存设置</button>
                </div>
            </div>
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
