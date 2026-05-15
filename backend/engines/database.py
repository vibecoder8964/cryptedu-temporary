"""
CryptEdu Database Layer — SQLite primary with optional Supabase sync.
Auto-creates tables on first import. User credentials encrypted with Fernet.
Security: parameterized queries, WAL mode, secure_delete, foreign keys.
"""
import sqlite3
import os
import json
import logging
import base64
from datetime import datetime
from typing import Optional, List, Dict, Any

from cryptography.fernet import Fernet

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DB_PATH, DATA_DIR, SUPABASE_ENABLED, ENCRYPTION_KEY

logger = logging.getLogger(__name__)

# ── Fernet Cipher ─────────────────────────────────────────
# Derive a URL-safe base64 key from the 32-byte ENCRYPTION_KEY
_fernet_key = base64.urlsafe_b64encode(ENCRYPTION_KEY)
_cipher = Fernet(_fernet_key)


def encrypt_value(plaintext: str) -> str:
    """Encrypt a string value using Fernet symmetric encryption."""
    if not plaintext:
        return ""
    return _cipher.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a Fernet-encrypted string."""
    if not ciphertext:
        return ""
    try:
        return _cipher.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return ""


def normalize_private_key(key: str) -> str:
    """
    Normalize a PEM private key to ensure correct format.
    Handles:
    - Surrounding quotes (users often paste "-----BEGIN..." with quotes)
    - Literal \\n sequences (from JSON copy-paste) → real newlines
    - Missing newlines around BEGIN/END markers
    """
    if not key:
        return ""
    # Strip surrounding quotes
    key = key.strip()
    if (key.startswith('"') and key.endswith('"')) or (key.startswith("'") and key.endswith("'")):
        key = key[1:-1]
    # Replace literal \\n sequences with real newlines
    key = key.replace('\\n', '\n')
    # Also handle double-escaped \\\\n
    key = key.replace('\\\\n', '\n')
    # Ensure BEGIN/END markers are on their own lines
    key = key.replace('-----BEGIN PRIVATE KEY----- ', '-----BEGIN PRIVATE KEY-----\n')
    key = key.replace(' -----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----')
    # Remove any trailing/leading whitespace per line and empty lines in between
    lines = [line.strip() for line in key.split('\n')]
    lines = [line for line in lines if line]
    # Reconstruct with proper newlines
    key = '\n'.join(lines) + '\n'
    return key


# ── Connection ────────────────────────────────────────────

def _ensure_dir():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def get_conn() -> sqlite3.Connection:
    _ensure_dir()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA secure_delete=ON")
    return conn


# ── Schema ────────────────────────────────────────────────

def init_db():
    """Create all tables if they don't exist."""
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL DEFAULT '',
            full_name TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT 'Regional Moderator',
            government_id TEXT NOT NULL DEFAULT '',
            aws_access_key_enc TEXT DEFAULT '',
            aws_secret_key_enc TEXT DEFAULT '',
            aws_region TEXT DEFAULT 'us-east-1',
            bedrock_role_arn_enc TEXT DEFAULT '',
            s3_training_bucket TEXT DEFAULT 'cryptedu-training-data',
            google_client_email_enc TEXT DEFAULT '',
            google_private_key_enc TEXT DEFAULT '',
            google_project_id TEXT DEFAULT '',
            google_drive_folder_id TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS user_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            action_type TEXT NOT NULL,
            action_data TEXT,
            page TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            filesize INTEGER DEFAULT 0,
            transcript TEXT,
            ai_status TEXT DEFAULT 'pending',
            ai_reason TEXT,
            ai_confidence REAL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS rag_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            filepath TEXT,
            page_count INTEGER DEFAULT 0,
            chunk_count INTEGER DEFAULT 0,
            ocr_used INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS equity_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            village_name TEXT NOT NULL,
            hub_connections INTEGER DEFAULT 0,
            device_ids INTEGER DEFAULT 0,
            kiosk_required INTEGER DEFAULT 0,
            priority TEXT DEFAULT 'low',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS placement_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            district_name TEXT NOT NULL,
            geojson_input TEXT,
            result_json TEXT,
            total_hubs INTEGER DEFAULT 0,
            total_capex REAL DEFAULT 0,
            annual_opex REAL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS training_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            job_name TEXT NOT NULL,
            job_arn TEXT,
            status TEXT DEFAULT 'pending',
            dataset_s3_uri TEXT,
            output_s3_uri TEXT,
            est_cost REAL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    """)
    conn.commit()

    # Seed default admin user if none exists
    existing = conn.execute("SELECT id FROM users WHERE username = ?", ("admin",)).fetchone()
    if not existing:
        import bcrypt
        pwd_hash = bcrypt.hashpw(b"123456", bcrypt.gensalt()).decode('utf-8')
        conn.execute(
            """INSERT INTO users (username, password_hash, full_name, role, government_id)
               VALUES (?, ?, ?, ?, ?)""",
            ("admin", pwd_hash, "Ahmad Bin Yusuf", "Regional Moderator", "KPM-MY-2023-8901")
        )
        conn.commit()
        logger.info("Default admin user created.")
        
    try:
        conn.execute("ALTER TABLE users ADD COLUMN google_client_email_enc TEXT DEFAULT ''")
        conn.execute("ALTER TABLE users ADD COLUMN google_private_key_enc TEXT DEFAULT ''")
        conn.execute("ALTER TABLE users ADD COLUMN google_project_id TEXT DEFAULT ''")
        conn.execute("ALTER TABLE users ADD COLUMN google_drive_folder_id TEXT DEFAULT ''")
        conn.commit()
    except Exception:
        pass

    # Migration: add lambda_url and lambda_api_key_enc columns
    try:
        conn.execute("ALTER TABLE users ADD COLUMN lambda_url TEXT DEFAULT ''")
        conn.execute("ALTER TABLE users ADD COLUMN lambda_api_key_enc TEXT DEFAULT ''")
        conn.commit()
    except Exception:
        pass

    # Create end_user_accounts table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS end_user_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT DEFAULT '',
            role TEXT DEFAULT 'student',
            created_at TEXT DEFAULT (datetime('now')),
            created_by INTEGER,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    """)
    conn.commit()

    # Seed default end-user if none exists
    existing_eu = conn.execute("SELECT id FROM end_user_accounts WHERE username = ?", ("roshi",)).fetchone()
    if not existing_eu:
        import bcrypt
        eu_hash = bcrypt.hashpw(b"012345", bcrypt.gensalt()).decode('utf-8')
        conn.execute(
            "INSERT INTO end_user_accounts (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)",
            ("roshi", eu_hash, "Roshi", "student")
        )
        conn.commit()
        logger.info("Default end-user 'roshi' created.")

    conn.close()
    logger.info(f"Database initialized at {DB_PATH}")


