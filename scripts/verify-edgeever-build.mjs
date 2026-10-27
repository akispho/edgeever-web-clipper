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
const readerSource=readFileSync('dist/reader-page.js','utf8');
assert.ok(!readerSource.includes('M94.82'),'Obsidian logo path shipped to reader');
assert.ok(readerSource.includes('M16 8h32v8H24v12h20v8H24v12h24v8H16z'),'EdgeEver logo missing from reader');
const styles=readFileSync('dist/style.css','utf8').toLowerCase();
for(const purple of ['#895df4','#a68af9','#8a5cf5']) assert.ok(!styles.includes(purple),`Obsidian accent ${purple} shipped`);
assert.ok(styles.includes('#237a73'),'EdgeEver accent missing from styles');
for(const page of ['popup.html','side-panel.html']) assert.ok(readFileSync(join('dist',page),'utf8').includes('destination-status'));
const settingsPage=readFileSync('dist/settings.html','utf8');
assert.ok(settingsPage.includes('https://github.com/akispho/edgeever-web-clipper'));
assert.ok(!settingsPage.includes('help-open-btn') && !settingsPage.includes('usage-chart-container'));
console.log('EdgeEver build checks passed: MV3 identity, entry files, destination isolation, brand UI, status UI.');

await import('./check-extension-runtime.mjs');
