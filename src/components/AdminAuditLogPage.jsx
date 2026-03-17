import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, RefreshCw, Search } from 'lucide-react';

const PAGE_SIZE = 12;

const formatDateTime = (value) => {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) return String(value || '-');
  return new Date(parsed).toLocaleString('zh-TW', { hour12: false });
};

const renderSummary = (log) => {
  const action = String(log?.action || '');
  if (action === 'set_contact_status') {
    if (typeof log?.setContacted === 'boolean') {
      return log.setContacted ? '已處理（已回信/回電）' : '改為待處理';
    }
    const emailFlag = log?.setEmailReplied ? '已回信' : '未回信';
    const phoneFlag = log?.setPhoneReplied ? '已回電' : '未回電';
    return `${emailFlag} / ${phoneFlag}`;
  }
  if (action === 'mark_submitted') {
    return `送出次數：${Number(log?.submitCountBefore || 0)} -> ${Number(log?.submitCountAfter || 0)}`;
  }
  if (action === 'update') return '更新履歷內容';
  if (action === 'create') return '新增履歷';
  if (action === 'delete') return '刪除履歷';
  return '-';
};

const AdminAuditLogPage = ({ logs, isLoading, onRefresh, onBack }) => {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [query, logs]);

  const filteredLogs = useMemo(() => {
    const keyword = String(query || '').trim().toLowerCase();
    if (!keyword) return logs;
    return logs.filter((log) => {
      const summary = renderSummary(log);
      const target = [
        formatDateTime(log.createdAt),
        String(log.actorEmail || ''),
        String(summary || ''),
      ]
        .join(' ')
        .toLowerCase();
      return target.includes(keyword);
    });
  }, [logs, query]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedLogs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, page]);

  return (
    <div className="bg-white border border-blue-100 rounded-2xl shadow-sm p-5 md:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-blue-700">處理紀錄</h2>
            <p className="text-gray-600 mt-1">提供管理者查閱履歷處理軌跡，支援分頁與關鍵字檢索。</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-70"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              重新整理
            </button>
            <button
              onClick={onBack}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" />
              回履歷列表
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋時間 / 管理員 Email / 內容"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setQuery('')}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
          >
            清除條件
          </button>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white h-[62vh] min-h-[360px] max-h-[560px] flex flex-col">
          <div className="flex-1 overflow-y-auto hidden md:block">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-3 w-[26%]">時間</th>
                  <th className="text-left px-3 py-3 w-[28%]">管理員</th>
                  <th className="text-left px-3 py-3">內容</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-gray-500" colSpan={3}>
                      <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                      載入中...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-gray-500" colSpan={3}>
                      查無紀錄
                    </td>
                  </tr>
                ) : (
                  pagedLogs.map((log) => (
                    <tr key={log.id} className="border-t border-gray-100">
                      <td className="px-3 py-3 text-gray-700 truncate">{formatDateTime(log.createdAt)}</td>
                      <td className="px-3 py-3 text-gray-700 break-all">{log.actorEmail || '-'}</td>
                      <td className="px-3 py-3 text-gray-700">{renderSummary(log)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/30">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-gray-500 border border-gray-200 rounded-xl bg-white">
                <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                載入中...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 border border-gray-200 rounded-xl bg-white">
                查無紀錄
              </div>
            ) : (
              pagedLogs.map((log) => (
                <div key={log.id} className="border rounded-xl bg-white p-4 shadow-sm border-gray-200">
                  <div className="text-xs text-gray-500">{formatDateTime(log.createdAt)}</div>
                  <div className="mt-1 break-all text-sm text-gray-700">{log.actorEmail || '-'}</div>
                  <div className="mt-2 text-sm text-gray-800">{renderSummary(log)}</div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 flex items-center justify-between">
            <div className="text-xs text-gray-600">
              第 {page} / {totalPages} 頁，共 {filteredLogs.length} 筆
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40"
              >
                上一頁
              </button>
              <button
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40"
              >
                下一頁
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAuditLogPage;
