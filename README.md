<div align="center">

# 🏥 OTscheduleV3
### 職能治療排班管理系統
**Occupational Therapy Scheduling System**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/kukocliao/OTscheduleV3)
&nbsp;
[![Live Demo](https://img.shields.io/badge/Live%20Demo-ot--schedule--v3.vercel.app-brightgreen?style=flat-square&logo=vercel)](https://ot-schedule-v3.vercel.app)
&nbsp;
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
&nbsp;
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
&nbsp;
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com)

[**🚀 立即體驗 Live Demo**](https://ot-schedule-v3.vercel.app) ｜ [設定教學](#-快速部署) ｜ [客製化治療師](#-客製化設定)

</div>

---

## ✨ 功能特色

| 功能 | 說明 |
|------|------|
| 🎯 **智慧輪替指派** | 輸入病歷號，系統自動以 Round-Robin 演算法推薦治療師，確保工作量公平分配 |
| ☁️ **雲端即時同步** | 整合 Firebase Firestore，多台電腦、多個分頁即時共用同一份排班表 |
| 🗓️ **請假管理** | 治療師請假期間自動封鎖對應排班格，避免誤排 |
| 📊 **CSV 匯出** | 一鍵匯出月課表，方便統計與存檔 |
| 🔐 **管理員後台** | 密碼保護的後台，管理治療師名單、排班重置、資料管理 |
| 📱 **跨裝置支援** | RWD 響應式設計，電腦、平板皆可使用 |
| ⚡ **離線可用** | 未設定 Firebase 時自動切換為本機模式，同一瀏覽器跨分頁仍可同步 |

---

## 🖥️ 系統畫面

> 🔗 前往 [https://ot-schedule-v3.vercel.app](https://ot-schedule-v3.vercel.app) 直接體驗完整功能

**前台（書記操作介面）**
- 輸入病歷號 + 選擇治療類別 → 系統自動推薦治療師
- 確認後即時寫入排班表並同步至雲端

**後台（管理員介面）**
- 新增 / 停用治療師
- 設定請假區間（整天 / 上午 / 下午）
- 重置排班、匯出月報表

---

## 🚀 快速部署

### 方法一：一鍵部署到 Vercel（推薦）

1. 點擊下方按鈕，Fork 並自動部署：

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/kukocliao/OTscheduleV3)

2. 部署完成後即可使用（本機模式，無需 Firebase）

### 方法二：本地開發

```bash
git clone https://github.com/kukocliao/OTscheduleV3.git
cd OTscheduleV3
npm install
npm run dev
```

---

## ☁️ 啟用雲端同步（Firebase）

讓多台電腦共用同一份排班資料：

### 1. 建立 Firebase 專案
1. 前往 [console.firebase.google.com](https://console.firebase.google.com)
2. 建立新專案 → 左側選 **Firestore Database** → 建立 → **測試模式** → 位置選 `asia-east1 (Taiwan)`
3. 專案設定（齒輪）→ 新增 Web 應用程式（`</>`）→ 複製 `firebaseConfig`

### 2. 設定 Vercel 環境變數

在 Vercel → Settings → Environment Variables 加入：

| 變數名稱 | 對應值 |
|---------|--------|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

3. Redeploy → Header 出現 **☁️ 雲端同步**（綠色）即完成

---

## 🛠️ 客製化設定

### 修改治療師名單

編輯 `src/data.ts`：

```typescript
export const initialTherapists: Therapist[] = [
  { id: 't1', name: '王小明', code: 'OT', color: 'emerald', isActive: true },
  { id: 't2', name: '李小華', code: 'OU', color: 'blue',    isActive: true },
  { id: 't3', name: '張小美', code: 'OV', color: 'indigo',  isActive: true },
  // 依需求新增或修改...
];
```

### 修改輪替順序

編輯 `src/App.tsx` 約第 36 行的 `ROTATION_SEQUENCES`，填入治療師 id 的排列順序。

### 修改治療類別

編輯 `src/types.ts` 的 `PatientCategory`，並同步更新 `src/data.ts` 的 `generateInitialSchedule`。

> 💡 **推薦做法：** 用 [Claude Code](https://claude.ai/code) 開啟此專案，AI 會讀取內建的設定引導，協助你完成所有客製化修改。

---

## 🏗️ 技術架構

```
OTscheduleV3/
├── src/
│   ├── App.tsx          # 主應用程式、輪替演算法、Firebase 同步
│   ├── types.ts         # TypeScript 型別定義（Patient、Therapist 等）
│   ├── data.ts          # 初始治療師清單、排程格產生邏輯
│   └── firebase.ts      # Firebase 初始化（環境變數驅動）
├── .claude/
│   └── skills/          # Claude AI 設定引導 skill
└── ...
```

| 技術 | 用途 |
|------|------|
| React 19 + Vite | 前端框架與建置工具 |
| TypeScript | 型別安全 |
| TailwindCSS | UI 樣式 |
| Firebase Firestore | 雲端即時資料庫 |
| Vercel | 免費靜態網站部署 |

---

## 🤝 貢獻與使用

歡迎 Fork 使用於自己的治療室！若有功能建議或問題，歡迎開 [Issue](https://github.com/kukocliao/OTscheduleV3/issues)。

如果這個專案對你有幫助，歡迎點 ⭐ Star 支持！

---

<div align="center">

Made with ❤️ for Occupational Therapists in Taiwan

</div>
