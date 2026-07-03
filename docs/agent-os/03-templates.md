# 03 任務交辦 prompt 範本

> 用法：複製對應範本，填掉所有 `【】`，整段貼進 Agent 工具的 prompt。
> 通則：subagent 是全新 context——repo 路徑、背景、術語都要寫進去，不能說「如前述」。
> model 選擇見 `01-dispatch.md` 第 1 節表格。

## A. 搜尋／定位（Explore + haiku）

```
你在 /home/user/OTscheduleV3（React+TS 排班系統，src/App.tsx 4391 行，勿整檔讀）。
先讀 docs/agent-os/codebase-map.md 取得地圖。
任務：找出【要找的符號/行為/字串】的定義與所有使用處。
驗收：每個結果附「檔案:行號」與該行原文；若找不到，列出你試過的 3 個以上 pattern。
回報：≤40 行清單，不貼大段程式碼，不做任何修改。
```

## B. 實作（general-purpose + sonnet）

```
你在 /home/user/OTscheduleV3。先讀 docs/agent-os/codebase-map.md 與 00-diagnosis.md。
目標：【做什麼】。動機：【使用者為什麼要這個】。
範圍：只改【檔案清單】；禁止動【禁區，如：資料 schema / migrations / Firebase 邏輯】。
既有慣例：commit message 用「feat:/fix: + 繁中一句話」；程式風格比照周圍程式碼。
驗收（全部達成才算完成）：
1. npm run lint 通過  2. npm run build 通過
3. 【行為驗收，如：後台新增 X 按鈕，點擊後 Y】
4. 改了 schema 就必須同步改 src/migrations.ts（沒改 schema 則明說「未動 schema」）
回報：改了哪些檔（檔案:行號區間）、lint/build 輸出最後 5 行、驗到哪一層、
未盡事項。commit 但【要/不要】push。失敗則回報嘗試軌跡與錯誤原文，不要硬掰。
```

## C. 重構（general-purpose + sonnet；跨 >3 檔的設計先派 Plan）

```
你在 /home/user/OTscheduleV3。先讀 docs/agent-os/codebase-map.md。
目標：重構【對象】，動機：【如：App.tsx 過大 / 重複邏輯】。
鐵律：行為不得改變——重構前先記錄【可觀察行為清單/現有輸出】，重構後逐條比對。
分步做：每完成一個獨立步驟就 commit 一次（方便壞了回退），禁止一個大 commit。
驗收：1. lint/build 通過 2. 行為比對清單逐條打勾 3. diff 中無「順手」的行為修改。
回報：每個 commit 一行說明＋行為比對結果；發現順手想修的 bug 只記錄不修，列在回報尾。
```

## D. 研究（general-purpose + sonnet；查官方文件優先於記憶）

```
問題：【要回答什麼】。決策背景：【答案會拿來決定什麼】。
要求：所有結論附來源（官方文件 URL / 檔案:行號）；查不到的寫「查無，建議實測」，
禁止憑訓練記憶填型號、價格、API 參數。
回報：≤60 行。結構：結論先行（3 行內）→ 依據 → 不確定處。
若產出長（>60 行），寫到【scratchpad 路徑】並回傳路徑＋10 行摘要。
```

## E. 審查／驗證（general-purpose + sonnet，必須 fresh context）

```
你在 /home/user/OTscheduleV3。你是獨立審查者，之前的對話你看不到，這是刻意的。
審查對象：【檔案清單 / PR / diff 範圍】。
背景：【這些產出宣稱做到什麼】——注意：宣稱不可信，你要自己驗。
檢查清單：
1. 【應包含的內容/行為清單，逐條核對】
2. 規則或程式碼內部矛盾
3. 提到的路徑、工具名、指令是否真的存在（實際跑 ls / Grep 驗證）
4. 【針對性問題，如：弱模型會誤讀的模糊句 / 邊界條件】
回報：問題清單，每條附「檔案:行號 + 問題 + 建議修法」，按嚴重度排序；
沒問題的項目也要列出「已核對通過」。不要修改任何檔案。
```

## 通用附註

- 交辦後收到回報，先跑 `02-rubrics.md` 第 2 節的完成判準，再採信。
- agent 回報「完成」但無證據 → 視同未完成，按 `01-dispatch.md` 第 5 節處理。
- 一次交辦一個目標。兩個目標拆兩次派工，寧可多派不要混包。
