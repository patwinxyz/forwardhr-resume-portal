import React from 'react';
import { X } from 'lucide-react';
import PreviewMode from './PreviewMode';
import { getEducationForOutput, hasValue } from '../modules/resumeCore';

const AdminViewModal = ({ isOpen, data, onClose }) => {
  if (!isOpen || !data) return null;

  const educationForOutput = getEducationForOutput(data.education);
  const hasCertificates = hasValue(data.certificates);

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4 no-print">
      <div className="w-full max-w-[1200px] max-h-[92vh] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-800">履歷檢視：{data.name || '未命名'}</h3>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm border border-gray-300 hover:bg-gray-50"
          >
            <X className="w-4 h-4" /> 關閉
          </button>
        </div>
        <div className="max-h-[calc(92vh-58px)] overflow-auto p-4 bg-slate-100">
          <PreviewMode data={data} educationForOutput={educationForOutput} hasCertificates={hasCertificates} previewScale={0.8} />
        </div>
      </div>
    </div>
  );
};

export default AdminViewModal;

