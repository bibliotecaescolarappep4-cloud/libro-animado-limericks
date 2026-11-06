import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const assetDir = join(root, 'assets', 'limericksarg');
const names = (await readdir(assetDir))
  .filter(file => file.endsWith('.jpg'))
  .map(file => file.slice(0, -4))
  .sort();
const contentTypes = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.jpg': 'image/jpeg'};

createServer(async (request, response) => {
  if (request.method === 'POST' && request.url === '/log') {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    await writeFile(join(root, 'tools', 'compile-error.txt'), Buffer.concat(chunks));
    response.writeHead(204).end();
    return;
  }
  if (request.method === 'POST' && request.url === '/save-target') {
    const name = request.headers['x-limerick-name'] ?? '';
    if (!names.includes(name) || !/^[a-z0-9_]+$/.test(name)) {
      response.writeHead(400).end();
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const directory = join(root, name);
    await mkdir(directory, {recursive: true});
    await writeFile(join(directory, 'targets.mind'), Buffer.concat(chunks));
    response.writeHead(204).end();
    return;
  }

  let requestPath = request.url === '/' ? '/tools/compile-targets.html' : request.url;
  const filePath = resolve(root, `.${requestPath}`);
  if (!filePath.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  try {
    let body = await readFile(filePath);
    if (requestPath === '/tools/compile-targets.html') {
      body = Buffer.from(body.toString().replace('PARAM_NAMES', JSON.stringify(names)));
    }
    response.writeHead(200, {'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream'}).end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(8765, '127.0.0.1', () => console.log('Compilador: http://127.0.0.1:8765'));
