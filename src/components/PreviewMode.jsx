import React from 'react';
import {
  formatYearMonthForWordCell,
  getPublicAssetPath,
  jobOptions,
  langOptions,
  locOptions,
  LOGO_FILENAME,
  PHOTO_SIZE_CM,
  timeOptions,
  transOptions,
} from '../modules/resumeCore';

const PreviewMode = ({ data, educationForOutput, hasCertificates, previewScale = 1 }) => (
  <div className="preview-stage">
    <div
      className="print-area preview-zoomed text-black relative"
      style={{ '--preview-scale': previewScale, zoom: `${Math.round(previewScale * 100)}%` }}
    >
      <div className="resume-header-wrap" style={{ fontFamily: 'sans-serif' }}>
        <div className="flex items-center justify-center w-full">
          <img
            src={getPublicAssetPath(LOGO_FILENAME)}
            alt="灃禾集團 Logo"
            className="max-w-[660px] w-auto h-auto object-contain mx-auto"
          />
        </div>
      </div>

      <div className="resume-title">個人履歷表</div>

      <div className="resume-table-wrapper">
        <table className="resume-table">
          <colgroup>
            <col style={{ width: '16%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '28%' }} />
            <col style={{ width: '20%' }} />
          </colgroup>
          <tbody>
            <tr>
              <td className="td-label">姓名</td>
              <td className="td-content">{data.name}</td>
              <td className="td-label">性別</td>
              <td className="td-content">
                <span className={`print-checkbox ${data.gender === '男' ? 'checked' : ''}`}></span> 男
                <span className="mx-3"></span>
                <span className={`print-checkbox ${data.gender === '女' ? 'checked' : ''}`}></span> 女
              </td>
              <td rowSpan="5" className="td-content">
                {data.photoDataUrl ? (
                  <div className="mx-auto" style={{ width: PHOTO_SIZE_CM, height: PHOTO_SIZE_CM }}>
                    <img src={data.photoDataUrl} alt="個人照片" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div
                    className="mx-auto flex items-center justify-center text-gray-300 text-sm border border-gray-200"
                    style={{ width: PHOTO_SIZE_CM, height: PHOTO_SIZE_CM }}
                  >
                    照片
                  </div>
                )}
              </td>
            </tr>
            <tr>
              <td className="td-label">出生日期</td>
              <td className="td-content">{data.birthDate ? data.birthDate.replace(/-/g, '/') : ''}</td>
              <td className="td-label">年齡</td>
              <td className="td-content">{data.age}</td>
            </tr>
            <tr>
              <td className="td-label">婚姻狀況</td>
              <td className="td-content">
                <span className={`print-checkbox ${data.maritalStatus === '未婚' ? 'checked' : ''}`}></span> 未婚
                <span className="mx-3"></span>
                <span className={`print-checkbox ${data.maritalStatus === '已婚' ? 'checked' : ''}`}></span> 已婚
              </td>
              <td className="td-label">居留證號</td>
              <td className="td-content">{data.arcNumber}</td>
            </tr>
            <tr>
              <td className="td-label">聯絡電話</td>
              <td className="td-content">{data.phone}</td>
              <td className="td-label">電子郵件</td>
              <td className="td-content text-[10.5pt]">{data.email}</td>
            </tr>
            <tr>
              <td className="td-label">居住地址</td>
              <td colSpan="3" className="td-content-left">{data.address}</td>
            </tr>

            <tr>
              <td rowSpan={educationForOutput.length + 1} className="td-label">教育背景</td>
              <td className="td-label">學校名稱</td>
              <td colSpan="2" className="td-label">就讀科系</td>
              <td className="td-label">畢業日期</td>
            </tr>
            {educationForOutput.map((edu, index) => (
              <tr key={`preview-edu-${index}`}>
                <td className="td-content">{edu.school || ''}</td>
                <td colSpan="2" className="td-content">{edu.major || ''}</td>
                <td className="td-content">{formatYearMonthForWordCell(edu.gradDate)}</td>
              </tr>
            ))}

            <tr>
              <td rowSpan={Math.max(4, data.experience.length) + 1} className="td-label">
                工作經驗<br /><br /><span className="font-normal text-[10pt] leading-tight block">(兼職或實習<br />經驗可)</span>
              </td>
              <td className="td-label">公司名稱</td>
              <td colSpan="2" className="td-label">職稱</td>
              <td className="td-label">工作時間</td>
            </tr>
            {[...Array(4)].map((_, i) => {
              const exp = data.experience[i] || { company: '', title: '', period: '' };
              return (
                <tr key={`exp-${i}`}>
                  <td className="td-content h-[35px]">{exp.company}</td>
                  <td colSpan="2" className="td-content">{exp.title}</td>
                  <td className="td-content">{exp.period}</td>
                </tr>
              );
            })}

            <tr>
              <td className="td-label">語言能力</td>
              <td colSpan="4" className="td-content text-center">
                {langOptions.map((lang) => (
                  <span key={lang} className="mr-6 inline-flex items-center">
                    <span className={`print-checkbox ${data.languages.includes(lang) ? 'checked' : ''}`}></span> {lang}
                  </span>
                ))}
                {data.languages.includes('其他') && data.otherLanguage && (
                  <span className="border-b border-black px-2">{data.otherLanguage}</span>
                )}
              </td>
            </tr>

            {hasCertificates ? (
              <tr>
                <td className="td-label">證照</td>
                <td className="td-content text-blue-700 underline">{data.certificates}</td>
                <td className="td-label">交通</td>
                <td colSpan="2" className="td-content-left">
                  <div className="flex flex-wrap gap-y-1">
                    {transOptions.map((trans) => (
                      <span key={trans} className="mr-3 inline-flex items-center">
                        <span className={`print-checkbox ${data.transportation.includes(trans) ? 'checked' : ''}`}></span> {trans}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ) : (
              <tr>
                <td className="td-label">交通</td>
                <td colSpan="4" className="td-content-left">
                  <div className="flex flex-wrap gap-y-1">
                    {transOptions.map((trans) => (
                      <span key={trans} className="mr-3 inline-flex items-center">
                        <span className={`print-checkbox ${data.transportation.includes(trans) ? 'checked' : ''}`}></span> {trans}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            )}

            <tr>
              <td className="td-label">可接受工作地點<br /><br /><span className="font-normal text-[10pt]">(可複選)</span></td>
              <td colSpan="4" className="td-content-left">
                <div className="flex flex-wrap gap-y-2">
                  {locOptions.map((loc) => (
                    <span key={loc} className="w-[12%] inline-flex items-center">
                      <span className={`print-checkbox ${data.locations.includes(loc) ? 'checked' : ''}`}></span> {loc}
                    </span>
                  ))}
                </div>
              </td>
            </tr>

            <tr>
              <td className="td-label">希望工作內容<br /><br /><span className="font-normal text-[10pt]">(可複選)</span></td>
              <td colSpan="4" className="td-content-left">
                <div className="flex flex-wrap gap-y-2">
                  {jobOptions.map((job, idx) => (
                    <span key={job} className={`${idx < 3 ? 'w-[33%]' : 'w-[20%]'} inline-flex items-center`}>
                      <span className={`print-checkbox ${data.jobTypes.includes(job) ? 'checked' : ''}`}></span> {job}
                    </span>
                  ))}
                  {data.jobTypes.includes('其他') && data.otherJobType && (
                    <span className="border-b border-black px-2">{data.otherJobType}</span>
                  )}
                </div>
              </td>
            </tr>

            <tr>
              <td className="td-label">可以接受工作時間<br /><br /><span className="font-normal text-[10pt]">(可複選)</span></td>
              <td colSpan="4" className="td-content-left">
                {timeOptions.map((time) => (
                  <span key={time} className="mr-8 inline-flex items-center">
                    <span className={`print-checkbox ${data.workHours.includes(time) ? 'checked' : ''}`}></span> {time}
                  </span>
                ))}
              </td>
            </tr>

            <tr>
              <td className="td-label">希望待遇</td>
              <td colSpan="4" className="td-content-left">{data.salary}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="text-center mt-5 font-bold text-[12pt]" style={{ fontFamily: "'標楷體', 'DFKai-SB', serif" }}>
        填寫日期：
        <span className="inline-block w-16 text-center border-b border-black">
          {data.fillDate ? data.fillDate.split('-')[0] : '        '}
        </span>年
        <span className="inline-block w-12 text-center border-b border-black">
          {data.fillDate ? data.fillDate.split('-')[1] : '      '}
        </span>月
        <span className="inline-block w-12 text-center border-b border-black">
          {data.fillDate ? data.fillDate.split('-')[2] : '      '}
        </span>日
      </div>
    </div>
  </div>
);

export default PreviewMode;