# ── Supabase Sync Helper ─────────────────────────────────

def _supabase_push(table: str, data: dict):
    """Fire-and-forget push to Supabase. Non-blocking, logged."""
    if not SUPABASE_ENABLED:
        return
    try:
        from engines.supabase_sync import push_row
        push_row(table, data)
    except Exception as e:
        logger.warning(f"Supabase sync failed for {table}: {e}")


# ── User CRUD ─────────────────────────────────────────────

def get_user(username: str = "admin") -> Optional[Dict]:
    """Get user profile. AWS credentials are returned decrypted."""
    conn = get_conn()
    row = conn.execute("SELECT id, username, full_name, role, government_id, aws_access_key_enc, aws_secret_key_enc, aws_region, bedrock_role_arn_enc, s3_training_bucket, google_client_email_enc, google_private_key_enc, google_project_id, google_drive_folder_id, created_at, updated_at FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    if not row:
        return None
    user = dict(row)
    # Decrypt sensitive fields
    user["aws_access_key"] = decrypt_value(user.pop("aws_access_key_enc", ""))
    user["aws_secret_key"] = decrypt_value(user.pop("aws_secret_key_enc", ""))
    user["bedrock_role_arn"] = decrypt_value(user.pop("bedrock_role_arn_enc", ""))
    user["google_client_email"] = decrypt_value(user.pop("google_client_email_enc", ""))
    user["google_private_key"] = decrypt_value(user.pop("google_private_key_enc", ""))
    return user

def get_user_by_username_with_hash(username: str) -> Optional[Dict]:
    """Get user profile including password hash for auth."""
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    if not row:
        return None
    return dict(row)


def get_user_masked(username: str = "admin") -> Optional[Dict]:
    """Get user profile with masked secrets (for API responses)."""
    user = get_user(username)
    if not user:
        return None
    # Mask sensitive fields
    ak = user.get("aws_access_key", "")
    sk = user.get("aws_secret_key", "")
    arn = user.get("bedrock_role_arn", "")
    gemail = user.get("google_client_email", "")
    gkey = user.get("google_private_key", "")
    
    user["aws_access_key_masked"] = (ak[:4] + "••••" + ak[-4:]) if len(ak) > 8 else ("••••" if ak else "")
    user["aws_secret_key_masked"] = "••••••••••••" if sk else ""
    user["bedrock_role_arn_masked"] = (arn[:20] + "••••") if len(arn) > 20 else ("••••" if arn else "")
    user["google_client_email_masked"] = (gemail[:4] + "••••" + gemail[-4:]) if len(gemail) > 8 else ("••••" if gemail else "")
    user["google_private_key_masked"] = "••••••••••••" if gkey else ""
    
    # Remove raw secrets from response
    del user["aws_access_key"]
    del user["aws_secret_key"]
    del user["bedrock_role_arn"]
    del user["google_client_email"]
    del user["google_private_key"]
    return user


def update_user_profile(username: str, full_name: str, role: str, government_id: str) -> bool:
    """Update non-sensitive profile fields."""
    conn = get_conn()
    conn.execute(
        """UPDATE users SET full_name=?, role=?, government_id=?, updated_at=datetime('now')
           WHERE username=?""",
        (full_name, role, government_id, username)
    )
    conn.commit()
    conn.close()
    return True


def update_user_credentials(
    username: str,
    aws_access_key: str,
    aws_secret_key: str,
    aws_region: str,
    bedrock_role_arn: str = "",
    s3_training_bucket: str = "cryptedu-training-data",
    google_client_email: str = "",
    google_private_key: str = "",
    google_project_id: str = "",
    google_drive_folder_id: str = ""
) -> bool:
    """Update AWS credentials — encrypts before storage."""
    conn = get_conn()
    conn.execute(
        """UPDATE users SET
           aws_access_key_enc=?, aws_secret_key_enc=?, aws_region=?,
           bedrock_role_arn_enc=?, s3_training_bucket=?,
           google_client_email_enc=?, google_private_key_enc=?,
           google_project_id=?, google_drive_folder_id=?,
           updated_at=datetime('now')
           WHERE username=?""",
        (
            encrypt_value(aws_access_key),
            encrypt_value(aws_secret_key),
            aws_region,
            encrypt_value(bedrock_role_arn),
            s3_training_bucket,
            encrypt_value(google_client_email),
            encrypt_value(google_private_key),
            google_project_id,
            google_drive_folder_id,
            username
        )
    )
    conn.commit()
    conn.close()

    # Also update environment variables for the current session
    if aws_access_key:
        os.environ["AWS_ACCESS_KEY_ID"] = aws_access_key
    if aws_secret_key:
        os.environ["AWS_SECRET_ACCESS_KEY"] = aws_secret_key
    if aws_region:
        os.environ["AWS_REGION"] = aws_region

    return True


def get_user_aws_credentials(username: str = "admin") -> Dict[str, str]:
    """Get decrypted AWS credentials for pipeline use."""
    user = get_user(username)
    if not user:
        return {"aws_access_key": "", "aws_secret_key": "", "aws_region": "us-east-1",
                "bedrock_role_arn": "", "s3_training_bucket": "cryptedu-training-data"}
    return {
        "aws_access_key": user.get("aws_access_key", ""),
        "aws_secret_key": user.get("aws_secret_key", ""),
        "aws_region": user.get("aws_region", "us-east-1"),
        "bedrock_role_arn": user.get("bedrock_role_arn", ""),
        "s3_training_bucket": user.get("s3_training_bucket", "cryptedu-training-data"),
    }


# ── User Actions / Cache ──────────────────────────────────

def log_user_action(user_id: int, action_type: str, action_data: dict, page: str = ""):
    """Log a user action for history/cache purposes. Data is encrypted."""
    conn = get_conn()
    encrypted_data = encrypt_value(json.dumps(action_data))
    conn.execute(
        "INSERT INTO user_actions (user_id, action_type, action_data, page) VALUES (?, ?, ?, ?)",
        (user_id, action_type, encrypted_data, page)
    )
    conn.commit()
    conn.close()


def get_user_actions(user_id: int, action_type: Optional[str] = None, limit: int = 50) -> List[Dict]:
    """Get user action history. Decrypts action data."""
    conn = get_conn()
    if action_type:
        rows = conn.execute(
            "SELECT * FROM user_actions WHERE user_id=? AND action_type=? ORDER BY created_at DESC LIMIT ?",
            (user_id, action_type, limit)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM user_actions WHERE user_id=? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit)
        ).fetchall()
    conn.close()

    results = []
    for row in rows:
        d = dict(row)
        try:
            d["action_data"] = json.loads(decrypt_value(d.get("action_data", "")))
        except Exception:
            d["action_data"] = {}
        results.append(d)
    return results


