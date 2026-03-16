import React from 'react';
import { Download, Edit, FileText, LogIn, LogOut, Printer, Send } from 'lucide-react';

const TopNav = ({
  mode,
  onEdit,
  onPreview,
  onExportWord,
  onSendEmail,
  onPrint,
  isExportingWord,
  isSendingEmail,
  authUser,
  isAuthBusy,
  isAuthConfigured,
  onLogin,
  onLogout,
}) => (
  <div className="bg-white shadow-sm sticky top-0 z-10 no-print">
    <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
      <div className="flex items-center gap-2 text-blue-600 font-bold text-lg sm:text-xl">
        <FileText className="w-6 h-6" />
        <span>灃禾集團 履歷系統</span>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {isAuthConfigured ? (
          authUser ? (
            <>
              <div className="px-3 py-2 text-xs rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 max-w-[240px] truncate">
                已登入：{authUser.email}
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-1 px-3 py-2 rounded-md font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <LogOut className="w-4 h-4" /> 登出
              </button>
            </>
          ) : (
            <button
              onClick={onLogin}
              disabled={isAuthBusy}
              className={`flex items-center gap-1 px-3 py-2 rounded-md font-medium transition-colors ${
                isAuthBusy ? 'bg-blue-300 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <LogIn className="w-4 h-4" /> {isAuthBusy ? '登入中...' : 'Google 登入'}
            </button>
          )
        ) : (
          <div className="px-3 py-2 text-xs rounded-md border border-amber-200 bg-amber-50 text-amber-700">
            未設定 Firebase 登入
          </div>
        )}

        <button
          onClick={onEdit}
          className={`flex items-center gap-1 px-3 py-2 rounded-md font-medium transition-colors ${
            mode === 'edit' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Edit className="w-4 h-4" /> 編輯資料
        </button>
        <button
          onClick={onPreview}
          className={`flex items-center gap-1 px-3 py-2 rounded-md font-medium transition-colors ${
            mode === 'preview' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText className="w-4 h-4" /> 預覽
        </button>

        {mode === 'preview' && (
          <>
            <button
              onClick={onSendEmail}
              disabled={isSendingEmail}
              className={`flex items-center gap-1 px-4 py-2 text-white rounded-md font-medium shadow-sm transition-colors ${
                isSendingEmail ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <Send className="w-4 h-4" /> {isSendingEmail ? '送出中...' : '送出寄送'}
            </button>
            <button
              onClick={onExportWord}
              disabled={isExportingWord}
              className={`flex items-center gap-1 px-4 py-2 text-white rounded-md font-medium shadow-sm transition-colors ${
                isExportingWord ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              <Download className="w-4 h-4" /> {isExportingWord ? '匯出中...' : '匯出 Word'}
            </button>
            <button
              onClick={onPrint}
              className="flex items-center gap-1 px-4 py-2 bg-orange-600 text-white rounded-md font-medium hover:bg-orange-700 shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" /> 列印 / PDF
            </button>
          </>
        )}
      </div>
    </div>
  </div>
);

export default TopNav;
