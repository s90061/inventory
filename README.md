# Inventory Management System

FastAPI + SQLite 庫存管理系統，運行於 :8090。

## 功能

- 📦 商品 CRUD（名稱、SKU、數量、成本、售價、品牌分類）
- 📷 商品照片上傳
- 🏷️ 品牌分類：ZEUS 瑞獅 / ASTONE / EVO 華泰（datalist + 箭頭 SVG）
- 📊 卡片 / 清單檢視切換
- 📤 匯出 / 📥 匯入 JSON
- 🖨️ 列印報表頁面
- 📱 響應式手機版
- 🔍 QR Code 掃描（html5-qrcode + ZXing）

## 設計風格

- 純黑底 #000000 + 金色 #c9a84c
- iPhone theme-color #000000
- 玻璃擬態卡片
- De-form 風格輸入框

## 快速啟動

```bash
pip install fastapi uvicorn python-multipart
python server.py
```

伺服器啟動於 http://0.0.0.0:8090

## 技術棧

- **Backend**: FastAPI + SQLite
- **Frontend**: Vanilla HTML/CSS/JS
- **QR Scanner**: html5-qrcode + ZXing browser
