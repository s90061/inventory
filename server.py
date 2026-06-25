#!/usr/bin/env python3
"""Inventory Management System — FastAPI + SQLite"""

import base64
import csv
import io
import json
import os
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

app = FastAPI(title="Inventory System")

BASE = Path(__file__).parent
UPLOADS = BASE / "uploads"
DB_PATH = BASE / "inventory.db"
STATIC = BASE / "static"

UPLOADS.mkdir(exist_ok=True)

# ── DB init ──────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            barcode TEXT DEFAULT '',
            category TEXT DEFAULT '',
            qty REAL NOT NULL DEFAULT 0,
            unit TEXT DEFAULT '個',
            min_qty REAL DEFAULT 0,
            photo_path TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id TEXT NOT NULL,
            change_qty REAL NOT NULL,
            result_qty REAL NOT NULL,
            type TEXT NOT NULL DEFAULT 'adjust',
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        );
    """)
    db.commit()
    db.close()

init_db()

# ── Helpers ──────────────────────────────────────────────
def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def row_to_dict(row):
    return dict(row) if row else {}

# ── API Routes ───────────────────────────────────────────
@app.get("/api/products")
def list_products(search: str = "", category: str = ""):
    db = get_db()
    q = "SELECT * FROM products WHERE 1=1"
    params = []
    if search:
        q += " AND (name LIKE ? OR notes LIKE ?)"
        kw = f"%{search}%"
        params.extend([kw, kw])
    if category:
        q += " AND category = ?"
        params.append(category)
    q += " ORDER BY updated_at DESC"
    rows = db.execute(q, params).fetchall()
    db.close()
    return [row_to_dict(r) for r in rows]

@app.get("/api/products/{product_id}")
def get_product(product_id: str):
    db = get_db()
    row = db.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
    db.close()
    if not row:
        raise HTTPException(404, "Product not found")
    return row_to_dict(row)

@app.post("/api/products")
async def create_product(
    name: str = Form(...),
    barcode: str = Form(""),
    category: str = Form(""),
    qty: float = Form(0),
    unit: str = Form("個"),
    min_qty: float = Form(0),
    notes: str = Form(""),
    photo: UploadFile = File(None),
):
    product_id = uuid.uuid4().hex[:12]
    photo_path = ""

    if photo and photo.filename:
        ext = Path(photo.filename).suffix[:8]
        safe_name = f"{product_id}{ext}"
        filepath = UPLOADS / safe_name
        content = await photo.read()
        filepath.write_bytes(content)
        photo_path = f"/uploads/{safe_name}"

    ts = now()
    db = get_db()
    db.execute(
        """INSERT INTO products (id, name, barcode, category, qty, unit, min_qty, photo_path, notes, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (product_id, name, barcode, category, qty, unit, min_qty, photo_path, notes, ts, ts),
    )
    db.commit()
    db.close()
    return {"id": product_id, "ok": True}

@app.put("/api/products/{product_id}")
def update_product(
    product_id: str,
    name: str = Form(...),
    barcode: str = Form(""),
    category: str = Form(""),
    qty: float = Form(None),
    unit: str = Form("個"),
    min_qty: float = Form(0),
    notes: str = Form(""),
):
    db = get_db()
    existing = db.execute("SELECT qty FROM products WHERE id=?", (product_id,)).fetchone()
    if not existing:
        db.close()
        raise HTTPException(404, "Product not found")

    old_qty = existing["qty"]
    new_qty = qty if qty is not None else old_qty
    ts = now()

    db.execute(
        """UPDATE products SET name=?, barcode=?, category=?, qty=?, unit=?, min_qty=?, notes=?, updated_at=?
           WHERE id=?""",
        (name, barcode, category, new_qty, unit, min_qty, notes, ts, product_id),
    )
    db.commit()
    db.close()

    # Log if qty changed
    if qty is not None and new_qty != old_qty:
        delta = round(new_qty - old_qty, 2)
        _add_log(product_id, delta, new_qty, "adjust", notes=f"手動調整: {old_qty} → {new_qty}")

    return {"ok": True}

