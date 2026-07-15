import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileText, Loader2, LogIn, LogOut, PlusCircle } from 'lucide-react';
import {
  isFirebaseAuthConfigured,
  loginWithGoogle,
  logoutAuthUser,
  subscribeAuthUser,
} from './modules/authClient';
import NoticeBanner from './components/NoticeBanner';
import RequisitionForm, { STATUS, blankRequisitionForm } from './employer/RequisitionForm';
import {
  listRequisitions,
  notifyRequisition,
  saveRequisition,
  setRequisitionStatus,
} from './modules/requisitionClient';

const parseAdminEmails = () =>
  String(import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const dash = (v) => (v === '' || v == null ? '—' : v);

const fmt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
};

const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.draft;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${s.cls}`}>{s.label}</span>;
};

// ---- 讀取用：把 record 展開成唯讀明細 ----
const DetailRow = ({ k, v, full }) => (
  <div className={`grid grid-cols-[110px_1fr] gap-3 py-2.5 border-b border-gray-100 text-sm ${full ? 'sm:col-span-2' : ''}`}>
    <span className="text-gray-500 font-semibold">{k}</span>
    <span className="text-gray-800 break-words">{dash(v)}</span>
  </div>
);

const RequisitionDetail = ({ record }) => {
  const f = record.formData || {};
  const works = (Array.isArray(f.work) ? f.work : []).filter((w) => w && w.trim()).map((w, i) => `${i + 1}. ${w}`).join('　');
  const salary = [f.salBase && `底薪 ${f.salBase}`, f.salAllow && `津貼 ${f.salAllow}`, f.salBonus && `獎金 ${f.salBonus}`].filter(Boolean).join('／');
  const shifts = [f.shiftM && `早 ${f.shiftM}`, f.shiftMid && `中 ${f.shiftMid}`, f.shiftE && `晚 ${f.shiftE}`].filter(Boolean).join('／');
  const health = [...(Array.isArray(f.health) ? f.health : []), f.healthOther].filter(Boolean).join('、');
  const Card = ({ title, children }) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
      <h3 className="text-base font-bold text-gray-800 border-b border-gray-200 pb-2 mb-2">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">{children}</div>
    </div>
  );
  return (
    <div className="space-y-4">
      <Card title="實習單位基本資訊">
        <DetailRow k="單位名稱" v={f.unitName || record.companyName} />
        <DetailRow k="統一編號" v={f.taxId} />
        <DetailRow k="連絡人" v={f.contact} />
        <DetailRow k="電話" v={f.phone} />
        <DetailRow k="Email" v={f.email} />
        <DetailRow k="需求人數" v={f.headcount ? `${f.headcount} 人` : ''} />
        <DetailRow k="單位地址" v={f.address} full />
        <DetailRow k="性別" v={f.gender} />
        <DetailRow k="雇用性質" v={f.employment} />
      </Card>
      <Card title="實習內容">
        <DetailRow k="中文程度" v={f.chinese} />
        <DetailRow k="英文程度" v={f.english} />
        <DetailRow k="科系需求" v={f.major} full />
        <DetailRow k="工作項目" v={works} full />
        <DetailRow k="補充說明" v={f.workNote} full />
      </Card>
      <Card title="實習條件">
        <DetailRow k="薪資條件" v={salary} full />
        <DetailRow k="加班費給付" v={f.otPay === '其他' ? `其他：${dash(f.otOther)}` : f.otPay} />
        <DetailRow k="其他福利" v={f.benefits} />
        <DetailRow k="上班時間" v={shifts} full />
        <DetailRow k="配合加班" v={`${f.needOT || ''}${f.otHours ? `（月均 ${f.otHours} 小時）` : ''}`} />
        <DetailRow k="淡旺季之分" v={f.season} />
        <DetailRow k="月休方式" v={f.rest === '排休' ? `排休 ${dash(f.restDays)} 天/月` : f.rest} />
        <DetailRow k="住宿" v={`${f.lodging || ''}${f.lodgingNote ? `（${f.lodgingNote}）` : ''}`} />
        <DetailRow k="餐點" v={`${f.meals || ''}${f.meals === '有提供' && f.mealCount ? ` ${f.mealCount} 餐/日` : ''}${f.mealNote ? `（${f.mealNote}）` : ''}`} />
        <DetailRow k="特殊體檢" v={health} full />
      </Card>
    </div>
  );
};

// 品牌列
const Brand = () => (
  <a href="/employer" className="flex items-center gap-2 text-blue-700 font-bold text-lg">
    <span className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">禾</span>
    <span className="leading-tight">
      灃禾人力銀行
      <span className="block text-[11px] font-medium text-gray-500">廠商專區 · 招募需求</span>
    </span>
  </a>
);

export default function EmployerApp() {
  const configured = isFirebaseAuthConfigured();
  const pathname = typeof window !== 'undefined' ? window.location.pathname || '' : '';
  const wantAdmin = /^\/employer\/admin(?:\/|$)/i.test(pathname);

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
  const [detail, setDetail] = useState(null);
  const [lastSubmitted, setLastSubmitted] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');

  const adminEmails = parseAdminEmails();
  const email = String(authUser?.email || '').trim().toLowerCase();
  const isAdmin = email ? adminEmails.includes(email) : false;
  const isAdminView = wantAdmin && isAdmin;

  useEffect(() => {
    const unsub = subscribeAuthUser((u) => {
      setAuthUser(u || null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

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
    if (authReady && authUser) reload(authUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, authUser, isAdminView]);

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

  const openNew = () => {
    setEditing(null);
    setScreen('form');
  };
  const openEditOrView = (record) => {
    if (record.status === 'draft' || record.status === 'submitted') {
      setEditing(record);
      setScreen('form');
    } else {
      setDetail(record);
      setScreen('detail');
    }
  };
  const openDetail = (record) => {
    setDetail(record);
    setScreen('detail');
  };

  const handleSaveDraft = async (formData) => {
    setBusy(true);
    try {
      await saveRequisition(authUser, { recordId: editing?.id, formData, submit: false });
      await reload();
      setScreen('list');
      showNotice('已存成草稿', 'success');
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

  const adminSetStatus = async (record, status) => {
    setBusy(true);
    try {
      const updated = await setRequisitionStatus(authUser, record.id, status);
      await reload();
      setDetail(updated);
      showNotice('狀態已更新', 'success');
    } catch (e) {
      showNotice(e?.message || '更新失敗', 'error');
    } finally {
      setBusy(false);
    }
  };

  // ---- 版面外殼 ----
  // 用「函式回傳 elements」而非巢狀 component，避免每次 render 產生新 component type
  // 而把子樹（含填寫中的表單）整個 remount 掉、清空使用者輸入。
  const shell = (children) => (
    <div className="min-h-screen bg-gray-100">
      <NoticeBanner notice={notice} />
      <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <Brand />
          <div className="flex items-center gap-2 flex-wrap">
            {authUser && !isAdminView && (
              <>
                <button onClick={openNew} className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100">
                  <PlusCircle className="w-4 h-4" /> 新增需求
                </button>
                {isAdmin && (
                  <a href="/employer/admin" className="px-3 py-2 rounded-md text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50">
                    管理後台
                  </a>
                )}
              </>
            )}
            {authUser && isAdminView && (
              <a href="/employer" className="px-3 py-2 rounded-md text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50">
                廠商填寫頁
              </a>
            )}
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
    return (
      shell(<>
        <div className="max-w-md mx-auto mt-10 bg-white rounded-xl border border-amber-200 p-6 text-center">
          <p className="text-amber-700 font-semibold">尚未設定 Firebase 登入</p>
          <p className="text-sm text-gray-500 mt-2">請於環境變數設定 VITE_FIREBASE_* 後即可使用廠商招募需求功能。</p>
        </div>
      </>)
    );
  }

  if (!authReady) {
    return (
      shell(<>
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> 載入中...
        </div>
      </>)
    );
  }

  if (!authUser) {
    return (
      shell(<>
        <div className="max-w-md mx-auto mt-10 bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">廠商招募需求</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            登入後即可填寫招募需求表，建立多筆職缺需求。送出後灃禾招募團隊會收到通知並與您聯繫。
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
      </>)
    );
  }

  if (wantAdmin && !isAdmin) {
    return (
      shell(<>
        <div className="max-w-md mx-auto mt-10 bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
          <p className="text-gray-800 font-semibold">需要管理員權限</p>
          <p className="text-sm text-gray-500 mt-2">此頁僅限灃禾管理員。</p>
          <a href="/employer" className="mt-4 inline-block px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
            回廠商填寫頁
          </a>
        </div>
      </>)
    );
  }

  // ================= ADMIN VIEW =================
  if (isAdminView) {
    const filtered = records.filter((r) => (!statusFilter || r.status === statusFilter) && (!companyFilter || (r.companyName || '') === companyFilter));
    const groupsMap = new Map();
    filtered.forEach((r) => {
      const key = r.companyName || '（未填單位）';
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key).push(r);
    });
    const groups = Array.from(groupsMap.entries());
    const companies = Array.from(new Set(records.map((r) => r.companyName || '（未填單位）')));
    const countBy = (s) => records.filter((r) => r.status === s).length;

    if (screen === 'detail' && detail) {
      return (
        shell(<>
          <button onClick={() => setScreen('list')} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 mb-4">
            <ArrowLeft className="w-4 h-4" /> 返回招募需求管理
          </button>
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{detail.jobTitle || '（未命名職缺）'}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {detail.companyName}｜{dash(detail.location)}｜<StatusBadge status={detail.status} />｜送出：{fmt(detail.submittedAt)}
              </p>
            </div>
            <div className="flex gap-2">
              {detail.status === 'submitted' && (
                <button onClick={() => adminSetStatus(detail, 'open')} disabled={busy} className="px-3 py-2 rounded-md text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
                  核可並開始招募
                </button>
              )}
              {detail.status === 'open' && (
                <button onClick={() => adminSetStatus(detail, 'closed')} disabled={busy} className="px-3 py-2 rounded-md text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                  結案
                </button>
              )}
            </div>
          </div>
          <RequisitionDetail record={detail} />
        </>)
      );
    }

    return (
      shell(<>
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Requisitions</p>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">招募需求管理</h1>
          <p className="text-sm text-gray-500 mt-1">依公司分組檢視所有廠商送出的招募需求。</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            ['公司數', new Set(records.map((r) => r.companyName || '（未填單位）')).size, 'text-blue-600'],
            ['需求總數', records.length, 'text-gray-800'],
            ['待處理（已送出）', countBy('submitted'), 'text-amber-600'],
            ['招募中', countBy('open'), 'text-emerald-600'],
          ].map(([label, value, color]) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500">{label}</p>
              <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">公司</label>
            <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">全部公司</option>
              {companies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">狀態</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">全部狀態</option>
              {Object.keys(STATUS).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
            </select>
          </div>
          {loading && <span className="text-sm text-gray-400 inline-flex items-center gap-1"><Loader2 className="w-4 h-4 animate-spin" /> 載入中</span>}
        </div>

        {groups.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500">目前沒有符合條件的招募需求</div>
        ) : (
          <div className="space-y-4">
            {groups.map(([company, items]) => (
              <div key={company} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-blue-50 border-b border-gray-200 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">{company.slice(0, 1)}</span>
                    <div>
                      <div className="font-bold text-gray-800">{company}</div>
                      <div className="text-xs text-gray-500">統編 {dash(items[0]?.formData?.taxId)} · {dash(items[0]?.formData?.contact)} · {dash(items[0]?.formData?.phone)}</div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-bold text-blue-700">
                    <b className="text-sm">{items.length}</b> 筆需求
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="px-4 py-2 font-semibold">職缺名稱</th>
                        <th className="px-4 py-2 font-semibold">工作地點</th>
                        <th className="px-4 py-2 font-semibold">需求人數</th>
                        <th className="px-4 py-2 font-semibold">雇用性質</th>
                        <th className="px-4 py-2 font-semibold">狀態</th>
                        <th className="px-4 py-2 font-semibold">送出時間</th>
                        <th className="px-4 py-2 font-semibold w-20">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r) => (
                        <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2.5"><span className="font-bold text-blue-700">{r.jobTitle || '（未命名）'}</span></td>
                          <td className="px-4 py-2.5 text-gray-700">{dash(r.location)}</td>
                          <td className="px-4 py-2.5 text-gray-700">{r.headcount ? `${r.headcount} 人` : '—'}</td>
                          <td className="px-4 py-2.5 text-gray-700">{dash(r.formData?.employment)}</td>
                          <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                          <td className="px-4 py-2.5 text-gray-500">{r.submittedAt ? fmt(r.submittedAt) : '（草稿）'}</td>
                          <td className="px-4 py-2.5">
                            <button onClick={() => openDetail(r)} className="px-2.5 py-1.5 rounded-md text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50">檢視</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </>)
    );
  }

  // ================= CLIENT VIEW =================
  if (screen === 'form') {
    return (
      shell(<>
        <button onClick={() => setScreen('list')} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> 返回我的招募需求
        </button>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">{editing ? '編輯招募需求' : '填寫招募需求表'}</h1>
        <p className="text-sm text-gray-500 mb-5">依「在台外籍畢業生人才需求表」欄位填寫。標示 <span className="text-red-500">*</span> 為必填；可先存成草稿，稍後再補完送出。</p>
        <RequisitionForm
          initial={editing ? { ...blankRequisitionForm(authUser), ...(editing.formData || {}) } : blankRequisitionForm(authUser)}
          editing={Boolean(editing)}
          busy={busy}
          onSaveDraft={handleSaveDraft}
          onSubmit={handleSubmit}
          onCancel={() => setScreen('list')}
        />
      </>)
    );
  }

  if (screen === 'detail' && detail) {
    return (
      shell(<>
        <button onClick={() => setScreen('list')} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> 返回我的招募需求
        </button>
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800">{detail.jobTitle || '（未命名職缺）'}</h1>
          <p className="text-sm text-gray-500 mt-1">{detail.companyName}｜{dash(detail.location)}｜<StatusBadge status={detail.status} /></p>
          <p className="text-xs text-gray-400 mt-1">此需求已由灃禾處理（{STATUS[detail.status]?.label}），如需修改請與灃禾聯繫。</p>
        </div>
        <RequisitionDetail record={detail} />
      </>)
    );
  }

  if (screen === 'success' && lastSubmitted) {
    const rec = lastSubmitted.record;
    return (
      shell(<>
        <div className="max-w-xl mx-auto mt-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center mx-auto shadow-lg">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mt-4">招募需求已送出</h1>
          <p className="text-sm text-gray-500 mt-2">
            需求編號 <b>#{rec.id.slice(0, 8)}</b>｜{rec.companyName}｜{rec.jobTitle}
          </p>
          <div className={`mt-5 rounded-lg border px-4 py-3 text-sm ${lastSubmitted.notifyOk ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
            {lastSubmitted.notifyOk
              ? '已通知灃禾招募團隊（Email＋Telegram），將盡快與您聯繫。'
              : '需求已送出並存檔；通知發送未完全成功，灃禾仍可在後台看到此需求。'}
          </div>
          <div className="mt-6 flex gap-3 justify-center">
            <button onClick={() => setScreen('list')} className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">回我的招募需求</button>
            <button onClick={openNew} className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50">再新增一筆</button>
          </div>
        </div>
      </>)
    );
  }

  // client list
  const countBy = (s) => records.filter((r) => r.status === s).length;
  return (
    shell(<>
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

      <div className="flex items-center justify-between mb-3">
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
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-2.5 font-semibold">職缺名稱</th>
                  <th className="px-4 py-2.5 font-semibold">工作地點</th>
                  <th className="px-4 py-2.5 font-semibold">需求人數</th>
                  <th className="px-4 py-2.5 font-semibold">雇用性質</th>
                  <th className="px-4 py-2.5 font-semibold">狀態</th>
                  <th className="px-4 py-2.5 font-semibold">更新時間</th>
                  <th className="px-4 py-2.5 font-semibold w-28">操作</th>
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
                      <button onClick={() => openEditOrView(r)} className="px-2.5 py-1.5 rounded-md text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50">
                        {r.status === 'draft' ? '繼續填寫' : r.status === 'submitted' ? '編輯' : '檢視'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>)
  );
}
