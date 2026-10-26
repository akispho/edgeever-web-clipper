import { describe, expect, it } from 'vitest';
import { trustedDestinationPage } from './edgeever-background';
describe('destination message boundary',()=>{
 it('only accepts exact extension destination pages including embedded popup queries',()=>{
  const base='chrome-extension://ours/';
  for(const path of ['popup.html','popup.html?context=iframe','settings.html','side-panel.html']) expect(trustedDestinationPage(base+path,base)).toBe(true);
  for(const url of [undefined,'https://site.test/settings.html','https://site.test/chrome-extension://ours/popup.html',base+'content.js',base+'settings.html.evil']) expect(trustedDestinationPage(url,base)).toBe(false);
 });
});

// Isolate the protocol from native persistence; the production IndexedDB transaction
// is also exercised by the standalone browser roundtrip check.
