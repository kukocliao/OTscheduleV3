# 00 快速診斷：本環境三大失敗模式與修法

> 讀者：Sonnet / Haiku 等級的 session。每條修法都是可直接照做的動作，不是原則。
> 建立：2026-07-03，Fable 5 session。事實依據見文末「查證紀錄」。

## 第 1 名（最漏 token）：整檔讀取 App.tsx

`src/App.tsx` 有 **4391 行（約 20 萬字元 ≈ 5 萬 token）**。整檔讀一次就吃掉大半 context，
讀兩次 session 基本報廢。`package-lock.json`（18 萬字元）同理。

**修法（照做）：**
1. 禁止對 `src/App.tsx` 使用無參數 Read。一律先 Grep 找符號：
   `Grep pattern="const EditModal" path="src/App.tsx" -n`
2. 拿到行號後，Read 加 `offset` 與 `limit`，一次 ≤200 行。
3. 永不讀 `package-lock.json`。查依賴版本讀 `package.json`（30 行）。
4. 找不到符號在哪，先看 `docs/agent-os/codebase-map.md` 的元件地圖，再 Grep。

## 第 2 名（最易失焦）：長對話壓縮後忘記驗收條件

context 滿了會自動摘要，摘要最常丟的是「使用者一開始要什麼、驗收條件是什麼」。
之後的你會拿著殘缺目標繼續做，方向漂移而不自知。

**修法（照做）：**
1. 任務超過 3 步，動工前先把以下三行寫進
   `docs/agent-os/current-task.md`（直接覆寫；本檔可以 commit，內容本來就是暫時的）：
   - 目標：使用者原話一句
   - 驗收：怎樣算完成（可驗證的條件，如「npm run lint 通過」「畫面上出現 X」）
   - 禁區：使用者說過不要動的東西
2. 每次要做「大動作」（改 >100 行、刪檔、push）前，重讀這個檔案比對一次。
3. 發現對話被壓縮過（開頭出現 summary），第一件事就是重讀 current-task.md。

## 第 3 名（最易出錯）：宣稱完成但沒驗證、沒 push

兩個具體風險：
- 本專案沒有測試，唯二的機械驗證是 `npm run lint`（tsc --noEmit）和 `npm run build`。
  跳過它們，型別錯誤會直接進 repo。
- 遠端 container 是暫時的：**沒 `git push` 的工作等於沒做**。session 閒置後全部消失。

**修法（照做）：**
1. 「完成」的定義固定為四項，缺一不可：
   `npm run lint` 通過 → `npm run build` 通過 → `git push -u origin <branch>` 成功 → PR 存在（無則開 draft PR）。
2. 改 UI 行為時，lint/build 只能證明「沒編譯錯」，不能證明「行為對」。
   行為驗證：用 `/verify` skill 或描述性驗收（請使用者看畫面），並在回報中明說驗到哪一層。
3. 每完成一個獨立子項就 commit 一次，不要攢到最後。commit message 格式照 git log 慣例：
   `feat:` / `fix:` / `refactor:` / `chore:` + 繁中一句話。

## 查證紀錄（2026-07-03 實測，非憑記憶）

- 行數：`wc -l src/*` 實測 App.tsx=4391、types.ts=95、data.ts=283。
- 驗證指令：`package.json` scripts 實測存在 `lint`、`build`。
- container 暫時性：本 harness system prompt 明載 session 結束後回收。
- 本專案無測試框架（package.json 無 test script、無 vitest/jest 依賴）。
