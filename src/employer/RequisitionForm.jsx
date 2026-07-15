import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import CheckboxGroup from '../components/CheckboxGroup';

// 招募需求表選項（對應「在台外籍畢業生人才需求表」）
export const OPT = {
  employment: ['評點制', '一般雇用（限畢業後2年內學生）', '兼職'],
  gender: ['不限', '男', '女'],
  lang: ['接受不會', '需略懂字彙', '需可基本溝通', '流利'],
  overtimePay: ['依勞基法給付', '其他'],
  yesno: ['是', '否'],
  hasnot: ['有', '無'],
  rest: ['周休二日', '排休'],
  provide: ['有提供', '無提供'],
  health: ['供膳檢', '粉塵檢', '噪音檢', '其他體檢項目'],
};

export const STATUS = {
  draft: { label: '草稿', cls: 'bg-gray-100 text-gray-600' },
  submitted: { label: '已送出', cls: 'bg-amber-50 text-amber-700' },
  open: { label: '招募中', cls: 'bg-emerald-50 text-emerald-700' },
  closed: { label: '已結案', cls: 'bg-gray-100 text-gray-400' },
};

// key 需與後端反正規化/通知一致：unitName=單位名稱。
export const blankRequisitionForm = (authUser) => ({
  jobTitle: '',
  location: '',
  headcount: '',
  gender: '不限',
  employment: '評點制',
  unitName: '',
  taxId: '',
  contact: authUser?.displayName || '',
  phone: '',
  email: authUser?.email || '',
  address: '',
  chinese: '需可基本溝通',
  english: '接受不會',
  major: '',
  work: ['', '', '', '', ''],
  workNote: '',
  salBase: '',
  salAllow: '',
  salBonus: '',
  otPay: '依勞基法給付',
  otOther: '',
  benefits: '提供一餐員工餐',
  shiftM: '',
  shiftMid: '',
  shiftE: '',
  needOT: '是',
  otHours: '',
  season: '無',
  rest: '周休二日',
  restDays: '',
  lodging: '無提供',
  lodgingNote: '',
  meals: '有提供',
  mealCount: '1',
  mealNote: '',
  health: [],
  healthOther: '',
  consent: false,
});

const REQUIRED = [
  ['jobTitle', '職缺名稱'],
  ['location', '工作地點'],
  ['unitName', '單位名稱'],
  ['taxId', '統一編號'],
  ['contact', '連絡人姓名'],
  ['phone', '電話'],
  ['email', 'Email'],
  ['address', '單位地址'],
  ['headcount', '需求人數'],
];

const INPUT_BASE =
  'w-full rounded-md border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none px-3 py-2 text-base';

const SectionCard = ({ index, title, hint, children }) => (
  <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
    <h2 className="text-lg sm:text-xl font-bold text-gray-800 border-b border-gray-200 pb-3 mb-4 sm:mb-6 flex items-center gap-2">
      <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">
        {index}
      </span>
      {title}
      {hint && <span className="ml-auto text-xs font-normal text-gray-400">{hint}</span>}
    </h2>
    {children}
  </div>
);

const Field = ({ label, required, error, children, full }) => (
  <div className={full ? 'sm:col-span-2' : ''}>
    <label className="block text-gray-700 font-semibold mb-1.5 text-sm">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
  </div>
);

