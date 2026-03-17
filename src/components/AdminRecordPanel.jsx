import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, Pencil, RefreshCw, Search, Trash2 } from 'lucide-react';

const PAGE_SIZE = 8;

const formatDateTime = (value) => {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) return String(value || '-');
  return new Date(parsed).toLocaleString('zh-TW', { hour12: false });
};

const isContactedRecord = (record) =>
  Boolean(record?.completedAt || record?.emailRepliedAt || record?.phoneRepliedAt);

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待處理' },
  { key: 'done', label: '已完成' },
];

const AdminRecordPanel = ({
  query,
  onQueryChange,
  onSearch,
  onReset,
  onOpenAuditLogs,
  records,
  isLoading,
  isUpdatingStatusId,
  deletingId,
  editingRecordId,
  selectedRecordId,
  onSelectRecord,
  onView,
  onEdit,
  onDelete,
  onUpdateContactStatus,
}) => {
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    setPage(1);
  }, [query, tab]);

  const filteredRecords = useMemo(() => {
    if (tab === 'all') return records;
    if (tab === 'pending') return records.filter((record) => !isContactedRecord(record));
    return records.filter((record) => isContactedRecord(record));
  }, [records, tab]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedRecords = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredRecords.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRecords, page]);

  const renderActionButtons = (record, compact = false) => (
    <div className={`flex ${compact ? 'flex-wrap' : ''} justify-end gap-2`}>
      <button
        onClick={() => onView(record)}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100 whitespace-nowrap"
      >
        <Eye className="w-4 h-4" /> 檢視
      </button>
      <button
        onClick={() => onEdit(record)}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
      >
        <Pencil className="w-4 h-4" /> 編輯
      </button>
      <button
        onClick={() => onDelete(record.id)}
        disabled={deletingId === record.id}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-red-50 text-red-700 border border-red-100 hover:bg-red-100 disabled:opacity-70 whitespace-nowrap"
      >
        {deletingId === record.id ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
        刪除
      </button>
    </div>
  );

  const renderContactedCheckbox = (record) => {
    const isUpdating = isUpdatingStatusId === record.id;
    const isChecked = isContactedRecord(record);
    return (
      <div className="flex items-center justify-center">
        <input
          type="checkbox"
          checked={isChecked}
          disabled={isUpdating}
          onChange={(event) =>
            onUpdateContactStatus(record, {
              setContacted: event.target.checked,
            })
          }
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
          title={isChecked ? `已處理：${formatDateTime(record.completedAt || record.updatedAt)}` : '待處理'}
        />
      </div>
    );
  };

  return (
    <div className="bg-white border border-blue-100 rounded-2xl shadow-sm p-5 md:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-blue-700">履歷資料管理</h2>
            <p className="text-gray-600 mt-1">可搜尋姓名 / 證件號碼 / 電話；勾選一筆後可用上方按鈕匯出或列印。</p>
          </div>
          <button
            onClick={onOpenAuditLogs}
            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            處理紀錄
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSearch();
              }
            }}
            placeholder="搜尋姓名 / 證件號碼 / 電話"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={onSearch}
            disabled={isLoading}
            className={`inline-flex items-center justify-center gap-1 px-4 py-2 rounded-lg font-medium text-white ${
              isLoading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} 查詢
          </button>
          <button
            onClick={onReset}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-1 px-4 py-2 rounded-lg font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-70"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> 清除條件
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                tab === item.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white h-[62vh] min-h-[360px] max-h-[560px] flex flex-col">
          <div className="flex-1 overflow-y-auto hidden md:block">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-center px-3 py-3 w-12">選取</th>
                  <th className="text-left px-3 py-3 w-[14%]">姓名</th>
                  <th className="text-left px-3 py-3 w-[14%]">電話</th>
                  <th className="text-left px-3 py-3 w-[34%]">Email</th>
                  <th className="text-center px-3 py-3 w-[10%]">已處理</th>
                  <th className="text-right px-3 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-gray-500" colSpan={6}>
                      <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                      查詢中...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-gray-500" colSpan={6}>
                      查無資料
                    </td>
                  </tr>
                ) : (
                  pagedRecords.map((record) => {
                    const formData = record.formData || {};
                    const isEditing = editingRecordId && editingRecordId === record.id;
                    const isSelected = selectedRecordId === record.id;
                    return (
                      <tr key={record.id} className={`border-t border-gray-100 ${isEditing ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(event) => onSelectRecord(record, event.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-3 text-gray-800 truncate">{formData.name || '-'}</td>
                        <td className="px-3 py-3 text-gray-700 truncate">{formData.phone || '-'}</td>
                        <td className="px-3 py-3 text-gray-600">
                          <div className="truncate">{record.ownerEmail || '-'}</div>
                          <div className="truncate text-xs text-gray-500 mt-1">
                            最後修改：{formatDateTime(record.lastModifiedAt || record.updatedAt)}
                          </div>
                        </td>
                        <td className="px-3 py-3">{renderContactedCheckbox(record)}</td>
                        <td className="px-3 py-3">{renderActionButtons(record)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/30">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-gray-500 border border-gray-200 rounded-xl bg-white">
                <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                查詢中...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 border border-gray-200 rounded-xl bg-white">
                查無資料
              </div>
            ) : (
              pagedRecords.map((record) => {
                const formData = record.formData || {};
                const isEditing = editingRecordId && editingRecordId === record.id;
                const isSelected = selectedRecordId === record.id;
                return (
                  <div
                    key={record.id}
                    className={`border rounded-xl bg-white p-4 shadow-sm ${isEditing ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(event) => onSelectRecord(record, event.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        選取
                      </label>
                      {isEditing && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">編輯中</span>
                      )}
                    </div>
                    <div className="mt-2 text-base font-semibold text-gray-900">{formData.name || '-'}</div>
                    <div className="mt-2 space-y-1.5 text-sm text-gray-700">
                      <div><span className="text-gray-500">電話：</span>{formData.phone || '-'}</div>
                      <div className="break-all"><span className="text-gray-500">Email：</span>{record.ownerEmail || '-'}</div>
                      <div className="break-all">
                        <span className="text-gray-500">最後修改：</span>
                        {formatDateTime(record.lastModifiedAt || record.updatedAt)}
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={isContactedRecord(record)}
                          disabled={isUpdatingStatusId === record.id}
                          onChange={(event) =>
                            onUpdateContactStatus(record, {
                              setContacted: event.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        已處理（已回信/回電）
                      </label>
                    </div>
                    <div className="mt-3">{renderActionButtons(record, true)}</div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 flex items-center justify-between">
            <div className="text-xs text-gray-600">
              第 {page} / {totalPages} 頁，共 {filteredRecords.length} 筆
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

export default AdminRecordPanel;

