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
