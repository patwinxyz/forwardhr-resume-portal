# 灃禾集團履歷系統（React + Vite + Vercel API）

## 功能

- 履歷填寫、預覽、列印、Word 匯出
- Google 登入（Firebase Auth）
- 送出時將 Word 附件寄送到指定信箱（Resend + `/api/send-resume`）

## 專案結構

```text
.
├─ api/
│  └─ send-resume.js
├─ public/
│  ├─ logo.jpg
│  └─ 評點製_人事資料表.docx
├─ src/
│  ├─ components/
│  ├─ modules/
│  │  ├─ authClient.js
│  │  └─ resumeCore.js
│  ├─ App.jsx
│  ├─ main.jsx
│  └─ styles.css
├─ .env.example
└─ package.json
```

## 本機執行

1. 安裝依賴
```bash
npm install
```

2. 複製環境變數範本
```bash
copy .env.example .env
```

3. 填入 `.env` 內容（Firebase + Resend）

4. 啟動前端
```bash
npm run dev
```

注意：`/api/send-resume` 是 Vercel Function。本機若要完整測試 API，建議用 `vercel dev`。

## Firebase 設定（Google 登入）

1. 到 Firebase Console 建立專案
2. Authentication -> Sign-in method -> 啟用 Google
3. Project settings -> Web App -> 取得以下值
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

## Resend 設定（寄送履歷）

1. 到 Resend 建立 API Key
2. 設定寄件者（`MAIL_FROM`）
3. 設定收件者（`MAIL_TO`，可多個用逗號）

## Vercel 部署

1. 專案推到 GitHub
2. Vercel 匯入此 repo
3. 在 Vercel Project Settings -> Environment Variables 設定：
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `RESEND_API_KEY`
- `MAIL_FROM`
- `MAIL_TO`
- （選填）`VITE_API_BASE_URL`
4. 重新部署

## 送出寄送流程

1. 使用者先 Google 登入
2. 填寫完成後點「預覽」
3. 點「送出寄送」
4. 系統會產生 Word 檔並寄到 `MAIL_TO`
5. 模板失敗時會自動改用 `.doc` 相容格式寄送
