import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeInstanceUrl, EdgeEverClient } from './edgeever-client';

afterEach(() => vi.unstubAllGlobals());
describe('EdgeEver client', () => {
 it('normalizes a deployment subpath and rejects credentials, queries and unsupported schemes', () => {
  expect(normalizeInstanceUrl(' example.org/notes/ ')).toBe('https://example.org/notes');
  expect(normalizeInstanceUrl('http://localhost:8787/')).toBe('http://localhost:8787');
  for (const value of ['file:///tmp/x', 'https://user:pass@example.org', 'https://example.org/?secret=x', 'https://example.org/#x']) expect(() => normalizeInstanceUrl(value)).toThrow();
 });
 it('requires credentials and restricts API paths before making requests', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  expect(() => new EdgeEverClient({instanceUrl:'https://notes.test', token:''})).toThrow();
  const client = new EdgeEverClient({instanceUrl:'https://notes.test', token:'private-token'});
  await expect(client.request('https://evil.test')).rejects.toThrow();
  await expect(client.request('/api/v1/../../evil')).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('uses the configured deployment prefix and refuses authenticated redirects', async () => {
  const fetcher = vi.fn(async (_url:string, _init:RequestInit) => Response.json({notebooks:[]})); vi.stubGlobal('fetch', fetcher);
  await new EdgeEverClient({instanceUrl:'https://notes.test/base', token:'private-token'}).notebooks();
  expect(fetcher.mock.calls[0][0]).toBe('https://notes.test/base/api/v1/notebooks');
  const init = fetcher.mock.calls[0][1] as RequestInit;
  expect(new Headers(init.headers).get('Authorization')).toBe('Bearer private-token');
  expect(init.redirect).toBe('error'); expect(init.credentials).toBe('omit');
 });
 it('reports status but never returns an echoed credential from a server error', async () => {
  vi.stubGlobal('fetch', async () => Response.json({error:{message:'private-token'}},{status:401}));
  await expect(new EdgeEverClient({instanceUrl:'https://notes.test',token:'private-token'}).notebooks()).rejects.toThrow('401');
  try { await new EdgeEverClient({instanceUrl:'https://notes.test',token:'private-token'}).notebooks(); } catch (e) { expect(String(e)).not.toContain('private-token'); }
 });
});
