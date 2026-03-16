# 灃禾集團履歷系統（React + Vite）

## 專案結構

```text
.
├─ public/
│  ├─ logo.jpg
│  └─ 評點製_人事資料表.docx
├─ src/
│  ├─ App.jsx
│  ├─ main.jsx
│  └─ styles.css
├─ index.html
├─ package.json
├─ vite.config.js
├─ tailwind.config.js
└─ postcss.config.cjs
```

## 本機開發

1. 安裝依賴：`npm install`
2. 啟動開發伺服器：`npm run dev`
3. 打包：`npm run build`
4. 預覽打包結果：`npm run preview`

## Word 匯出說明

- 系統會優先使用 `public/評點製_人事資料表.docx` 當模板匯出 `.docx`。
- 若模板匯出失敗，會自動回退為 HTML 相容模式匯出 `.doc`。
