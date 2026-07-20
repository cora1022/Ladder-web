import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'public');
const output = resolve(root, 'dist');
const required = [
  'index.html', 'privacy.html', 'terms.html', 'contact.html', '404.html',
  'robots.txt', 'sitemap.xml', 'og.png', 'assets/js/ladder-core.js', 'assets/js/app.js',
];

await Promise.all(required.map((file) => stat(resolve(source, file))));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
console.log(`Built ${required.length} required assets into dist/.`);