# ── Video CRUD ────────────────────────────────────────────

def insert_video(filename: str, filepath: str, filesize: int = 0) -> int:
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO videos (filename, filepath, filesize) VALUES (?, ?, ?)",
        (filename, filepath, filesize)
    )
    vid = cur.lastrowid
    conn.commit()
    conn.close()
    _supabase_push("videos", {"id": vid, "filename": filename, "filesize": filesize, "ai_status": "pending"})
    return vid


def update_video_transcript(video_id: int, transcript: str):
    conn = get_conn()
    conn.execute(
        "UPDATE videos SET transcript=?, updated_at=datetime('now') WHERE id=?",
        (transcript, video_id)
    )
    conn.commit()
    conn.close()


def update_video_ai_status(video_id: int, status: str, reason: str, confidence: float = 0):
    conn = get_conn()
    conn.execute(
        "UPDATE videos SET ai_status=?, ai_reason=?, ai_confidence=?, updated_at=datetime('now') WHERE id=?",
        (status, reason, confidence, video_id)
    )
    conn.commit()
    conn.close()
    _supabase_push("videos", {"id": video_id, "ai_status": status, "ai_reason": reason})


def get_videos(status_filter: Optional[str] = None) -> List[Dict]:
    conn = get_conn()
    if status_filter and status_filter != "all":
        rows = conn.execute(
            "SELECT * FROM videos WHERE ai_status=? ORDER BY created_at DESC", (status_filter,)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM videos ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_video(video_id: int) -> Optional[Dict]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM videos WHERE id=?", (video_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


# ── RAG Document CRUD ─────────────────────────────────────

def insert_rag_document(filename: str, filepath: str, page_count: int, chunk_count: int, ocr_used: bool) -> int:
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO rag_documents (filename, filepath, page_count, chunk_count, ocr_used) VALUES (?, ?, ?, ?, ?)",
        (filename, filepath, page_count, chunk_count, 1 if ocr_used else 0)
    )
    doc_id = cur.lastrowid
    conn.commit()
    conn.close()
    _supabase_push("rag_documents", {"id": doc_id, "filename": filename, "chunk_count": chunk_count})
    return doc_id


