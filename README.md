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

### Linux / macOS

```bash
git clone https://github.com/s90061/inventory.git ~/inventory && cd ~/inventory
pip install fastapi uvicorn python-multipart
python server.py
```

### Windows (Command Prompt)

```cmd
git clone https://github.com/s90061/inventory.git %USERPROFILE%\inventory
cd %USERPROFILE%\inventory
pip install fastapi uvicorn python-multipart
python server.py
```

### Windows 一鍵啟動

雙擊 `start.bat` 即可啟動伺服器。

### Windows（免安裝 Python — embeddable）

無管理員權限時，使用 [Python embeddable package](https://www.python.org/downloads/windows/)：

1. 下載 `python-3.11.x-embed-amd64.zip`，解壓至 `C:\inventory\python\`
2. 編輯 `python311._pth`，取消註解 `import site`
3. 執行 `python get-pip.py` 安裝 pip
4. `python -m pip install fastapi uvicorn python-multipart`
5. `git clone https://github.com/s90061/inventory.git C:\inventory\app`
6. `cd C:\inventory\app && ..\python\python.exe server.py`

---

伺服器啟動於 http://localhost:8090

## 技術棧

- **Backend**: FastAPI + SQLite
- **Frontend**: Vanilla HTML/CSS/JS
- **QR Scanner**: html5-qrcode + ZXing browser
