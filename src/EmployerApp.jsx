import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileText, Loader2, LogIn, LogOut, PlusCircle } from 'lucide-react';
import {
  isFirebaseAuthConfigured,
  loginWithGoogle,
  logoutAuthUser,
  subscribeAuthUser,
} from './modules/authClient';
import NoticeBanner from './components/NoticeBanner';
import RequisitionForm, { blankRequisitionForm } from './employer/RequisitionForm';
import { RequisitionDetail, StatusBadge, dash, fmt } from './employer/RequisitionShared';
import { deleteRequisition, listRequisitions, notifyRequisition, saveRequisition } from './modules/requisitionClient';

const parseAdminEmails = () =>
  String(import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const Brand = () => (
  <a href="/employer" className="flex items-center gap-2 text-blue-700 font-bold text-lg">
    <span className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">禾</span>
    <span className="leading-tight">
      灃禾
      <span className="block text-[11px] font-medium text-gray-500">廠商專區 · 招募需求</span>
    </span>
  </a>
);

// 廠商招募需求（只給廠商用）。管理員一律導向統一後台 /admin。
export default function EmployerApp() {
  const configured = isFirebaseAuthConfigured();

  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const showNotice = (message, type = 'info') => setNotice({ message, type });

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [screen, setScreen] = useState('list'); // list | form | success | detail
  const [editing, setEditing] = useState(null);
  const [prefill, setPrefill] = useState(null); // 重新招募：以既有內容開新需求
  const [detail, setDetail] = useState(null);
  const [lastSubmitted, setLastSubmitted] = useState(null);

  const adminEmails = parseAdminEmails();
  const email = String(authUser?.email || '').trim().toLowerCase();
  const isAdmin = email ? adminEmails.includes(email) : false;

  useEffect(() => {
    const unsub = subscribeAuthUser((u) => {
      setAuthUser(u || null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // 管理員一律到統一後台管理（履歷＋招募需求都在 /admin）
  useEffect(() => {
    if (authReady && authUser && isAdmin && typeof window !== 'undefined') {
      window.location.replace('/admin');
    }
  }, [authReady, authUser, isAdmin]);

  const reload = async (user = authUser) => {
    if (!user) return;
    setLoading(true);
    try {
      setRecords(await listRequisitions(user));
    } catch (e) {
      showNotice(e?.message || '載入失敗', 'error');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (authReady && authUser && !isAdmin) reload(authUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, authUser, isAdmin]);

  const handleLogin = async () => {
    setAuthBusy(true);
    try {
      await loginWithGoogle();
    } catch (e) {
      showNotice(e?.message || '登入失敗', 'error');
    } finally {
      setAuthBusy(false);
    }
  };
  const handleLogout = async () => {
    await logoutAuthUser();
    setRecords([]);
    setScreen('list');
  };

  const openNew = () => { setEditing(null); setPrefill(null); setScreen('form'); };
  const openEditOrView = (record) => {
    if (record.status === 'draft' || record.status === 'submitted') {
      setEditing(record);
      setPrefill(null);
      setScreen('form');
    } else {
      setDetail(record);
      setScreen('detail');
    }
  };
  const openDetail = (record) => { setDetail(record); setScreen('detail'); };
  const openReuse = (record) => {
    // 沿用內容開一筆全新需求（不動原本已結案的那筆）；照片請重新上傳
    setEditing(null);
    setPrefill({ ...(record.formData || {}), photos: [] });
    setScreen('form');
  };

  const handleSaveDraft = async (formData) => {
    setBusy(true);
    try {
      const rec = await saveRequisition(authUser, { recordId: editing?.id, formData, submit: false });
      await reload();
      setScreen('list');
      showNotice(rec?.status === 'submitted' ? '已儲存變更（此需求仍為「已送出」狀態）' : '已存成草稿', 'success');
    } catch (e) {
      showNotice(e?.message || '儲存失敗', 'error');
    } finally {
      setBusy(false);
    }
  };
  const handleSubmit = async (formData) => {
    setBusy(true);
    try {
      const rec = await saveRequisition(authUser, { recordId: editing?.id, formData, submit: true });
      let notifyOk = true;
      try {
        await notifyRequisition(authUser, rec.id);
      } catch (e) {
        notifyOk = false;
      }
      await reload();
      setLastSubmitted({ record: rec, notifyOk });
      setScreen('success');
    } catch (e) {
      showNotice(e?.message || '送出失敗', 'error');
    } finally {
      setBusy(false);
    }
  };
  const handleDelete = async (record) => {
    if (typeof window !== 'undefined' && !window.confirm(`確定刪除「${record.jobTitle || '此需求'}」？此動作無法復原。`)) return;
    setBusy(true);
    try {
      await deleteRequisition(authUser, record.id);
      await reload();
      showNotice('已刪除', 'success');
    } catch (e) {
      showNotice(e?.message || '刪除失敗', 'error');
    } finally {
      setBusy(false);
    }
  };

  // 版面外殼（函式回傳 elements，避免巢狀 component 造成 remount 清空表單）
  const shell = (children) => (
    <div className="min-h-screen bg-gray-100">
      <NoticeBanner notice={notice} />
      <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <Brand />
          <div className="flex items-center gap-2 flex-wrap">
            {authUser ? (
              <>
                <span className="hidden sm:inline text-xs text-gray-500 max-w-[180px] truncate">{authUser.email}</span>
                <button onClick={handleLogout} className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100">
                  <LogOut className="w-4 h-4" /> 登出
                </button>
              </>
            ) : (
              <button
                onClick={handleLogin}
                disabled={authBusy || !configured}
                className={`inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-white ${
                  authBusy || !configured ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <LogIn className="w-4 h-4" /> {authBusy ? '登入中...' : 'Google 登入'}
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );

  if (!configured) {
    return shell(
      <div className="max-w-md mx-auto mt-10 bg-white rounded-xl border border-amber-200 p-6 text-center">
        <p className="text-amber-700 font-semibold">尚未設定 Firebase 登入</p>
        <p className="text-sm text-gray-500 mt-2">請於環境變數設定 VITE_FIREBASE_* 後即可使用廠商招募需求功能。</p>
      </div>,
    );
  }

  if (!authReady) {
    return shell(
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> 載入中...
      </div>,
    );
  }

  // 強制 Gmail 登入：未登入只給登入畫面，看不到任何內容
  if (!authUser) {
    return shell(
      <div className="max-w-md mx-auto mt-10 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 to-blue-700" />
        <div className="p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">廠商招募需求</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            請先以 Google 登入，即可填寫招募需求表、建立多筆職缺需求。送出後灃禾招募團隊會收到通知並與您聯繫。
          </p>
          <button
            onClick={handleLogin}
            disabled={authBusy}
            className={`mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-white ${
              authBusy ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <LogIn className="w-4 h-4" /> {authBusy ? '登入中...' : '使用 Google 登入'}
          </button>
        </div>
      </div>,
    );
  }

  // 管理員 → 導向統一後台
  if (isAdmin) {
    return shell(
      <div className="max-w-md mx-auto mt-10 bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-600" />
        <p className="text-gray-700 font-semibold mt-3">此帳號為管理員</p>
        <p className="text-sm text-gray-500 mt-1">正帶您前往統一管理後台…</p>
        <a href="/admin" className="mt-4 inline-block px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">前往 /admin</a>
      </div>,
    );
  }

  // ---- 廠商：表單 ----
  if (screen === 'form') {
    const seed = editing
      ? { ...blankRequisitionForm(authUser), ...(editing.formData || {}) }
      : { ...blankRequisitionForm(authUser), ...(prefill || {}) };
    return shell(
      <>
        <button onClick={() => setScreen('list')} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> 返回我的招募需求
        </button>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">{editing ? '編輯招募需求' : '填寫招募需求表'}</h1>
        <p className="text-sm text-gray-500 mb-4">依「在台外籍畢業生人才需求表」欄位填寫。標示 <span className="text-red-500">*</span> 為必填；可先存成草稿，稍後再補完送出。</p>
        {!editing && prefill && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 mb-4">
            已複製既有需求內容為<b>一筆新的招募需求</b>，可直接調整後送出。<b>場地照片請重新上傳</b>。
          </div>
        )}
        <RequisitionForm
          initial={seed}
          editing={Boolean(editing)}
          busy={busy}
          onSaveDraft={handleSaveDraft}
          onSubmit={handleSubmit}
          onCancel={() => setScreen('list')}
        />
      </>,
    );
  }

  // ---- 廠商：唯讀明細（已招募中/已結案）----
  if (screen === 'detail' && detail) {
    return shell(
      <>
        <button onClick={() => setScreen('list')} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> 返回我的招募需求
        </button>
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800">{detail.jobTitle || '（未命名職缺）'}</h1>
          <p className="text-sm text-gray-500 mt-1">{detail.companyName}｜{dash(detail.location)}｜<StatusBadge status={detail.status} /></p>
          <p className="text-xs text-gray-400 mt-1">此需求已由灃禾處理（{detail.status === 'open' ? '招募中' : '已結案'}），如需修改請與灃禾聯繫。{detail.status === 'closed' && '若要再次招募，可於列表點「重新招募」複製為新需求。'}</p>
        </div>
        <RequisitionDetail record={detail} />
      </>,
    );
  }

  // ---- 廠商：送出成功 ----
  if (screen === 'success' && lastSubmitted) {
    const rec = lastSubmitted.record;
    return shell(
      <div className="max-w-xl mx-auto mt-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center mx-auto shadow-lg">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mt-4">招募需求已送出</h1>
        <p className="text-sm text-gray-500 mt-2">
          需求編號 <b>#{String(rec.id).slice(0, 8)}</b>｜{rec.companyName}｜{rec.jobTitle}
        </p>
        <div className={`mt-5 rounded-lg border px-4 py-3 text-sm ${lastSubmitted.notifyOk ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          {lastSubmitted.notifyOk
            ? '已通知灃禾招募團隊（Email＋Telegram），將盡快與您聯繫。'
            : '需求已送出並存檔；通知發送未完全成功，灃禾仍可在後台看到此需求。'}
        </div>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => setScreen('list')} className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">回我的招募需求</button>
          <button onClick={openNew} className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50">再新增一筆</button>
        </div>
      </div>,
    );
  }

  // ---- 廠商：列表 ----
  const countBy = (s) => records.filter((r) => r.status === s).length;
  return shell(
    <>
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Client Portal</p>
        <h1 className="text-2xl font-bold text-gray-800 mt-1">我的招募需求</h1>
        <p className="text-sm text-gray-500 mt-1">您可以建立多筆招募需求，每一筆對應一個職缺。送出後灃禾招募團隊會收到 Email 與 Telegram 通知。</p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-4">
        此頁僅顯示<b>您自己送出的</b>招募需求；別人送出的您看不到。送出後由灃禾審核。
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          ['草稿', countBy('draft'), 'text-gray-500'],
          ['已送出', countBy('submitted'), 'text-amber-600'],
          ['招募中', countBy('open'), 'text-emerald-600'],
          ['已結案', countBy('closed'), 'text-gray-400'],
        ].map(([label, value, color]) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500">{label}</p>
            <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <span className="text-sm font-semibold text-gray-500">
          共 {records.length} 筆{loading && <Loader2 className="inline w-4 h-4 animate-spin ml-2 text-gray-400" />}
        </span>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
          <PlusCircle className="w-4 h-4" /> 新增招募需求
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {records.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-3 font-bold">禾</div>
            <p className="font-semibold text-gray-700">尚未建立招募需求</p>
            <p className="text-sm mt-1">點「新增招募需求」開始填寫第一筆。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-2.5 font-semibold">職缺名稱</th>
                  <th className="px-4 py-2.5 font-semibold">工作地點</th>
                  <th className="px-4 py-2.5 font-semibold">需求人數</th>
                  <th className="px-4 py-2.5 font-semibold">雇用性質</th>
                  <th className="px-4 py-2.5 font-semibold">狀態</th>
                  <th className="px-4 py-2.5 font-semibold">更新時間</th>
                  <th className="px-4 py-2.5 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3"><span className="font-bold text-blue-700">{r.jobTitle || '（未命名職缺）'}</span></td>
                    <td className="px-4 py-3 text-gray-700">{dash(r.location)}</td>
                    <td className="px-4 py-3 text-gray-700">{r.headcount ? `${r.headcount} 人` : '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{dash(r.formData?.employment)}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-gray-500">{fmt(r.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 whitespace-nowrap">
                        <button onClick={() => openEditOrView(r)} className="px-2.5 py-2 rounded-md text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50">
                          {r.status === 'draft' ? '繼續填寫' : r.status === 'submitted' ? '編輯' : '檢視'}
                        </button>
                        {r.status === 'closed' && (
                          <button onClick={() => openReuse(r)} className="px-2.5 py-2 rounded-md text-xs font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                            重新招募
                          </button>
                        )}
                        {(r.status === 'draft' || r.status === 'submitted') && (
                          <button onClick={() => handleDelete(r)} disabled={busy} className="px-2.5 py-2 rounded-md text-xs font-semibold border border-red-100 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60">
                            刪除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>,
  );
}
