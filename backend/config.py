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
DB_PATH = os.getenv("DB_PATH", os.path.join(DATA_DIR, "cryptedu.db"))

# ── Supabase (optional cloud sync) ──────────────────────────
SUPABASE_ENABLED = os.getenv("CRYPTEDU_SUPABASE", "false").lower() == "true"
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# ── AWS Cognito (Admin_App identity) ────────────────────────
# Spec task 2.1 — verify_cognito_id_token verifies admin ID tokens issued by
# this User Pool. Region/Pool/App Client are read from environment variables
# in production and fall back to the values baked into
# ``frontend/src/aws-config.ts`` so a fresh local checkout works without
# additional configuration. The User Pool ID format is "<region>_<suffix>",
# so an explicit COGNITO_REGION override is supported but unnecessary.
COGNITO_USER_POOL_ID = os.getenv(
    "COGNITO_USER_POOL_ID", "ap-southeast-5_KI27lU59V"
)
COGNITO_APP_CLIENT_ID = os.getenv(
    "COGNITO_APP_CLIENT_ID", "3igvjqrogfepkabl711u2tog3t"
)
# Derive the region from the User Pool ID prefix (everything before the
# first underscore) when COGNITO_REGION is not explicitly set, so that an
# operator who only configures COGNITO_USER_POOL_ID still gets a coherent
# JWKS URL and `iss` claim.
COGNITO_REGION = os.getenv(
    "COGNITO_REGION",
    COGNITO_USER_POOL_ID.split("_", 1)[0] if "_" in COGNITO_USER_POOL_ID else "",
)

# ── AWS Bedrock ─────────────────────────────────────────────
# Spec task 1.3 — AWS credentials are loaded per-request from the encrypted
# columns of the calling admin's `users` row via
# `engines.database.get_user_aws_credentials_by_id`. The previous global
# `AWS_REGION` / `AWS_ACCESS_KEY` / `AWS_SECRET_KEY` constants read from
# `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` environment
# variables and were a violation of Requirement 1.11 / Property 6 (a single
# admin's keys would be visible to every other admin on the same process).
# They are intentionally removed; do not re-introduce them.
BEDROCK_ENABLED = os.getenv("CRYPTEDU_BEDROCK", "true").lower() == "true"
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
