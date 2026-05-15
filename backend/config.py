"""
Backend Configuration — CryptEdu Sovereign Learning Mesh
"""
import os
import hashlib

# ── Whisper / Ollama toggles ────────────────────────────────
WHISPER_ENABLED = os.getenv("CRYPTEDU_WHISPER", "true").lower() == "true"
OLLAMA_ENABLED = os.getenv("CRYPTEDU_OLLAMA", "true").lower() == "true"

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma2:2b")
OLLAMA_FINETUNED_MODEL = os.getenv("OLLAMA_FINETUNED", "cryptedu:latest")

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")

# ── Database ────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DB_PATH = os.path.join(DATA_DIR, "cryptedu.db")

# ── Supabase (optional cloud sync) ──────────────────────────
SUPABASE_ENABLED = os.getenv("CRYPTEDU_SUPABASE", "false").lower() == "true"
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# ── AWS Bedrock ─────────────────────────────────────────────
BEDROCK_ENABLED = os.getenv("CRYPTEDU_BEDROCK", "true").lower() == "true"
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
BEDROCK_BASE_MODEL = os.getenv("BEDROCK_BASE_MODEL", "amazon.titan-text-express-v1")

# ── Encryption ──────────────────────────────────────────────
# Derive a stable Fernet key from a machine-specific secret.
# In production, use a proper KMS. For local-first, this is acceptable.
_SECRET_SEED = os.getenv("CRYPTEDU_SECRET", "cryptedu-sovereign-mesh-2024")
ENCRYPTION_KEY = hashlib.sha256(_SECRET_SEED.encode()).digest()  # 32 bytes for Fernet-compatible key (will be base64-encoded in use)

# ── Hub Cost Defaults (MYR) ─────────────────────────────────
HUB_COST = {
    "master": {
        "hardware": 1830,
        "installation": 300,
        "antenna": 350,
        "annual_maintenance": 200,
    },
    "child": {
        "hardware": 580,
        "installation": 200,
        "antenna": 250,
        "annual_maintenance": 100,
    },
}

# ── Hub Capacity Limits ─────────────────────────────────────
HUB_CAPACITY = {
    "sub_hub": {
        "web_text_smooth": 30,
        "web_text_max": 50,
        "video_720p_smooth": 12,
        "video_720p_max": 18,
    },
    "master_hub": {
        "active_sub_hubs_smooth": 8,
        "active_sub_hubs_max": 15,
        "ai_interaction_smooth": 1,
        "ai_interaction_max": 30,
    },
    "students_per_hub_ratio": 40,  # 1 hub per 40 students
    "optimal_spacing_km": 3.5,     # midpoint of 2-5km range
    "min_spacing_km": 2.0,
    "max_spacing_km": 5.0,
}

# ── Real-World Data API Endpoints ───────────────────────────
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OPENTOPODATA_URL = "https://api.opentopodata.org/v1/srtm30m"

# ── Hub Placement Intelligence Parameters ───────────────────
TOWER_COVERAGE_RADIUS_KM = 3.0       # Each cell tower covers ~3km radius (rural)
COVERAGE_THRESHOLD_PCT = 90           # Above this % → area already connected → 0 hubs
MAX_HABITABLE_ELEVATION_M = 1500      # Above this → terrain-unsuitable
STEEP_SLOPE_THRESHOLD_M = 500         # Elevation diff between adjacent samples
MASTER_HUB_RADIUS_KM = 50.0          # One master hub covers 50km radius

# ── School Student Count Estimates (when OSM has no capacity tag) ──
DEFAULT_STUDENTS_PRIMARY = 200        # SK / primary school
DEFAULT_STUDENTS_SECONDARY = 500      # SMK / secondary school
DEFAULT_STUDENTS_UNKNOWN = 200        # Fallback when school type unknown

# ── Demographic Fallback (when OSM has no school data) ──────
FALLBACK_POPULATION_DENSITY_PER_KM2 = 22   # Rural average (global)
FALLBACK_STUDENT_RATIO = 0.27               # Age 7-21 as % of population
FALLBACK_EXISTING_COVERAGE_FILTER = 0.35    # Assume 35% already has connectivity
FALLBACK_TERRAIN_PENALTY = 0.15             # Assume 15% is terrain-unsuitable
