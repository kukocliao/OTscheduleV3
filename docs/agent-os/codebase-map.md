# Codebase 地圖（OTscheduleV3）

> 用途：改程式前先讀這份，避免整檔讀 App.tsx。
> 產生：2026-07-03，由 Explore subagent 實掃。行號會隨改動漂移——**行號只當起點，用 Grep 確認後再 Read**。

## 檔案結構

```
src/
├── App.tsx        # 4391 行，單一巨型元件，含全部狀態/邏輯/UI
├── types.ts       # 95 行，核心資料型別
├── data.ts        # 283 行，初始資料 + 輪替演算法 schema 說明
├── firebase.ts    # 24 行，Firebase 初始化（環境變數驅動，可選）
├── migrations.ts  # 37 行，備份 JSON 版本遷移
└── main.tsx       # React 進入點
```

無 router、無 state 管理庫、無 component 拆檔——所有 UI 在 `App.tsx` 的
單一 `export default function App()`（第 53 行起）裡。

## App.tsx 區塊地圖（行號為 2026-07-03 快照）

- 39 `DEFAULT_ROTATION_SEQUENCES` — 預設治療師輪替順序（可被 localStorage/Firebase 覆寫）
- 47 `sha256()`、51 `isSha256Hash()` — 管理員密碼雜湊
- 55–296 `useState` 宣告區 — patients、therapists、leaves、scheduleCells、archiveByMonth、
  therapistOrder、rotationSequences、登入/密碼狀態、appUsers、auditLog…，初始值皆讀 localStorage
- 351–449 Firebase 同步 `useEffect` — `onSnapshot('scheduleApp/sharedState')` 訂閱＋setDoc 寫回
- 474 `loadArchiveMonth()` — 載入指定月份歸檔
- 493–919 `useMemo` 衍生資料 — patientMap、sortedTherapistsInRotation、
  eligibleRecommendationCells、fairRecommendationCells 等排班演算法輸入
- 919–2518 handler 群：
  - 排班核心：`handleAssignPatient`(935)、`handleRemoveAssignment`(1045)、
    `handleModifyTherapist`(1083)、`handleSaveAssignmentEdit`(1199)、
    `handleClerkSelectOption`(1313)、`handleSkipClerkTherapist`(1431)、
    `handleConfirmClerkAssignment`(1484)、`handleBatchAutoSchedule`(1559)、`handleClearAllSchedule`(1722)
  - 拖放：`handleDragStart`(1740)、`handleDrop`(1755)
  - 備份/匯出：`handleExportBackup`(1893)、`handleImportBackup`(1934)、`handleExportCSV`(1987)
  - 治療師/月報表：`handleResetTherapistSchedule`(2050)、`handleSaveTherapistEdit`(2109)、
    `handleAdjustTherapistPriority`(2493)
  - 使用者/權限：`handleUserLogin`(2171)、`handleSetAdminPassword`(2219)、
    `handleChangeAdminPassword`(2244)、`handleVerifyAdminPassword`(2251)
  - 病患 CRUD：`handleSavePatientEdit`(2299)、`handleAddPatient`(2399)、`handleDeletePatient`(2433)
  - 請假：`handleAddLeave`(2469)、`handleDeleteLeave`(2484)
- 2518–2561 顯示小工具：`getCategoryLabel`、`getCategoryColorClass`、`getUrgencyBadge`
- 2662 起主 JSX（有 `{/* */}` 註解分節）：
  2665 Header／2702 即時狀態／2752 Tab 導覽／2809+ 前台排班（2987 推薦彈窗、
  3100 已指派清單、3368 月統計）／3449+ 後台管理（3593 CRUD 主表、3803 使用者管理、
  3909 稽核紀錄、3972 管理員密碼、4050 備份還原、4084 輪替序列編輯器）／4233 Footer

## 資料模型（src/types.ts，整檔僅 95 行可直接讀）

- `PatientCategory` — 病患類別 union：住院/住院複雜/門診複雜/中度/輕度/副木
- `Patient` / `Therapist` / `ScheduleCell`（排班格）/ `TherapistLeave`（請假區間）
- `ArchivedAssignment` — 換日歸檔的去正規化紀錄（不依賴現存 patients/therapists）
- `LoggedSchedule`（AUTO/MANUAL 日誌）/ `AppUser`（前台具名使用者）/ `AuditEntry`（稽核）

## 資料儲存（雙模式）

- **localStorage 為主**：keys 有 `app_patients`、`app_therapists`、`app_leaves`、
  `app_schedule_cells`、`app_archived_assignments`、`app_therapist_order`、
  `app_rotation_sequences`、`app_rotation_indices`、`app_users`、`app_audit_log`、
  `admin_pwd_hash`、`app_site_pwd`；sessionStorage：`app_admin_ok`、`app_current_user`
- **Firebase Firestore 可選**：`src/firebase.ts` 依 `VITE_FIREBASE_*` 環境變數決定
  `FIREBASE_CONFIGURED`，未設定則 `db = null` 純本機。主狀態在文件
  `scheduleApp/sharedState`；月報表歸檔在獨立文件 `scheduleApp/archive_{month}`。
- **migrations.ts**：匯入備份 JSON 時依 `version` 逐步遷移，`CURRENT_SCHEMA_VERSION = 2`。
  ⚠️ 改資料 schema 必須同步加 migration，否則舊備份匯入會壞。

## 部署與客製化

- Vercel 一鍵部署（README 57–65 行）；本地 `npm install && npm run dev`。
- 雲端同步：Firebase Console 建 Firestore + 6 個 `VITE_FIREBASE_*` 環境變數（README 78–101 行）。
- 客製化入口：治療師名單 `src/data.ts`；輪替順序 `App.tsx:39`；治療類別
  `types.ts` 的 `PatientCategory`＋同步改 `data.ts` 的 `generateInitialSchedule`。
- 另有 `.claude/skills/otschedule-setup` skill 引導客製化。
