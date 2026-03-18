import React, { useEffect, useRef, useState } from 'react';
import { FileText, Mail, MapPin, Phone, Plus, Trash2 } from 'lucide-react';
import CheckboxGroup from './CheckboxGroup';
import {
  jobOptions,
  langOptions,
  locOptions,
  PHOTO_WIDTH_CM,
  PHOTO_HEIGHT_CM,
  timeOptions,
  transOptions,
} from '../modules/resumeCore';

const EditMode = ({
  data,
  activeErrorField,
  adultMaxBirthDate,
  getErrorInputClass,
  onChange,
  onPhotoUpload,
  onClearPhoto,
  onEducationChange,
  onAddEducation,
  onRemoveEducation,
  onExperienceChange,
  onAddExperience,
  onRemoveExperience,
  onPreview,
  onCheckboxChange,
  onBeforeNextStep,
  showPreviewAction = true,
  wizardMode = false,
  compactMode = false,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const stepTopRef = useRef(null);
  const prevStepRef = useRef(0);
  const totalSteps = 3;

  useEffect(() => {
    if (!wizardMode && currentStep !== 0) {
      setCurrentStep(0);
    }
  }, [wizardMode, currentStep]);

  useEffect(() => {
    if (!wizardMode) return;
    if (prevStepRef.current === currentStep) return;
    prevStepRef.current = currentStep;

    const anchor = stepTopRef.current;
    if (!anchor) return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, [currentStep, wizardMode]);

  const isStepVisible = (stepIndex) => !wizardMode || currentStep === stepIndex;
  const goNextStep = () => {
    if (typeof onBeforeNextStep === 'function') {
      const canProceed = onBeforeNextStep(currentStep);
      if (!canProceed) return;
    }
    setCurrentStep((prev) => Math.min(totalSteps - 1, prev + 1));
  };

  const checkboxGroupSharedProps = {
    data,
    activeErrorField,
    onCheckboxChange,
    onTextChange: onChange,
    getErrorInputClass,
  };

  return (
    <div
      className={`resume-edit-form ${wizardMode ? 'pb-28 sm:pb-0 lg:h-[calc(100vh-190px)] lg:min-h-[700px] lg:max-h-[860px] lg:flex lg:flex-col' : ''} ${compactMode ? 'md:[zoom:0.90]' : ''} space-y-4 sm:space-y-6`}
    >
      <div ref={stepTopRef} className="scroll-mt-24" />

      <div className={wizardMode ? 'bg-white border border-gray-200 rounded-xl p-3 sm:p-4 md:p-5 lg:flex-1 lg:min-h-0 lg:overflow-hidden' : ''}>
      <div className={wizardMode ? 'min-h-[440px] sm:min-h-[520px] md:min-h-[640px] space-y-5 sm:space-y-6 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1' : 'space-y-5 sm:space-y-6'}>
      {isStepVisible(0) && (
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 border-b border-gray-200 pb-3 mb-4 sm:mb-6 flex items-center gap-2">
          <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">1</span>
          基本資料
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
            <input
              type="text"
              name="name"
              value={data.name}
              onChange={onChange}
              data-field-key="name"
              id="field-name"
              className={getErrorInputClass('name', 'w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 transition-all')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">性別</label>
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 rounded-md p-2 ${activeErrorField === 'gender' ? 'ring-2 ring-red-500 bg-red-50' : ''}`}>
              <label
                className={`flex items-center gap-3 cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
                  data.gender === '男' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-blue-300'
                }`}
              >
                <input
                  type="radio"
                  name="gender"
                  value="男"
                  checked={data.gender === '男'}
                  onChange={onChange}
                  data-field-key="gender"
                  id="field-gender"
                  className="text-blue-600 focus:ring-blue-500 w-5 h-5"
                />
                <span className="font-medium">男</span>
              </label>
              <label
                className={`flex items-center gap-3 cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
                  data.gender === '女' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-blue-300'
                }`}
              >
                <input
                  type="radio"
                  name="gender"
                  value="女"
                  checked={data.gender === '女'}
                  onChange={onChange}
                  data-field-key="gender"
                  className="text-blue-600 focus:ring-blue-500 w-5 h-5"
                />
                <span className="font-medium">女</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">出生日期</label>
            <input
              type="text"
              name="birthDate"
              value={data.birthDate}
              onChange={onChange}
              inputMode="numeric"
              maxLength={10}
              placeholder="YYYY-MM-DD"
              data-field-key="birthDate"
              id="field-birthDate"
              className={getErrorInputClass('birthDate', 'w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 transition-all')}
            />
            <div className="text-xs text-gray-500 mt-1">可直接輸入日期（例：1998-07-21，最晚可填 {adultMaxBirthDate}）</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">年齡</label>
            <input
              type="number"
              name="age"
              value={data.age}
              readOnly
              data-field-key="age"
              id="field-age"
              className={getErrorInputClass('age', 'w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-600 cursor-not-allowed')}
            />
            <div className="text-xs text-gray-500 mt-1">會依出生日期自動計算</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">婚姻狀況</label>
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 rounded-md p-2 ${activeErrorField === 'maritalStatus' ? 'ring-2 ring-red-500 bg-red-50' : ''}`}>
              <label
                className={`flex items-center gap-3 cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
                  data.maritalStatus === '未婚' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-blue-300'
                }`}
              >
                <input
                  type="radio"
                  name="maritalStatus"
                  value="未婚"
                  checked={data.maritalStatus === '未婚'}
                  onChange={onChange}
                  data-field-key="maritalStatus"
                  id="field-maritalStatus"
                  className="text-blue-600 focus:ring-blue-500 w-5 h-5"
                />
                <span className="font-medium">未婚</span>
              </label>
              <label
                className={`flex items-center gap-3 cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
                  data.maritalStatus === '已婚' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-blue-300'
                }`}
              >
                <input
                  type="radio"
                  name="maritalStatus"
                  value="已婚"
                  checked={data.maritalStatus === '已婚'}
                  onChange={onChange}
                  data-field-key="maritalStatus"
                  className="text-blue-600 focus:ring-blue-500 w-5 h-5"
                />
                <span className="font-medium">已婚</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">居留證號 (若適用)</label>
            <input type="text" name="arcNumber" value={data.arcNumber} onChange={onChange} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">聯絡電話</label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="tel"
                name="phone"
                value={data.phone}
                onChange={onChange}
                data-field-key="phone"
                id="field-phone"
                inputMode="numeric"
                maxLength={10}
                placeholder="請輸入 10 碼數字"
                className={getErrorInputClass('phone', 'w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 transition-all')}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">需為 10 碼數字</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">電子郵件</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input type="email" name="email" value={data.email} onChange={onChange} data-field-key="email" id="field-email" className={getErrorInputClass('email', 'w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 transition-all')} />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">居住地址</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input type="text" name="address" value={data.address} onChange={onChange} data-field-key="address" id="field-address" className={getErrorInputClass('address', 'w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 transition-all')} />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">個人照片（選填）</label>
            <p className="text-xs text-gray-500 mb-2">
              照片顯示與匯出尺寸固定為寬 {PHOTO_WIDTH_CM}、高 {PHOTO_HEIGHT_CM}，限 5MB 內，系統會自動壓縮至 300KB 以下再上傳。
            </p>
            <div className="flex flex-col md:flex-row gap-4 items-start">
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={onPhotoUpload}
                className="block w-full md:w-auto text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {data.photoDataUrl && (
                <button
                  type="button"
                  onClick={onClearPhoto}
                  className="px-3 py-2 text-sm rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  移除照片
                </button>
              )}
            </div>
            {data.photoDataUrl && (
              <div
                className="mt-3 border border-gray-300 rounded-md overflow-hidden bg-white"
                style={{ width: PHOTO_WIDTH_CM, height: PHOTO_HEIGHT_CM }}
              >
                <img src={data.photoDataUrl} alt="照片預覽" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {isStepVisible(1) && (
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center border-b border-gray-200 pb-3 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">2</span>
            教育背景
          </h2>
          {data.education.length < 4 && (
            <button onClick={onAddEducation} className="w-full sm:w-auto justify-center text-sm text-blue-600 inline-flex items-center gap-1 hover:text-blue-700 font-medium bg-blue-50 px-3 py-2 rounded-md">
              <Plus className="w-4 h-4" /> 新增教育背景
            </button>
          )}
        </div>
        <div className="space-y-4">
          {data.education.map((educationItem, index) => (
            <div key={`education-${index}`} className="p-4 border border-gray-100 bg-gray-50 rounded-lg relative">
              <div className="mb-3 text-sm font-semibold text-gray-600">第 {index + 1} 筆教育背景</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">學校名稱</label>
                  <input
                    type="text"
                    value={educationItem.school}
                    onChange={(event) => onEducationChange(index, 'school', event.target.value)}
                    data-field-key={`education.${index}.school`}
                    id={`field-education-${index}-school`}
                    className={getErrorInputClass(`education.${index}.school`, 'w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 transition-all')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">就讀科系</label>
                  <input
                    type="text"
                    value={educationItem.major}
                    onChange={(event) => onEducationChange(index, 'major', event.target.value)}
                    data-field-key={`education.${index}.major`}
                    id={`field-education-${index}-major`}
                    className={getErrorInputClass(`education.${index}.major`, 'w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 transition-all')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">畢業日期</label>
                  <input
                    type="text"
                    value={educationItem.gradDate}
                    onChange={(event) => onEducationChange(index, 'gradDate', event.target.value)}
                    inputMode="numeric"
                    maxLength={7}
                    placeholder="YYYY-MM"
                    data-field-key={`education.${index}.gradDate`}
                    id={`field-education-${index}-gradDate`}
                    className={getErrorInputClass(`education.${index}.gradDate`, 'w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 transition-all')}
                  />
                  <div className="text-xs text-gray-500 mt-1">格式：YYYY-MM（例：2020-06）</div>
                </div>
              </div>
              {data.education.length > 1 && (
                <button onClick={() => onRemoveEducation(index)} className="absolute top-2 right-2 bg-red-100 text-red-600 p-2 rounded-full hover:bg-red-200 transition-colors shadow-sm">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-3">
          可新增最多 4 筆教育背景，預覽與匯出會依序顯示。
        </div>
      </div>
      )}

      {isStepVisible(1) && (
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center border-b border-gray-200 pb-3 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">2</span>
            工作經驗 <span className="text-sm font-normal text-gray-500">(兼職或實習經驗可)</span>
          </h2>
          {data.experience.length < 4 && (
            <button onClick={onAddExperience} className="w-full sm:w-auto justify-center text-sm text-blue-600 inline-flex items-center gap-1 hover:text-blue-700 font-medium bg-blue-50 px-3 py-2 rounded-md">
              <Plus className="w-4 h-4" /> 新增經驗
            </button>
          )}
        </div>
        <div className="space-y-4">
          {data.experience.map((exp, index) => (
            <div key={index} className="flex flex-col md:flex-row gap-4 p-4 border border-gray-100 bg-gray-50 rounded-lg relative">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">公司名稱</label>
                <input type="text" value={exp.company} onChange={(e) => onExperienceChange(index, 'company', e.target.value)} className="w-full px-3 py-2.5 rounded-md border border-gray-300 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">職稱</label>
                <input type="text" value={exp.title} onChange={(e) => onExperienceChange(index, 'title', e.target.value)} className="w-full px-3 py-2.5 rounded-md border border-gray-300 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">工作起訖</label>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <input
                    type="text"
                    placeholder="開始"
                    value={exp.periodStart || ''}
                    onChange={(e) => onExperienceChange(index, 'periodStart', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-md border border-gray-300 focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-gray-400 text-sm">~</span>
                  <input
                    type="text"
                    placeholder="結束"
                    value={exp.periodEnd || ''}
                    onChange={(e) => onExperienceChange(index, 'periodEnd', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-md border border-gray-300 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              {data.experience.length > 1 && (
                <button onClick={() => onRemoveExperience(index)} className="absolute top-2 right-2 bg-red-100 text-red-600 p-2 rounded-full hover:bg-red-200 transition-colors shadow-sm">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      )}

      {isStepVisible(2) && (
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 border-b border-gray-200 pb-3 mb-4 sm:mb-6 flex items-center gap-2">
          <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">3</span>
          專長與求職條件
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
          <div><CheckboxGroup {...checkboxGroupSharedProps} label="語言能力" category="languages" options={langOptions} otherField="otherLanguage" /></div>
          <div>
            <label className="block text-gray-700 font-semibold mb-2">證照 (如: 中文華測 B1 等)</label>
            <input type="text" name="certificates" value={data.certificates} onChange={onChange} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="md:col-span-2"><CheckboxGroup {...checkboxGroupSharedProps} label="交通工具" category="transportation" options={transOptions} otherField="otherTransport" /></div>
          <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
            <CheckboxGroup {...checkboxGroupSharedProps} label="可接受工作地點（可複選）" category="locations" options={locOptions} />
            <CheckboxGroup {...checkboxGroupSharedProps} label="希望工作內容（可複選）" category="jobTypes" options={jobOptions} otherField="otherJobType" />
            <CheckboxGroup {...checkboxGroupSharedProps} label="可以接受工作時間（可複選）" category="workHours" options={timeOptions} />
            <div className="mt-4">
              <label className="block text-gray-700 font-semibold mb-2">希望待遇</label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-gray-500 font-medium">NT$</span>
                <input
                  type="text"
                  name="salary"
                  value={data.salary}
                  onChange={onChange}
                  data-field-key="salary"
                  id="field-salary"
                  className={getErrorInputClass('salary', 'w-full sm:w-52 px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500')}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
      </div>
      </div>

      {wizardMode ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] backdrop-blur sm:static sm:inset-auto sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:pb-0 lg:mt-2">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-2 sm:gap-3 min-h-[64px]">
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            className={`px-4 sm:px-5 py-2.5 rounded-lg font-medium border flex-1 sm:flex-none sm:w-[160px] lg:w-[180px] text-center ${
              currentStep === 0
                ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            上一步
          </button>
          {currentStep < totalSteps - 1 ? (
            <button
              type="button"
              onClick={goNextStep}
              className="bg-blue-600 text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 flex-1 sm:flex-none sm:w-[160px] lg:w-[180px] text-center"
            >
              下一步
            </button>
          ) : (
            showPreviewAction && (
              <button
                onClick={onPreview}
                className="bg-blue-600 text-white flex-1 sm:flex-none sm:w-[160px] lg:w-[180px] justify-center px-4 sm:px-6 py-2.5 rounded-lg font-medium text-sm sm:text-base hover:bg-blue-700 shadow-md inline-flex items-center gap-2"
              >
                完成填寫 <FileText className="w-4 h-4" />
              </button>
            )
          )}
          </div>
        </div>
      ) : showPreviewAction && (
        <div className="pt-4">
          <button
            onClick={onPreview}
            className="bg-blue-600 text-white w-full sm:w-auto sm:ml-auto justify-center px-5 sm:px-8 py-3 rounded-lg font-bold text-base sm:text-lg hover:bg-blue-700 shadow-md inline-flex items-center gap-2"
          >
            完成填寫，前往匯出 / 預覽 <FileText className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default EditMode;
