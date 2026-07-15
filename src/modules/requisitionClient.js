// 招募需求（廠商）API client — 比照 App.jsx 對 /api/resume-records 的呼叫慣例：
// 以 Firebase idToken 帶 Authorization header，經 getApiEndpoint 前綴，回傳 { ok, ... }。

const getApiEndpoint = (path) => {
  const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  return apiBaseUrl ? `${apiBaseUrl.replace(/\/$/, '')}${path}` : path;
};

const parseResponsePayload = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: text.slice(0, 200) };
  }
};

const authHeaders = async (authUser) => {
  if (!authUser || typeof authUser.getIdToken !== 'function') {
    throw new Error('請先登入');
  }
  const idToken = await authUser.getIdToken();
  if (!idToken) throw new Error('登入憑證已失效，請重新登入');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` };
};

const ENDPOINT = '/api/requisitions';

// 列表：管理員回全部；一般登入者只回自己送出的。
export const listRequisitions = async (authUser, filters = {}) => {
  const headers = await authHeaders(authUser);
  const params = new URLSearchParams();
  if (String(filters.q || '').trim()) params.set('q', String(filters.q).trim());
  if (String(filters.status || '').trim()) params.set('status', String(filters.status).trim());
  if (String(filters.company || '').trim()) params.set('company', String(filters.company).trim());
  const query = params.toString();
  const response = await fetch(`${getApiEndpoint(ENDPOINT)}${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers,
  });
  const result = await parseResponsePayload(response);
  if (!response.ok || !result?.ok) {
    throw new Error(result?.message || `招募需求查詢失敗（${response.status}）`);
  }
  return Array.isArray(result.records) ? result.records : [];
};

// 建立/更新。submit=true 由後端轉為 submitted 並記錄送出時間。
export const saveRequisition = async (authUser, { recordId, formData, submit = false } = {}) => {
  const headers = await authHeaders(authUser);
  const response = await fetch(getApiEndpoint(ENDPOINT), {
    method: 'POST',
    headers,
    body: JSON.stringify({ recordId: recordId || '', formData, submit: Boolean(submit) }),
  });
  const result = await parseResponsePayload(response);
  if (!response.ok || !result?.ok || !result?.record?.id) {
    // 409：已被灃禾設為 open/closed，一般廠商不能再改
    throw new Error(result?.message || `招募需求儲存失敗（${response.status}）`);
  }
  return result.record;
};

// 管理員狀態流轉：draft/submitted/open/closed
export const setRequisitionStatus = async (authUser, recordId, status) => {
  const headers = await authHeaders(authUser);
  const response = await fetch(getApiEndpoint(ENDPOINT), {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ action: 'setStatus', recordId, status }),
  });
  const result = await parseResponsePayload(response);
  if (!response.ok || !result?.ok) {
    throw new Error(result?.message || `狀態更新失敗（${response.status}）`);
  }
  return result.record;
};

export const deleteRequisition = async (authUser, id) => {
  const headers = await authHeaders(authUser);
  const response = await fetch(`${getApiEndpoint(ENDPOINT)}?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });
  const result = await parseResponsePayload(response);
  if (!response.ok || !result?.ok) {
    throw new Error(result?.message || `刪除失敗（${response.status}）`);
  }
  return true;
};

// 送出後通知灃禾（Telegram + Email）。非阻斷：呼叫端請以 try/catch 包起來，失敗不影響已存檔的需求。
export const notifyRequisition = async (authUser, requisitionId) => {
  const headers = await authHeaders(authUser);
  const response = await fetch(getApiEndpoint('/api/notify-requisition'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ requisitionId }),
  });
  const result = await parseResponsePayload(response);
  if (!response.ok || !result?.ok) {
    throw new Error(result?.message || `通知發送失敗（${response.status}）`);
  }
  return result.results || {};
};
