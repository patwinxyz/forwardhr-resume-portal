import React, { useEffect, useState } from 'react';
import EditMode from './components/EditMode';
import NoticeBanner from './components/NoticeBanner';
import PreviewMode from './components/PreviewMode';
import ResumeStyles from './components/ResumeStyles';
import TopNav from './components/TopNav';
import {
  isFirebaseAuthConfigured,
  loginWithGoogle,
  logoutAuthUser,
  subscribeAuthUser,
} from './modules/authClient';

import {
  initialData,
  MAX_PHOTO_SIZE_BYTES,
  langOptions,
  transOptions,
  locOptions,
  jobOptions,
  timeOptions,
  hasValue,
  escapeHTML,
  escapeHTMLWithBreaks,
  getExportFilename,
  WORD_TEMPLATE_FILENAME,
  PHOTO_SIZE_CM,
  MIN_AGE,
  getWordTemplateCandidates,
  loadJSZipModule,
  getEmbeddedLogoDataUrl,
  formatYearMonthForWordCell,
  calculateAgeFromBirthDate,
  getAdultMaxBirthDate,
  getEducationForOutput,
  injectPhotoIntoWordZip,
  fillResumeTemplateXml,
} from './modules/resumeCore';
const ResumeBuilder = () => {
  const FIXED_PREVIEW_SCALE = 0.8;
  const [data, setData] = useState(initialData);
  const [mode, setMode] = useState('edit');
  const [validationErrors, setValidationErrors] = useState([]);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [activeErrorField, setActiveErrorField] = useState('');
  const [notice, setNotice] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthBusy, setIsAuthBusy] = useState(false);

  const clearValidationErrors = () => {
    if (validationErrors.length > 0 || activeErrorField) {
      setValidationErrors([]);
      setActiveErrorField('');
    }
    if (notice) {
      setNotice(null);
    }
  };

  const showNotice = (message, type = 'info') => {
    setNotice({ message, type });
  };

  useEffect(() => {
    const unsubscribe = subscribeAuthUser((user) => {
      setAuthUser(user || null);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (!isFirebaseAuthConfigured()) {
      showNotice('尚未設定 Firebase 登入，請先設定環境變數。', 'error');
      return;
    }

    setIsAuthBusy(true);
    try {
      await loginWithGoogle();
      showNotice('登入成功，現在可以送出履歷寄送。', 'info');
    } catch (error) {
      console.error('Login failed:', error);
      showNotice('登入失敗，請稍後再試。', 'error');
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    setIsAuthBusy(true);
    try {
      await logoutAuthUser();
      showNotice('已登出。', 'info');
    } catch (error) {
      console.error('Logout failed:', error);
      showNotice('登出失敗，請稍後再試。', 'error');
    } finally {
      setIsAuthBusy(false);
    }
  };

  const focusField = (fieldKey) => {
    if (!fieldKey) return;

    const tryFocus = (retry = 0) => {
      const target =
        document.querySelector(`[data-field-key="${fieldKey}"]`) ||
        document.getElementById(`field-${fieldKey.replace(/\./g, '-')}`);

      if (!target) {
        if (retry < 8) {
          setTimeout(() => tryFocus(retry + 1), 60);
        }
        return;
      }

      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof target.focus === 'function') {
        target.focus();
      }
    };

    setTimeout(() => tryFocus(0), 40);
  };

  const getErrorInputClass = (fieldKey, baseClass) =>
    `${baseClass} ${activeErrorField === fieldKey ? 'border-red-500 ring-2 ring-red-500 bg-red-50' : ''}`;

  const validateForm = () => {
    const errors = [];
    const pushError = (fieldKey, message) => errors.push({ fieldKey, message });
    const phonePattern = /^\d{10}$/;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const ageNumber = Number(data.age);
    const adultMaxBirthDate = getAdultMaxBirthDate();

    if (!hasValue(data.name)) pushError('name', '姓名');
    if (!hasValue(data.gender)) pushError('gender', '性別');
    if (!hasValue(data.birthDate)) pushError('birthDate', '出生日期');
    if (hasValue(data.birthDate) && data.birthDate > adultMaxBirthDate) {
      pushError('birthDate', `需年滿 ${MIN_AGE} 歲`);
    }
    if (!hasValue(data.age)) {
      pushError('birthDate', '年齡');
    } else if (!Number.isInteger(ageNumber) || ageNumber < MIN_AGE || ageNumber > 100) {
      pushError('birthDate', `年齡需為 ${MIN_AGE}-100 的整數`);
    }
    if (!hasValue(data.maritalStatus)) pushError('maritalStatus', '婚姻狀況');
    if (!hasValue(data.phone)) {
      pushError('phone', '聯絡電話');
    } else if (!phonePattern.test(data.phone.trim())) {
      pushError('phone', '聯絡電話需為 10 碼數字');
    }
    if (!hasValue(data.email)) {
      pushError('email', '電子郵件');
    } else if (!emailPattern.test(data.email.trim())) {
      pushError('email', '電子郵件格式不正確');
    }
    if (!hasValue(data.address)) pushError('address', '居住地址');
    const educationList = Array.isArray(data.education) ? data.education : [];
    const firstEducation = educationList[0] || { school: '', major: '', gradDate: '' };
    if (!hasValue(firstEducation.school)) pushError('education.0.school', '學校名稱');
    if (!hasValue(firstEducation.major)) pushError('education.0.major', '就讀科系');
    if (!hasValue(firstEducation.gradDate)) pushError('education.0.gradDate', '畢業日期');
    for (let index = 1; index < educationList.length; index += 1) {
      const edu = educationList[index];
      const hasAnyEducationValue = hasValue(edu?.school) || hasValue(edu?.major) || hasValue(edu?.gradDate);
      if (!hasAnyEducationValue) continue;

      if (!hasValue(edu.school)) pushError(`education.${index}.school`, `第 ${index + 1} 筆教育背景：學校名稱`);
      if (!hasValue(edu.major)) pushError(`education.${index}.major`, `第 ${index + 1} 筆教育背景：就讀科系`);
      if (!hasValue(edu.gradDate)) pushError(`education.${index}.gradDate`, `第 ${index + 1} 筆教育背景：畢業日期`);
    }
    if (data.languages.length === 0) pushError('languages', '語言能力（至少勾選一項）');
    if (data.transportation.length === 0) pushError('transportation', '交通工具（至少勾選一項）');
    if (data.locations.length === 0) pushError('locations', '可接受工作地點（至少勾選一項）');
    if (data.jobTypes.length === 0) pushError('jobTypes', '希望工作內容（至少勾選一項）');
    if (data.workHours.length === 0) pushError('workHours', '可接受工作時間（至少勾選一項）');
    if (!hasValue(data.salary)) pushError('salary', '希望待遇');
    if (!hasValue(data.fillDate)) pushError('fillDate', '填寫日期');

    if (data.languages.includes('其他') && !hasValue(data.otherLanguage)) {
      pushError('otherLanguage', '語言能力選擇「其他」時需填寫說明');
    }
    if (data.transportation.includes('其他') && !hasValue(data.otherTransport)) {
      pushError('otherTransport', '交通工具選擇「其他」時需填寫說明');
    }
    if (data.jobTypes.includes('其他') && !hasValue(data.otherJobType)) {
      pushError('otherJobType', '希望工作內容選擇「其他」時需填寫說明');
    }

    return errors;
  };

  const ensureValidBeforeAction = (actionText) => {
    const errors = validateForm();
    const firstError = errors[0];
    setValidationErrors(firstError ? [firstError.message] : []);
    setActiveErrorField(firstError ? firstError.fieldKey : '');

    if (firstError) {
      setMode('edit');
      focusField(firstError.fieldKey);
      showNotice(`請先修正：${firstError.message}，完成後再${actionText}。`, 'error');
      return false;
    }

    return true;
  };

  const goPreview = () => {
    if (!ensureValidBeforeAction('預覽')) return;
    setMode('preview');
    window.scrollTo(0, 0);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    clearValidationErrors();
    if (name === 'phone') {
      const digitsOnly = String(value || '').replace(/\D/g, '').slice(0, 10);
      setData((prev) => ({ ...prev, phone: digitsOnly }));
      return;
    }
    if (name === 'birthDate') {
      setData((prev) => ({
        ...prev,
        birthDate: value,
        age: calculateAgeFromBirthDate(value),
      }));
      return;
    }
    setData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotice('請上傳圖片檔（JPG、PNG、WEBP）。', 'error');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      showNotice('照片檔案過大，請上傳 5MB 以下圖片。', 'error');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      clearValidationErrors();
      setData((prev) => ({ ...prev, photoDataUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setData((prev) => ({ ...prev, photoDataUrl: '' }));
  };

  const handleEducationChange = (index, field, value) => {
    clearValidationErrors();
    setData((prev) => {
      const newEducation = [...prev.education];
      newEducation[index] = { ...newEducation[index], [field]: value };
      return { ...prev, education: newEducation };
    });
  };

  const addEducation = () => {
    if (data.education.length >= 4) return;
    clearValidationErrors();
    setData((prev) => ({
      ...prev,
      education: [...prev.education, { school: '', major: '', gradDate: '' }],
    }));
  };

  const removeEducation = (index) => {
    if (data.education.length <= 1) return;
    clearValidationErrors();
    setData((prev) => ({
      ...prev,
      education: prev.education.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleExperienceChange = (index, field, value) => {
    clearValidationErrors();
    const newExperience = [...data.experience];
    newExperience[index][field] = value;
    setData(prev => ({ ...prev, experience: newExperience }));
  };

  const addExperience = () => {
    if (data.experience.length < 4) {
      clearValidationErrors();
      setData(prev => ({
        ...prev,
        experience: [...prev.experience, { company: '', title: '', period: '' }]
      }));
    }
  };

  const removeExperience = (index) => {
    clearValidationErrors();
    const newExperience = data.experience.filter((_, i) => i !== index);
    setData(prev => ({ ...prev, experience: newExperience }));
  };

  const handleCheckboxChange = (category, value) => {
    clearValidationErrors();
    setData(prev => {
      const currentList = prev[category];
      if (currentList.includes(value)) {
        return { ...prev, [category]: currentList.filter(item => item !== value) };
      } else {
        return { ...prev, [category]: [...currentList, value] };
      }
    });
  };

  const printDocument = () => {
    if (!ensureValidBeforeAction('列印')) return;
    window.print();
  };

  // -------------------------------------------------------------
  // Word 匯出核心
  // -------------------------------------------------------------
  const buildLegacyWordBlob = async () => {
    const checked = '&#9745;';
    const unchecked = '&#9744;';
    const getCb = (condition) => condition ? checked : unchecked;
    const embeddedLogoDataUrl = await getEmbeddedLogoDataUrl();
    const safeLogoSrc = embeddedLogoDataUrl ? embeddedLogoDataUrl.replace(/"/g, '&quot;') : '';
    const logoMarkup = safeLogoSrc
      ? `<img src="${safeLogoSrc}" alt="灃禾集團 Logo" style="max-width: 660px; width: 100%; height: auto; display: block; margin: 0 auto;" />`
      : '';
    const safeText = (value) => escapeHTMLWithBreaks(value);
    const safePhotoSrc = data.photoDataUrl ? String(data.photoDataUrl).replace(/"/g, '&quot;') : '';
    const educationOutput = getEducationForOutput(data.education);
    const hasCertificateValue = hasValue(data.certificates);
    const [fillYear = '', fillMonth = '', fillDay = ''] = (data.fillDate || '').split('-');

    const safeData = {
      name: safeText(data.name),
      birthDate: data.birthDate ? escapeHTML(data.birthDate.replace(/-/g, '/')) : '',
      age: safeText(data.age),
      arcNumber: safeText(data.arcNumber),
      phone: safeText(data.phone),
      email: safeText(data.email),
      address: safeText(data.address),
      school: safeText(educationOutput.map((edu) => edu.school || '').join('\n')),
      major: safeText(educationOutput.map((edu) => edu.major || '').join('\n')),
      gradDate: safeText(educationOutput.map((edu) => formatYearMonthForWordCell(edu.gradDate)).join('\n')),
      certificates: safeText(data.certificates),
      salary: safeText(data.salary),
      fillYear: escapeHTML(fillYear),
      fillMonth: escapeHTML(fillMonth),
      fillDay: escapeHTML(fillDay),
    };

    const renderCbHTML = (opts, selected, otherVal = '') => {
      return opts.map(opt => {
        const isChecked = selected.includes(opt);
        return `<span style="margin-right: 12px;">${getCb(isChecked)} ${escapeHTML(opt)}</span>`;
      }).join('') + (selected.includes('其他') && otherVal ? `<u style="margin-left:5px;">&nbsp;${safeText(otherVal)}&nbsp;</u>` : '');
    };

    const wordHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <title>履歷表</title>
        <style>
          body { font-family: '標楷體', 'DFKai-SB', 'MingLiU', serif; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          td, th { border: 1px solid black; padding: 8px 5px; font-size: 11pt; vertical-align: middle; }
          .title { font-size: 18pt; font-weight: bold; text-align: center; letter-spacing: 5px; margin-bottom: 15px; font-family: '標楷體', 'DFKai-SB', serif;}
          .center { text-align: center; }
          .bold { font-weight: bold; }
        </style>
      </head>
      <body>
        
        <!-- Header Banner Simulation -->
        <table style="width: 100%; border: none; margin-bottom: 20px;">
          <tr>
            <td style="width: 100%; border: none; vertical-align: middle; text-align: center;">
              ${logoMarkup}
            </td>
          </tr>
        </table>

        <div class="title">個人履歷表</div>
        
        <!-- Main Resume Table -->
        <table>
          <tr>
            <td class="center bold" style="width: 16%;">姓名</td>
            <td class="center" style="width: 24%;">${safeData.name}</td>
            <td class="center bold" style="width: 12%;">性別</td>
            <td class="center" style="width: 28%;">${getCb(data.gender === '男')} 男 &nbsp;&nbsp;&nbsp;&nbsp; ${getCb(data.gender === '女')} 女</td>
            <td rowspan="5" style="width: 20%; text-align: center; vertical-align: middle;">
              ${safePhotoSrc ? `<img src="${safePhotoSrc}" alt="個人照片" style="width: ${PHOTO_SIZE_CM}; height: ${PHOTO_SIZE_CM}; object-fit: cover; display: block; margin: 0 auto;" />` : ''}
            </td>
          </tr>
          <tr>
            <td class="center bold">出生日期</td>
            <td class="center">${safeData.birthDate}</td>
            <td class="center bold">年齡</td>
            <td class="center">${safeData.age}</td>
          </tr>
          <tr>
            <td class="center bold">婚姻狀況</td>
            <td class="center">${getCb(data.maritalStatus === '未婚')} 未婚 &nbsp;&nbsp;&nbsp;&nbsp; ${getCb(data.maritalStatus === '已婚')} 已婚</td>
            <td class="center bold">居留證號</td>
            <td class="center">${safeData.arcNumber}</td>
          </tr>
          <tr>
            <td class="center bold">聯絡電話</td>
            <td class="center">${safeData.phone}</td>
            <td class="center bold">電子郵件</td>
            <td class="center">${safeData.email}</td>
          </tr>
          <tr>
            <td class="center bold">居住地址</td>
            <td colspan="3" style="padding-left: 10px;">${safeData.address}</td>
          </tr>
          <tr>
            <td rowspan="2" class="center bold">教育背景</td>
            <td class="center bold">學校名稱</td>
            <td colspan="2" class="center bold">就讀科系</td>
            <td class="center bold">畢業日期</td>
          </tr>
          <tr>
            <td class="center">${safeData.school}</td>
            <td colspan="2" class="center">${safeData.major}</td>
            <td class="center">${safeData.gradDate}</td>
          </tr>
          <tr>
            <td rowspan="5" class="center bold">工作經驗<br><br><span style="font-size: 10pt; font-weight: normal;">(兼職或實習<br>經驗可)</span></td>
            <td class="center bold">公司名稱</td>
            <td colspan="2" class="center bold">職稱</td>
            <td class="center bold">工作時間</td>
          </tr>
          ${[0, 1, 2, 3].map(i => {
            const exp = data.experience[i] || { company: '', title: '', period: '' };
            return `<tr>
              <td class="center" height="28">${safeText(exp.company)}</td>
              <td colspan="2" class="center">${safeText(exp.title)}</td>
              <td class="center">${safeText(exp.period)}</td>
            </tr>`;
          }).join('')}
          <tr>
            <td class="center bold">語言能力</td>
            <td colspan="4" class="center">${renderCbHTML(langOptions, data.languages, data.otherLanguage)}</td>
          </tr>
          <tr>
            <td class="center bold">證照</td>
            <td class="center">${hasCertificateValue ? `<span style="color: blue; text-decoration: underline;">${safeData.certificates}</span>` : ''}</td>
            <td class="center bold">交通</td>
            <td colspan="2" style="padding-left: 10px;">${renderCbHTML(transOptions, data.transportation, data.otherTransport)}</td>
          </tr>
          <tr>
            <td class="center bold">可接受工作地點<br><br><span style="font-weight: normal; font-size: 10pt;">(可複選)</span></td>
            <td colspan="4" style="padding-left: 10px;">${renderCbHTML(locOptions, data.locations)}</td>
          </tr>
          <tr>
            <td class="center bold">希望工作內容<br><br><span style="font-weight: normal; font-size: 10pt;">(可複選)</span></td>
            <td colspan="4" style="padding-left: 10px;">${renderCbHTML(jobOptions, data.jobTypes, data.otherJobType)}</td>
          </tr>
          <tr>
            <td class="center bold">可以接受工作時間<br><br><span style="font-weight: normal; font-size: 10pt;">(可複選)</span></td>
            <td colspan="4" style="padding-left: 10px;">${renderCbHTML(timeOptions, data.workHours)}</td>
          </tr>
          <tr>
            <td class="center bold">希望待遇</td>
            <td colspan="4" style="padding-left: 10px;">${safeData.salary}</td>
          </tr>
        </table>
        
        <div style="text-align: center; font-size: 12pt; margin-top: 15px;">
          填寫日期： 
          <u>&nbsp;&nbsp;&nbsp;${safeData.fillYear || '      '}&nbsp;&nbsp;&nbsp;</u> 年 
          <u>&nbsp;&nbsp;&nbsp;${safeData.fillMonth || '    '}&nbsp;&nbsp;&nbsp;</u> 月 
          <u>&nbsp;&nbsp;&nbsp;${safeData.fillDay || '    '}&nbsp;&nbsp;&nbsp;</u> 日
        </div>
      </body>
      </html>
    `;

    return new Blob(['\ufeff', wordHTML], { type: 'application/msword;charset=utf-8' });
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToWordLegacy = async (skipValidation = false) => {
    if (!skipValidation && !ensureValidBeforeAction('匯出 Word')) return;

    const blob = await buildLegacyWordBlob();
    downloadBlob(blob, getExportFilename(data.name, data.fillDate));
  };

  const buildTemplateWordBlob = async () => {
    const JSZip = await loadJSZipModule();

    const templateCandidates = getWordTemplateCandidates();
    let templateBuffer = null;

    for (const candidateUrl of templateCandidates) {
      try {
        const response = await fetch(candidateUrl, { cache: 'no-store' });
        if (response.ok) {
          templateBuffer = await response.arrayBuffer();
          break;
        }
      } catch (error) {
        // continue trying other candidates
      }
    }

    if (!templateBuffer) {
      throw new Error(`找不到模板檔案：${WORD_TEMPLATE_FILENAME}`);
    }

    const zip = await JSZip.loadAsync(templateBuffer);
    const documentXmlFile = zip.file('word/document.xml');

    if (!documentXmlFile) {
      throw new Error('模板缺少 word/document.xml');
    }

    let photoRelationshipId = '';
    if (data.photoDataUrl) {
      photoRelationshipId = await injectPhotoIntoWordZip(zip, data.photoDataUrl);
    }

    const documentXml = await documentXmlFile.async('string');
    const xmlDocument = new DOMParser().parseFromString(documentXml, 'application/xml');
    const parserError = xmlDocument.getElementsByTagName('parsererror')[0];
    if (parserError) {
      throw new Error('模板 XML 解析失敗');
    }

    fillResumeTemplateXml(xmlDocument, data, { photoRelationshipId });

    const serializedXml = new XMLSerializer().serializeToString(xmlDocument);
    zip.file('word/document.xml', serializedXml);

    return zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  };

  const exportToWord = async () => {
    if (isExportingWord) return;
    if (!ensureValidBeforeAction('匯出 Word')) return;

    setIsExportingWord(true);

    try {
      const outputBlob = await buildTemplateWordBlob();
      downloadBlob(outputBlob, getExportFilename(data.name, data.fillDate).replace(/\.doc$/i, '.docx'));
    } catch (error) {
      console.error('模板匯出失敗，改用相容模式：', error);
      showNotice('模板匯出失敗，已改用相容模式匯出 .doc。', 'error');
      await exportToWordLegacy(true);
    } finally {
      setIsExportingWord(false);
    }
  };

  const arrayBufferToBase64 = (arrayBuffer) => {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }

    return window.btoa(binary);
  };

  const sendResumeByEmail = async () => {
    if (isSendingEmail) return;
    if (!ensureValidBeforeAction('送出寄送')) return;

    if (!isFirebaseAuthConfigured()) {
      showNotice('尚未設定 Firebase 登入，無法送出寄送。', 'error');
      return;
    }

    if (!authReady) {
      showNotice('正在確認登入狀態，請稍後再試。', 'error');
      return;
    }

    if (!authUser) {
      showNotice('請先使用 Google 登入後再送出。', 'error');
      return;
    }

    setIsSendingEmail(true);

    try {
      let attachmentBlob;
      let attachmentFilename;
      let attachmentMimeType;

      try {
        attachmentBlob = await buildTemplateWordBlob();
        attachmentFilename = getExportFilename(data.name, data.fillDate).replace(/\.doc$/i, '.docx');
        attachmentMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } catch (error) {
        console.error('模板產生失敗，改用相容模式寄送：', error);
        attachmentBlob = await buildLegacyWordBlob();
        attachmentFilename = getExportFilename(data.name, data.fillDate);
        attachmentMimeType = 'application/msword';
        showNotice('模板產生失敗，已改用相容 .doc 格式寄送。', 'error');
      }

      const attachmentBuffer = await attachmentBlob.arrayBuffer();
      const attachmentBase64 = arrayBufferToBase64(attachmentBuffer);
      const idToken = typeof authUser.getIdToken === 'function' ? await authUser.getIdToken() : '';
      const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim();
      const endpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/send-resume`;
      const response = await fetch(apiBaseUrl ? endpoint : '/api/send-resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          attachmentBase64,
          attachmentFilename,
          attachmentMimeType,
          applicantName: data.name,
          applicantEmail: data.email,
          applicantPhone: data.phone,
          fillDate: data.fillDate,
          submitterEmail: authUser.email || '',
          submitterName: authUser.displayName || '',
        }),
      });

      const rawText = await response.text();
      let result = {};
      try {
        result = rawText ? JSON.parse(rawText) : {};
      } catch (parseError) {
        result = { message: rawText?.slice(0, 140) || '' };
      }
      if (!response.ok || !result?.ok) {
        const detailMessage = result?.message || `寄送 API 錯誤（${response.status}）`;
        throw new Error(detailMessage);
      }

      showNotice('已成功送出，Word 附件已寄到指定信箱。', 'info');
    } catch (error) {
      console.error('Send email failed:', error);
      const errorMessage = error instanceof Error ? error.message : '請稍後重試。';
      showNotice(`送出寄送失敗：${errorMessage}`, 'error');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const educationForOutput = getEducationForOutput(data.education);
  const hasCertificates = hasValue(data.certificates);
  const adultMaxBirthDate = getAdultMaxBirthDate();
  const isAuthConfigured = isFirebaseAuthConfigured();

  if (!isAuthConfigured) {
    return (
      <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
        <ResumeStyles />
        <NoticeBanner notice={notice} />
        <div className="max-w-xl mx-auto px-4 py-16">
          <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-3">灃禾集團 履歷系統</h1>
            <p className="text-amber-700 leading-relaxed">
              目前尚未完成 Firebase 登入設定，請先補齊 `VITE_FIREBASE_*` 環境變數後重新部署。
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!authReady || !authUser) {
    return (
      <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
        <ResumeStyles />
        <NoticeBanner notice={notice} />
        <div className="max-w-xl mx-auto px-4 py-16">
          <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-8 text-center">
            <h1 className="text-2xl font-bold text-blue-700 mb-2">灃禾集團 履歷系統</h1>
            <p className="text-gray-600 mb-6">請先使用 Google 信箱登入後再使用系統。</p>
            <button
              onClick={handleLogin}
              disabled={isAuthBusy || !authReady}
              className={`inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-white transition-colors ${
                isAuthBusy || !authReady ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {authReady ? (isAuthBusy ? '登入中...' : 'Google 登入') : '載入登入狀態中...'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800 pb-12">
      <ResumeStyles />
      <TopNav
        mode={mode}
        onEdit={() => setMode('edit')}
        onPreview={goPreview}
        onExportWord={exportToWord}
        onSendEmail={sendResumeByEmail}
        onPrint={printDocument}
        isExportingWord={isExportingWord}
        isSendingEmail={isSendingEmail}
        authUser={authUser}
        isAuthBusy={isAuthBusy}
        isAuthConfigured={isAuthConfigured}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
      <NoticeBanner notice={notice} />

      <div className="max-w-5xl mx-auto mt-8 px-4">
        {mode === 'edit' ? (
          <EditMode
            data={data}
            validationErrors={validationErrors}
            activeErrorField={activeErrorField}
            adultMaxBirthDate={adultMaxBirthDate}
            getErrorInputClass={getErrorInputClass}
            onChange={handleChange}
            onPhotoUpload={handlePhotoUpload}
            onClearPhoto={clearPhoto}
            onEducationChange={handleEducationChange}
            onAddEducation={addEducation}
            onRemoveEducation={removeEducation}
            onExperienceChange={handleExperienceChange}
            onAddExperience={addExperience}
            onRemoveExperience={removeExperience}
            onPreview={goPreview}
            onCheckboxChange={handleCheckboxChange}
          />
        ) : (
          <PreviewMode
            data={data}
            educationForOutput={educationForOutput}
            hasCertificates={hasCertificates}
            previewScale={FIXED_PREVIEW_SCALE}
          />
        )}
      </div>
    </div>
  );
};
export default ResumeBuilder;


