import JSZip from 'jszip';

const initialData = {
  name: '',
  gender: '',
  birthDate: '',
  age: '',
  maritalStatus: '',
  arcNumber: '',
  phone: '',
  email: '',
  address: '',
  photoDataUrl: '',
  education: [{ school: '', major: '', gradDate: '' }],
  experience: [
    { company: '', title: '', period: '' },
  ],
  languages: [],
  otherLanguage: '',
  certificates: '',
  transportation: [],
  otherTransport: '',
  locations: [],
  jobTypes: [],
  otherJobType: '',
  workHours: [],
  salary: '',
  fillDate: new Date().toISOString().split('T')[0]
};

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_PHOTO_DATAURL_BYTES = 300 * 1024;
const PHOTO_MAX_DIMENSION_PX = 1200;

const langOptions = ['中文', '英文', '越文', '其他'];
const transOptions = ['捷運', '汽車', '機車', '公車', '其他'];
const locOptions = ['台北', '新北', '宜蘭', '桃園', '新竹', '台中', '高雄', '台南'];
const jobOptions = ['服務業（櫃檯/銷售人員）', '餐飲業（外場/內場）', '旅宿業（櫃檯/房務）', '製造業', '內勤 (行政/行銷)', '其他'];
const timeOptions = ['日班', '中班', '夜班', '輪班', '都可'];

const hasValue = (value) => String(value ?? '').trim() !== '';

const escapeHTML = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeHTMLWithBreaks = (value = '') => escapeHTML(value).replace(/\r?\n/g, '<br>');

const getDateToken = (dateString) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString.replace(/-/g, '');
  }

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const getExportFilename = (name, fillDate) => {
  const cleanedName = String(name || '個人')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/\.+$/g, '')
    .slice(0, 30);

  return `${cleanedName || '個人'}_履歷表_${getDateToken(fillDate)}.doc`;
};

const WORD_XML_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
const WORD_REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const WORD_DRAWING_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const DRAWING_MAIN_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const PIC_NS = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
const IMAGE_RELATIONSHIP_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
const WORD_TEMPLATE_FILENAME = '評點製_人事資料表.docx';
const LOGO_FILENAME = 'logo.jpg';
const PHOTO_SIZE_CM = '2.5cm';
const PHOTO_SIZE_EMU = 900000;
const MIN_AGE = 18;

let logoDataUrlCache = '';

