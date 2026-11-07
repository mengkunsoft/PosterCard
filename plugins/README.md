# PosterCard 博客插件

基于 PosterCard 前端海报库的现成插件，一键为文章生成分享海报（PNG，含二维码）。全部选项均可在后台自定义。

| 目录 | 平台 | 说明 |
| --- | --- | --- |
| `wordpress/postercard/` | WordPress ≥ 5.0（PHP ≥ 7.0） | 后台「设置 → PosterCard 海报」 |
| `emlog/postercard/` | emlog pro | 后台「插件 → PosterCard 文章分享海报 → 设置」 |

## 功能

- 文章页自动插入「生成分享海报」按钮（可关闭，改为手动放置）
- 自动读取文章标题、摘要、封面（特色图片 / 首图）、作者、日期，二维码指向文章链接
- 16 种海报版式，纯前端出图，不占服务器资源
- 后台可自定义：版式、海报宽度、按钮文字、站点名、Logo、品牌描述、默认封面、摘要截断长度、资源加载方式

## 安装

### WordPress

1. 把 `wordpress/postercard/` 整个文件夹上传到 `wp-content/plugins/`；
2. 后台「插件」页面启用「PosterCard 文章分享海报」；
3. 到「设置 → PosterCard 海报」按需配置。

手动放置按钮：关闭「自动插入按钮」后，在文章中使用短代码 `[postercard]`（可带文字 `[postercard text="生成海报"]`），或在主题模板里输出任意带 `class="postercard-btn"` 的元素。

### emlog pro

1. 把 `emlog/postercard/` 整个文件夹上传到 `content/plugins/`；
2. 后台「插件」页面激活「PosterCard 文章分享海报」；
3. 点击插件的「设置」按需配置（地址：`/admin/plugin.php?plugin=postercard`）。

按钮通过 `log_related` 挂载点输出在文章详情页（需模板保留该标准挂载点）。关闭「自动插入按钮」后，可在模板中自行放置带 `class="postercard-btn"` 的元素。

## 资源加载方式（后台可切换）

后台「资源加载方式」提供三种模式，默认 **本地（插件自带资源）**：

| 模式 | 说明 |
| --- | --- |
| **本地（插件自带资源）** | 从插件自身的 `dist/`、`tpl/`、`assets/` 目录加载，完全不依赖外部 CDN，适合内网 / 无外网环境。发布包已内置这些文件。 |
| **jsDelivr CDN** | 从官方 CDN 加载：`https://cdn.jsdelivr.net/gh/mengkunsoft/PosterCard@master` |
| **自定义地址** | 填写你自托管 PosterCard 仓库文件的地址（末尾不带斜杠），例如 `https://your-domain.com/static/PosterCard`；留空则回退 jsDelivr CDN。跨域场景需允许 CORS。 |

无论哪种模式，插件都会加载以下文件（相对基础地址）：

- `dist/postercard.full.min.js`（一体化版，已内置 html2canvas 与 qrcode.js）
- `dist/postercard.min.css`
- `tpl/<模板名>/index.html`（海报模板，运行时 fetch）
- `assets/postercard.webp`（封面兜底占位图）

### 本地模式的文件从哪来

开发 / 安装时，插件目录里**不需要**手动放这些文件——它们由发布流程自动生成并打包进发布 zip：

```
npm run pack        # 1) 构建 dist/  2) 把 dist/ tpl/ assets/ 复制进插件  3) 把插件打成 releases/*.zip
```

`releases/postercard-wordpress.zip`、`releases/postercard-emlog.zip` 即开箱即用的完整插件包，解压后自带全部运行资源，本地模式可直接工作。

> 仓库中插件目录的 `dist/`、`tpl/`、`assets/vendor/`、`assets/postercard.webp` 由打包脚本生成、已加入 `.gitignore`，不入库；仅 WordPress 插件的源文件 `assets/init.js` 入库。

## PJAX / 无刷新主题

pjax 只替换正文容器，`<head>` / footer 里的脚本不会重新执行，所以「按文章在服务端注入一次全局配置」的写法会失效：跳到第二篇文章后，生成的仍是第一篇的标题、封面、二维码和文件名。容器内的脚本若被重复执行，还会造成点击一次生成多张海报。

插件已内置兼容，**大多数 pjax 主题无需任何额外配置**，遵循三条原则：

1. **资源只加载一次、放在 pjax 容器之外**。库脚本（`postercard.full.min.js`）与样式由 WordPress 的 `wp_enqueue_scripts` 输出在 head/footer，天然不会被替换。
2. **文章数据随按钮一起输出**。自动插入的按钮和短代码按钮都带 `data-postercard`（当前文章的完整配置 JSON），pjax 换掉正文时新按钮自带新数据，不再依赖只注入一次的全局对象。
3. **`document` 级事件委托且只绑一次**。委托挂在不会被替换的 `document` 上，并用 `__postercardBound` 做幂等；脚本在 `DOMContentLoaded` 之后才被注入也不会漏绑定。

因此**不需要**监听 `pjax:complete` / `pjax:end` 去重新初始化，也不需要重新加载模板（库内部的模板缓存可跨页面复用）。

### 主题里手动放置按钮

不带 `data-postercard` 的手写按钮会回退到整页渲染时注入的全局配置，此时只把二维码链接纠正为当前页地址，**标题、封面等仍是首次加载那篇文章的**。pjax 主题若手动放置按钮，请同时输出配置：

```html
<button type="button" class="postercard-btn"
        data-postercard='{"fields":{"title":"文章标题","url":"https://example.com/post/2","cover":"..."},"style":{"template":"default"},"deps":{"templateBase":"/postercard/tpl","assetsBase":"/postercard/assets"}}'>
  生成分享海报
</button>
```

> 配置由服务端按当前文章生成，用 `json_encode(..., JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)` 再用 `esc_attr` / `htmlspecialchars` 转义后写入属性。

### emlog 主题的额外注意

emlog 插件的资源标签和初始化脚本都输出在 `log_related` 挂载点（正文容器内）。若主题的 pjax **不执行**容器内脚本，从首页无刷新进入文章页时按钮会没有反应，按下面任一方式处理：

- 把下面两个标签移到主题的 `head` / footer（pjax 容器之外），全站加载一次：

  ```html
  <link rel="stylesheet" href="/content/plugins/postercard/dist/postercard.min.css">
  <script src="/content/plugins/postercard/dist/postercard.full.min.js"></script>
  ```

- 或在 pjax 完成回调里调用幂等的初始化函数（重复调用无副作用）：

  ```js
  $(document).on('pjax:complete', function () {
    if (window.PosterCardEMInit) window.PosterCardEMInit();
  });
  ```

  若 `PosterCardEMInit` 不存在（连内联脚本都没执行过），说明主题把正文里的 `<script>` 一起丢弃了，此时需采用上一种方式，并在主题 footer 自行注册 click 委托或改用手动按钮。

另外，点击时若检测到 `window.PosterCard` 未定义，插件会按需动态补加载一次库脚本，覆盖「pjax 执行了内联脚本但没执行 `<script src>`」的情况。

### 自己写调用代码时

- `fields.url` 不传即可，库会取 `location.href`；pjax 的 `pushState` 会同步更新它。
- 不要把 `PosterCard.generate(options)` 的 `options` 在页面初始化时缓存成一个固定对象；应在点击时按当前文章重新构造。
- 弹窗、遮罩、加载层由库挂在 `document.body` 上并按类名复用；即使某主题整体替换了 `body` 内容，再次生成时会自动重建，全局 `keydown` / `resize` 监听也只注册一次。
