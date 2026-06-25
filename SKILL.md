---
name: inventory-system
description: "Inventory Management System — FastAPI + SQLite self-hosted app. Gold luxury dark theme, barcode scanning, photo uploads, card/list views, JSON export/import, report dashboard."
category: productivity
version: 1.0.0
author: s90061
license: MIT
repository: https://github.com/s90061/inventory
---

# Inventory Management System

Self-hosted inventory tracker with FastAPI + SQLite backend and vanilla HTML/CSS/JS frontend.

## Features

- 📦 Product CRUD (name, SKU, quantity, cost, price, brand category)
- 📷 Product photo upload (client-side compression)
- 🏷️ Brand categories with datalist + free-form input
- 📊 Card / List view toggle
- 📤 JSON export / 📥 JSON import
- 🖨️ Report dashboard with KPI, charts, low-stock alerts
- 📱 Responsive mobile UI
- 🔍 QR/barcode scanning (html5-qrcode + ZXing)
- 🎨 Gold luxury dark theme (#000000 background, #c9a84c gold)

## Quick Install

```bash
# Clone
git clone https://github.com/s90061/inventory.git ~/inventory && cd ~/inventory

# Install dependencies
pip install fastapi uvicorn python-multipart

# Start server (port 8090)
python server.py
```

Open http://localhost:8090 in your browser.

## Architecture

```
inventory/
├── server.py              # FastAPI backend, SQLite storage
├── static/
│   ├── index.html         # Main inventory page
│   ├── app.js             # Client logic
│   ├── style.css          # Gold luxury dark theme CSS
│   ├── report.html        # Report dashboard
│   ├── report.js          # Report logic + charts
│   ├── report.css         # Report-specific styles
│   ├── html5-qrcode.min.js
│   ├── zxing-browser.min.js
│   └── zxing-library.min.js
├── uploads/               # Product photos (auto-created)
└── inventory.db           # SQLite database (auto-created)
```

### REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/products` | GET | List products (`?search=` `?category=`) |
| `/api/products/<id>` | GET | Single product |
| `/api/products` | POST | Create product (FormData) |
| `/api/products/<id>` | PUT | Update product (FormData) |
| `/api/products/<id>` | DELETE | Delete product + photo |
| `/api/products/<id>/adjust` | POST | Stock in/out (`change: +N/-N`) |
| `/api/products/<id>/photo` | POST | Upload/replace photo |
| `/api/products/<id>/photo` | DELETE | Remove photo |
| `/api/scan` | POST | Barcode scan-in (auto +1) |
| `/api/scan-out` | POST | Barcode scan-out (auto -1) |
| `/api/categories` | GET | Distinct categories |
| `/api/export` | GET | Download JSON (`?fmt=csv`) |
| `/api/import` | POST | Upload JSON (upsert) |
| `/api/report/summary` | GET | KPI + low-stock + categories |
| `/api/report/trends` | GET | Daily in/out trends (`?days=30`) |

## Customization

### Brand Categories

Edit the `<datalist id="category-list">` in `static/index.html` to change preset categories:
```html
<datalist id="category-list">
  <option value="Your Brand A">
  <option value="Your Brand B">
  <option value="Your Brand C">
</datalist>
```

### Color Theme

CSS variables in `static/style.css`:
```css
:root {
  --bg: #0a0a0a;          /* Page background */
  --bg-card: #1a1a1a;    /* Card background */
  --gold: #c9a84c;        /* Primary accent */
  --text: #f0ead6;        /* Main text */
  --text-muted: #c0b395;  /* Muted text */
}
```

### Server Port

Change in `server.py`:
```python
uvicorn.run(app, host="0.0.0.0", port=8090)
```

## Run as Service (Linux)

```bash
# systemd unit
cat > /tmp/inventory.service << 'EOF'
[Unit]
Description=Inventory Management System
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/inventory
ExecStart=/usr/bin/python3 server.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo cp /tmp/inventory.service /etc/systemd/system/
sudo systemctl enable --now inventory
```

## Run in Background (no systemd)

```bash
cd ~/inventory
nohup python server.py > /dev/null 2>&1 &
```

## Tech Stack

- **Backend**: Python 3.11+ / FastAPI / SQLite
- **Frontend**: Vanilla HTML / CSS / JS
- **Charts**: Chart.js (CDN)
- **Barcode**: html5-qrcode + @zxing/browser
- **No build step required**

## License

MIT
