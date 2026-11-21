/* Gộp toàn bộ app thành 1 file HTML duy nhất: node build.js -> dist/mach-dien-lab.html */
'use strict';
const fs = require('fs');
const path = require('path');
let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, f) => '<style>\n' + fs.readFileSync(path.join(__dirname, f), 'utf8') + '</style>');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, f) => '<script>\n' + fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>');
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'mach-dien-lab.html'), html);
console.log('Đã tạo dist/mach-dien-lab.html (' + Math.round(html.length / 1024) + ' KB)');