const getPublicAssetPath = (filename) => {
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBaseUrl}${filename}`;
};

const getWordTemplateCandidates = () => {
  const encodedFilename = encodeURIComponent(WORD_TEMPLATE_FILENAME);
  const baseTemplatePath = getPublicAssetPath(WORD_TEMPLATE_FILENAME);
  const baseEncodedTemplatePath = getPublicAssetPath(encodedFilename);
  const candidates = [
    baseTemplatePath,
    baseEncodedTemplatePath,
    `/${WORD_TEMPLATE_FILENAME}`,
    `/${encodedFilename}`,
    `./${WORD_TEMPLATE_FILENAME}`,
    `./${encodedFilename}`,
    WORD_TEMPLATE_FILENAME,
    encodedFilename,
  ];
  return Array.from(new Set(candidates));
};

const loadJSZipModule = async () => JSZip;

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const getEmbeddedLogoDataUrl = async () => {
  if (logoDataUrlCache) return logoDataUrlCache;

  const baseLogoPath = getPublicAssetPath(LOGO_FILENAME);
  const candidates = Array.from(
    new Set([
      `/${LOGO_FILENAME}`,
      baseLogoPath,
      `./${LOGO_FILENAME}`,
      LOGO_FILENAME,
    ])
  );

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { cache: 'no-store' });
      if (!response.ok) continue;
      const blob = await response.blob();
      logoDataUrlCache = await blobToDataUrl(blob);
      if (logoDataUrlCache) return logoDataUrlCache;
    } catch (error) {
      // try next candidate
    }
  }

  return '';
};

const getWordChecked = (condition) => (condition ? '☑' : '□');

const buildCheckboxLine = (options, selected = [], otherValue = '') => {
  const text = options
    .map((option) => `${getWordChecked(selected.includes(option))}${option}`)
    .join('   ');

  if (selected.includes('其他') && hasValue(otherValue)) {
    return `${text}   ${otherValue}`;
  }
  return text;
};

const formatDateForWordCell = (dateString) => (dateString ? dateString.replace(/-/g, '/') : '');

const formatYearMonthForWordCell = (dateString) => {
  if (!dateString) return '　　年　　月';
  const [year = '', month = ''] = dateString.split('-');
  return `${year} 年 ${month} 月`;
};

const formatFillDateLine = (dateString) => {
  if (!dateString) return '填寫日期：________年________月______日';
  const [year = '____', month = '__', day = '__'] = dateString.split('-');
  return `填寫日期：${year}年${month}月${day}日`;
};

const calculateAgeFromBirthDate = (birthDate) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate || '')) return '';

  const today = new Date();
  const birthday = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birthday.getTime())) return '';

  let age = today.getFullYear() - birthday.getFullYear();
  const monthGap = today.getMonth() - birthday.getMonth();
  const dayGap = today.getDate() - birthday.getDate();

  if (monthGap < 0 || (monthGap === 0 && dayGap < 0)) {
    age -= 1;
  }

  if (age < 0) return '';
  return String(age);
};

const getAdultMaxBirthDate = () => {
  const today = new Date();
  const adultDate = new Date(today);
  adultDate.setFullYear(adultDate.getFullYear() - MIN_AGE);
  const year = adultDate.getFullYear();
  const month = String(adultDate.getMonth() + 1).padStart(2, '0');
  const day = String(adultDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const hasEducationValue = (edu) =>
  hasValue(edu?.school) || hasValue(edu?.major) || hasValue(edu?.gradDate);

const getEducationForOutput = (educationList = []) => {
  const normalizedList = Array.isArray(educationList) ? educationList : [];
  const filled = normalizedList.filter(hasEducationValue);
  return filled.length > 0 ? filled : [{ school: '', major: '', gradDate: '' }];
};

const getDirectWordChildren = (node, localName) =>
  Array.from(node.childNodes).filter((child) => child.nodeType === 1 && child.localName === localName);

const getWordCellText = (cell) =>
  Array.from(cell.getElementsByTagNameNS(WORD_XML_NS, 't'))
    .map((node) => node.textContent || '')
    .join('');

const createWordNode = (xmlDocument, name) => xmlDocument.createElementNS(WORD_XML_NS, `w:${name}`);

const setWordParagraphText = (paragraph, text) => {
  const xmlDocument = paragraph.ownerDocument;
  const firstRun = getDirectWordChildren(paragraph, 'r')[0];
  const firstRunProps = firstRun ? getDirectWordChildren(firstRun, 'rPr')[0] : null;

  Array.from(paragraph.childNodes).forEach((child) => {
    if (!(child.nodeType === 1 && child.localName === 'pPr')) {
      paragraph.removeChild(child);
    }
  });

  const lines = String(text ?? '').split('\n');
  const safeLines = lines.length > 0 ? lines : [''];

  safeLines.forEach((line, index) => {
    const run = createWordNode(xmlDocument, 'r');
    if (firstRunProps) {
      run.appendChild(firstRunProps.cloneNode(true));
    }

    const textNode = createWordNode(xmlDocument, 't');
    if (/^\s|\s$/.test(line)) {
      textNode.setAttributeNS(XML_NAMESPACE, 'xml:space', 'preserve');
    }
    textNode.textContent = line;
    run.appendChild(textNode);
    paragraph.appendChild(run);

    if (index < safeLines.length - 1) {
      const breakRun = createWordNode(xmlDocument, 'r');
      if (firstRunProps) {
        breakRun.appendChild(firstRunProps.cloneNode(true));
      }
      breakRun.appendChild(createWordNode(xmlDocument, 'br'));
      paragraph.appendChild(breakRun);
    }
  });
};

const setWordCellText = (cell, text) => {
  const xmlDocument = cell.ownerDocument;
  const paragraphs = getDirectWordChildren(cell, 'p');
  let paragraph = paragraphs[0];

  if (!paragraph) {
    paragraph = createWordNode(xmlDocument, 'p');
    cell.appendChild(paragraph);
  }

  for (let index = 1; index < paragraphs.length; index += 1) {
    cell.removeChild(paragraphs[index]);
  }

  setWordParagraphText(paragraph, text);
};

const setWordCellDrawing = (cell, drawingNode) => {
  const xmlDocument = cell.ownerDocument;
  const paragraphs = getDirectWordChildren(cell, 'p');
  let paragraph = paragraphs[0];

  if (!paragraph) {
    paragraph = createWordNode(xmlDocument, 'p');
    cell.appendChild(paragraph);
  }

  for (let index = 1; index < paragraphs.length; index += 1) {
    cell.removeChild(paragraphs[index]);
  }

  const firstRun = getDirectWordChildren(paragraph, 'r')[0];
  const firstRunProps = firstRun ? getDirectWordChildren(firstRun, 'rPr')[0] : null;

  Array.from(paragraph.childNodes).forEach((child) => {
    if (!(child.nodeType === 1 && child.localName === 'pPr')) {
      paragraph.removeChild(child);
    }
  });

  let paragraphProps = getDirectWordChildren(paragraph, 'pPr')[0];
  if (!paragraphProps) {
    paragraphProps = createWordNode(xmlDocument, 'pPr');
    paragraph.insertBefore(paragraphProps, paragraph.firstChild);
  }

  let justifyNode = getDirectWordChildren(paragraphProps, 'jc')[0];
  if (!justifyNode) {
    justifyNode = createWordNode(xmlDocument, 'jc');
    paragraphProps.appendChild(justifyNode);
  }
  justifyNode.setAttributeNS(WORD_XML_NS, 'w:val', 'center');

  const run = createWordNode(xmlDocument, 'r');
  if (firstRunProps) {
    run.appendChild(firstRunProps.cloneNode(true));
  }
  run.appendChild(drawingNode);
  paragraph.appendChild(run);
};

const getNextDrawingId = (xmlDocument) => {
  const ids = [];

  Array.from(xmlDocument.getElementsByTagNameNS(WORD_DRAWING_NS, 'docPr')).forEach((node) => {
    const value = Number.parseInt(node.getAttribute('id') || '', 10);
    if (Number.isFinite(value)) ids.push(value);
  });

  Array.from(xmlDocument.getElementsByTagNameNS(PIC_NS, 'cNvPr')).forEach((node) => {
    const value = Number.parseInt(node.getAttribute('id') || '', 10);
    if (Number.isFinite(value)) ids.push(value);
  });

  return (ids.length > 0 ? Math.max(...ids) : 1) + 1;
};

const createWordPhotoDrawing = (xmlDocument, relationshipId) => {
  const baseDrawing = xmlDocument.getElementsByTagNameNS(WORD_XML_NS, 'drawing')[0];
  if (!baseDrawing) {
    throw new Error('模板缺少圖片節點，無法插入照片');
  }

  const drawingNode = baseDrawing.cloneNode(true);
  const drawingId = getNextDrawingId(xmlDocument);

  const inlineExtent = drawingNode.getElementsByTagNameNS(WORD_DRAWING_NS, 'extent')[0];
  if (inlineExtent) {
    inlineExtent.setAttribute('cx', String(PHOTO_SIZE_EMU));
    inlineExtent.setAttribute('cy', String(PHOTO_SIZE_EMU));
  }

  const xfrm = drawingNode.getElementsByTagNameNS(DRAWING_MAIN_NS, 'xfrm')[0];
  const xfrmExtent = xfrm ? xfrm.getElementsByTagNameNS(DRAWING_MAIN_NS, 'ext')[0] : null;
  if (xfrmExtent) {
    xfrmExtent.setAttribute('cx', String(PHOTO_SIZE_EMU));
    xfrmExtent.setAttribute('cy', String(PHOTO_SIZE_EMU));
  }

  const docPr = drawingNode.getElementsByTagNameNS(WORD_DRAWING_NS, 'docPr')[0];
  if (docPr) {
    docPr.setAttribute('id', String(drawingId));
    docPr.setAttribute('name', '個人照片');
  }

  const cNvPr = drawingNode.getElementsByTagNameNS(PIC_NS, 'cNvPr')[0];
  if (cNvPr) {
    cNvPr.setAttribute('id', String(drawingId));
    cNvPr.setAttribute('name', '個人照片');
  }

  const blip = drawingNode.getElementsByTagNameNS(DRAWING_MAIN_NS, 'blip')[0];
  if (blip) {
    blip.setAttributeNS(WORD_REL_NS, 'r:embed', relationshipId);
  }

  return drawingNode;
};

const getImageMimeFromDataUrl = (dataUrl) => {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/i.exec(String(dataUrl || ''));
  return match ? match[1].toLowerCase() : '';
};

const getImageExtensionFromMime = (mimeType) => {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpeg';
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/gif') return 'gif';
  if (normalized === 'image/bmp') return 'bmp';
  return 'jpeg';
};

const convertImageDataUrlToJpeg = (dataUrl) =>
  new Promise((resolve) => {
    const image = new Image();

    image.onload = () => {
      const width = image.naturalWidth || image.width || 1;
      const height = image.naturalHeight || image.height || 1;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');

      if (!context) {
        resolve(dataUrl);
        return;
      }

      // JPEG 不支援透明，先鋪白底避免黑底。
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };

    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });

const getWordPhotoAsset = async (photoDataUrl) => {
  if (!photoDataUrl) return null;

  let normalizedDataUrl = String(photoDataUrl);
  let mimeType = getImageMimeFromDataUrl(normalizedDataUrl);

  if (mimeType === 'image/webp') {
    normalizedDataUrl = await convertImageDataUrlToJpeg(normalizedDataUrl);
    mimeType = getImageMimeFromDataUrl(normalizedDataUrl) || 'image/jpeg';
  }

  const response = await fetch(normalizedDataUrl);
  const buffer = await response.arrayBuffer();
  const extension = getImageExtensionFromMime(mimeType);
  const contentType = mimeType || 'image/jpeg';

  return {
    bytes: new Uint8Array(buffer),
    extension,
    contentType,
  };
};

const getNextRelationshipId = (relationshipsDocument) => {
  const relationships = Array.from(relationshipsDocument.getElementsByTagNameNS(PACKAGE_REL_NS, 'Relationship'));
  const idNumbers = relationships
    .map((relation) => {
      const match = /^rId(\d+)$/i.exec(relation.getAttribute('Id') || '');
      return match ? Number.parseInt(match[1], 10) : NaN;
    })
    .filter((value) => Number.isFinite(value));

  return `rId${(idNumbers.length > 0 ? Math.max(...idNumbers) : 0) + 1}`;
};

const ensureWordContentTypeDefault = (contentTypesDocument, extension, contentType) => {
  const defaults = Array.from(contentTypesDocument.getElementsByTagNameNS(CONTENT_TYPES_NS, 'Default'));
  const hasExisting = defaults.some(
    (item) => String(item.getAttribute('Extension') || '').toLowerCase() === String(extension || '').toLowerCase()
  );

  if (hasExisting) return;

  const defaultNode = contentTypesDocument.createElementNS(CONTENT_TYPES_NS, 'Default');
  defaultNode.setAttribute('Extension', String(extension || '').toLowerCase());
  defaultNode.setAttribute('ContentType', contentType);
  contentTypesDocument.documentElement.appendChild(defaultNode);
};

const injectPhotoIntoWordZip = async (zip, photoDataUrl) => {
  const photoAsset = await getWordPhotoAsset(photoDataUrl);
  if (!photoAsset) return '';

  const relationshipFile = zip.file('word/_rels/document.xml.rels');
  if (!relationshipFile) {
    throw new Error('模板缺少 word/_rels/document.xml.rels');
  }

  const relationXml = await relationshipFile.async('string');
  const relationDoc = new DOMParser().parseFromString(relationXml, 'application/xml');
  const relationError = relationDoc.getElementsByTagName('parsererror')[0];
  if (relationError) {
    throw new Error('模板關聯檔解析失敗');
  }

  const relationshipId = getNextRelationshipId(relationDoc);
  const photoFilename = `resume_photo.${photoAsset.extension}`;
  const relationshipNode = relationDoc.createElementNS(PACKAGE_REL_NS, 'Relationship');
  relationshipNode.setAttribute('Id', relationshipId);
  relationshipNode.setAttribute('Type', IMAGE_RELATIONSHIP_TYPE);
  relationshipNode.setAttribute('Target', `media/${photoFilename}`);
  relationDoc.documentElement.appendChild(relationshipNode);
  zip.file('word/_rels/document.xml.rels', new XMLSerializer().serializeToString(relationDoc));

  const contentTypesFile = zip.file('[Content_Types].xml');
  if (contentTypesFile) {
    const contentTypesXml = await contentTypesFile.async('string');
    const contentTypesDoc = new DOMParser().parseFromString(contentTypesXml, 'application/xml');
    const contentTypesError = contentTypesDoc.getElementsByTagName('parsererror')[0];
    if (!contentTypesError) {
      ensureWordContentTypeDefault(contentTypesDoc, photoAsset.extension, photoAsset.contentType);
      zip.file('[Content_Types].xml', new XMLSerializer().serializeToString(contentTypesDoc));
    }
  }

  zip.file(`word/media/${photoFilename}`, photoAsset.bytes, { binary: true });
  return relationshipId;
};

const fillResumeTemplateXml = (xmlDocument, formData, options = {}) => {
  const table = xmlDocument.getElementsByTagNameNS(WORD_XML_NS, 'tbl')[0];
  if (!table) throw new Error('找不到履歷表主表格');

  let rows = Array.from(table.getElementsByTagNameNS(WORD_XML_NS, 'tr'));
  if (rows.length < 18) {
    throw new Error(`模板格式與預期不符（目前列數：${rows.length}）`);
  }

  const refreshRows = () => {
    rows = Array.from(table.getElementsByTagNameNS(WORD_XML_NS, 'tr'));
  };

  const getRowCells = (rowIndex) => getDirectWordChildren(rows[rowIndex], 'tc');
  const setByIndex = (rowIndex, cellIndex, value) => {
    const cells = getRowCells(rowIndex);
    if (!cells[cellIndex]) return;
    setWordCellText(cells[cellIndex], value);
  };

  const educationForOutput = getEducationForOutput(formData.education);
  const extraEducationRows = Math.max(0, educationForOutput.length - 1);

  // 教育背景每一筆都使用獨立列，讓 Word 內有實體分格線。
  if (extraEducationRows > 0) {
    const educationTemplateRow = rows[6];
    if (!educationTemplateRow) {
      throw new Error('模板缺少教育背景資料列');
    }

    for (let index = 0; index < extraEducationRows; index += 1) {
      const cloneRow = educationTemplateRow.cloneNode(true);
      const cloneCells = getDirectWordChildren(cloneRow, 'tc');
      cloneCells.forEach((cell) => setWordCellText(cell, ''));

      refreshRows();
      const insertBeforeRow = rows[7 + index] || null;
      table.insertBefore(cloneRow, insertBeforeRow);
    }

    refreshRows();
  }

  const educationDataStartRow = 6;
  const experienceHeaderRow = educationDataStartRow + educationForOutput.length;
  const experienceDataStartRow = experienceHeaderRow + 1;
  const languageRow = experienceDataStartRow + 4;
  const certificateRow = languageRow + 1;
  const locationsRow = certificateRow + 1;
  const jobTypesRow = locationsRow + 1;
  const workHoursRow = jobTypesRow + 1;
  const salaryRow = workHoursRow + 1;

  setByIndex(0, 1, formData.name);
  setByIndex(0, 3, `${getWordChecked(formData.gender === '男')}男   ${getWordChecked(formData.gender === '女')}女`);
  setByIndex(1, 1, formatDateForWordCell(formData.birthDate));
  setByIndex(1, 3, formData.age);
  setByIndex(2, 1, `${getWordChecked(formData.maritalStatus === '未婚')}未婚   ${getWordChecked(formData.maritalStatus === '已婚')}已婚`);
  setByIndex(2, 3, formData.arcNumber);
  setByIndex(3, 1, formData.phone);
  setByIndex(3, 3, formData.email);
  setByIndex(4, 1, formData.address);

  educationForOutput.forEach((edu, index) => {
    const rowIndex = educationDataStartRow + index;
    setByIndex(rowIndex, 1, edu.school || '');
    setByIndex(rowIndex, 2, edu.major || '');
    setByIndex(rowIndex, 3, formatYearMonthForWordCell(edu.gradDate));
  });

  for (let index = 0; index < 4; index += 1) {
    const exp = formData.experience[index] || { company: '', title: '', period: '' };
    const rowIndex = experienceDataStartRow + index;
    setByIndex(rowIndex, 1, exp.company);
    setByIndex(rowIndex, 2, exp.title);
    setByIndex(rowIndex, 3, exp.period);
  }

  setByIndex(languageRow, 1, buildCheckboxLine(langOptions, formData.languages, formData.otherLanguage));
  setByIndex(certificateRow, 0, '證照');
  setByIndex(certificateRow, 1, formData.certificates || '');
  setByIndex(certificateRow, 2, '交通');
  setByIndex(certificateRow, 3, buildCheckboxLine(transOptions, formData.transportation, formData.otherTransport));
  setByIndex(locationsRow, 1, buildCheckboxLine(locOptions, formData.locations));
  setByIndex(jobTypesRow, 1, buildCheckboxLine(jobOptions, formData.jobTypes, formData.otherJobType));
  setByIndex(workHoursRow, 1, buildCheckboxLine(timeOptions, formData.workHours));
  setByIndex(salaryRow, 1, formData.salary);

  if (options.photoRelationshipId) {
    const firstRowCells = getRowCells(0);
    const photoCell = firstRowCells[4];
    if (photoCell) {
      const photoDrawing = createWordPhotoDrawing(xmlDocument, options.photoRelationshipId);
      setWordCellDrawing(photoCell, photoDrawing);
    }
  }

  const paragraphs = Array.from(xmlDocument.getElementsByTagNameNS(WORD_XML_NS, 'p'));
  const fillDateParagraph = paragraphs.find((paragraph) => getWordCellText(paragraph).includes('填寫日期'));
  if (fillDateParagraph) {
    setWordParagraphText(fillDateParagraph, formatFillDateLine(formData.fillDate));
  }
};

export {
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
  LOGO_FILENAME,
  PHOTO_SIZE_CM,
  MIN_AGE,
  getWordTemplateCandidates,
  loadJSZipModule,
  getPublicAssetPath,
  getEmbeddedLogoDataUrl,
  formatYearMonthForWordCell,
  calculateAgeFromBirthDate,
  getAdultMaxBirthDate,
  getEducationForOutput,
  injectPhotoIntoWordZip,
  fillResumeTemplateXml,
};