def get_rag_documents() -> List[Dict]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM rag_documents ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_rag_document(doc_id: int) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM rag_documents WHERE id=?", (doc_id,))
    conn.commit()
    conn.close()
    return cur.rowcount > 0


# ── Equity CRUD ───────────────────────────────────────────

def get_equity_data() -> List[Dict]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM equity_data ORDER BY village_name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def upsert_equity_data(data: List[Dict]):
    conn = get_conn()
    conn.execute("DELETE FROM equity_data")
    for d in data:
        hub = d.get("hub_connections", 0)
        dev = d.get("device_ids", 0)
        gap_pct = round((1 - dev / max(hub, 1)) * 100)
        kiosk = 1 if dev < hub * 0.3 else 0
        priority = "high" if gap_pct > 70 else ("medium" if gap_pct > 40 else "low")
        conn.execute(
            "INSERT INTO equity_data (village_name, hub_connections, device_ids, kiosk_required, priority) VALUES (?, ?, ?, ?, ?)",
            (d["village_name"], hub, dev, kiosk, priority)
        )
    conn.commit()
    conn.close()
    _supabase_push("equity_data", {"count": len(data), "updated": datetime.now().isoformat()})


def seed_demo_equity_data():
    """Generate 12 realistic simulated villages for demo purposes."""
    import random
    rng = random.Random(42)
    villages = [
        "Kampung Sungai Merah", "Kampung Batu Kawa", "Kampung Telaga Air",
        "Kampung Stutong", "Kampung Tabuan Dayak", "Kampung Sourabaya",
        "Kampung Gita", "Kampung Pinang Jawa", "Kampung Semariang",
        "Kampung Buntal", "Kampung Santubong", "Kampung Damai"
    ]
    data = []
    for v in villages:
        hub = rng.randint(40, 350)
        device_ratio = rng.choice([0.1, 0.15, 0.2, 0.25, 0.35, 0.5, 0.6, 0.7, 0.85])
        dev = max(5, int(hub * device_ratio))
        data.append({"village_name": v, "hub_connections": hub, "device_ids": dev})
    upsert_equity_data(data)
    return data


