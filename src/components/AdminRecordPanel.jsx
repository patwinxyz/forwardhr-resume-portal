import React from 'react';
import { Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';

const AdminRecordPanel = ({
  filters,
  onFilterChange,
  onSearch,
  onReset,
  records,
  isLoading,
  deletingId,
  currentDraftId,
  onApply,
  onDelete,
}) => (
  <div className="bg-white border border-blue-100 rounded-2xl shadow-sm p-5 md:p-6">
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-bold text-blue-700">履歷資料管理</h2>
        <p className="text-gray-600 mt-1">可用姓名或證件號碼查詢，點「載入編修」後可直接修改與儲存。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          type="text"
          value={filters.name}
          onChange={(event) => onFilterChange('name', event.target.value)}
          placeholder="查詢姓名"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          value={filters.arcNumber}
          onChange={(event) => onFilterChange('arcNumber', event.target.value)}
          placeholder="查詢證件號碼"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={onSearch}
          disabled={isLoading}
          className={`inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium text-white ${
            isLoading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} 查詢
        </button>
        <button
          onClick={onReset}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-70"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> 清除條件
        </button>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">姓名</th>
                <th className="text-left px-4 py-3">證件號碼</th>
                <th className="text-left px-4 py-3">聯絡電話</th>
                <th className="text-left px-4 py-3">填寫者</th>
                <th className="text-left px-4 py-3">更新時間</th>
                <th className="text-right px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                    查詢中...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>
                    查無資料
                  </td>
                </tr>
              ) : (
                records.map((record) => {
                  const formData = record.formData || {};
                  const isCurrent = currentDraftId && currentDraftId === record.id;
                  return (
                    <tr key={record.id} className={`border-t border-gray-100 ${isCurrent ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3 text-gray-800">{formData.name || '-'}</td>
                      <td className="px-4 py-3 text-gray-700">{formData.arcNumber || '-'}</td>
                      <td className="px-4 py-3 text-gray-700">{formData.phone || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{record.ownerEmail || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{record.updatedAt || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => onApply(record)}
                            className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                          >
                            載入編修
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
);

export default AdminRecordPanel;
