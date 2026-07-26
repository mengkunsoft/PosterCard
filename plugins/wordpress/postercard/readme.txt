=== PosterCard 文章分享海报 ===
Contributors: mengkunsoft
Tags: poster, share, qrcode, share-card
Requires at least: 5.0
Tested up to: 6.7
Requires PHP: 7.0
Stable tag: 1.1.0
License: MIT

基于 PosterCard 前端海报库，一键为文章生成精美分享海报（PNG，含二维码）。

== Description ==

* 16 种海报版式，纯前端生成，不占用服务器资源
* 自动读取文章标题、摘要、特色图片、作者、日期、链接二维码
* 文章底部自动插入「生成分享海报」按钮，也可用短代码 `[postercard]` 手动放置
* 全部选项可在后台「设置 → PosterCard 海报」自定义：版式、宽度、按钮文字、站点名、Logo、品牌描述、默认封面、摘要长度、资源加载方式（本地 / jsDelivr CDN / 自定义地址）

== Installation ==

1. 将 `postercard` 文件夹上传到 `/wp-content/plugins/` 目录
2. 在后台「插件」页面启用「PosterCard 文章分享海报」
3. 到「设置 → PosterCard 海报」按需配置

== Changelog ==

= 1.1.0 =
* 新增后台「资源加载方式」下拉：本地（插件自带资源，默认）/ jsDelivr CDN / 自定义地址
* 发布流程自动把 dist/tpl/assets 打入插件并分别打包 wordpress / emlog 插件 zip

= 1.0.0 =
* 首个版本
