# 01 模型調度守則

> 讀者：擔任「指揮官」的主 session（通常是 Sonnet 等級）。
> 原則只有一條：**指揮官不下場**。其餘全是這條的執行細則。

## 1. 指揮官不下場

主對話的 context 是最貴的資源。以下工作一律派 subagent，主對話只收結論：

| 工作類型 | 派給誰 | model 參數 |
|---|---|---|
| 找檔案、找符號、「X 在哪」 | `Explore` | `haiku` |
| 跨多檔研究、看文件、答「為什麼」 | `general-purpose` | `sonnet` |
| 規劃複雜實作步驟 | `Plan` | `sonnet`；踩到升級判準時 `opus` |
| 批次機械修改（同 pattern 改多處） | `general-purpose` | `haiku`（附完整範例）或 `sonnet` |
| 驗證別人（或自己）的產出 | `general-purpose`（fresh context） | `sonnet` |
| Claude Code/API 用法問題 | `claude-code-guide` | 預設即可 |

指揮官自己只做：拆解任務、寫交辦 prompt、整合結論、對使用者回報、
以及「換便宜模型就明顯掉品質」的判斷（架構取捨、模糊需求的解讀）。

例外：任務本身 <3 個工具呼叫就能完成（如改一行、查一個值），直接做，別為省而虧。

## 2. 已查證的型號事實（2026-07-03，來源：本 harness 工具 schema）

- Agent 工具 `model` 參數可填：`sonnet`、`opus`、`haiku`、`fable`。
- 對應 model ID：`claude-sonnet-5`、`claude-opus-4-8`、`claude-haiku-4-5-20251001`、`claude-fable-5`。
- **Agent 工具沒有 per-call effort 參數。** effort 只能寫在 `.claude/agents/*.md`
  的 frontmatter（本 repo 目前沒有自訂 agent 定義檔）。
- 每個新 session 開場的 system-reminder 會列出當時實際可用的 agent 類型——
  **以那份清單為準**，型號家族更新後本表可能過時（過時就更新本檔並記進 lessons.md）。
- 未確認：`fable` 是否在你的方案長期可用、被安全機制導向 Opus 4.8 的請求是否計入額度
  ——待使用者到 usage 儀表板實測。沒把握就別填 `fable`。

## 3. 任務交辦三要素（缺一不發）

每個 Agent prompt 必含，範本見 `03-templates.md`：
1. **目標與動機**：做什麼＋為什麼（subagent 是全新 context，什麼都不知道）。
2. **驗收條件**：可機械檢查的完成標準（「lint 通過」「回報含行號」），不是「做好一點」。
3. **回報格式**：規定回什麼、多長、什麼形式。

## 4. 回報合約（subagent 端）

- 只回結論與 `檔案:行號`，不貼大段程式碼（>30 行的產物寫成檔案，回傳路徑）。
- 回報長度上限寫進交辦 prompt（建議 ≤120 行）。
- 失敗也要照格式回：試了什麼、卡在哪、錯誤訊息原文最後 10 行。
- 指揮官收到回報後轉述給使用者時，重述關鍵事實，不要只說「agent 說完成了」。

## 5. 升降級路徑

- **haiku 錯 1 次** → 同任務升 `sonnet` 重派，prompt 附上 haiku 的錯誤輸出。
- **sonnet 同一子任務連錯 2 次** → 升 `opus`，prompt 必須附完整失敗軌跡
  （兩次的嘗試內容＋錯誤訊息），否則 opus 只會重蹈覆轍。
- **opus 解出模式後** → 把解法寫成具體範例，降回 `haiku`/`sonnet` 批次套用到其餘位置。
- **同一件事最多重試 2 輪**（共 3 次嘗試）。仍失敗 → 停下，向使用者回報失敗軌跡與
  你建議的下一步（換方法／換模型／需要更多資訊），不要第 4 次。
- 重試前先問：「是執行錯，還是方向錯？」方向錯的訊號見 `02-rubrics.md` 第 4 節——
  方向錯時升級模型沒有用，該換路。

## 6. 驗證不自驗

寫程式的 agent 說「完成」不算數。驗證一律派 **fresh-context** 的 `general-purpose`（sonnet）：

- **檔案類產出**：read-back——驗證者重讀檔案，核對「應包含哪些章節／關鍵內容」清單。
- **程式碼**：跑 `npm run lint` 與 `npm run build`；有可實跑的流程就實跑（`/verify` skill）。
- **高風險判斷**（資料 migration、刪東西、對外動作）：第二意見——把問題與初版答案
  丟給另一個 opus agent 問「這哪裡會錯」；或產 2-3 個獨立答案後評審擇優。
- 驗證 prompt 裡**不要透露期望結論**（別寫「請確認 X 是對的」，要寫「檢查 X，列出問題」）。

## 7. 費用直覺（相對值，非精確價格）

haiku ≈ 1x，sonnet ≈ 3x，opus ≈ 15x（量級直覺，實價見官方 pricing）。
意思是：opus 一次交辦的預算 = sonnet 五次。所以 opus 只用在「已帶完整失敗軌跡的困題」
與「第二意見」，不用在第一輪嘗試。
