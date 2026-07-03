# OTscheduleV3 — Claude 工作索引

職能治療排班系統。Vite + React 19 + TS 單頁應用，無測試框架，無 router/狀態庫。
本檔只做路由：規則細節都在 `docs/agent-os/`，**照下表按需讀取，不要全部讀**。

## 鐵律（先讀這 6 條，其他按需）

1. **勿整檔讀 `src/App.tsx`（4391 行）**。先讀 `docs/agent-os/codebase-map.md`，
   再 Grep 定位，Read 時帶 offset/limit（≤200 行）。永不讀 `package-lock.json`。
2. **完成 = 有證據**：`npm run lint` ＋ `npm run build` 通過、行為驗過、已 push、PR 存在。
   缺一項就不准說「完成」。細節：`docs/agent-os/02-rubrics.md` 第 2 節。
3. **大量讀取/掃描/批次改檔/驗證 → 派 subagent**，主對話只收結論。
   怎麼派：`docs/agent-os/01-dispatch.md`。
4. **任務 >3 步先寫 `docs/agent-os/current-task.md`**（目標/驗收/禁區各一行），
   大動作前重讀一次。對話被壓縮過（開頭有 summary）→ 第一步就是重讀它。
5. **改資料 schema（types.ts / localStorage key）必同步改 `src/migrations.ts`** 並 bump 版本，
   否則舊備份匯入會壞。
6. **同一件事最多重試 2 輪**。錯誤重複出現時，先對照 `docs/agent-os/02-rubrics.md`
   第 4 節的訊號清單（符合任兩項＝方向錯，停下換路，不要再試）。

## 按需路由表

| 情境 | 讀這個 |
|---|---|
| 要改任何程式碼、找東西在哪 | `docs/agent-os/codebase-map.md` |
| 要派 subagent（model 選擇、交辦、升降級、驗證） | `docs/agent-os/01-dispatch.md` |
| 交辦 prompt 怎麼寫（搜尋/實作/重構/研究/審查） | `docs/agent-os/03-templates.md` |
| 拿不定主意（升級？完成？問使用者？換路？） | `docs/agent-os/02-rubrics.md` |
| 想改制度檔、寫踩雷教訓、檔案太長要精簡 | `docs/agent-os/04-maintenance.md` |
| 開工前想避開已知的坑 | `docs/agent-os/lessons.md`（掃標題即可） |
| 本環境的三大失敗模式與修法 | `docs/agent-os/00-diagnosis.md` |
| 制度的來歷與設計意圖 | `docs/agent-os/05-letter.md` |
| 使用者要設定治療師/類別/輪替/Firebase/部署 | `.claude/skills/otschedule-setup`（skill 會自動觸發） |

## 專案速查

- 指令：`npm run dev`（port 3000）/ `npm run lint`（tsc --noEmit）/ `npm run build`
- 資料：localStorage 為主（key 前綴 `app_`），Firebase Firestore 可選
  （`VITE_FIREBASE_*` 環境變數，未設定即純本機）。詳見 codebase-map.md。
- commit 慣例：`feat:` / `fix:` / `refactor:` / `chore:` ＋ 繁中一句話（見 git log）。
- 使用者以繁體中文溝通；程式註解與 UI 文字為繁中。
- 醫療排班規則（病患優先序等）屬院方政策：不確定就問使用者，不要自行發明。

## 維護本檔

本檔上限 150 行、只放索引與鐵律。要加內容 → 寫進 `docs/agent-os/` 新檔＋在路由表加一行。
修改權限與流程見 `docs/agent-os/04-maintenance.md` 第 1 節。
