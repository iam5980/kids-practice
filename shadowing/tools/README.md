# 跟讀小教練：單字題庫建置

`python3 build_words.py` → 重新產生 `../words.js`。

- `wordlists/*.txt`：各等級詞條（一行一個）。來源：劍橋 YLE／A2 Key／B1 PET 官方字表、LTTC 全民英檢參考字表（中高級總表依級數欄拆成三級）、大考中心《高中英文參考詞彙表》（111 學年度起）第 1–6 級、AWL（Victoria University 官方字首表）、Oxford 5000（CEFR A1–C1）。
- `zh/gept_zh.json`：LTTC 字表的中文釋義；`zh/missing_zh*.json`：字表中查無的字的補充譯註。
- 新增一個等級：把 txt 放進 `wordlists/`，在 `build_words.py` 的 `LEVELS` 與 `CEFR` 各加一行；缺中文的字補進新的 `zh/missing_zhN.json` 並加進讀檔清單。
- 規則：同一路線內每個字只放在最早出現的等級；排除冠詞、代名詞、be 動詞等功能字與 YLE 人名；每 20 字一包（`index.html` 的 `PACK`）。
