import React from 'react';
import { STATUS } from './RequisitionForm';

export const dash = (v) => (v === '' || v == null ? '—' : v);

export const fmt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
};

export const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.draft;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${s.cls}`}>{s.label}</span>;
};

const DetailRow = ({ k, v, full }) => (
  <div className={`grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-2.5 border-b border-gray-100 text-sm ${full ? 'sm:col-span-2' : ''}`}>
    <span className="text-gray-500 font-semibold">{k}</span>
    <span className="text-gray-800 break-words min-w-0">{dash(v)}</span>
  </div>
);

// 唯讀明細（廠商檢視自己已處理的需求、管理員檢視任一需求）
export const RequisitionDetail = ({ record }) => {
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
      {Array.isArray(f.photos) && f.photos.length > 0 && (
        <Card title="場地照片">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:col-span-2">
            {f.photos.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-gray-200 aspect-[4/3] bg-gray-50">
                <img src={src} alt={`場地照片 ${i + 1}`} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
