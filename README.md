# 📚 考試題庫訓練

多科目的考試題庫練習小遊戲，可以加到手機主畫面當 App 用。

每個科目都有：
- 📝 **模擬考**：照該科考試的題數和配分出題
- 🏛️ **闖關模式**：3 條命、限時、連對加分
- 📖 **選擇題練習**／✍️ **問答題練習**（想一想再看答案，自己評分）
- 📕 **錯題本**：答錯的題目自動收集

## 新增科目

1. 在 `data/subjects/` 複製一份 `civil-law.ts`，改成新科目的題目
2. 在 `data/subjects/index.ts` 的 `SUBJECTS` 陣列加上它

題目格式在 `data/types.ts`。

## 開發

```bash
npm install
npm run dev
```

推到 `main` 會自動透過 GitHub Actions 部署到 GitHub Pages。
