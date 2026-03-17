import React, { useEffect, useState } from 'react';
import AdminEditDrawer from './components/AdminEditDrawer';
import AdminRecordPanel from './components/AdminRecordPanel';
import AdminViewModal from './components/AdminViewModal';
import DraftManager from './components/DraftManager';
import EditMode from './components/EditMode';
import NoticeBanner from './components/NoticeBanner';
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
  MAX_PHOTO_DATAURL_BYTES,
  PHOTO_MAX_DIMENSION_PX,
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

const getTodayDateText = () => new Date().toISOString().split('T')[0];

const normalizeResumeData = (source) => {
  const raw = source && typeof source === 'object' ? source : {};
  const data = {
    ...initialData,
    ...raw,
    education: Array.isArray(raw.education) && raw.education.length > 0 ? raw.education : [{ school: '', major: '', gradDate: '' }],
    experience: Array.isArray(raw.experience) && raw.experience.length > 0 ? raw.experience : [{ company: '', title: '', period: '' }],
    languages: Array.isArray(raw.languages) ? raw.languages : [],
    transportation: Array.isArray(raw.transportation) ? raw.transportation : [],
    locations: Array.isArray(raw.locations) ? raw.locations : [],
    jobTypes: Array.isArray(raw.jobTypes) ? raw.jobTypes : [],
    workHours: Array.isArray(raw.workHours) ? raw.workHours : [],
    photoDataUrl:
      typeof raw.photoDataUrl === 'string' && raw.photoDataUrl
        ? raw.photoDataUrl
        : typeof raw.photoURL === 'string'
          ? raw.photoURL
          : '',
    fillDate: typeof raw.fillDate === 'string' && raw.fillDate ? raw.fillDate : getTodayDateText(),
  };

  if (data.birthDate) {
    const autoAge = calculateAgeFromBirthDate(data.birthDate);
    data.age = autoAge || String(data.age || '');
  } else {
    data.age = String(data.age || '');
  }

  return data;
};

const createBlankResumeData = () =>
  normalizeResumeData({
    ...initialData,
    fillDate: getTodayDateText(),
    photoDataUrl: '',
  });

const parseResponsePayload = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: text.slice(0, 200) };
  }
};

const getApiEndpoint = (path) => {
  const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  return apiBaseUrl ? `${apiBaseUrl.replace(/\/$/, '')}${path}` : path;
};

const parseAdminEmails = () =>
  String(import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const getUpdatedTimeValue = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortRecordsByNewest = (records = []) =>
  [...records].sort((a, b) => getUpdatedTimeValue(b?.updatedAt) - getUpdatedTimeValue(a?.updatedAt));

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('讀取圖片失敗'));
    reader.readAsDataURL(file);
  });

const loadImage = (source) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('圖片解析失敗'));
    image.src = source;
  });

const getDataUrlBytes = (dataUrl) => {
  const base64Data = String(dataUrl || '').split(',')[1] || '';
  if (!base64Data) return 0;
  const paddingLength = (base64Data.match(/=+$/) || [''])[0].length;
  return Math.floor((base64Data.length * 3) / 4) - paddingLength;
};

const convertImageToUploadDataUrl = async (file) => {
  const sourceDataUrl = await readFileAsDataUrl(file);
  if (!sourceDataUrl) {
    throw new Error('照片內容為空');
  }

  const image = await loadImage(sourceDataUrl);
  const sourceWidth = image.naturalWidth || image.width || 1;
  const sourceHeight = image.naturalHeight || image.height || 1;
  const longEdge = Math.max(sourceWidth, sourceHeight);
  const scale = longEdge > PHOTO_MAX_DIMENSION_PX ? PHOTO_MAX_DIMENSION_PX / longEdge : 1;
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('瀏覽器不支援圖片處理，請更換瀏覽器');
  }

  const qualities = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46, 0.38];
  const MIN_LONG_EDGE_PX = 480;
  let workingWidth = targetWidth;
  let workingHeight = targetHeight;
  let latestDataUrl = '';

  while (true) {
    canvas.width = workingWidth;
    canvas.height = workingHeight;

    // JPEG 不支援透明，先鋪白底可避免透明區塊變黑。
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, workingWidth, workingHeight);
    context.drawImage(image, 0, 0, workingWidth, workingHeight);

    for (const quality of qualities) {
      const candidate = canvas.toDataURL('image/jpeg', quality);
      latestDataUrl = candidate;
      if (getDataUrlBytes(candidate) <= MAX_PHOTO_DATAURL_BYTES) {
        return candidate;
      }
    }

    const longEdgeNow = Math.max(workingWidth, workingHeight);
    if (longEdgeNow <= MIN_LONG_EDGE_PX) {
      break;
    }

    workingWidth = Math.max(1, Math.round(workingWidth * 0.85));
    workingHeight = Math.max(1, Math.round(workingHeight * 0.85));
  }

  if (latestDataUrl && getDataUrlBytes(latestDataUrl) <= MAX_PHOTO_DATAURL_BYTES) {
    return latestDataUrl;
  }
  throw new Error('照片處理後仍超過 300KB，請改用更小的照片');
};

