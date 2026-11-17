# 沿途

**過程本身，就是風景。**

https://along-theway.vercel.app/

> 在不同風景和人文（科目）裡走一圈，找到自己的答案。

把考古題變成一趟旅程：每一科是一張車票和一本護照，每個主題是一站，每一題是一個路標。重點在過程——沿途看懂了什麼，會寫成明信片收進旅行手帳。

## 功能

- **上傳考古題**：拖放或選擇 PDF、PowerPoint、Word 檔，AI 自動整理成一趟旅程
- **練習**：單選、複選、是非、填空、簡答；作答後立即看到正確答案與解析
- **篩選**：依科目、年份篩選題庫；依題型、「不熟的」、「答錯的」篩選題目
- **標記不熟**：作答時可標記題目，之後只練這些題
- **模擬考**：照該科考試的題數與配分計分
- **紀錄**：歷次作答紀錄、各主題正確率與弱點分析（存在使用者自己的瀏覽器）

## 題庫

- 網站沒有內建題庫：每個人的題庫都是自己上傳（AI 整理），或從別人分享的連結匯入，只存在自己的瀏覽器裡。
- **分享連結**：在題庫的護照頁按「分享這條路線」。整份題庫會壓縮進連結的 `#` 後面，不會送到伺服器、也不會存在任何地方；拿到連結的人才能匯入。程式在 `lib/share.ts`。
- 也可以在網站上傳同格式的 `.json` 檔，直接加入成自己的題庫。
- 想放所有人都看得到的公開題庫，可以在 `data/subjects/` 加檔案並加進 `index.ts`（格式見 `data/types.ts`）。

## AI 自動規劃路線

上傳 PDF、PowerPoint（.pptx）或 Word（.docx），由 Google Gemini 整理重點並出題。

- 後端在 `app/api/analyze/route.ts`，金鑰只存在伺服器的環境變數 `GEMINI_API_KEY`。
- PDF 直接交給 AI 讀（上限 4 MB）；pptx / docx 先在瀏覽器取出文字再送，所以檔案大也沒關係。
- 同一個 IP 10 分鐘內最多 6 次。
- 模型預設 `gemini-3.5-flash-lite`，可用環境變數 `GEMINI_MODEL` 更換。

## 開發

```bash
npm install
cp .env.example .env.local   # 填入 GEMINI_API_KEY
npm run dev
```

## 部署（Vercel）

1. 在 vercel.com 匯入這個 GitHub 專案（Framework 選 Next.js，其他用預設）。
2. 在 Settings → Environment Variables 新增 `GEMINI_API_KEY`。
3. 之後推到 `main` 就會自動部署。
