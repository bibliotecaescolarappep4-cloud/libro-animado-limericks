import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createCanvas, loadImage } from 'canvas';
import { OfflineCompiler } from 'mind-ar/src/image-target/offline-compiler.js';

const root = resolve(import.meta.dirname, '..', '..');
const assets = join(root, 'assets', 'limericksarg');
let names = (await readdir(assets)).filter(file => file.endsWith('.jpg')).map(file => file.slice(0, -4)).sort();
if (process.argv[2]) names = names.filter(name => name === process.argv[2]);

for (const [index, name] of names.entries()) {
  console.log(`[${index + 1}/${names.length}] ${name}`);
  const source = await loadImage(join(assets, `${name}.jpg`));
  const scale = Math.min(1, 1000 / Math.max(source.width, source.height));
  const image = createCanvas(Math.round(source.width * scale), Math.round(source.height * scale));
  image.getContext('2d').drawImage(source, 0, 0, image.width, image.height);
  const compiler = new OfflineCompiler();
  await compiler.compileImageTargets([image], () => {});
  const directory = join(root, name);
  await mkdir(directory, {recursive: true});
  await writeFile(join(directory, 'targets.mind'), compiler.exportData());
}
