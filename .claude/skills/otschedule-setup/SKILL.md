---
name: otschedule-setup
description: >
  OTscheduleV3 職能治療排班系統的設定與客製化引導。當使用者提到這個排班系統、
  想要設定治療師、修改治療項目、調整輪替順序、設定 Firebase 雲端同步、
  部署到 Vercel，或是看到 OTscheduleV3 / ot-schedule-v3 相關程式碼時，
  請使用此 skill。即使使用者只說「幫我改治療師」或「新增治療類別」，
  只要在這個專案的 context 下都應觸發。
---

# OTscheduleV3 客製化引導

## 專案概覽

**GitHub:** https://github.com/kukocliao/OTscheduleV3  
**線上展示:** https://ot-schedule-v3.vercel.app  
**技術棧:** React 19 + Vite + TypeScript + TailwindCSS + Firebase Firestore  
**部署平台:** Vercel（免費方案即可）

這是一套給職能治療師使用的排班管理系統，支援：
- 前台書記快速指派（輸入病歷號 → 系統自動推薦治療師）
- 公平輪替演算法（Round-Robin）
- Firebase 雲端即時同步（多裝置共用）
- 請假管理、CSV 匯出

---

## 關鍵設定檔位置

```
src/
├── types.ts        ← 治療類別定義（PatientCategory）
├── data.ts         ← 治療師初始清單、排程產生邏輯
└── App.tsx         ← 輪替順序（ROTATION_SEQUENCES）
```

---

## 1. 修改治療師

**檔案：`src/data.ts`**

```typescript
export const initialTherapists: Therapist[] = [
  { id: 't1', name: '趙長宥', code: 'OT', color: 'emerald', isActive: true },
  { id: 't2', name: '潘亮全', code: 'OU', color: 'blue',    isActive: true },
  { id: 't3', name: '姜壯坤', code: 'OV', color: 'indigo',  isActive: true },
  { id: 't4', name: '蘇柏臻', code: 'OB', color: 'purple',  isActive: true },
  { id: 't5', name: '邱申棟', code: 'OC', color: 'pink',    isActive: true },
];
```

**欄位說明：**
| 欄位 | 說明 | 範例 |
|------|------|------|
| `id` | 唯一識別碼，不可重複，輪替序列會用到 | `'t1'` |
| `name` | 治療師中文姓名 | `'王小明'` |
| `code` | 縮寫代號（顯示在排班格上） | `'OT'` |
| `color` | Tailwind 顏色名稱 | `'emerald'` / `'blue'` / `'rose'` / `'amber'` / `'violet'` |
| `isActive` | 是否啟用（false 則不排班） | `true` |

**新增治療師步驟：**
1. 在陣列加一筆，`id` 用 `'t6'`、`'t7'` 依序遞增
2. 同步更新 `App.tsx` 的 `ROTATION_SEQUENCES`，把新 id 加進輪替序列

---

## 2. 修改輪替順序

**檔案：`src/App.tsx`，約第 36 行**

```typescript
export const ROTATION_SEQUENCES: Record<string, string[]> = {
  am_regular: ['t1', 't2', 't3', 't4', ...],  // 上午：住院/門診/中常
  pm_regular: ['t1', 't5', 't3', 't4', ...],  // 下午：住院/門診/中常
  am_splint:  ['t1', 't2', 't3', 't4', ...],  // 上午：副木
  pm_splint:  ['t1', 't5', 't3', 't4', ...],  // 下午：副木
};
```

**說明：**
- 陣列裡的順序就是輪替順序，可以重複（代表某治療師排班次數較多）
- 如果某治療師不參與副木，就不要放進 `am_splint` / `pm_splint`
- 新增治療師後，把他的 `id` 插入適當位置

---

## 3. 修改治療類別

**檔案：`src/types.ts`**

```typescript
export type PatientCategory =
  | 'INPATIENT'          // 住院病人
  | 'INPATIENT_COMPLEX'  // 住院複雜
  | 'OUTPATIENT_COMPLEX' // 門診複雜
  | 'MODERATE'           // 中度
  | 'LIGHT'              // 輕度
  | 'SPLINT';            // 副木
```

**注意：** 修改 PatientCategory 後，需一併更新：
- `src/data.ts` 的 `generateInitialSchedule` 裡的 `categories` 陣列
- `src/App.tsx` 中所有 switch/case 或顯示文字的地方（搜尋 `getCategoryLabel`）

---

## 4. Firebase 雲端同步設定

讓不同裝置的排班資料即時同步，需要建立自己的 Firebase 專案。

### Step 1：建立 Firebase 專案
1. 前往 https://console.firebase.google.com
2. 建立新專案（名稱自訂）
3. 左側選 **Firestore Database** → 建立 → 選**測試模式** → 位置選 `asia-east1 (Taiwan)`

### Step 2：取得 Web App 設定
1. 專案設定（齒輪圖示）→ 新增 Web 應用程式（`</>`）
2. 輸入應用程式名稱 → 註冊 → 複製 `firebaseConfig` 物件

### Step 3：在 Vercel 加入環境變數
前往 Vercel 專案 → Settings → Environment Variables，加入以下 6 個：

| 變數名稱 | 對應 firebaseConfig 欄位 |
|---------|------------------------|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

加完後 Redeploy，Header 出現 **☁️ 雲端同步**（綠色）即成功。

### Firestore 安全規則（測試完後建議更新）
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /scheduleApp/{docId} {
      allow read, write: if true;
    }
  }
}
```

---

## 5. 部署到 Vercel

### 首次部署
1. Fork https://github.com/kukocliao/OTscheduleV3 到自己的 GitHub
2. 前往 https://vercel.com → New Project → Import 你 fork 的 repo
3. Framework 選 **Vite**，其餘預設 → Deploy
4. 完成後加入 Firebase 環境變數（見上方）

### 更新程式碼後重新部署
修改程式碼後，push 到 GitHub，Vercel 會自動重新部署。

若要手動 push（無密碼），使用 Personal Access Token：
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 勾選 `repo` → 生成 token
3. 執行：
```bash
git remote set-url origin https://<你的GitHub帳號>:<token>@github.com/<你的帳號>/OTscheduleV3.git
git push origin main
git remote set-url origin https://github.com/<你的帳號>/OTscheduleV3.git  # 移除 token
```

---

## 6. 常見問題

**Q: 改了 `data.ts` 的治療師，舊的排班資料會消失嗎？**  
A: 不會。治療師資料儲存在 localStorage 和 Firestore，`data.ts` 只是初始預設值。若要套用新治療師，需在後台手動新增或清空資料。

**Q: 沒有設定 Firebase 也能用嗎？**  
A: 可以。系統會自動退到「分頁同步」模式（同一瀏覽器的不同分頁可以同步），但不同裝置無法共用資料。

**Q: 治療師代號（code）有格式限制嗎？**  
A: 無限制，但建議簡短（2-3 字元），因為會顯示在排班格上。

**Q: 可以增加超過 5 位治療師嗎？**  
A: 可以。id 依序新增（`t6`, `t7`...），並更新 `ROTATION_SEQUENCES`。

---

## Claude 引導使用者的流程

當使用者說「幫我改治療師」時，依序：
1. 先讀 `src/data.ts` 確認目前治療師清單
2. 詢問使用者：新治療師的姓名、代號、顏色偏好
3. 修改 `initialTherapists` 陣列
4. 詢問這位治療師要加入哪些輪替序列（上午/下午/副木）
5. 修改 `App.tsx` 的 `ROTATION_SEQUENCES`
6. 提醒使用者 push 到 GitHub 並 Redeploy
