/**
 * 插件打包脚本
 * 1. 将核心库产物 dist/、模板 tpl/、静态资源 assets/ 复制到两个插件目录（供「本地加载」模式使用）
 * 2. 把每个插件目录分别打成 zip 发布包（releases/postercard-wordpress.zip、releases/postercard-emlog.zip）
 *
 * 用法：node build-plugins.js   （建议在 npm run build 之后执行）
 */
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const root = __dirname;

const src = {
  dist: path.join(root, 'dist'),
  tpl: path.join(root, 'tpl'),
  assets: path.join(root, 'assets'),
};

// 目标插件目录（与 plugins/<平台>/postercard 对应）
const targets = [
  { dir: path.join(root, 'plugins/wordpress/postercard'), zip: 'postercard-wordpress.zip' },
  { dir: path.join(root, 'plugins/emlog/postercard'), zip: 'postercard-emlog.zip' },
];

const releasesDir = path.join(root, 'releases');

function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function bundleLibs() {
  for (const key of ['dist', 'tpl', 'assets']) {
    if (!fs.existsSync(src[key])) {
      throw new Error(`缺少源目录 ${src[key]}，请先运行 npm run build（dist/ 由构建生成）`);
    }
  }
  for (const t of targets) {
    copyDir(src.dist, path.join(t.dir, 'dist'));
    copyDir(src.tpl, path.join(t.dir, 'tpl'));
    copyDir(src.assets, path.join(t.dir, 'assets'));
    console.log(`✔ 已把 dist/tpl/assets 打包进 ${path.relative(root, t.dir)}`);
  }
}

function zipDir(dir, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => {
      console.log(`✔ ${path.basename(zipPath)} (${archive.pointer()} bytes)`);
      resolve();
    });
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') console.warn(err);
      else reject(err);
    });
    archive.on('error', reject);
    archive.pipe(output);
    // 插件 zip 以 postercard/ 为根目录，符合 WP / emlog 安装习惯
    archive.directory(dir, 'postercard');
    archive.finalize();
  });
}

async function pack() {
  ensureDir(releasesDir);
  // 清理旧 zip，避免叠加
  for (const t of targets) {
    const p = path.join(releasesDir, t.zip);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  bundleLibs();

  for (const t of targets) {
    await zipDir(t.dir, path.join(releasesDir, t.zip));
  }
  console.log('插件打包完成 -> releases/');
}

pack().catch((err) => {
  console.error(err);
  process.exit(1);
});
