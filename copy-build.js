import fs from 'fs';
import path from 'path';

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  let entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    let srcPath = path.join(src, entry.name);
    let destPath = path.join(dest, entry.name);

    entry.isDirectory() ? copyDir(srcPath, destPath) : fs.copyFileSync(srcPath, destPath);
  }
}

copyDir('dist/assets', 'assets');
if (fs.existsSync('dist/404.html')) fs.copyFileSync('dist/404.html', '404.html');
if (fs.existsSync('dist/manifest.json')) fs.copyFileSync('dist/manifest.json', 'manifest.json');
if (fs.existsSync('dist/robots.txt')) fs.copyFileSync('dist/robots.txt', 'robots.txt');
if (fs.existsSync('dist/sw.js')) fs.copyFileSync('dist/sw.js', 'sw.js');
if (fs.existsSync('dist/template.html')) fs.copyFileSync('dist/template.html', 'index.html');
