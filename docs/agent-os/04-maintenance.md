# 04 維護協議

> 這套制度會腐化，除非照這份協議維護。讀者：任何等級的 session。

## 1. 檔案權限分級

**弱模型可自行改（改前備份到同目錄 `*.bak-YYYYMMDD`，commit 時刪掉 .bak）：**
- `docs/agent-os/codebase-map.md` — 行號漂移、結構變動後**應主動更新**
- `docs/agent-os/lessons.md` — 踩雷就寫，見第 2 節
- `docs/agent-os/current-task.md` — 每個任務自由覆寫

**改前先問使用者（用 AskUserQuestion 附 diff 摘要）：**
- `CLAUDE.md` — 例外：純粹修正已失效的路徑/行數可直接改
- `docs/agent-os/00-diagnosis.md`、`01-dispatch.md`、`02-rubrics.md`、`03-templates.md`、
  `04-maintenance.md`（本檔）、`05-letter.md` — 制度本體，隨手改會讓規則彼此打架。
  例外：僅限第 3 節明列的事實項目（只涉及 00-diagnosis 與 01-dispatch）可直接改
- `.claude/skills/**` — 影響所有 session 的觸發行為

**永遠不准 AI 自行動：**
- 刪除 `docs/agent-os/` 任何檔案；改 git history（rebase/force push main）

## 2. 踩雷教訓寫回哪裡、什麼格式

地點：`docs/agent-os/lessons.md`，**新條目加在最上面**。一條 ≤6 行，格式：

```
## YYYY-MM-DD 一句話標題
- 情境：當時在做什麼
- 雷：踩到什麼（附錯誤訊息關鍵行或 檔案:行號）
- 修法：下次照做的具體動作
- 影響檔：若已把修法寫進制度檔，註明哪一檔哪一節；沒寫就標「未制度化」
```

收錄門檻：**會再發生的才寫**。一次性手滑不寫；同一個雷第二次出現，除了寫 lessons，
還要升級成制度——把修法補進對應制度檔（此時適用第 1 節的「先問」流程）。

## 3. 事實過時的處理（可直接改，不用問）

以下屬「事實」非「制度」，發現與現實不符就直接更新＋在 commit message 註明證據：
- codebase-map.md 的行號與結構
- 01-dispatch.md 第 2 節的型號清單（以新 session 的 system-reminder 實際清單為準）
- 01-dispatch.md 第 7 節的定價數字（以官方 pricing 頁或 claude-api skill 定價表為準，
  改數字時附查證日期與來源；「調度含義」的文字屬制度，要動仍需先問）
- 00-diagnosis.md 查證紀錄中的行數、指令

原則：**制度（該怎麼做）要問，事實（現在是什麼）直接修。**

## 4. 精簡時機

- `lessons.md` 超過 **100 行**：移除「>3 個月且已制度化」的條目（制度檔裡已有了），
  未制度化的舊條目合併壓縮。（移除條目 ≠ 刪除檔案，檔案本身永遠保留。）
- `CLAUDE.md` 超過 **150 行**：必須精簡——長內容抽到 `docs/agent-os/` 新檔，
  CLAUDE.md 只留一行路由。精簡屬結構性修改，執行前仍依第 1 節先問使用者。
- `codebase-map.md` 超過 **200 行**：只保留「地圖」（哪裡有什麼），刪掉「說明」（為什麼）。
- 任何制度檔超過 **150 行**：拆出「按需附錄」檔，主檔留判準與路由。

## 5. 每季（或大改版後）健檢

派一個 fresh-context `general-purpose`（sonnet）agent 跑 `03-templates.md` 的審查範本 E，
對象是整個 `docs/agent-os/`＋`CLAUDE.md`，重點查：
路徑失效、行號漂移、型號過時、規則互相矛盾。發現的問題按第 1 節權限處理。
