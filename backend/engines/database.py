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

# ── Fernet key fallback gate disabled per request ─────────────────────────
# Fernet encryption has been completely removed from the program.
# We no longer require the CRYPTEDU_SECRET environment variable to boot.


def encrypt_value(plaintext: str) -> str:
    """Encryption disabled per user request."""
    if not plaintext:
        return ""
    logger.warning("Encryption disabled. Returning plaintext.")
    return plaintext


def decrypt_value(ciphertext: str) -> str:
    """Decryption disabled per user request."""
    if not ciphertext:
        return ""
    logger.warning("Decryption disabled. Returning plaintext.")
    return ciphertext


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

    # Seed test@admin.edu.my user
    test_admin_existing = conn.execute("SELECT id FROM users WHERE username = ?", ("test@admin.edu.my",)).fetchone()
    if not test_admin_existing:
        import bcrypt
        test_pwd_hash = bcrypt.hashpw(b"Test123###", bcrypt.gensalt()).decode('utf-8')
        conn.execute(
            """INSERT INTO users (username, password_hash, full_name, role, government_id)
               VALUES (?, ?, ?, ?, ?)""",
            ("test@admin.edu.my", test_pwd_hash, "Test Admin", "Regional Moderator", "")
        )
        conn.commit()
        logger.info("test@admin.edu.my user created.")

    # Seed student end user
    test_student_existing = conn.execute("SELECT id FROM end_user_accounts WHERE username = ?", ("student",)).fetchone()
    if not test_student_existing:
        import bcrypt
        student_pwd_hash = bcrypt.hashpw(b"123456", bcrypt.gensalt()).decode('utf-8')
        conn.execute(
            """INSERT INTO end_user_accounts (username, password_hash, full_name, role)
               VALUES (?, ?, ?, ?)""",
            ("student", student_pwd_hash, "Test Student", "student")
        )
        conn.commit()
        logger.info("student end-user created.")
        
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

    # Spec task 1.1 — Per-admin Google Drive subfolder IDs (Requirements 4.2, 4.7).
    # Idempotent: PRAGMA table_info is the source of truth for column existence,
    # so re-running init_db() on an already-migrated DB is a no-op.
    existing_user_cols = {
        row["name"] for row in conn.execute("PRAGMA table_info(users)").fetchall()
    }
    for col in ("textbooks_folder_id", "exam_questions_folder_id", "exam_answers_folder_id"):
        if col not in existing_user_cols:
            conn.execute(f"ALTER TABLE users ADD COLUMN {col} TEXT DEFAULT ''")

    # Spec task 6.4 — opt-in Lambda proxy toggle (default false).
    # Lambda path is reachable only when this is explicitly set to 1.
    if "use_lambda_proxy" not in existing_user_cols:
        conn.execute("ALTER TABLE users ADD COLUMN use_lambda_proxy INTEGER DEFAULT 0")
    conn.commit()

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

    # Spec task 1.1 — Per-end-user persistent state and chat history (Requirement 1.10).
    # Both tables FK to end_user_accounts(id) so they sit after that table is created.
    # CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS make this idempotent.
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS end_user_state (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            end_user_id INTEGER NOT NULL,
            state_key TEXT NOT NULL,
            state_value TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now')),
            UNIQUE(end_user_id, state_key),
            FOREIGN KEY (end_user_id) REFERENCES end_user_accounts(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS end_user_chat (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            end_user_id INTEGER NOT NULL,
            video_key TEXT NOT NULL,
            role TEXT NOT NULL,
            text TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (end_user_id) REFERENCES end_user_accounts(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_chat_user_video
            ON end_user_chat(end_user_id, video_key, id);
    """)
    conn.commit()

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

    # Spec task 1.3 — Do NOT mutate os.environ here. The previous implementation
    # leaked the most-recently-saved admin's AWS keys to every other admin on
    # the same backend process (Requirement 1.11 / Property 6 violation).
    # Credentials live only in the encrypted columns; pipeline code loads them
    # per-request via get_user_aws_credentials_by_id().
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
    lambda_api_key: str = "",
    use_lambda_proxy: bool = False,
    textbooks_folder_id: str = "",
    exam_questions_folder_id: str = "",
    exam_answers_folder_id: str = "",
) -> bool:
    """Update AWS/Google/Lambda credentials by numeric user ID — encrypts before storage."""
    # Fetch existing to avoid overwriting with empty strings
    existing = get_user_by_id_decrypted(user_id) or {}
    
    aws_access_key = aws_access_key if aws_access_key else existing.get("aws_access_key", "")
    aws_secret_key = aws_secret_key if aws_secret_key else existing.get("aws_secret_key", "")
    aws_region = aws_region if aws_region else existing.get("aws_region", "us-east-1")
    bedrock_role_arn = bedrock_role_arn if bedrock_role_arn else existing.get("bedrock_role_arn", "")
    s3_training_bucket = s3_training_bucket if s3_training_bucket else existing.get("s3_training_bucket", "cryptedu-training-data")
    google_client_email = google_client_email if google_client_email else existing.get("google_client_email", "")
    google_private_key = google_private_key if google_private_key else existing.get("google_private_key", "")
    google_project_id = google_project_id if google_project_id else existing.get("google_project_id", "")
    google_drive_folder_id = google_drive_folder_id if google_drive_folder_id else existing.get("google_drive_folder_id", "")
    lambda_url = lambda_url if lambda_url else existing.get("lambda_url", "")
    lambda_api_key = lambda_api_key if lambda_api_key else existing.get("lambda_api_key", "")
    textbooks_folder_id = textbooks_folder_id if textbooks_folder_id else existing.get("textbooks_folder_id", "")
    exam_questions_folder_id = exam_questions_folder_id if exam_questions_folder_id else existing.get("exam_questions_folder_id", "")
    exam_answers_folder_id = exam_answers_folder_id if exam_answers_folder_id else existing.get("exam_answers_folder_id", "")

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
           use_lambda_proxy=?,
           textbooks_folder_id=?, exam_questions_folder_id=?, exam_answers_folder_id=?,
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
            1 if use_lambda_proxy else 0,
            textbooks_folder_id,
            exam_questions_folder_id,
            exam_answers_folder_id,
            user_id
        )
    )
    conn.commit()
    conn.close()

    # Spec task 1.3 — Do NOT mutate os.environ here. The previous implementation
    # leaked the most-recently-saved admin's AWS keys to every other admin on
    # the same backend process (Requirement 1.11 / Property 6 violation).
    # Credentials live only in the encrypted columns; pipeline code loads them
    # per-request via get_user_aws_credentials_by_id().
    return True


def get_user_aws_credentials_by_id(user_id: int) -> Dict[str, str]:
    """Get decrypted AWS credentials for pipeline use, looked up by numeric user ID."""
    user = get_user_by_id_decrypted(user_id)
    if not user:
        return {"aws_access_key": "", "aws_secret_key": "", "aws_region": "us-east-1",
                "bedrock_role_arn": "", "s3_training_bucket": "cryptedu-training-data",
                "lambda_url": "", "lambda_api_key": "", "use_lambda_proxy": False}
    return {
        "aws_access_key": user.get("aws_access_key", ""),
        "aws_secret_key": user.get("aws_secret_key", ""),
        "aws_region": user.get("aws_region", "us-east-1"),
        "bedrock_role_arn": user.get("bedrock_role_arn", ""),
        "s3_training_bucket": user.get("s3_training_bucket", "cryptedu-training-data"),
        "lambda_url": user.get("lambda_url", ""),
        "lambda_api_key": user.get("lambda_api_key", ""),
        "use_lambda_proxy": bool(user.get("use_lambda_proxy", 0)),
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


# ─────────────────────────────────────────────────────────────────────────────
# Per-end-user persistent state and chat history
# (spec task 2.13 — Requirement 1.10)
# ─────────────────────────────────────────────────────────────────────────────
#
# Requirement 1.10 binds every end-user cache, storage, and history record to
# the owning ``end_user_accounts.id`` so that two browsers / devices logged
# into the same account observe one consistent view, while two different
# accounts cannot see each other's state.
#
# All four helpers below take ``end_user_id`` as their first positional
# argument and use it as the *only* filter on every query. The caller
# resolves ``end_user_id`` from the session cookie via
# ``get_current_end_user_id`` (spec task 2.10 / 2.14) — never from the
# request body — so a hostile client cannot read or write under another
# user's id by sending it on the wire.


def save_end_user_state(end_user_id: int, key: str, value_json: str) -> None:
    """
    Upsert one ``(state_key, state_value)`` pair for the given end-user.

    The ``end_user_state`` table is keyed by ``UNIQUE(end_user_id,
    state_key)`` (see ``init_db``); when a row already exists for that
    composite key, ``ON CONFLICT`` rewrites ``state_value`` and bumps
    ``updated_at`` to the current UTC second. New ``state_key`` values
    insert fresh rows. Either way the post-condition is the single
    canonical row for ``(end_user_id, state_key)`` carrying ``value_json``.

    ``value_json`` is stored verbatim — the column is ``TEXT`` and the
    layer above this function is responsible for serialising the user
    payload (chat history blobs, progress markers, quiz results) into
    valid JSON. The DB does not parse or validate the JSON; it is opaque
    to SQLite, which lets the upsert stay one statement and parameterised
    end-to-end.

    Validates Requirement 1.10 (per-account isolation: only the supplied
    ``end_user_id`` is touched) and complements
    ``load_end_user_state`` / ``append_end_user_chat`` /
    ``list_end_user_chat`` (spec task 2.13).
    """
    conn = get_conn()
    try:
        conn.execute(
            """
            INSERT INTO end_user_state (end_user_id, state_key, state_value)
            VALUES (?, ?, ?)
            ON CONFLICT(end_user_id, state_key) DO UPDATE SET
                state_value = excluded.state_value,
                updated_at  = datetime('now')
            """,
            (end_user_id, key, value_json),
        )
        conn.commit()
    finally:
        conn.close()


def load_end_user_state(end_user_id: int) -> Dict[str, str]:
    """
    Return every ``state_key → state_value`` pair owned by ``end_user_id``.

    The query filters on ``end_user_id`` alone — Requirement 1.10's
    per-account isolation invariant — and returns a plain dict keyed by
    ``state_key``. The composite uniqueness constraint
    ``UNIQUE(end_user_id, state_key)`` guarantees one row per key, so the
    dict construction below cannot lose data to silent overwrites.

    Returns an empty dict when the user has no rows yet (e.g. first
    login, or after a seed wipe). The caller is responsible for parsing
    the JSON-shaped ``state_value`` strings if it needs structured access.
    """
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT state_key, state_value FROM end_user_state WHERE end_user_id = ?",
            (end_user_id,),
        ).fetchall()
    finally:
        conn.close()
    # ``Row`` row factory makes ``row['state_key']`` work; the dict
    # constructor below pins the {key: value} contract Requirement 1.10
    # describes ("state synchronizes across sessions and devices").
    return {row["state_key"]: row["state_value"] for row in rows}


def append_end_user_chat(
    end_user_id: int, video_key: str, role: str, text: str
) -> None:
    """
    Insert one chat turn for ``(end_user_id, video_key)``.

    Chat history is append-only: every student message and every Local
    AI Tutor reply is its own row, ordered by the autoincrementing ``id``
    column (which is monotonic per SQLite per connection — sufficient for
    "chronological order" as Requirement 1.10 uses the term). The
    ``created_at`` column carries the wall-clock time as a secondary
    debug aid; the ordering contract for ``list_end_user_chat`` rests on
    ``id`` alone so two messages inserted in the same UTC second still
    sort deterministically.

    The ``role`` column is intentionally a free-form ``TEXT`` here so the
    persistence layer is not coupled to the exact set of roles the route
    layer accepts (currently ``"student"`` and ``"tutor"``); the route
    handler in spec task 2.14 enforces the allow-list before calling in.
    """
    conn = get_conn()
    try:
        conn.execute(
            """
            INSERT INTO end_user_chat (end_user_id, video_key, role, text)
            VALUES (?, ?, ?, ?)
            """,
            (end_user_id, video_key, role, text),
        )
        conn.commit()
    finally:
        conn.close()


def list_end_user_chat(
    end_user_id: int, video_key: str, limit: int = 50
) -> List[Dict]:
    """
    Return the most recent ``limit`` chat turns for
    ``(end_user_id, video_key)`` in chronological order.

    Implementation: pick the newest ``limit`` rows with
    ``ORDER BY id DESC LIMIT ?`` (this is what the
    ``idx_chat_user_video(end_user_id, video_key, id)`` index is built
    for — the planner walks the index backwards and stops after
    ``limit`` rows without scanning the full table), then re-sort the
    page ascending so the caller receives them oldest-first. This gives
    the UI the right shape: render top-to-bottom and you see the
    conversation in the order it happened, but never more than the most
    recent ``limit`` turns.

    Returns a list of dicts (one per row) preserving every column from
    ``end_user_chat`` so the caller can show timestamps as well as
    role/text. An empty list comes back when the user has no history for
    this video, which is the natural first-visit state.
    """
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT id, end_user_id, video_key, role, text, created_at
              FROM end_user_chat
             WHERE end_user_id = ? AND video_key = ?
             ORDER BY id DESC
             LIMIT ?
            """,
            (end_user_id, video_key, limit),
        ).fetchall()
    finally:
        conn.close()
    # ``rows`` is newest-first because of ``ORDER BY id DESC``; reverse
    # so the returned list reads chronologically (oldest first), matching
    # how a chat transcript is rendered.
    return [dict(r) for r in reversed(rows)]


# ─────────────────────────────────────────────────────────────────────────────
# Deterministic seeding (spec task 2.7 — Requirements 1.3, 1.4)
# ─────────────────────────────────────────────────────────────────────────────
#
# ``seed_users`` enforces the post-seed invariant from Requirement 1.4:
# *exactly one* JWT_User with username ``roshi`` / password ``123456`` and
# *exactly one* Cognito_User with username
# ``cryptedu-admin@school.edu.my`` / password ``cryptedu123##``. To make
# that invariant true regardless of prior state, the routine wipes every
# identity store first (Requirement 1.3) and then re-inserts the two seed
# accounts.
#
# Order of operations is deliberate:
#
#   1. ``end_user_chat`` and ``end_user_state`` are deleted before
#      ``end_user_accounts`` so the foreign-key cascade is not relied on
#      (the schema declares ``ON DELETE CASCADE`` but PRAGMA
#      ``foreign_keys`` is per-connection and a future schema change
#      could drop the cascade — explicit deletes keep this routine
#      independent of either).
#   2. ``end_user_accounts`` is deleted before any insert so re-running
#      seed never produces a duplicate ``roshi`` account.
#   3. ``user_actions`` is deleted before ``users`` so the
#      ``user_actions.user_id → users.id`` foreign key is never a
#      blocker.
#   4. ``users`` is deleted last in the SQLite phase. After this point
#      the local credential-vault store is empty.
#   5. Cognito users are listed via ``list_users`` (paginated — every
#      page must be exhausted before the next stage; otherwise leftover
#      users would survive the wipe and re-running seed would not
#      converge to the same final state). Each user is deleted via
#      ``admin_delete_user``. Per-user delete failures are logged but do
#      not abort the wipe — Requirement 1.3 says "every existing
#      Cognito_User", not "abort on the first stuck user", and a single
#      stuck account must not block reseed of an entire pool.
#   6. The seed admin is created via ``admin_create_user`` with
#      ``MessageAction='SUPPRESS'`` (no welcome email — this is a
#      deterministic seed, not a real onboarding) followed by
#      ``admin_set_user_password`` with ``Permanent=True`` so the password
#      ``cryptedu123##`` is usable immediately without the
#      FORCE_CHANGE_PASSWORD step Cognito otherwise injects.
#   7. The matching ``users`` row is inserted last so the credential
#      vault exists before any subsequent ``/api/auth/cognito-exchange``
#      call (spec task 2.3) tries to load it.
#   8. The seed end-user is inserted into ``end_user_accounts`` with the
#      bcrypt hash of ``123456``.
#
# Idempotence (Requirement 1.3 + 1.4): every step uses an unconditional
# DELETE / list-and-delete / fresh INSERT. There are no
# ``INSERT OR IGNORE`` short-circuits in the seed path, so re-running
# yields the same final state regardless of what was there before. The
# Cognito ``admin_create_user`` call is preceded by the wipe loop, so the
# pool is empty when it runs and cannot collide with a leftover user.
#
# Error policy:
#   * Cognito wipe per-user failures: caught and logged, continue.
#   * Cognito wipe page-listing failure: propagates (we cannot guarantee
#     the wipe is complete and must not silently skip seeding).
#   * Cognito seed-create / set-password failures: propagate. The seed
#     admin is the contract Requirement 1.4 establishes; if Cognito
#     refuses to create it, the caller must see the failure.
#   * SQLite seed insert failures: propagate (same reason).
#
# Caller contract: ``cognito_client`` is a boto3 ``cognito-idp`` client
# constructed by the caller with appropriate AWS credentials. The
# function does not construct or fall back to global AWS env vars
# (Requirement 1.11 / Property 6 — credentials must always come from the
# caller, never from process state).

# Seed identity values are pinned by Requirement 1.4. Centralised here so
# the seed routine and any future verification helper share one source of
# truth.
SEED_ADMIN_USERNAME = "cryptedu-admin@school.edu.my"
SEED_ADMIN_PASSWORD = "cryptedu123##"
SEED_END_USER_USERNAME = "roshi"
SEED_END_USER_PASSWORD = "123456"


def seed_users(cognito_client) -> None:
    """
    Wipe every identity store, then create exactly the two seed accounts.

    Steps (executed in order):

    1. ``DELETE FROM end_user_chat``
    2. ``DELETE FROM end_user_state``
    3. ``DELETE FROM end_user_accounts``
    4. ``DELETE FROM user_actions``
    5. ``DELETE FROM users``
    6. For every Cognito user listed (paginated) under
       ``COGNITO_USER_POOL_ID``: ``admin_delete_user``. Per-user
       failures are logged and do not abort the wipe.
    7. ``cognito_client.admin_create_user`` for ``SEED_ADMIN_USERNAME``
       with ``MessageAction='SUPPRESS'``, then
       ``admin_set_user_password`` with ``Permanent=True`` and
       ``SEED_ADMIN_PASSWORD``.
    8. ``INSERT INTO users`` for ``SEED_ADMIN_USERNAME`` with the bcrypt
       hash of ``SEED_ADMIN_PASSWORD`` (and the same default profile
       fields the migration in ``init_db`` uses for its empty-row
       default).
    9. ``INSERT INTO end_user_accounts`` for ``SEED_END_USER_USERNAME``
       with the bcrypt hash of ``SEED_END_USER_PASSWORD``.

    Idempotent: re-running yields the same final state. There are no
    conditional inserts; every run starts from an empty store.

    Parameters
    ----------
    cognito_client : boto3.client('cognito-idp')
        The caller is responsible for constructing this client with
        AWS credentials authorised to ``ListUsers``, ``AdminDeleteUser``,
        ``AdminCreateUser``, and ``AdminSetUserPassword`` against
        ``COGNITO_USER_POOL_ID``. The function does not fall back to
        global AWS environment variables (Requirement 1.11).

    Raises
    ------
    Exception
        Any seed-stage insert or Cognito create/set-password failure
        propagates so the caller can surface it. Cognito wipe per-user
        failures are caught and logged; they do not abort the routine.
    """
    import bcrypt
    from config import COGNITO_USER_POOL_ID

    # ── Stage 1: wipe SQLite identity stores ────────────────────────────
    # Use a single transaction so a mid-wipe crash leaves the DB in a
    # consistent state (either every table is wiped or none is). The
    # foreign-key dependents (``end_user_chat``, ``end_user_state``,
    # ``user_actions``) are deleted first explicitly so the FK chain is
    # never the reason for a failure.
    conn = get_conn()
    try:
        conn.execute("DELETE FROM end_user_chat")
        conn.execute("DELETE FROM end_user_state")
        conn.execute("DELETE FROM end_user_accounts")
        conn.execute("DELETE FROM user_actions")
        conn.execute("DELETE FROM users")
        conn.commit()
    finally:
        conn.close()

    # ── Stage 2: wipe the Cognito User Pool ─────────────────────────────
    # ``list_users`` is paginated. We follow the ``PaginationToken`` until
    # it is absent, deleting every returned user. Per-user delete errors
    # are logged but do not abort the loop — see Error policy in the
    # module docstring above.
    pagination_token: Optional[str] = None
    while True:
        list_kwargs: Dict[str, Any] = {"UserPoolId": COGNITO_USER_POOL_ID}
        if pagination_token:
            list_kwargs["PaginationToken"] = pagination_token

        # A page-listing failure is fatal: if we cannot enumerate the pool
        # we cannot guarantee the wipe is complete, and Requirement 1.3
        # says "every existing Cognito_User" must be removed before any
        # seed insert.
        page = cognito_client.list_users(**list_kwargs)

        for user in page.get("Users", []):
            username = user.get("Username")
            if not username:
                continue
            try:
                cognito_client.admin_delete_user(
                    UserPoolId=COGNITO_USER_POOL_ID,
                    Username=username,
                )
            except Exception as exc:
                # One stuck user must not block reseed of the rest of the
                # pool. Log and continue.
                logger.warning(
                    "seed_users: failed to delete Cognito user %s: %s",
                    username,
                    exc,
                )

        pagination_token = page.get("PaginationToken")
        if not pagination_token:
            break

    # ── Stage 3: create the seed Cognito admin ──────────────────────────
    # ``MessageAction='SUPPRESS'`` skips the Cognito-generated welcome
    # email — this is a deterministic seed, not a real onboarding.
    # ``admin_set_user_password`` with ``Permanent=True`` immediately
    # promotes the password out of the FORCE_CHANGE_PASSWORD state so the
    # admin can sign in with ``SEED_ADMIN_PASSWORD`` on the very next
    # request. Failures here propagate (the seed contract is broken if
    # the admin is not created).
    cognito_client.admin_create_user(
        UserPoolId=COGNITO_USER_POOL_ID,
        Username=SEED_ADMIN_USERNAME,
        UserAttributes=[
            {"Name": "email", "Value": SEED_ADMIN_USERNAME},
            {"Name": "email_verified", "Value": "true"},
        ],
        MessageAction="SUPPRESS",
    )
    cognito_client.admin_set_user_password(
        UserPoolId=COGNITO_USER_POOL_ID,
        Username=SEED_ADMIN_USERNAME,
        Password=SEED_ADMIN_PASSWORD,
        Permanent=True,
    )

    # ── Stage 4: insert the matching SQLite seed rows ───────────────────
    # The credential-vault row in ``users`` is keyed by the same email as
    # the Cognito user (Requirement 1.13), so a subsequent
    # ``/api/auth/cognito-exchange`` (spec task 2.3) finds the row that
    # ``ensure_admin_row`` would otherwise lazily create. The
    # ``password_hash`` column stores the bcrypt hash of
    # ``SEED_ADMIN_PASSWORD`` so the row is also a complete
    # password-based credential — useful for tooling that bypasses
    # Cognito (e.g. local dev without Internet access).
    admin_pwd_hash = bcrypt.hashpw(
        SEED_ADMIN_PASSWORD.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")
    end_user_pwd_hash = bcrypt.hashpw(
        SEED_END_USER_PASSWORD.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    conn = get_conn()
    try:
        conn.execute(
            """
            INSERT INTO users
                (username, password_hash, full_name, role, government_id)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                SEED_ADMIN_USERNAME,
                admin_pwd_hash,
                SEED_ADMIN_USERNAME,
                "Regional Moderator",
                "",
            ),
        )
        conn.execute(
            """
            INSERT INTO end_user_accounts
                (username, password_hash, full_name, role)
            VALUES (?, ?, ?, ?)
            """,
            (
                SEED_END_USER_USERNAME,
                end_user_pwd_hash,
                SEED_END_USER_USERNAME.capitalize(),
                "student",
            ),
        )
        conn.commit()
    finally:
        conn.close()

    logger.info(
        "seed_users: reseeded identity stores; "
        "admin=%s end_user=%s",
        SEED_ADMIN_USERNAME,
        SEED_END_USER_USERNAME,
    )


# Initialize on import
init_db()
