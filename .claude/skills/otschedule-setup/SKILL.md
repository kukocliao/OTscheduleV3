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

## 給 Claude 的前置提醒

- 動程式碼前先讀 `docs/agent-os/codebase-map.md`；**勿整檔讀 `src/App.tsx`（4391 行）**，
  用 Grep 定位＋Read offset/limit。其他鐵律見專案根目錄 `CLAUDE.md`。
- **本系統的資料存在 localStorage / Firestore，程式碼裡的清單只是「全新安裝的初始值」。**
  所以改治療師、輪替順序，一律優先引導使用者用後台 UI；改程式碼對已在使用中的
  系統通常「看不到效果」，這是最常見的誤區。

## 專案概覽

**GitHub:** https://github.com/kukocliao/OTscheduleV3
**線上展示:** https://ot-schedule-v3.vercel.app
**技術棧:** React 19 + Vite + TypeScript + TailwindCSS + Firebase Firestore
**部署平台:** Vercel（免費方案即可）

給職能治療師的排班管理系統：前台書記快速指派（輸入病歷號 → 自動推薦治療師）、
公平輪替演算法（Round-Robin）、Firebase 雲端即時同步、請假管理、CSV 匯出、
後台管理（治療師/使用者/輪替序列/備份還原）。

---

## 1. 修改治療師（後台 UI 優先）

**正路：後台 → 「治療師資料管理」**——新增、修改、停用治療師都在這裡操作，
立即生效並同步到 localStorage/Firestore。改完提醒使用者到「輪替序列設定」
把新治療師加入輪替（見第 2 節）。

**程式碼路徑（僅影響「全新安裝」的初始值）：`src/data.ts` 的 `initialTherapists`**

| 欄位 | 說明 | 範例 |
|------|------|------|
| `id` | 唯一識別碼，不可重複，輪替序列會用到 | `'t1'` |
| `name` | 治療師中文姓名 | `'王小明'` |
| `code` | 縮寫代號（顯示在排班格上，建議 2-3 字元） | `'OT'` |
| `color` | Tailwind 顏色名稱 | `'emerald'` / `'blue'` / `'rose'` |
| `isActive` | 是否啟用（false 則不排班） | `true` |

判斷用哪條路：使用者已在用系統（有排班資料）→ 後台 UI；
正在準備第一次部署、還沒有任何資料 → 改 `data.ts` 也可以。

---

## 2. 修改輪替順序（後台 UI 優先）

**正路：後台 → 「輪替序列設定」**——四條佇列（上午/下午 × 一般/副木）都可直接編輯，
立即生效。序列中治療師可重複出現（代表該治療師排班次數較多）；
不參與副木的治療師就不要放進副木序列。

**程式碼路徑（僅初始值）：`src/App.tsx` 第 39 行的 `DEFAULT_ROTATION_SEQUENCES`**
（keys：`am_regular` / `pm_regular` / `am_splint` / `pm_splint`，內容是治療師 id 陣列）。
注意：實際生效值是 state `rotationSequences`（存 localStorage/Firestore），
`DEFAULT_` 只是空值時的 fallback——改它不會影響使用中的系統。
後台編輯器也有「還原為預設值」按鈕會讀取它。

---

## 3. 修改治療類別（必動程式碼，屬進階改動）

**檔案：`src/types.ts` 的 `PatientCategory`**（現有：INPATIENT 住院 /
INPATIENT_COMPLEX 住院複雜 / OUTPATIENT_COMPLEX 門診複雜 / MODERATE 中度 /
LIGHT 輕度 / SPLINT 副木）。

修改後**必須**一併處理，缺一會壞：
1. `src/data.ts` 的 `generateInitialSchedule` 裡的 categories
2. `src/App.tsx` 所有顯示與判斷處（Grep `getCategoryLabel`、`getCategoryColorClass` 及該類別字串）
3. `src/migrations.ts` 加 migration 並 bump 版本（舊備份/舊 localStorage 含舊類別值）
4. 類別的優先順序屬院方政策——不確定就問使用者，不要自行發明

