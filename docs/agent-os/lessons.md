# 踩雷教訓（新條目加最上面；格式見 04-maintenance.md 第 2 節）

## 2026-07-03 skill 內容會落後於程式碼演進（UI 功能取代程式碼設定後未更新）
- 情境：檢視 otschedule-setup skill
- 雷：skill 仍教「改 App.tsx 的 ROTATION_SEQUENCES」，但該值早已改名為 DEFAULT_ 且被
  localStorage/Firestore 覆寫、後台已有 UI 編輯器——照做會白改且困惑
- 修法：新增後台 UI 功能時，同步檢查 .claude/skills 與 codebase-map.md 是否過時
- 影響檔：已修正 SKILL.md；巡檢機制在 04-maintenance.md 第 5 節

## 2026-07-03 App.tsx 整檔讀取會吃掉大半 context
- 情境：任何需要看 App.tsx 的任務
- 雷：App.tsx 4391 行 ≈ 5 萬 token，整檔讀一次 context 即告急
- 修法：先讀 codebase-map.md → Grep 定位 → Read offset/limit ≤200 行
- 影響檔：已制度化於 00-diagnosis.md 第 1 名、CLAUDE.md 鐵律 1

## 2026-07-03 遠端 container 未 push 即消失
- 情境：在 claude.ai/code 遠端環境工作
- 雷：container 為暫時性，session 閒置回收後未 push 的變更全部遺失
- 修法：每完成一個獨立子項就 commit；收尾必 push＋確認 PR 存在
- 影響檔：已制度化於 00-diagnosis.md 第 3 名、02-rubrics.md 第 2 節

## 2026-07-03 憑記憶填模型型號會錯
- 情境：寫調度規則、呼叫 Agent 工具時填 model
- 雷：訓練記憶中的型號名與當前實際可用值不一致；且各 harness 可用清單不同
- 修法：只用當前 session system-reminder 列出的值；查不到就標「待確認」，不編造
- 影響檔：已制度化於 01-dispatch.md 第 2 節
