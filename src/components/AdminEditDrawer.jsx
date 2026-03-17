import React from 'react';
import { Download, Loader2, Printer, Save, X } from 'lucide-react';

const AdminEditDrawer = ({
  isOpen,
  title,
  isSaving,
  isExportingWord,
  canExport,
  onClose,
  onSave,
  onExportWord,
  onPrint,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex no-print">
      <div className="flex-1 bg-black/30" onClick={onClose} aria-hidden="true" />
      <aside className="w-full max-w-[760px] h-full bg-white shadow-2xl border-l border-gray-200 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800">{title || '編輯履歷'}</h3>
            <p className="text-xs text-gray-500 mt-1">右側抽屜編輯，儲存後會立即更新列表。</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={onExportWord}
              disabled={!canExport || isExportingWord}
              className={`inline-flex items-center gap-1 px-3 py-2 rounded-md font-medium text-white ${
                !canExport || isExportingWord ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isExportingWord ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 匯出 Word
            </button>
            <button
              onClick={onPrint}
              disabled={!canExport}
              className={`inline-flex items-center gap-1 px-3 py-2 rounded-md font-medium text-white ${
                !canExport ? 'bg-emerald-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <Printer className="w-4 h-4" /> 列印 / PDF
            </button>
            <button
              onClick={onSave}
              disabled={isSaving}
              className={`inline-flex items-center gap-1 px-3 py-2 rounded-md font-medium text-white ${
                isSaving ? 'bg-emerald-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 儲存修改
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-md font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
            >
              <X className="w-4 h-4" /> 關閉
            </button>
          </div>
        </div>

        <div className="px-5 py-5">{children}</div>
      </aside>
    </div>
  );
};

export default AdminEditDrawer;
