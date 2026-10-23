# kids-practice

孩子們的練習 App。網址：https://iam5980.github.io/kids-practice/

結構：`<孩子>/<科目>/<學期-考試>/`，例如 `au/reading/1151-mid/`。
- au = Audrey，hw = Howard，shadowing = 兩人共用
- 科目資料夾：英文課 reading / grammar / science / social；中文部 chinese（國語）/ zh-science（自然）/ zh-social（社會）/ math（數學）
- 學期代碼：1151 = 115 學年第 1 學期；mid / final = 期中 / 期末
- 新增一份練習：放進對應資料夾，再到首頁 index.html 的 CATALOG 加一行。
- 答案卷不放在這裡（網站是公開的）。

## 共用程式範本
`template/app-core.js` 是所有練習 App 共用的核心程式（朗讀、iPad 錄音、選項平均分布、Finish & Score、口說先錄後看答案）。
- 產生新 App 時，把整個檔案**內嵌**進 App 的 `<script>`，不要用 `<script src>` 連結。
- 修 bug 只改這個檔案，之後產生的 App 都會用到修好的版本（已上線的 App 不會自動變）。
- `template/demo.html` 是測試頁：https://iam5980.github.io/kids-practice/template/demo.html