const PillSelect = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => {
      const active = value === opt;
      return (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
            active
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${active ? 'bg-blue-600' : 'bg-gray-300'}`} />
          {opt}
        </button>
      );
    })}
  </div>
);

const RequisitionForm = ({ initial, editing = false, busy = false, onSaveDraft, onSubmit, onCancel }) => {
  const [data, setData] = useState(() => ({ ...blankRequisitionForm(), ...(initial || {}) }));
  const [errors, setErrors] = useState({});
  const [summary, setSummary] = useState([]);

  const setField = (key, value) => setData((d) => ({ ...d, [key]: value }));
  const onTextChange = (e) => setField(e.target.name, e.target.value);
  const setWork = (i, value) =>
    setData((d) => {
      const work = Array.isArray(d.work) ? [...d.work] : ['', '', '', '', ''];
      work[i] = value;
      return { ...d, work };
    });
  const onCheckboxChange = (category, opt) =>
    setData((d) => {
      const arr = Array.isArray(d[category]) ? d[category] : [];
      return { ...d, [category]: arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt] };
    });

  const getErrorInputClass = (key, base) =>
    errors[key] ? `${base} border-red-500 ring-2 ring-red-500 bg-red-50` : base;

  const validate = () => {
    const errs = {};
    const list = [];
    REQUIRED.forEach(([key, label]) => {
      if (!String(data[key] || '').trim()) {
        errs[key] = `${label}為必填`;
        list.push(`${label}為必填`);
      }
    });
    if (!data.consent) list.push('請勾選確認同意事項');
    setErrors(errs);
    setSummary(list);
    if (list.length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (validate()) onSubmit(data);
  };
  const handleDraft = () => {
    setErrors({});
    setSummary([]);
    onSaveDraft(data);
  };

  const checkboxShared = { data, activeErrorField: '', onCheckboxChange, onTextChange, getErrorInputClass };

  return (
    <div className="space-y-5">
      {summary.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="font-bold text-red-700 text-sm">請修正以下欄位後再送出：</p>
          <ul className="mt-1.5 list-disc pl-5 text-sm text-red-700 space-y-0.5">
            {summary.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 1. 職缺資訊 */}
      <SectionCard index={1} title="職缺資訊" hint="用於區分同一公司的不同職缺">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="職缺名稱" required error={errors.jobTitle}>
            <input
              name="jobTitle"
              value={data.jobTitle}
              onChange={onTextChange}
              placeholder="例：外場服務人員"
              className={getErrorInputClass('jobTitle', INPUT_BASE)}
            />
          </Field>
          <Field label="工作地點／門市" required error={errors.location}>
            <input
              name="location"
              value={data.location}
              onChange={onTextChange}
              placeholder="例：桃園中壢門市"
              className={getErrorInputClass('location', INPUT_BASE)}
            />
          </Field>
        </div>
      </SectionCard>

      {/* 2. 實習單位基本資訊 */}
      <SectionCard index={2} title="實習單位基本資訊">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="單位名稱" required error={errors.unitName}>
            <input name="unitName" value={data.unitName} onChange={onTextChange} className={getErrorInputClass('unitName', INPUT_BASE)} />
          </Field>
          <Field label="統一編號" required error={errors.taxId}>
            <input name="taxId" value={data.taxId} onChange={onTextChange} placeholder="8 碼" className={getErrorInputClass('taxId', INPUT_BASE)} />
          </Field>
          <Field label="連絡人姓名" required error={errors.contact}>
            <input name="contact" value={data.contact} onChange={onTextChange} className={getErrorInputClass('contact', INPUT_BASE)} />
          </Field>
          <Field label="電話" required error={errors.phone}>
            <input name="phone" value={data.phone} onChange={onTextChange} className={getErrorInputClass('phone', INPUT_BASE)} />
          </Field>
          <Field label="Email" required error={errors.email}>
            <input name="email" value={data.email} onChange={onTextChange} className={getErrorInputClass('email', INPUT_BASE)} />
          </Field>
          <Field label="需求人數" required error={errors.headcount}>
            <input name="headcount" value={data.headcount} onChange={onTextChange} inputMode="numeric" placeholder="例：3" className={getErrorInputClass('headcount', INPUT_BASE)} />
          </Field>
          <Field label="單位地址" required error={errors.address} full>
            <input name="address" value={data.address} onChange={onTextChange} className={getErrorInputClass('address', INPUT_BASE)} />
          </Field>
          <Field label="性別">
            <PillSelect options={OPT.gender} value={data.gender} onChange={(v) => setField('gender', v)} />
          </Field>
          <Field label="雇用性質" required>
            <PillSelect options={OPT.employment} value={data.employment} onChange={(v) => setField('employment', v)} />
          </Field>
        </div>
      </SectionCard>

      {/* 3. 實習內容 */}
      <SectionCard index={3} title="實習內容">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="中文程度需求（聽說）">
            <PillSelect options={OPT.lang} value={data.chinese} onChange={(v) => setField('chinese', v)} />
          </Field>
          <Field label="英文程度需求（聽說）">
            <PillSelect options={OPT.lang} value={data.english} onChange={(v) => setField('english', v)} />
          </Field>
          <Field label="科系需求" full>
            <input name="major" value={data.major} onChange={onTextChange} placeholder="例：餐飲/觀光相關，或填「不限」" className={INPUT_BASE} />
          </Field>
        </div>
        <div className="mt-4">
          <label className="block text-gray-700 font-semibold mb-2 text-sm">工作項目（最多 5 項）</label>
          <div className="space-y-2">
            {data.work.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-7 h-7 shrink-0 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <input value={w} onChange={(e) => setWork(i, e.target.value)} placeholder={`工作項目 ${i + 1}`} className={INPUT_BASE} />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <Field label="補充說明">
            <textarea name="workNote" value={data.workNote} onChange={onTextChange} rows={3} placeholder="其他工作內容補充說明" className={INPUT_BASE} />
          </Field>
        </div>
      </SectionCard>

      {/* 4. 實習條件 */}
      <SectionCard index={4} title="實習條件">
        <p className="text-sm font-semibold text-blue-700 mb-2">薪資條件</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="底薪"><input name="salBase" value={data.salBase} onChange={onTextChange} placeholder="例：28,590" className={INPUT_BASE} /></Field>
          <Field label="津貼"><input name="salAllow" value={data.salAllow} onChange={onTextChange} placeholder="例：全勤 1,500" className={INPUT_BASE} /></Field>
          <Field label="獎金"><input name="salBonus" value={data.salBonus} onChange={onTextChange} placeholder="例：季獎金" className={INPUT_BASE} /></Field>
        </div>

        <hr className="my-5 border-gray-100" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="加班費給付">
            <PillSelect options={OPT.overtimePay} value={data.otPay} onChange={(v) => setField('otPay', v)} />
            {data.otPay === '其他' && (
              <input name="otOther" value={data.otOther} onChange={onTextChange} placeholder="其他方式說明" className={`${INPUT_BASE} mt-2`} />
            )}
          </Field>
          <Field label="其他福利">
            <textarea name="benefits" value={data.benefits} onChange={onTextChange} rows={2} className={INPUT_BASE} />
          </Field>
        </div>

        <hr className="my-5 border-gray-100" />
        <p className="text-sm font-semibold text-blue-700 mb-2">上班時間</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="早班"><input name="shiftM" value={data.shiftM} onChange={onTextChange} placeholder="例：10:30 起" className={INPUT_BASE} /></Field>
          <Field label="中班"><input name="shiftMid" value={data.shiftMid} onChange={onTextChange} placeholder="例：14:00 起" className={INPUT_BASE} /></Field>
          <Field label="晚班"><input name="shiftE" value={data.shiftE} onChange={onTextChange} placeholder="例：17:00 起" className={INPUT_BASE} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <Field label="是否須配合加班">
            <PillSelect options={OPT.yesno} value={data.needOT} onChange={(v) => setField('needOT', v)} />
          </Field>
          <Field label="每月平均加班時數">
            <div className="flex items-center gap-2">
              <input name="otHours" value={data.otHours} onChange={onTextChange} inputMode="numeric" className={`${INPUT_BASE} max-w-[110px]`} />
              <span className="text-sm text-gray-500 font-medium">小時</span>
            </div>
          </Field>
          <Field label="是否有淡旺季之分">
            <PillSelect options={OPT.hasnot} value={data.season} onChange={(v) => setField('season', v)} />
          </Field>
        </div>

        <hr className="my-5 border-gray-100" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="月休方式">
            <PillSelect options={OPT.rest} value={data.rest} onChange={(v) => setField('rest', v)} />
          </Field>
          <Field label="排休天數（若為排休）">
            <div className="flex items-center gap-2">
              <input name="restDays" value={data.restDays} onChange={onTextChange} inputMode="numeric" className={`${INPUT_BASE} max-w-[110px]`} />
              <span className="text-sm text-gray-500 font-medium">天／月</span>
            </div>
          </Field>
        </div>

        <hr className="my-5 border-gray-100" />
        <p className="text-sm font-semibold text-blue-700 mb-2">住宿</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="提供狀態">
            <PillSelect options={OPT.provide} value={data.lodging} onChange={(v) => setField('lodging', v)} />
          </Field>
          <Field label="是否需自行付費說明">
            <input name="lodgingNote" value={data.lodgingNote} onChange={onTextChange} placeholder="例：住宿每月自付 2,000" className={INPUT_BASE} />
          </Field>
        </div>

        <hr className="my-5 border-gray-100" />
        <p className="text-sm font-semibold text-blue-700 mb-2">餐點</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="提供狀態">
            <PillSelect options={OPT.provide} value={data.meals} onChange={(v) => setField('meals', v)} />
          </Field>
          <Field label="提供餐數">
            <div className="flex items-center gap-2">
              <input name="mealCount" value={data.mealCount} onChange={onTextChange} inputMode="numeric" className={`${INPUT_BASE} max-w-[110px]`} />
              <span className="text-sm text-gray-500 font-medium">餐／日</span>
            </div>
          </Field>
          <Field label="自行付費說明">
            <input name="mealNote" value={data.mealNote} onChange={onTextChange} placeholder="例：不可外帶，外帶須付費" className={INPUT_BASE} />
          </Field>
        </div>

        <hr className="my-5 border-gray-100" />
        <CheckboxGroup {...checkboxShared} label="特殊體檢（可複選）" category="health" options={OPT.health} />
        <Field label="其他體檢項目說明">
          <input name="healthOther" value={data.healthOther} onChange={onTextChange} placeholder="其他體檢項目" className={INPUT_BASE} />
        </Field>
      </SectionCard>

      {/* 5. 送出前確認 */}
      <SectionCard index={5} title="送出前確認" hint="送出即通知灃禾">
        <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3.5 cursor-pointer">
          <input
            type="checkbox"
            checked={data.consent}
            onChange={() => setField('consent', !data.consent)}
            className="form-checkbox h-5 w-5 mt-0.5 shrink-0 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <span className="text-sm text-amber-900 leading-relaxed">
            本公司確認以上招募需求內容屬實，並同意灃禾人力銀行為招募媒合作業處理與利用上述資料。送出後將以 Email 及 Telegram 通知灃禾招募團隊。
          </span>
        </label>

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg font-semibold px-4 py-2.5 text-white transition-colors ${
              busy ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {editing ? '更新並送出' : '送出招募需求'}
          </button>
          <button
            type="button"
            onClick={handleDraft}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center rounded-lg font-semibold px-4 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            存成草稿
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-lg font-semibold px-4 py-2.5 border border-red-100 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
          >
            取消
          </button>
        </div>
      </SectionCard>
    </div>
  );
};

export default RequisitionForm;
