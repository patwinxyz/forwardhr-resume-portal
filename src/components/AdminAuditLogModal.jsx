import React from 'react';
import { Loader2, X } from 'lucide-react';

const formatDateTime = (value) => {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) return String(value || '-');
  return new Date(parsed).toLocaleString('zh-TW', { hour12: false });
};

const renderSummary = (log) => {
  const action = String(log?.action || '');
  if (action === 'set_contact_status') {
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

const AdminAuditLogModal = ({
  isOpen,
  logs,
  isLoading,
  onClose,
  onRefresh,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 no-print">
      <div className="w-full max-w-6xl max-h-[92vh] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-800">處理紀錄</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              重新整理
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm border border-gray-300 hover:bg-gray-50"
            >
              <X className="w-4 h-4" /> 關閉
            </button>
          </div>
        </div>
        <div className="max-h-[calc(92vh-58px)] overflow-auto bg-slate-50">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="text-left px-4 py-3 w-[17%]">時間</th>
                <th className="text-left px-4 py-3 w-[18%]">管理員</th>
                <th className="text-left px-4 py-3 w-[14%]">動作</th>
                <th className="text-left px-4 py-3 w-[14%]">履歷 ID</th>
                <th className="text-left px-4 py-3">內容</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-10 text-center text-gray-500" colSpan={5}>
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                    載入中...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-gray-500" colSpan={5}>目前沒有紀錄</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-t border-gray-200 bg-white">
                    <td className="px-4 py-3 text-gray-700">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-700 break-all">{log.actorEmail || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{log.action || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 break-all">{log.recordId || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{renderSummary(log)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminAuditLogModal;

