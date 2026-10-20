import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const output = resolve(root, 'pages-dist');
const files = [
  'index.html',
  'styles.css',
  'favicon.svg',
  'manifest.webmanifest',
  'service-worker.js',
  'src',
  'vendor',
];

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const file of files) {
  const source = resolve(root, file);
  if (!existsSync(source)) throw new Error(`缺少发布文件：${file}`);
  cpSync(source, resolve(output, file), { recursive: true });
}

console.log(`网页文件已生成到 ${output}`);
