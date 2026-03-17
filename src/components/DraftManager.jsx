import React from 'react';
import { Loader2, RefreshCw, Trash2, X } from 'lucide-react';

const DraftManager = ({
  isOpen,
  records,
  isAdmin,
  isLoading,
  deletingId,
  onClose,
  onRefresh,
  onApply,
  onDelete,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-30 bg-black/30 flex items-center justify-center p-4 no-print">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-800 text-lg">{isAdmin ? '履歷資料管理' : '我的草稿'}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm border border-gray-200 hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> 重新整理
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-sm border border-gray-200 hover:bg-gray-50"
            >
              <X className="w-4 h-4" /> 關閉
            </button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-12 text-center text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
              載入草稿中...
            </div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center text-gray-500">目前沒有草稿</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3">標題</th>
                  {isAdmin && <th className="text-left px-4 py-3">填寫者</th>}
                  <th className="text-left px-4 py-3">更新時間</th>
                  <th className="text-right px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-gray-800">{record.title || '未命名草稿'}</td>
                    {isAdmin && <td className="px-4 py-3 text-gray-600">{record.ownerEmail || '-'}</td>}
                    <td className="px-4 py-3 text-gray-600">{record.updatedAt || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => onApply(record)}
                          className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                        >
                          載入
                        </button>
                        <button
                          onClick={() => onDelete(record.id)}
                          disabled={deletingId === record.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-50 text-red-700 border border-red-100 hover:bg-red-100 disabled:opacity-70"
                        >
                          {deletingId === record.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default DraftManager;