const ResumeBuilder = () => {
  const isAdminRoute =
    typeof window !== 'undefined' && /^\/admin(?:\/|$)/i.test(window.location.pathname || '');
  const [data, setData] = useState(() => createBlankResumeData());
  const [validationErrors, setValidationErrors] = useState([]);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [deletingDraftId, setDeletingDraftId] = useState('');
  const [isDraftManagerOpen, setIsDraftManagerOpen] = useState(false);
  const [draftRecords, setDraftRecords] = useState([]);
  const [currentDraftId, setCurrentDraftId] = useState('');
  const [adminQuery, setAdminQuery] = useState('');
  const [isAdminDrawerOpen, setIsAdminDrawerOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [activeErrorField, setActiveErrorField] = useState('');
  const [notice, setNotice] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const adminEmails = parseAdminEmails();
  const authEmail = String(authUser?.email || '').trim().toLowerCase();
  const isAdmin = authEmail ? adminEmails.includes(authEmail) : false;

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

  useEffect(() => {
    if (!authReady || !authUser || !isAdmin || isAdminRoute) return;
    if (typeof window === 'undefined') return;
    window.location.replace('/admin');
  }, [authReady, authUser, isAdmin, isAdminRoute]);

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
      setCurrentDraftId('');
      setIsAdminDrawerOpen(false);
      setViewingRecord(null);
      setDraftRecords([]);
      setIsDraftManagerOpen(false);
      showNotice('已登出。', 'info');
    } catch (error) {
      console.error('Logout failed:', error);
      showNotice('登出失敗，請稍後再試。', 'error');
    } finally {
      setIsAuthBusy(false);
    }
  };

  const getAuthRequestHeaders = async () => {
    if (!authUser || typeof authUser.getIdToken !== 'function') {
      throw new Error('請先登入');
    }
    const idToken = await authUser.getIdToken();
    if (!idToken) {
      throw new Error('登入憑證已失效，請重新登入');
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    };
  };

  const fetchDraftRecords = async (filters = {}) => {
    const headers = await getAuthRequestHeaders();
    const params = new URLSearchParams();
    const keyword = String(filters?.q || '').trim();
    if (keyword) params.set('q', keyword);
    const query = params.toString();
    const response = await fetch(`${getApiEndpoint('/api/resume-records')}${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers,
    });
    const result = await parseResponsePayload(response);
    if (!response.ok || !result?.ok) {
      throw new Error(result?.message || `草稿查詢失敗（${response.status}）`);
    }
    return sortRecordsByNewest(Array.isArray(result.records) ? result.records : []);
  };

  const loadRecords = async (filters = {}, { openModal = false } = {}) => {
    if (!authUser) {
      showNotice('請先登入後再載入資料。', 'error');
      return;
    }

    setIsLoadingDrafts(true);
    try {
      const records = await fetchDraftRecords(filters);
      setDraftRecords(sortRecordsByNewest(records));
      if (openModal) {
        setIsDraftManagerOpen(true);
      }
    } catch (error) {
      console.error('Load records failed:', error);
      showNotice(`載入資料失敗：${error?.message || '請稍後再試。'}`, 'error');
    } finally {
      setIsLoadingDrafts(false);
    }
  };

  useEffect(() => {
    if (!authUser || !isAdmin || !isAdminRoute) return;
    void loadRecords({ q: adminQuery });
  }, [authUser, isAdmin, isAdminRoute]);

  const openDraftManager = async () => {
    if (isAdmin && isAdminRoute) {
      await loadRecords({ q: adminQuery });
      return;
    }
    await loadRecords({}, { openModal: true });
  };

  const upsertResumeRecord = async ({ showSuccessNotice = false, successMessage = '' } = {}) => {
    if (!authUser) {
      showNotice('請先登入後再儲存草稿。', 'error');
      return null;
    }
    if (isAdmin && !currentDraftId) {
      showNotice('管理員請先載入既有履歷後再儲存修改。', 'error');
      return null;
    }

    setIsSavingDraft(true);
    try {
      const headers = await getAuthRequestHeaders();
      const title = `${data.name || '未命名'}_${data.fillDate || getTodayDateText()}`;

      const response = await fetch(getApiEndpoint('/api/resume-records'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recordId: currentDraftId,
          title,
          formData: data,
        }),
      });
      const result = await parseResponsePayload(response);
      if (!response.ok || !result?.ok || !result?.record?.id) {
        throw new Error(result?.message || `草稿儲存失敗（${response.status}）`);
      }

      const savedRecord = result.record;
      setCurrentDraftId(savedRecord.id);
      if (savedRecord?.formData) {
        setData(normalizeResumeData(savedRecord.formData));
      }

      if (isAdmin) {
        await loadRecords({ q: adminQuery });
      } else {
        setDraftRecords((prev) => {
          const merged = [savedRecord, ...prev.filter((item) => item.id !== savedRecord.id)];
          return sortRecordsByNewest(merged);
        });
      }
      if (showSuccessNotice) {
        showNotice(successMessage || (isAdmin ? '履歷資料已更新。' : '履歷已儲存。'), 'info');
      }
      return savedRecord;
    } catch (error) {
      console.error('Save draft failed:', error);
      showNotice(`儲存草稿失敗：${error?.message || '請稍後再試。'}`, 'error');
      return null;
    } finally {
      setIsSavingDraft(false);
    }
  };

  const saveDraft = async () => {
    await upsertResumeRecord({
      showSuccessNotice: true,
      successMessage: isAdmin ? '履歷資料已更新。' : '履歷已儲存。',
    });
  };

  const applyDraftRecord = (record) => {
    if (!record?.formData || typeof record.formData !== 'object') {
      showNotice('草稿資料格式不正確。', 'error');
      return;
    }

    clearValidationErrors();
    const nextData = normalizeResumeData(record.formData);
    setData(nextData);
    setCurrentDraftId(record.id || '');
    if (!isAdmin) {
      setIsDraftManagerOpen(false);
    } else {
      setIsAdminDrawerOpen(true);
    }
    showNotice(`已載入${isAdmin ? '履歷' : '草稿'}：${record.title || '未命名草稿'}`, 'info');
  };

  const deleteDraftRecord = async (recordId) => {
    if (!recordId) return;

    setDeletingDraftId(recordId);
    try {
      const headers = await getAuthRequestHeaders();
      const response = await fetch(`${getApiEndpoint('/api/resume-records')}?id=${encodeURIComponent(recordId)}`, {
        method: 'DELETE',
        headers,
      });
      const result = await parseResponsePayload(response);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.message || `草稿刪除失敗（${response.status}）`);
      }

      setDraftRecords((prev) => prev.filter((item) => item.id !== recordId));
      if (currentDraftId === recordId) {
        setCurrentDraftId('');
        setIsAdminDrawerOpen(false);
      }
      setViewingRecord(null);
      showNotice('草稿已刪除。', 'info');
    } catch (error) {
      console.error('Delete draft failed:', error);
      showNotice(`刪除草稿失敗：${error?.message || '請稍後再試。'}`, 'error');
    } finally {
      setDeletingDraftId('');
    }
  };

  const createNewDraft = () => {
    if (isAdmin) {
      showNotice('管理員模式不提供建立新履歷，請從「管理履歷資料」載入後編修。', 'error');
      return;
    }
    clearValidationErrors();
    setData(createBlankResumeData());
    setCurrentDraftId('');
    showNotice('已建立新表單。', 'info');
  };

  const handleAdminQueryChange = (value) => {
    setAdminQuery(value);
  };

  const handleAdminSearch = async () => {
    await loadRecords({ q: adminQuery });
  };

  const handleAdminReset = async () => {
    setAdminQuery('');
    await loadRecords({ q: '' });
  };

  const handleAdminViewRecord = (record) => {
    if (!record?.formData) return;
    setViewingRecord(normalizeResumeData(record.formData));
  };

  const handleAdminEditRecord = (record) => {
    applyDraftRecord(record);
    setIsAdminDrawerOpen(true);
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
      pushError('birthDate', '出生日期不符合規定');
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
      focusField(firstError.fieldKey);
      showNotice(`請先修正：${firstError.message}，完成後再${actionText}。`, 'error');
      return false;
    }

    return true;
  };

  const goPreview = () => {};

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
    const inputElement = event.target;
    const file = inputElement.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotice('請上傳圖片檔（JPG、PNG、WEBP）。', 'error');
      inputElement.value = '';
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      showNotice('照片檔案過大，請上傳 5MB 以下圖片。', 'error');
      inputElement.value = '';
      return;
    }

    void (async () => {
      try {
        const dataUrl = await convertImageToUploadDataUrl(file);
        clearValidationErrors();
        setData((prev) => ({ ...prev, photoDataUrl: dataUrl }));
      } catch (error) {
        const message = error instanceof Error ? error.message : '照片處理失敗';
        showNotice(message, 'error');
      } finally {
        inputElement.value = '';
      }
    })();
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
    if (!isAdmin) {
      showNotice('僅管理員可使用列印功能。', 'error');
      return;
    }
    if (isAdminRoute && !currentDraftId) {
      showNotice('請先在列表點「編輯」載入履歷，再列印或匯出 PDF。', 'error');
      return;
    }
    if (!ensureValidBeforeAction('列印')) return;
    window.print();
  };

  // -------------------------------------------------------------
  // Word 匯出核心
  // -------------------------------------------------------------
  const buildLegacyWordBlob = async (sourceData = data) => {
    const formData = sourceData || data;
    const checked = '&#9745;';
    const unchecked = '&#9744;';
    const getCb = (condition) => condition ? checked : unchecked;
    const embeddedLogoDataUrl = await getEmbeddedLogoDataUrl();
    const safeLogoSrc = embeddedLogoDataUrl ? embeddedLogoDataUrl.replace(/"/g, '&quot;') : '';
    const logoMarkup = safeLogoSrc
      ? `<img src="${safeLogoSrc}" alt="灃禾集團 Logo" style="max-width: 660px; width: 100%; height: auto; display: block; margin: 0 auto;" />`
      : '';
    const safeText = (value) => escapeHTMLWithBreaks(value);
    const safePhotoSrc = formData.photoDataUrl ? String(formData.photoDataUrl).replace(/"/g, '&quot;') : '';
    const educationOutput = getEducationForOutput(formData.education);
    const hasCertificateValue = hasValue(formData.certificates);
    const [fillYear = '', fillMonth = '', fillDay = ''] = (formData.fillDate || '').split('-');

    const safeData = {
      name: safeText(formData.name),
      birthDate: formData.birthDate ? escapeHTML(formData.birthDate.replace(/-/g, '/')) : '',
      age: safeText(formData.age),
      arcNumber: safeText(formData.arcNumber),
      phone: safeText(formData.phone),
      email: safeText(formData.email),
      address: safeText(formData.address),
      school: safeText(educationOutput.map((edu) => edu.school || '').join('\n')),
      major: safeText(educationOutput.map((edu) => edu.major || '').join('\n')),
      gradDate: safeText(educationOutput.map((edu) => formatYearMonthForWordCell(edu.gradDate)).join('\n')),
      certificates: safeText(formData.certificates),
      salary: safeText(formData.salary),
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
            <td class="center" style="width: 28%;">${getCb(formData.gender === '男')} 男 &nbsp;&nbsp;&nbsp;&nbsp; ${getCb(formData.gender === '女')} 女</td>
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
            <td class="center">${getCb(formData.maritalStatus === '未婚')} 未婚 &nbsp;&nbsp;&nbsp;&nbsp; ${getCb(formData.maritalStatus === '已婚')} 已婚</td>
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
            const exp = formData.experience[i] || { company: '', title: '', period: '' };
            return `<tr>
              <td class="center" height="28">${safeText(exp.company)}</td>
              <td colspan="2" class="center">${safeText(exp.title)}</td>
              <td class="center">${safeText(exp.period)}</td>
            </tr>`;
          }).join('')}
          <tr>
            <td class="center bold">語言能力</td>
            <td colspan="4" class="center">${renderCbHTML(langOptions, formData.languages, formData.otherLanguage)}</td>
          </tr>
          <tr>
            <td class="center bold">證照</td>
            <td class="center">${hasCertificateValue ? `<span style="color: blue; text-decoration: underline;">${safeData.certificates}</span>` : ''}</td>
            <td class="center bold">交通</td>
            <td colspan="2" style="padding-left: 10px;">${renderCbHTML(transOptions, formData.transportation, formData.otherTransport)}</td>
          </tr>
          <tr>
            <td class="center bold">可接受工作地點<br><br><span style="font-weight: normal; font-size: 10pt;">(可複選)</span></td>
            <td colspan="4" style="padding-left: 10px;">${renderCbHTML(locOptions, formData.locations)}</td>
          </tr>
          <tr>
            <td class="center bold">希望工作內容<br><br><span style="font-weight: normal; font-size: 10pt;">(可複選)</span></td>
            <td colspan="4" style="padding-left: 10px;">${renderCbHTML(jobOptions, formData.jobTypes, formData.otherJobType)}</td>
          </tr>
          <tr>
            <td class="center bold">可以接受工作時間<br><br><span style="font-weight: normal; font-size: 10pt;">(可複選)</span></td>
            <td colspan="4" style="padding-left: 10px;">${renderCbHTML(timeOptions, formData.workHours)}</td>
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
    if (!isAdmin) {
      showNotice('僅管理員可使用 Word 匯出功能。', 'error');
      return;
    }
    if (!skipValidation && !ensureValidBeforeAction('匯出 Word')) return;

    const blob = await buildLegacyWordBlob();
    downloadBlob(blob, getExportFilename(data.name, data.fillDate));
  };

  const buildTemplateWordBlob = async (sourceData = data) => {
    const formData = sourceData || data;
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
    if (formData.photoDataUrl) {
      photoRelationshipId = await injectPhotoIntoWordZip(zip, formData.photoDataUrl);
    }

    const documentXml = await documentXmlFile.async('string');
    const xmlDocument = new DOMParser().parseFromString(documentXml, 'application/xml');
    const parserError = xmlDocument.getElementsByTagName('parsererror')[0];
    if (parserError) {
      throw new Error('模板 XML 解析失敗');
    }

    fillResumeTemplateXml(xmlDocument, formData, { photoRelationshipId });

    const serializedXml = new XMLSerializer().serializeToString(xmlDocument);
    zip.file('word/document.xml', serializedXml);

    return zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  };

  const exportToWord = async () => {
    if (!isAdmin) {
      showNotice('僅管理員可使用 Word 匯出功能。', 'error');
      return;
    }
    if (isAdminRoute && !currentDraftId) {
      showNotice('請先在列表點「編輯」載入履歷，再匯出 Word。', 'error');
      return;
    }
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
      const savedRecord = await upsertResumeRecord();
      if (!savedRecord) {
        throw new Error('送出前自動儲存失敗');
      }

      const latestData = savedRecord?.formData ? normalizeResumeData(savedRecord.formData) : data;
      const renderData = {
        ...latestData,
        // 當前頁面若剛上傳新照片，優先使用本地 Data URL，避免跨網域讀圖失敗。
        photoDataUrl: data.photoDataUrl || latestData.photoDataUrl,
      };

      let attachmentBlob;
      let attachmentFilename;
      let attachmentMimeType;

      try {
        attachmentBlob = await buildTemplateWordBlob(renderData);
        attachmentFilename = getExportFilename(renderData.name, renderData.fillDate).replace(/\.doc$/i, '.docx');
        attachmentMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } catch (error) {
        console.error('模板產生失敗，改用相容模式寄送：', error);
        attachmentBlob = await buildLegacyWordBlob(renderData);
        attachmentFilename = getExportFilename(renderData.name, renderData.fillDate);
        attachmentMimeType = 'application/msword';
        showNotice('模板產生失敗，已改用相容 .doc 格式寄送。', 'error');
      }

      const attachmentBuffer = await attachmentBlob.arrayBuffer();
      const attachmentBase64 = arrayBufferToBase64(attachmentBuffer);
      const idToken = typeof authUser.getIdToken === 'function' ? await authUser.getIdToken() : '';
      const response = await fetch(getApiEndpoint('/api/send-resume'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          attachmentBase64,
          attachmentFilename,
          attachmentMimeType,
          applicantName: renderData.name,
          applicantEmail: renderData.email,
          applicantPhone: renderData.phone,
          fillDate: renderData.fillDate,
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
      setData(latestData);
    } catch (error) {
      console.error('Send email failed:', error);
      const errorMessage = error instanceof Error ? error.message : '請稍後重試。';
      showNotice(`送出寄送失敗：${errorMessage}`, 'error');
    } finally {
      setIsSendingEmail(false);
    }
  };

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

  if (isAdminRoute && !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
        <ResumeStyles />
        <NoticeBanner notice={notice} />
        <div className="max-w-xl mx-auto px-4 py-16">
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8 text-center">
            <h1 className="text-2xl font-bold text-red-700 mb-3">無管理權限</h1>
            <p className="text-gray-600">此帳號不在管理員白名單，請改用一般填寫頁面。</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800 pb-12">
      <ResumeStyles />
      <TopNav
        isAdmin={isAdmin}
        isAdminRoute={isAdminRoute}
        onNewDraft={createNewDraft}
        onLoadDrafts={openDraftManager}
        onExportWord={exportToWord}
        onPrint={printDocument}
        canExport={Boolean(currentDraftId)}
        isExportingWord={isExportingWord}
        onSendEmail={sendResumeByEmail}
        isSendingEmail={isSendingEmail}
        isLoadingDrafts={isLoadingDrafts}
        authUser={authUser}
        isAuthBusy={isAuthBusy}
        isAuthConfigured={isAuthConfigured}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
      <NoticeBanner notice={notice} />
      {!isAdminRoute && (
        <DraftManager
          isOpen={isDraftManagerOpen}
          records={draftRecords}
          isAdmin={false}
          isLoading={isLoadingDrafts}
          deletingId={deletingDraftId}
          onClose={() => setIsDraftManagerOpen(false)}
          onRefresh={openDraftManager}
          onApply={applyDraftRecord}
          onDelete={deleteDraftRecord}
        />
      )}

      <div className="max-w-5xl mx-auto mt-8 px-4">
        {isAdminRoute ? (
          <div className="space-y-6">
            <AdminRecordPanel
              query={adminQuery}
              onQueryChange={handleAdminQueryChange}
              onSearch={handleAdminSearch}
              onReset={handleAdminReset}
              records={draftRecords}
              isLoading={isLoadingDrafts}
              deletingId={deletingDraftId}
              editingRecordId={currentDraftId}
              onView={handleAdminViewRecord}
              onEdit={handleAdminEditRecord}
              onDelete={deleteDraftRecord}
            />
            <AdminEditDrawer
              isOpen={isAdminDrawerOpen && Boolean(currentDraftId)}
              title={data.name ? `編輯履歷：${data.name}` : '編輯履歷'}
              isSaving={isSavingDraft}
              isExportingWord={isExportingWord}
              canExport={Boolean(currentDraftId)}
              onClose={() => {
                setIsAdminDrawerOpen(false);
                setCurrentDraftId('');
              }}
              onSave={saveDraft}
              onExportWord={exportToWord}
              onPrint={printDocument}
            >
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
                showPreviewAction={false}
              />
            </AdminEditDrawer>
            <AdminViewModal
              isOpen={Boolean(viewingRecord)}
              data={viewingRecord}
              onClose={() => setViewingRecord(null)}
            />
          </div>
        ) : (
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
            showPreviewAction={false}
          />
        )}
      </div>
    </div>
  );
};
export default ResumeBuilder;