---

## 4. Firebase 雲端同步設定

> ⚠️ **安全警告（先講清楚再動手）**：排班資料包含**病歷號**。下面教學用的
> 「測試模式」規則等於一個**任何知道專案 ID 的人都能讀寫**的公開資料庫，
> 只適合試用階段。而本系統目前**沒有內建登入驗證機制**，無法只靠改規則做到
> 真正的存取控制——若要正式多人使用，請使用者開一個任務給 Claude：
> 「加上 Firebase Auth（匿名或帳號登入）並收緊 Firestore 規則」。
> 試用期間至少做到：不放真實病歷號，或接受此風險。

### Step 1：建立 Firebase 專案
1. https://console.firebase.google.com → 建立新專案
2. 左側 **Firestore Database** → 建立 → 選測試模式 → 位置 `asia-east1 (Taiwan)`
   （測試模式規則 30 天後自動到期封鎖，到期前要處理上面的安全警告）

### Step 2：取得 Web App 設定
專案設定（齒輪）→ 新增 Web 應用程式（`</>`）→ 註冊 → 複製 `firebaseConfig`

### Step 3：在 Vercel 加入 6 個環境變數
Settings → Environment Variables：`VITE_FIREBASE_API_KEY`（apiKey）、
`VITE_FIREBASE_AUTH_DOMAIN`（authDomain）、`VITE_FIREBASE_PROJECT_ID`（projectId）、
`VITE_FIREBASE_STORAGE_BUCKET`（storageBucket）、
`VITE_FIREBASE_MESSAGING_SENDER_ID`（messagingSenderId）、`VITE_FIREBASE_APP_ID`（appId）。
加完 Redeploy，Header 出現 **☁️ 雲端同步**（綠色）即成功。

---

## 5. 部署到 Vercel

### 首次部署
1. Fork https://github.com/kukocliao/OTscheduleV3 到自己的 GitHub
2. https://vercel.com → New Project → Import 該 repo
3. Framework 選 **Vite**，其餘預設 → Deploy
4. 需要雲端同步再加 Firebase 環境變數（見第 4 節）

### 更新後重新部署
push 到 GitHub，Vercel 自動重新部署。push 認證優先用現成管道：
Claude Code 的 GitHub 整合、`gh auth login`、或 GitHub Desktop。
避免把 token 寫進 remote URL（會留在設定檔與 shell 歷史）。

---

## 6. 常見問題

**Q: 改了 `data.ts` 的治療師，舊的排班資料會消失嗎？**
A: 不會，但反過來也一樣——改 `data.ts` 不會影響使用中的系統
（資料在 localStorage/Firestore）。要改生效中的治療師，用後台 UI（第 1 節）。

**Q: 沒有設定 Firebase 也能用嗎？**
A: 可以，資料存在瀏覽器 localStorage，單機完整可用；只是不同裝置無法共用資料。

**Q: 可以增加超過 5 位治療師嗎？**
A: 可以，後台直接新增，再到「輪替序列設定」把新 id 加入各佇列。

---

## Claude 引導使用者的流程（以「幫我改治療師」為例）

1. 先問一句：系統是否已在使用中（有排班資料）？
2. **使用中** → 引導後台操作：後台 → 治療師資料管理 → 新增/修改
   → 再到「輪替序列設定」加入輪替 → 完成，不需改程式碼、不需重新部署。
3. **全新部署前** → 改 `src/data.ts` 的 `initialTherapists` ＋
   `src/App.tsx:39` 的 `DEFAULT_ROTATION_SEQUENCES`，
   然後跑 `npm run lint`、`npm run build`，push 後 Vercel 自動部署。
4. 涉及類別／演算法／優先序的要求 → 先確認是院方政策還是工程問題，政策要問使用者。
