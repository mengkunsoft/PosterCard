const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');

const root = __dirname;
const distDir = path.join(root, 'dist');

// 读取包信息，生成文件头注释（版本 / 作者 / 版权）
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const year = new Date().getFullYear();
const author = pkg.author || 'mengkunsoft';
const banner = `/*! ${pkg.name} v${pkg.version} | (c) ${year} ${author} | MIT License */\n`;

function ensureDist() {
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
}

async function build() {
  ensureDist();

  // 1) 压缩核心库 JS
  const jsSrc = fs.readFileSync(path.join(root, 'postercard.js'), 'utf8');
  const jsResult = await minify(jsSrc, { compress: true, mangle: true });
  if (jsResult.error) throw jsResult.error;
  const jsMin = banner + jsResult.code;
  fs.writeFileSync(path.join(distDir, 'postercard.min.js'), jsMin);
  console.log('✔ postercard.min.js');

  // 2) 压缩库样式 CSS
  const cssSrc = fs.readFileSync(path.join(root, 'postercard.css'), 'utf8');
  const cssResult = new CleanCSS({ level: 2 }).minify(cssSrc);
  if (cssResult.errors && cssResult.errors.length) {
    throw new Error(cssResult.errors.join('\n'));
  }
  fs.writeFileSync(path.join(distDir, 'postercard.min.css'), banner + cssResult.styles);
  console.log('✔ postercard.min.css');

  // 3) 一体化版本：打包 html2canvas + qrcode + 核心库
  const html2canvas = fs.readFileSync(
    path.join(root, 'assets/vendor/html2canvas.min.js'),
    'utf8'
  );
  const qrcode = fs.readFileSync(
    path.join(root, 'assets/vendor/qrcode.min.js'),
    'utf8'
  );
  const full = banner + [html2canvas, qrcode, jsResult.code].join('\n;\n');
  fs.writeFileSync(path.join(distDir, 'postercard.full.min.js'), full);
  console.log('✔ postercard.full.min.js');

  console.log('Build complete -> dist/');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
