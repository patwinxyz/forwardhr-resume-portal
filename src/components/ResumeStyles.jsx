import React from 'react';

const previewStyles = `
  .preview-stage {
    padding: 10px 0 28px;
    border-radius: 24px;
    background:
      radial-gradient(circle at 20% 0%, rgba(249, 115, 22, 0.12), transparent 45%),
      radial-gradient(circle at 85% 100%, rgba(29, 78, 216, 0.1), transparent 42%),
      linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
  }
  .print-area {
    width: min(210mm, 100%);
    margin: 0 auto;
    padding: 18px 18px 22px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 18px;
    box-shadow: 0 24px 56px rgba(15, 23, 42, 0.16);
  }
  .resume-header-wrap {
    border: 1px solid #fed7aa;
    border-radius: 12px;
    background: linear-gradient(180deg, #fff9f3 0%, #ffffff 100%);
    padding: 12px 10px;
    margin-bottom: 16px;
  }
  .resume-title {
    font-size: 18pt;
    font-weight: bold;
    text-align: center;
    margin-bottom: 16px;
    letter-spacing: 5px;
    font-family: '標楷體', 'DFKai-SB', serif;
  }
  .preview-stage .resume-table .td-label {
    background: #fffaf6;
    letter-spacing: 0.04em;
  }
  .preview-stage .resume-table .td-content,
  .preview-stage .resume-table .td-content-left {
    background: #ffffff;
  }
  .preview-zoomed .resume-table {
    min-width: calc(920px * var(--preview-scale, 1));
  }
  @supports not (zoom: 1) {
    .preview-zoomed {
      transform: scale(var(--preview-scale, 1));
      transform-origin: top center;
      width: calc(100% / var(--preview-scale, 1));
    }
    .preview-zoomed .resume-table {
      min-width: 920px;
    }
  }
  @media print {
    @page { size: A4 portrait; margin: 10mm 12mm; }
    html, body { background-color: white; margin: 0; padding: 0; width: 100%; }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print { display: none !important; }
    .preview-stage {
      padding: 0 !important;
      border-radius: 0 !important;
      background: none !important;
    }
    .print-area {
      width: auto;
      min-height: auto;
      margin: 0 auto;
      padding: 0;
      background: white;
      border: none;
      border-radius: 0;
      box-shadow: none;
    }
    .preview-zoomed {
      zoom: 100% !important;
      transform: none !important;
      width: auto !important;
    }
    .resume-header-wrap {
      border: none !important;
      border-radius: 0 !important;
      background: none !important;
      padding: 0 !important;
      margin-bottom: 12px !important;
    }
    .resume-table tr, .resume-table td {
      page-break-inside: avoid !important;
      break-inside: avoid;
    }
    .resume-table {
      min-width: 0 !important;
    }
    .resume-table-wrapper {
      overflow: visible !important;
    }
  }
  .resume-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-family: '標楷體', 'DFKai-SB', 'MingLiU', serif;
  }
  .resume-table-wrapper {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .resume-table td {
    border: 1px solid #000;
    padding: 8px 5px;
    font-size: 11pt;
    line-height: 1.4;
    vertical-align: middle;
  }
  .resume-table .td-label {
    font-weight: bold;
    text-align: center;
  }
  .resume-table .td-content {
    text-align: center;
  }
  .resume-table .td-content-left {
    text-align: left;
    padding-left: 10px;
  }
  .print-checkbox {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 1px solid #000;
    margin-right: 4px;
    vertical-align: middle;
    position: relative;
  }
  .print-checkbox.checked::after {
    content: '✓';
    position: absolute;
    top: -3px;
    left: 1px;
    font-size: 14px;
    line-height: 1;
  }
  @media (max-width: 768px) {
    .preview-stage {
      padding: 6px 0 20px;
    }
    .print-area {
      padding: 10px 8px 14px;
      border-radius: 12px;
    }
    .preview-zoomed .resume-table {
      min-width: calc(860px * var(--preview-scale, 1));
    }
    .resume-table-wrapper {
      margin: 0 -2px;
    }
    .resume-header-wrap {
      padding: 8px 6px;
      margin-bottom: 10px;
    }
    .resume-table td {
      font-size: 10.5pt;
      padding: 6px 4px;
    }
  }
`;

const ResumeStyles = () => <style>{previewStyles}</style>;

export default ResumeStyles;
