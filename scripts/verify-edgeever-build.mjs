import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
const manifest=JSON.parse(readFileSync('dist/manifest.json','utf8'));
assert.equal(manifest.manifest_version,3);
assert.equal(manifest.name,'EdgeEver Web Clipper');
assert.equal(manifest.version,JSON.parse(readFileSync('package.json','utf8')).version);
assert.ok(!manifest.update_url && !manifest.key && !manifest.externally_connectable);
for(const file of ['popup.html','side-panel.html','settings.html','background.js','content.js','style.css','LICENSE','UPSTREAM.md']) assert.ok(existsSync(join('dist',file)),`Missing ${file}`);
assert.ok(readFileSync('dist/LICENSE','utf8').includes('MIT License'));
for(const file of readdirSync('dist').filter(f=>f.endsWith('.js'))) {
 const source=readFileSync(join('dist',file),'utf8');
 assert.ok(!source.includes('obsidian://'),`Obsidian URI in ${file}`);
 if(file!=='background.js') assert.ok(!source.includes('edgeever-private'),`Credential database shipped to ${file}`);
}
for(const page of ['popup.html','side-panel.html']) assert.ok(readFileSync(join('dist',page),'utf8').includes('destination-status'));
console.log('EdgeEver build checks passed: MV3 identity, entry files, destination isolation, status UI.');

await import('./check-extension-runtime.mjs');