@app.post("/api/products/{product_id}/adjust")
def adjust_qty(product_id: str, change: float = Form(...), notes: str = Form("")):
    """+change = 進貨, -change = 出貨"""
    db = get_db()
    row = db.execute("SELECT qty FROM products WHERE id=?", (product_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(404, "Product not found")

    new_qty = round(row["qty"] + change, 2)
    ts = now()
    db.execute("UPDATE products SET qty=?, updated_at=? WHERE id=?", (new_qty, ts, product_id))
    db.commit()
    db.close()

    log_type = "in" if change > 0 else "out"
    _add_log(product_id, change, new_qty, log_type, notes)
    return {"ok": True, "new_qty": new_qty}

@app.delete("/api/products/{product_id}")
def delete_product(product_id: str):
    db = get_db()
    row = db.execute("SELECT photo_path FROM products WHERE id=?", (product_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(404, "Product not found")

    # Delete photo file
    if row["photo_path"]:
        fp = BASE / row["photo_path"].lstrip("/")
        if fp.exists():
            fp.unlink()

    db.execute("DELETE FROM products WHERE id=?", (product_id,))
    db.commit()
    db.close()
    return {"ok": True}

@app.get("/api/products/{product_id}/logs")
def product_logs(product_id: str):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM logs WHERE product_id=? ORDER BY created_at DESC LIMIT 100",
        (product_id,),
    ).fetchall()
    db.close()
    return [row_to_dict(r) for r in rows]

@app.get("/api/categories")
def list_categories():
    db = get_db()
    rows = db.execute("SELECT DISTINCT category FROM products WHERE category != '' ORDER BY category").fetchall()
    db.close()
    return [r["category"] for r in rows]

# ── Photo upload (separate endpoint for cross-platform compat) ──
@app.post("/api/products/{product_id}/photo")
async def upload_photo(product_id: str, photo: UploadFile = File(...)):
    db = get_db()
    existing = db.execute("SELECT photo_path FROM products WHERE id=?", (product_id,)).fetchone()
    if not existing:
        db.close()
        raise HTTPException(404, "Product not found")

    # Remove old photo
    if existing["photo_path"]:
        old_fp = BASE / existing["photo_path"].lstrip("/")
        if old_fp.exists():
            old_fp.unlink()

    ext = Path(photo.filename).suffix[:8] if photo.filename else ".jpg"
    safe_name = f"{product_id}{ext}"
    filepath = UPLOADS / safe_name
    content = await photo.read()
    filepath.write_bytes(content)
    photo_path = f"/uploads/{safe_name}"

    ts = now()
    db.execute("UPDATE products SET photo_path=?, updated_at=? WHERE id=?", (photo_path, ts, product_id))
    db.commit()
    db.close()
    return {"ok": True, "photo_path": photo_path}

@app.post("/api/scan")
def scan_barcode(barcode: str = Form(...)):
    """Lookup product by barcode, auto +1 if found"""
    db = get_db()
    row = db.execute("SELECT * FROM products WHERE barcode=? AND barcode!=''", (barcode,)).fetchone()
    if not row:
        db.close()
        return {"found": False}

    product = row_to_dict(row)
    new_qty = round(product["qty"] + 1, 2)
    ts = now()
    db.execute("UPDATE products SET qty=?, updated_at=? WHERE id=?", (new_qty, ts, product["id"]))
    db.commit()
    db.close()

    _add_log(product["id"], 1, new_qty, "in", f"掃碼進貨: {barcode}")
    return {"found": True, "product": product["name"], "new_qty": new_qty}

@app.post("/api/scan-out")
def scan_out_barcode(barcode: str = Form(...)):
    """Lookup product by barcode, auto -1 if found (with qty >= 0 check)"""
    db = get_db()
    row = db.execute("SELECT * FROM products WHERE barcode=? AND barcode!=''", (barcode,)).fetchone()
    if not row:
        db.close()
        return {"found": False}

    product = row_to_dict(row)
    if product["qty"] <= 0:
        db.close()
        return {"found": True, "product": product["name"], "new_qty": 0, "zero": True}

    new_qty = round(product["qty"] - 1, 2)
    ts = now()
    db.execute("UPDATE products SET qty=?, updated_at=? WHERE id=?", (new_qty, ts, product["id"]))
    db.commit()
    db.close()

    _add_log(product["id"], -1, new_qty, "out", f"掃碼出庫: {barcode}")
    return {"found": True, "product": product["name"], "new_qty": new_qty}

def _add_log(product_id, change_qty, result_qty, log_type, notes=""):
    db = get_db()
    db.execute(
        "INSERT INTO logs (product_id, change_qty, result_qty, type, notes, created_at) VALUES (?,?,?,?,?,?)",
        (product_id, change_qty, result_qty, log_type, notes, now()),
    )
    db.commit()
    db.close()

# ── Export / Import ──────────────────────────────────────
@app.get("/api/export")
def export_data(fmt: str = "json"):
    """Export all products + logs as JSON or CSV (with Base64 photos)"""
    db = get_db()
    products = [row_to_dict(r) for r in db.execute("SELECT * FROM products ORDER BY updated_at DESC").fetchall()]
    logs = [row_to_dict(r) for r in db.execute("SELECT * FROM logs ORDER BY created_at DESC").fetchall()]
    db.close()
    
    # Encode photos as Base64
    for p in products:
        photo_path = p.get('photo_path', '')
        if photo_path:
            photo_file = BASE / photo_path.lstrip('/')
            if photo_file.exists():
                photo_data = photo_file.read_bytes()
                photo_base64 = base64.b64encode(photo_data).decode('utf-8')
                # Add Base64 data, keep path for reference
                p['photo_base64'] = photo_base64
                p['photo_mime'] = 'image/jpeg'  # All photos are compressed to JPEG
            else:
                p['photo_base64'] = None
        else:
            p['photo_base64'] = None
    
    if fmt == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id","name","barcode","category","qty","unit","min_qty","notes","photo_path","created_at","updated_at"])
        for p in products:
            writer.writerow([p.get(k,"") for k in ["id","name","barcode","category","qty","unit","min_qty","notes","photo_path","created_at","updated_at"]])
        output.seek(0)
        return StreamingResponse(output, media_type="text/csv",
                                 headers={"Content-Disposition": "attachment; filename=inventory_export.csv"})
    
    export = {"products": products, "logs": logs, "exported_at": now()}
    return JSONResponse(export, headers={"Content-Disposition": "attachment; filename=inventory_export.json"})

@app.post("/api/import")
async def import_data(file: UploadFile = File(...)):
    """Import JSON export — upserts products, appends logs, restores Base64 photos"""
    raw = await file.read()
    try:
        data = json.loads(raw)
    except Exception:
        raise HTTPException(400, "Invalid JSON")

    products = data.get("products", [])
    logs = data.get("logs", [])
    if not products:
        raise HTTPException(400, "No products found")

    db = get_db()
    imported = 0
    skipped = 0
    photos_restored = 0

    for p in products:
        pid = p.get("id", "")
        name = p.get("name", "")
        if not pid or not name:
            skipped += 1
            continue
        
        # Handle Base64 photo restoration
        photo_path = p.get("photo_path", "")
        photo_base64 = p.get("photo_base64")
        
        if photo_base64 and photo_path:
            # Decode and save photo
            try:
                photo_data = base64.b64decode(photo_base64)
                photo_filename = Path(photo_path).name
                photo_file = UPLOADS / photo_filename
                photo_file.write_bytes(photo_data)
                photos_restored += 1
            except Exception:
                # If decoding fails, keep the path but no file
                pass

        existing = db.execute("SELECT id FROM products WHERE id=?", (pid,)).fetchone()
        ts = now()
        if existing:
            db.execute(
                """UPDATE products SET name=?, barcode=?, category=?, qty=?, unit=?, min_qty=?,
                   notes=?, photo_path=?, updated_at=? WHERE id=?""",
                (p.get("name"), p.get("barcode",""), p.get("category",""), p.get("qty",0),
                 p.get("unit","個"), p.get("min_qty",0), p.get("notes",""), photo_path, ts, pid),
            )
        else:
            db.execute(
                """INSERT INTO products (id, name, barcode, category, qty, unit, min_qty, photo_path, notes, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (pid, name, p.get("barcode",""), p.get("category",""), p.get("qty",0),
                 p.get("unit","個"), p.get("min_qty",0), photo_path, p.get("notes",""),
                 p.get("created_at", ts), ts),
            )
        imported += 1

    for log in logs:
        if log.get("product_id") and log.get("change_qty") is not None:
            existing_log = db.execute(
                "SELECT id FROM logs WHERE product_id=? AND created_at=? AND change_qty=?",
                (log["product_id"], log.get("created_at",""), log["change_qty"]),
            ).fetchone()
            if not existing_log:
                db.execute(
                    "INSERT INTO logs (product_id, change_qty, result_qty, type, notes, created_at) VALUES (?,?,?,?,?,?)",
                    (log["product_id"], log["change_qty"], log.get("result_qty",0),
                     log.get("type","adjust"), log.get("notes",""), log.get("created_at", now())),
                )

    db.commit()
    db.close()
    return {"ok": True, "imported": imported, "skipped": skipped, "photos_restored": photos_restored}

# ── Serve uploads static ───────────────────────────────
@app.get("/api/report/summary")
def report_summary():
    db = get_db()
    total = db.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    total_qty = db.execute("SELECT SUM(qty) FROM products").fetchone()[0] or 0
    low_stock = db.execute("SELECT COUNT(*) FROM products WHERE min_qty > 0 AND qty <= min_qty").fetchone()[0]
    cat_rows = db.execute("SELECT category, COUNT(*) as cnt, SUM(qty) as total_qty FROM products WHERE category != '' GROUP BY category ORDER BY cnt DESC").fetchall()
    categories = [{"name": r["category"], "count": r["cnt"], "total_qty": r["total_qty"]} for r in cat_rows]
    latest_logs = db.execute(
        "SELECT l.*, p.name as product_name FROM logs l JOIN products p ON l.product_id = p.id ORDER BY l.created_at DESC LIMIT 10"
    ).fetchall()
    recent = [{"product_name": r["product_name"], "change_qty": r["change_qty"], "type": r["type"], "created_at": r["created_at"]} for r in latest_logs]

    low_stock_rows = db.execute("SELECT id, name, qty, unit, min_qty, category FROM products WHERE min_qty > 0 AND qty <= min_qty ORDER BY category, qty ASC").fetchall()
    low_stock_items = [{"id": r["id"], "name": r["name"], "qty": r["qty"], "unit": r["unit"], "min_qty": r["min_qty"], "category": r["category"] or "-"} for r in low_stock_rows]

    db.close()
    return {"total_products": total, "total_qty": total_qty, "low_stock": low_stock, "categories": categories, "recent_logs": recent, "low_stock_items": low_stock_items}

@app.get("/api/report/trends")
def report_trends(days: int = 30):
    db = get_db()
    import re
    raw = db.execute(
        "SELECT created_at, type, SUM(ABS(change_qty)) as qty FROM logs WHERE created_at >= date('now', ?) GROUP BY date(created_at), type ORDER BY created_at",
        (f"-{days} days",)
    ).fetchall()
    db.close()
    # Pivot into daily in/out
    daily = {}
    for r in raw:
        d = r["created_at"][:10]
        if d not in daily:
            daily[d] = {"in": 0, "out": 0}
        if r["type"] == "in":
            daily[d]["in"] += round(r["qty"], 2)
        else:
            daily[d]["out"] += round(r["qty"], 2)
    labels = sorted(daily.keys())
    in_data = [daily[d]["in"] for d in labels]
    out_data = [daily[d]["out"] for d in labels]
    return {"labels": labels, "in": in_data, "out": out_data}


@app.get("/uploads/{filename}")
def serve_upload(filename: str):
    fp = UPLOADS / filename
    if not fp.exists():
        raise HTTPException(404)
    return FileResponse(fp)

# ── Serve SPA ──────────────────────────────────────────
@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")

@app.get("/report")
def report_page():
    return FileResponse(STATIC / "report.html", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

# Mount static files after explicit routes
app.mount("/static", StaticFiles(directory=str(STATIC)), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8090)