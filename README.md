# 灃禾集團履歷系統（React + Vite + Vercel API）

## 功能

- 履歷填寫、預覽、列印、Word 匯出
- Google 登入（Firebase Auth）
- 送出時將 Word 附件寄送到指定信箱（Resend + `/api/send-resume`）
- 權限切分：一般使用者可填表與送出；管理員模式只提供履歷 CRUD 管理
- 管理員列表查詢：單一搜尋列可查「姓名 / 證件號碼 / 電話」
- 管理員介面：`/admin` 首頁即查詢列表，操作含「檢視 / 編輯 / 刪除」，編輯使用右側抽屜
- 使用者介面：僅保留「新建 / 載入歷史履歷 / 送出寄送」，送出時自動儲存後寄信
- 照片儲存：照片上傳至 Firebase Storage，Firestore 僅儲存照片路徑與 URL

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

管理員白名單設定（前端）：
- `VITE_ADMIN_EMAILS`：以逗號分隔管理員 email，例如：
  - `VITE_ADMIN_EMAILS=patwinxyz@gmail.com,admin@forwardhrm.com`
- 白名單登入後會進入「管理員 CRUD 模式」。

管理員白名單設定（後端）：
- `ADMIN_EMAILS`：與 `VITE_ADMIN_EMAILS` 使用相同清單。
- 用於後端 API 權限判斷（管理員可讀取全部資料並刪除/更新）。

照片儲存設定（後端）：
- `FIREBASE_STORAGE_BUCKET`：Firebase Storage bucket 名稱。

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

## Firebase Admin 設定（後端驗證登入 Token）

`/api/send-resume` 會在後端驗證 Firebase ID token，避免未登入者濫用寄信 API。

1. Firebase Console -> Project settings -> Service accounts
2. 產生新的 private key（下載 JSON）
3. 在 Vercel Environment Variables 使用下列任一方式：
- 方式 A（推薦）：`FIREBASE_SERVICE_ACCOUNT_JSON`（整份 JSON 壓成單行字串）
- 方式 B：`FIREBASE_PROJECT_ID`、`FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY`

## Resend 設定（寄送履歷）

1. 到 Resend 建立 API Key
2. 在 Resend `Domains` 驗證 `forwardhrm.com`（建議用 Cloudflare 自動寫入 DNS）
3. 設定寄件者（`MAIL_FROM`）
- 可用格式 A：`no-reply@forwardhrm.com`
- 可用格式 B：`Forward HR <no-reply@forwardhrm.com>`
4. （選填）設定寄件名稱 `MAIL_FROM_NAME=Forward HR`（當 `MAIL_FROM` 是純 email 時會自動套用）
5. 設定收件者（`MAIL_TO`，可多個用逗號），例如：`hr@forwardhrm.com,manager@forwardhrm.com`

## Vercel 部署

1. 專案推到 GitHub
2. Vercel 匯入此 repo
3. 在 Vercel Project Settings -> Environment Variables 設定：
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_ADMIN_EMAILS`（管理員 email 白名單，逗號分隔）
- `ADMIN_EMAILS`（後端管理員白名單，建議與 `VITE_ADMIN_EMAILS` 相同）
- `RESEND_API_KEY`
- `MAIL_FROM`
- `MAIL_FROM_NAME`（選填）
- `MAIL_TO`
- `FIREBASE_SERVICE_ACCOUNT_JSON`（或改用分拆三個變數）
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- （選填）`VITE_API_BASE_URL`
4. 重新部署

## 送出寄送流程

1. 使用者先 Google 登入
2. 填寫履歷資料
3. 點「送出寄送」
4. 系統會先自動儲存履歷（含照片路徑），再產生 Word 檔並寄到 `MAIL_TO`
5. 模板失敗時會自動改用 `.doc` 相容格式寄送
