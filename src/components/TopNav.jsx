import React from 'react';
import { Download, FileText, FolderOpen, Loader2, LogIn, LogOut, PlusCircle, Printer, RefreshCw, Send } from 'lucide-react';

const TopNav = ({
  isAdmin,
  isAdminRoute,
  onNewDraft,
  onLoadDrafts,
  onExportWord,
  onPrint,
  canExport,
  isExportingWord,
  onSendEmail,
  isSendingEmail,
  isLoadingDrafts,
  authUser,
  isAuthBusy,
  isAuthConfigured,
  onLogin,
  onLogout,
}) => (
  <div className="bg-white shadow-sm sticky top-0 z-10 no-print">
    <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-blue-600 font-bold text-lg sm:text-xl">
          <FileText className="w-6 h-6 shrink-0" />
          <span className="leading-tight whitespace-nowrap">灃禾集團 履歷系統</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {isAuthConfigured ? (
            authUser ? (
              <>
                <div className="px-3 py-2 text-xs rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 max-w-[260px] truncate">
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
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {isAdmin && isAdminRoute ? (
          <>
            <button
              onClick={onLoadDrafts}
              disabled={isLoadingDrafts}
              className={`flex items-center gap-1 px-3 py-2 rounded-md font-medium transition-colors ${
                isLoadingDrafts ? 'bg-slate-300 text-white cursor-not-allowed' : 'bg-slate-600 text-white hover:bg-slate-700'
              }`}
            >
              {isLoadingDrafts ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} 重新整理列表
            </button>
            <button
              onClick={onExportWord}
              disabled={!canExport || isExportingWord}
              className={`flex items-center gap-1 px-3 py-2 rounded-md font-medium text-white transition-colors ${
                !canExport || isExportingWord ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
              title={!canExport ? '請先從列表點選「編輯」載入履歷' : ''}
            >
              {isExportingWord ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 匯出 Word
            </button>
            <button
              onClick={onPrint}
              disabled={!canExport}
              className={`flex items-center gap-1 px-3 py-2 rounded-md font-medium transition-colors ${
                !canExport ? 'bg-emerald-300 text-white cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
              title={!canExport ? '請先從列表點選「編輯」載入履歷' : ''}
            >
              <Printer className="w-4 h-4" /> 列印 / PDF
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onNewDraft}
              className="flex items-center gap-1 px-3 py-2 rounded-md font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <PlusCircle className="w-4 h-4" /> 新建
            </button>
            <button
              onClick={onLoadDrafts}
              disabled={isLoadingDrafts}
              className={`flex items-center gap-1 px-3 py-2 rounded-md font-medium transition-colors ${
                isLoadingDrafts ? 'bg-slate-300 text-white cursor-not-allowed' : 'bg-slate-600 text-white hover:bg-slate-700'
              }`}
            >
              {isLoadingDrafts ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />} 載入歷史履歷
            </button>
            <button
              onClick={onSendEmail}
              disabled={isSendingEmail}
              className={`flex items-center gap-1 px-3 py-2 text-white rounded-md font-medium shadow-sm transition-colors ${
                isSendingEmail ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <Send className="w-4 h-4" /> {isSendingEmail ? '送出中...' : '送出寄送'}
            </button>
          </>
        )}
      </div>
    </div>
  </div>
);

export default TopNav;
