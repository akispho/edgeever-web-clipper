export interface EdgeEverSettings { instanceUrl: string; token: string; notebookId?: string }
export interface Notebook { id: string; name: string; parentId: string | null }
export interface Memo { id: string; notebookId: string; title: string; contentMarkdown: string; contentJson?: unknown; revision: number; contentHash: string; tags?: string[] }
export interface EditSession { id: string; baseRevision: number; baseContentHash: string }

export function normalizeInstanceUrl(value: string): string {
 const input = value.trim();
 if (!input) throw new Error('请先设置 EdgeEver 地址 / Configure your EdgeEver URL.');
 const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`);
 if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('EdgeEver 地址只能使用 HTTP(S)，不能含凭据、查询或锚点。');
 return url.href.replace(/\/+$/, '');
}

export class EdgeEverClient {
 readonly baseUrl: string;
 private readonly token: string;
 constructor(settings: EdgeEverSettings) {
  this.baseUrl = normalizeInstanceUrl(settings.instanceUrl);
  this.token = settings.token.trim();
  if (!this.token || /[\r\n]/.test(this.token)) throw new Error('请先设置有效的 EdgeEver API Token。');
 }
 async request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith('/api/v1/') || /(?:^|\/)(?:\.|\.\.)(?:\/|$)/.test(path) || /[\\#]/.test(path) || /%2e|%2f|%5c/i.test(path)) throw new Error('Invalid EdgeEver API path.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${this.token}`);
  if (typeof init.body === 'string') headers.set('Content-Type','application/json');
  let response: Response;
  try {
   response = await fetch(this.baseUrl + path, {...init, headers, redirect:'error', credentials:'omit', signal:init.signal || AbortSignal.timeout(15000)});
  } catch { throw new Error('EdgeEver 请求失败：请检查地址、连接、TLS 和实例访问权限。'); }
  // Server error bodies can echo secrets; expose only the status and a local message.
  if (!response.ok) throw new Error(`EdgeEver HTTP ${response.status}${response.status === 409 ? '：笔记发生编辑冲突，未覆盖，请重新剪藏。' : response.status === 401 || response.status === 403 ? '：请检查 Token 和权限。' : '：请求失败。'}`);
  try { return await response.json() as T; } catch { throw new Error('EdgeEver 返回了无效的 JSON 响应。'); }
 }
 async notebooks(): Promise<Notebook[]> {
  const result = await this.request<{notebooks: Notebook[]}>('/api/v1/notebooks');
  if (!Array.isArray(result.notebooks) || result.notebooks.some(n=>!n || typeof n.id !== 'string' || typeof n.name !== 'string')) throw new Error('EdgeEver 笔记本响应无效。');
  return result.notebooks;
 }
 post<T>(path: string, body: unknown): Promise<T> { return this.request<T>(path,{method:'POST',body:JSON.stringify(body)}); }
 async createNotebook(name: string, parentId: string): Promise<Notebook> {
  const {notebook} = await this.post<{notebook:Notebook}>('/api/v1/notebooks',{name,parentId});
  if (!notebook?.id) throw new Error('EdgeEver 未返回新笔记本 ID。');
  return notebook;
 }
 async memo(id: string): Promise<Memo> {
  const {memo} = await this.request<{memo:Memo}>(`/api/v1/memos/${encodeURIComponent(id)}`);
  return validateMemo(memo);
 }
 async create(body: {notebookId:string;title:string;contentMarkdown:string;tags:string[]}): Promise<Memo> {
  const {memo} = await this.post<{memo:Memo}>('/api/v1/memos',body); return validateMemo(memo);
 }
 async editSession(id: string): Promise<EditSession> {
  const {editSession} = await this.post<{editSession:EditSession}>(`/api/v1/memos/${encodeURIComponent(id)}/edit-sessions`,{});
  if (!editSession?.id || !Number.isInteger(editSession.baseRevision) || typeof editSession.baseContentHash !== 'string') throw new Error('EdgeEver 编辑会话无效。');
  return editSession;
 }
 async save(id: string, session: EditSession, contentMarkdown: string, overwrite=false): Promise<Memo> {
  const {memo} = await this.post<{memo:Memo}>(`/api/v1/memos/${encodeURIComponent(id)}/save`,{editSessionId:session.id,expectedRevision:session.baseRevision,expectedContentHash:session.baseContentHash,contentMarkdown,...(overwrite ? {allowDestructiveOverwrite:true} : {})}); return validateMemo(memo);
 }
 async upload(id: string, blob: Blob, name: string, signal?: AbortSignal): Promise<string> {
  const form = new FormData(); form.append('file',blob,name);
  const {resource} = await this.request<{resource:{id:string}}>(`/api/v1/memos/${encodeURIComponent(id)}/resources`,{method:'POST',body:form,signal});
  if (!resource?.id) throw new Error('EdgeEver 未返回附件 ID。'); return `${this.baseUrl}/api/v1/resources/${encodeURIComponent(resource.id)}/blob`;
 }
}
function validateMemo(memo: Memo): Memo {
 if (!memo?.id || !Number.isInteger(memo.revision) || typeof memo.contentHash !== 'string' || typeof memo.contentMarkdown !== 'string') throw new Error('EdgeEver 笔记响应缺少 ID 或版本；为避免数据丢失已停止。');
 return memo;
}