# ── Placement Runs ────────────────────────────────────────

def save_placement_run(district: str, geojson_input: dict, result: dict) -> int:
    conn = get_conn()
    meta = result.get("metadata", {})
    cur = conn.execute(
        "INSERT INTO placement_runs (district_name, geojson_input, result_json, total_hubs, total_capex, annual_opex) VALUES (?, ?, ?, ?, ?, ?)",
        (district, json.dumps(geojson_input), json.dumps(result),
         meta.get("total_hubs", 0), meta.get("total_capex_myr", 0), meta.get("annual_opex_myr", 0))
    )
    run_id = cur.lastrowid
    conn.commit()
    conn.close()
    return run_id


def get_placement_runs() -> List[Dict]:
    conn = get_conn()
    rows = conn.execute("SELECT id, district_name, total_hubs, total_capex, annual_opex, created_at FROM placement_runs ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Training Jobs ─────────────────────────────────────────

def save_training_job(user_id: int, job_name: str, job_arn: str, dataset_s3: str, output_s3: str, est_cost: float) -> int:
    conn = get_conn()
    cur = conn.execute(
        """INSERT INTO training_jobs (user_id, job_name, job_arn, dataset_s3_uri, output_s3_uri, est_cost)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (user_id, job_name, job_arn, dataset_s3, output_s3, est_cost)
    )
    job_id = cur.lastrowid
    conn.commit()
    conn.close()
    return job_id


def update_training_job_status(job_id: int, status: str):
    conn = get_conn()
    conn.execute(
        "UPDATE training_jobs SET status=?, updated_at=datetime('now') WHERE id=?",
        (status, job_id)
    )
    conn.commit()
    conn.close()


def get_training_jobs(user_id: Optional[int] = None) -> List[Dict]:
    conn = get_conn()
    if user_id:
        rows = conn.execute(
            "SELECT * FROM training_jobs WHERE user_id=? ORDER BY created_at DESC", (user_id,)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM training_jobs ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── User-ID-Based CRUD (for session-authenticated endpoints) ─────────────────

def get_user_by_id(user_id: int) -> Optional[Dict]:
    """Get raw user row by numeric ID."""
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_masked_by_id(user_id: int) -> Optional[Dict]:
    """Get user profile with masked secrets, looked up by numeric ID."""
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not row:
        return None
    user = dict(row)
    ak = decrypt_value(user.get("aws_access_key_enc", ""))
    sk = decrypt_value(user.get("aws_secret_key_enc", ""))
    arn = decrypt_value(user.get("bedrock_role_arn_enc", ""))
    gemail = decrypt_value(user.get("google_client_email_enc", ""))
    gkey = decrypt_value(user.get("google_private_key_enc", ""))
    lkey = decrypt_value(user.get("lambda_api_key_enc", ""))
    user["aws_access_key_masked"] = (ak[:4] + "••••" + ak[-4:]) if len(ak) > 8 else ("••••" if ak else "")
    user["aws_secret_key_masked"] = "••••••••••••" if sk else ""
    user["bedrock_role_arn_masked"] = (arn[:20] + "••••") if len(arn) > 20 else ("••••" if arn else "")
    user["google_client_email_masked"] = (gemail[:4] + "••••" + gemail[-4:]) if len(gemail) > 8 else ("••••" if gemail else "")
    user["google_private_key_masked"] = "••••••••••••" if gkey else ""
    user["lambda_api_key_masked"] = "••••••••••••" if lkey else ""
    # Remove encrypted and sensitive fields
    for f in ["aws_access_key_enc", "aws_secret_key_enc", "bedrock_role_arn_enc",
              "google_client_email_enc", "google_private_key_enc", "lambda_api_key_enc",
              "password_hash"]:
        user.pop(f, None)
    return user


def get_user_by_id_decrypted(user_id: int) -> Optional[Dict]:
    """Get user profile with all credentials decrypted, looked up by numeric ID."""
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not row:
        return None
    user = dict(row)
    user["aws_access_key"] = decrypt_value(user.pop("aws_access_key_enc", ""))
    user["aws_secret_key"] = decrypt_value(user.pop("aws_secret_key_enc", ""))
    user["bedrock_role_arn"] = decrypt_value(user.pop("bedrock_role_arn_enc", ""))
    user["google_client_email"] = decrypt_value(user.pop("google_client_email_enc", ""))
    user["google_private_key"] = decrypt_value(user.pop("google_private_key_enc", ""))
    user["lambda_api_key"] = decrypt_value(user.pop("lambda_api_key_enc", ""))
    return user


def update_user_profile_by_id(user_id: int, full_name: str, role: str, government_id: str) -> bool:
    """Update non-sensitive profile fields by numeric user ID."""
    conn = get_conn()
    conn.execute(
        "UPDATE users SET full_name=?, role=?, government_id=?, updated_at=datetime('now') WHERE id=?",
        (full_name, role, government_id, user_id)
    )
    conn.commit()
    conn.close()
    return True


def update_user_credentials_by_id(
    user_id: int,
    aws_access_key: str,
    aws_secret_key: str,
    aws_region: str,
    bedrock_role_arn: str = "",
    s3_training_bucket: str = "cryptedu-training-data",
    google_client_email: str = "",
    google_private_key: str = "",
    google_project_id: str = "",
    google_drive_folder_id: str = "",
    lambda_url: str = "",
    lambda_api_key: str = ""
) -> bool:
    """Update AWS/Google/Lambda credentials by numeric user ID — encrypts before storage."""
    # Normalize private key format before encryption
    if google_private_key:
        google_private_key = normalize_private_key(google_private_key)
    conn = get_conn()
    conn.execute(
        """UPDATE users SET
           aws_access_key_enc=?, aws_secret_key_enc=?, aws_region=?,
           bedrock_role_arn_enc=?, s3_training_bucket=?,
           google_client_email_enc=?, google_private_key_enc=?,
           google_project_id=?, google_drive_folder_id=?,
           lambda_url=?, lambda_api_key_enc=?,
           updated_at=datetime('now')
           WHERE id=?""",
        (
            encrypt_value(aws_access_key) if aws_access_key else "",
            encrypt_value(aws_secret_key) if aws_secret_key else "",
            aws_region,
            encrypt_value(bedrock_role_arn) if bedrock_role_arn else "",
            s3_training_bucket,
            encrypt_value(google_client_email) if google_client_email else "",
            encrypt_value(google_private_key) if google_private_key else "",
            google_project_id,
            google_drive_folder_id,
            lambda_url,
            encrypt_value(lambda_api_key) if lambda_api_key else "",
            user_id
        )
    )
    conn.commit()
    conn.close()

    # Also update environment variables for the current session
    if aws_access_key:
        os.environ["AWS_ACCESS_KEY_ID"] = aws_access_key
    if aws_secret_key:
        os.environ["AWS_SECRET_ACCESS_KEY"] = aws_secret_key
    if aws_region:
        os.environ["AWS_REGION"] = aws_region

    return True


def get_user_aws_credentials_by_id(user_id: int) -> Dict[str, str]:
    """Get decrypted AWS credentials for pipeline use, looked up by numeric user ID."""
    user = get_user_by_id_decrypted(user_id)
    if not user:
        return {"aws_access_key": "", "aws_secret_key": "", "aws_region": "us-east-1",
                "bedrock_role_arn": "", "s3_training_bucket": "cryptedu-training-data",
                "lambda_url": "", "lambda_api_key": ""}
    return {
        "aws_access_key": user.get("aws_access_key", ""),
        "aws_secret_key": user.get("aws_secret_key", ""),
        "aws_region": user.get("aws_region", "us-east-1"),
        "bedrock_role_arn": user.get("bedrock_role_arn", ""),
        "s3_training_bucket": user.get("s3_training_bucket", "cryptedu-training-data"),
        "lambda_url": user.get("lambda_url", ""),
        "lambda_api_key": user.get("lambda_api_key", ""),
    }


# ── End-User Accounts ────────────────────────────────────

def bulk_create_end_users(accounts: list, created_by: int) -> dict:
    """Create multiple end-user accounts. Returns {created, skipped, errors}."""
    import bcrypt
    conn = get_conn()
    created = 0
    skipped = 0
    errors = []
    for acc in accounts:
        username = acc.get("username", "").strip()
        password = acc.get("password", "").strip()
        if not username or not password:
            errors.append(f"Empty username or password skipped")
            continue
        try:
            pwd_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            conn.execute(
                "INSERT INTO end_user_accounts (username, password_hash, created_by) VALUES (?, ?, ?)",
                (username, pwd_hash, created_by)
            )
            created += 1
        except sqlite3.IntegrityError:
            skipped += 1
        except Exception as e:
            errors.append(str(e))
    conn.commit()
    conn.close()
    return {"created": created, "skipped": skipped, "errors": errors}


def get_end_user_by_username(username: str) -> Optional[Dict]:
    """Get end-user account for login verification."""
    conn = get_conn()
    row = conn.execute("SELECT * FROM end_user_accounts WHERE username = ?", (username,)).fetchone()
    conn.close()
    return dict(row) if row else None


def list_end_users(limit: int = 100) -> List[Dict]:
    """List all end-user accounts (masked)."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, username, full_name, role, created_at FROM end_user_accounts ORDER BY created_at DESC LIMIT ?",
        (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# Initialize on import
init_db()
