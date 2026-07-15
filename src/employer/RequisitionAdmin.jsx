import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { listRequisitions, setRequisitionStatus } from '../modules/requisitionClient';
import { STATUS } from './RequisitionForm';
import { RequisitionDetail, StatusBadge, dash, fmt } from './RequisitionShared';

// 招募需求後台 — 嵌入履歷管理頁的「招募需求」分頁。自行載入資料，樣式對齊履歷 admin。
export default function RequisitionAdmin({ authUser, showNotice }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');

  const reload = async () => {
    if (!authUser) return;
    setLoading(true);
    try {
      setRecords(await listRequisitions(authUser));
    } catch (e) {
      showNotice?.(e?.message || '載入招募需求失敗', 'error');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  const changeStatus = async (record, status) => {
    setBusy(true);
    try {
      const updated = await setRequisitionStatus(authUser, record.id, status);
      await reload();
      setDetail((d) => (d && d.id === updated.id ? updated : d));
      showNotice?.('狀態已更新。', 'info');
    } catch (e) {
      showNotice?.(e?.message || '更新失敗', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (detail) {
    return (
      <div className="bg-white border border-blue-100 rounded-2xl shadow-sm p-5 md:p-6">
        <button onClick={() => setDetail(null)} className="text-sm font-semibold text-blue-700 mb-4">← 返回招募需求列表</button>
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">{detail.jobTitle || '（未命名職缺）'}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {detail.companyName}｜{dash(detail.location)}｜<StatusBadge status={detail.status} />｜送出：{fmt(detail.submittedAt)}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {detail.status === 'submitted' && (
              <button disabled={busy} onClick={() => changeStatus(detail, 'open')} className="px-3 py-2 rounded-md text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
                核可並開始招募
              </button>
            )}
            {detail.status === 'open' && (
              <button disabled={busy} onClick={() => changeStatus(detail, 'closed')} className="px-3 py-2 rounded-md text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                結案
              </button>
            )}
            {detail.status === 'closed' && (
              <button disabled={busy} onClick={() => changeStatus(detail, 'open')} className="px-3 py-2 rounded-md text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60">
                重新開放招募
              </button>
            )}
          </div>
        </div>
        <RequisitionDetail record={detail} />
      </div>
    );
  }

  const filtered = records.filter(
    (r) => (!statusFilter || r.status === statusFilter) && (!companyFilter || (r.companyName || '（未填單位）') === companyFilter),
  );
  const groupsMap = new Map();
  filtered.forEach((r) => {
    const k = r.companyName || '（未填單位）';
    if (!groupsMap.has(k)) groupsMap.set(k, []);
    groupsMap.get(k).push(r);
  });
  const groups = Array.from(groupsMap.entries());
  const companies = Array.from(new Set(records.map((r) => r.companyName || '（未填單位）')));
  const countBy = (s) => records.filter((r) => r.status === s).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['公司數', new Set(records.map((r) => r.companyName || '（未填單位）')).size, 'text-blue-700'],
          ['需求總數', records.length, 'text-gray-800'],
          ['待處理（已送出）', countBy('submitted'), 'text-amber-600'],
          ['招募中', countBy('open'), 'text-emerald-600'],
        ].map(([label, value, color]) => (
          <div key={label} className="bg-white border border-blue-100 rounded-2xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500">{label}</p>
            <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-blue-100 rounded-2xl shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-semibold text-gray-500 mb-1">公司</label>
          <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="w-full sm:w-56 rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">全部公司</option>
            {companies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-semibold text-gray-500 mb-1">狀態</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full sm:w-40 rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">全部狀態</option>
            {Object.keys(STATUS).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
          </select>
        </div>
        {loading && <span className="text-sm text-gray-400 inline-flex items-center gap-1"><Loader2 className="w-4 h-4 animate-spin" /> 載入中</span>}
      </div>

      {groups.length === 0 ? (
        <div className="bg-white border border-blue-100 rounded-2xl shadow-sm p-10 text-center text-gray-500">目前沒有符合條件的招募需求</div>
      ) : (
        groups.map(([company, items]) => (
          <div key={company} className="bg-white border border-blue-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-blue-50 border-b border-blue-100 flex-wrap">
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
              <table className="w-full text-sm min-w-[720px]">
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
                      <td className="px-4 py-2.5"><span className="font-bold text-blue-700">{r.jobTitle || '（未命名）'}</span><div className="text-gray-400 text-xs">#{String(r.id).slice(0, 8)}</div></td>
                      <td className="px-4 py-2.5 text-gray-700">{dash(r.location)}</td>
                      <td className="px-4 py-2.5 text-gray-700">{r.headcount ? `${r.headcount} 人` : '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{dash(r.formData?.employment)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-2.5 text-gray-500">{r.submittedAt ? fmt(r.submittedAt) : '（草稿）'}</td>
                      <td className="px-4 py-2.5"><button onClick={() => setDetail(r)} className="px-2.5 py-1.5 rounded-md text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50">檢視</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
