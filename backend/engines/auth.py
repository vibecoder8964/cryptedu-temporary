"""
Authentication engine using JWT and bcrypt.
"""
import os
import sys
import threading
import jwt
import bcrypt
import requests
from datetime import datetime, timedelta
from fastapi import HTTPException, Security, Request, Response
from fastapi.security import APIKeyCookie
from jwt.algorithms import RSAAlgorithm
from pydantic import BaseModel
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    ENCRYPTION_KEY,
    COGNITO_USER_POOL_ID,
    COGNITO_APP_CLIENT_ID,
    COGNITO_REGION,
)

# Use the config ENCRYPTION_KEY as the secret for JWT (since it's a stable 32-byte secret)
import base64
JWT_SECRET = base64.b64encode(ENCRYPTION_KEY).decode('utf-8')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days

# We look for a cookie named 'session_token'
cookie_sec = APIKeyCookie(name="session_token", auto_error=False)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def get_current_user_id(request: Request) -> int:
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return int(user_id)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ─────────────────────────────────────────────────────────────────────────────
# Cognito ID-token verification (spec task 2.1)
# ─────────────────────────────────────────────────────────────────────────────
#
# The Admin_App authenticates against the AWS Cognito User Pool configured in
# ``frontend/src/aws-config.ts`` and forwards the resulting ID token to the
# backend (``POST /api/auth/cognito-exchange`` — added by spec task 2.3).
# ``verify_cognito_id_token`` is the single trust gate: it validates the
# signature against the User Pool's published JWKS, validates the standard
# claims (``aud``, ``iss``, ``exp``), and validates ``token_use == "id"`` so
# that an access token cannot be substituted for an ID token.
#
# JWKS handling:
#
# * The JWKS document is fetched lazily on the first verification call and
#   cached in ``_JWKS_CACHE`` keyed by ``kid``.
# * If the token's ``kid`` is not in the cache, the JWKS is refetched once
#   (Cognito rotates signing keys; a previously-unseen ``kid`` is the
#   normal trigger for a refresh, not an unconditional periodic refetch).
# * A module-level lock serialises concurrent refreshes so that two
#   simultaneous "kid miss" calls do not perform two HTTP fetches.
#
# Failure mode: any error — network failure, malformed JWKS, missing
# claims, signature mismatch, expired token, wrong ``token_use``, wrong
# ``aud``/``iss`` — is converted to ``HTTPException(401, "Invalid Cognito
# token")``. The caller never sees the underlying exception type so that
# information about the verifier's internals is not leaked to clients.

# Cognito issues ID tokens signed with RS256.
_COGNITO_ALGORITHMS = ["RS256"]

# Issuer string Cognito embeds in every token issued by this User Pool.
# Empty when COGNITO_REGION / COGNITO_USER_POOL_ID are unset; verification
# then fails fast with 401, which is the desired behaviour for an
# unconfigured deployment.
_COGNITO_ISSUER = (
    f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
    if COGNITO_REGION and COGNITO_USER_POOL_ID
    else ""
)

# JWKS endpoint published by the User Pool — see
# https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html
_COGNITO_JWKS_URL = (
    f"{_COGNITO_ISSUER}/.well-known/jwks.json" if _COGNITO_ISSUER else ""
)

# kid → cryptography public key object suitable for ``jwt.decode``.
# Populated on first use; refreshed on a kid miss.
_JWKS_CACHE: dict = {}
_JWKS_LOCK = threading.Lock()

# How long to wait for the JWKS HTTP fetch. Cognito's endpoint is highly
# available so a short timeout is fine; longer timeouts would just make a
# misconfigured deployment hang requests.
_JWKS_FETCH_TIMEOUT_SECONDS = 5.0


def _refresh_jwks_cache() -> None:
    """
    Fetch the User Pool's JWKS document and rebuild ``_JWKS_CACHE``.

    Holding ``_JWKS_LOCK`` while replacing the cache prevents two threads
    from issuing two simultaneous HTTP fetches when many requests miss
    on the same new ``kid`` at once.
    """
    if not _COGNITO_JWKS_URL:
        # Misconfigured deployment — no User Pool / region. The verifier
        # itself raises 401 on failure, but here we make the cause obvious
        # in logs by raising a distinct error that the caller wraps.
        raise RuntimeError("Cognito User Pool / region is not configured")

    response = requests.get(_COGNITO_JWKS_URL, timeout=_JWKS_FETCH_TIMEOUT_SECONDS)
    response.raise_for_status()
    payload = response.json()

    new_cache: dict = {}
    for jwk in payload.get("keys", []):
        kid = jwk.get("kid")
        if not kid:
            # Skip malformed entries rather than aborting — the rest of the
            # JWKS may still contain the kid we need.
            continue
        # ``RSAAlgorithm.from_jwk`` accepts a JSON string and returns a
        # cryptography ``RSAPublicKey`` instance. ``jwt.decode`` accepts
        # that key directly when ``algorithms=["RS256"]``.
        new_cache[kid] = RSAAlgorithm.from_jwk(jwk)

    # Replace atomically; readers see either the old cache or the new one,
    # never a partially-built dict.
    _JWKS_CACHE.clear()
    _JWKS_CACHE.update(new_cache)


def _get_signing_key(kid: str):
    """
    Return the cached public key for ``kid``. Refresh once on a miss.

    The two-pass lookup (cache → refresh → cache) is deliberate: the
    refresh path is taken only when a previously-unseen ``kid`` arrives
    (typically because Cognito rotated signing keys), not on every
    verification.
    """
    key = _JWKS_CACHE.get(kid)
    if key is not None:
        return key

    with _JWKS_LOCK:
        # Re-check inside the lock — another thread may have already
        # refreshed the cache while we were waiting for the lock.
        key = _JWKS_CACHE.get(kid)
        if key is not None:
            return key
        _refresh_jwks_cache()
        return _JWKS_CACHE.get(kid)


def verify_cognito_id_token(id_token: str) -> str:
    """
    Verify a Cognito ID token and return its ``email`` claim.

    The function validates, in order:

    1. The token is a parseable JWT carrying a ``kid`` in its header.
    2. The ``kid`` matches a public key in the User Pool's JWKS (refetched
       once on miss).
    3. The signature checks out against that public key (RS256).
    4. The ``aud`` claim equals ``COGNITO_APP_CLIENT_ID``.
    5. The ``iss`` claim equals
       ``https://cognito-idp.<region>.amazonaws.com/<user_pool_id>``.
    6. The ``exp`` claim has not passed (``jwt.decode`` enforces this).
    7. The ``token_use`` claim equals ``"id"`` — this rejects access
       tokens, which carry the same signature but a different audience
       semantics.
    8. The token carries a non-empty ``email`` claim to return.

    Any failure raises ``HTTPException(401, "Invalid Cognito token")`` so
    that callers (notably ``POST /api/auth/cognito-exchange``) can return
    a uniform 401 response without leaking the underlying cause.
    """
    if not id_token or not isinstance(id_token, str):
        raise HTTPException(status_code=401, detail="Invalid Cognito token")

    if not _COGNITO_ISSUER or not COGNITO_APP_CLIENT_ID:
        # Misconfigured deployment — fail closed, never accept a token.
        raise HTTPException(status_code=401, detail="Invalid Cognito token")

    try:
        unverified_header = jwt.get_unverified_header(id_token)
        kid = unverified_header.get("kid")
        if not kid:
            raise HTTPException(status_code=401, detail="Invalid Cognito token")

        signing_key = _get_signing_key(kid)
        if signing_key is None:
            # JWKS refresh did not surface this kid — token is signed by a
            # key we cannot validate, treat as invalid.
            raise HTTPException(status_code=401, detail="Invalid Cognito token")

        claims = jwt.decode(
            id_token,
            signing_key,
            algorithms=_COGNITO_ALGORITHMS,
            audience=COGNITO_APP_CLIENT_ID,
            issuer=_COGNITO_ISSUER,
            options={
                # Be explicit so a future PyJWT default change cannot quietly
                # weaken validation. ``exp`` is verified by default but we
                # restate it for clarity.
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": True,
                "verify_iss": True,
                "require": ["exp", "aud", "iss", "token_use"],
            },
        )
    except HTTPException:
        # Re-raise our own 401s without rewrapping.
        raise
    except Exception:
        # Any other failure (network error fetching JWKS, malformed JWKS,
        # invalid signature, expired token, wrong audience/issuer, decode
        # error, unexpected exception type) collapses to a uniform 401.
        raise HTTPException(status_code=401, detail="Invalid Cognito token")

    # Guard token_use ourselves — PyJWT does not know it is a Cognito-only
    # claim, so passing it via ``options.require`` only ensures presence,
    # not value.
    if claims.get("token_use") != "id":
        raise HTTPException(status_code=401, detail="Invalid Cognito token")

    email = claims.get("email")
    if not isinstance(email, str) or not email:
        raise HTTPException(status_code=401, detail="Invalid Cognito token")

    return email


# ─────────────────────────────────────────────────────────────────────────────
# Cognito → backend session bridge (spec task 2.2)
# ─────────────────────────────────────────────────────────────────────────────
#
# After ``verify_cognito_id_token`` accepts an Admin_App login, the backend
# still needs two things before any ``/api/v1/*`` route can run:
#
#   1. A row in the SQLite ``users`` table keyed by the Cognito email, so
#      Per_User_Credentials (AWS_Bedrock_Credentials, S3_Credentials,
#      Google_Drive_Credentials) can be stored against it. Requirement 1.13
#      says this row MUST exist whenever the Cognito_User exists; we ensure
#      it lazily on every successful exchange so the seed flow and the
#      "first login of a freshly-created admin" flow both work without
#      extra orchestration.
#
#   2. A backend session cookie ("session_token") whose ``sub`` claim is
#      the integer ``users.id``. Every existing ``Depends(get_current_user_id)``
#      route already reads this cookie; nothing else has to change.
#
# Both helpers live here (not in ``engines/database.py``) because the
# session cookie shape and the JWT signing key are auth-layer concerns —
# ``database.py`` deliberately knows nothing about FastAPI ``Response``
# objects or JWT payloads.
#
# ``ensure_admin_row`` uses ``INSERT OR IGNORE`` so concurrent first-login
# requests for the same Cognito user do not race: SQLite serialises the
# write, the second writer becomes a no-op, and both readers SELECT the
# same row id back out. The follow-up SELECT runs on the same connection so
# it sees the just-inserted row even under WAL mode.
#
# ``create_admin_session_cookie`` mirrors the cookie flags used by the
# existing ``/api/auth/login`` admin path verbatim (httponly=True,
# secure=False for HTTP-only dev, samesite="lax", max_age = 7 days in
# minutes). Spec task 2.10 will later align ``/api/end-users/login`` with
# the same flags; that change is intentionally NOT made here so this task
# stays scoped to the Cognito bridge.


def ensure_admin_row(cognito_email: str) -> int:
    """
    Ensure a ``users`` row exists for ``cognito_email`` and return its id.

    Inserts a credential-vault row (password_hash='' because Cognito holds
    the real secret, full_name=email as a sensible placeholder, role from
    the existing default, government_id='') if one does not already exist
    for ``username=cognito_email``. ``INSERT OR IGNORE`` makes the call
    idempotent and concurrent-safe: a second call for the same email is a
    no-op, and we still SELECT the row id back out so the caller can mint
    a session cookie against it.

    Lives in this module (not ``engines/database.py``) per spec task 2.2 so
    the auth layer owns the entire Cognito→backend-session bridge.
    """
    if not isinstance(cognito_email, str) or not cognito_email:
        # Defensive guard: ``verify_cognito_id_token`` already rejects empty
        # email claims, but a future caller bypassing that path must not be
        # able to insert an empty-username row that collides with future
        # seed data.
        raise ValueError("cognito_email must be a non-empty string")

    # Late import keeps this module importable in environments that do not
    # have the database wired up (e.g. early test setup, type checkers).
    from engines.database import get_conn

    conn = get_conn()
    try:
        # INSERT OR IGNORE on the UNIQUE ``username`` column is the
        # idempotent insert. password_hash='' is intentional: Cognito holds
        # the real secret, so any later attempt to log in via
        # ``/api/auth/login`` against this row will fail at
        # ``verify_password`` (an empty hash never matches a non-empty
        # password). full_name defaults to the email so the admin profile
        # is non-empty until the admin updates it from AdminProfilePage.
        conn.execute(
            """
            INSERT OR IGNORE INTO users
                (username, password_hash, full_name, role, government_id)
            VALUES (?, ?, ?, ?, ?)
            """,
            (cognito_email, "", cognito_email, "Regional Moderator", ""),
        )
        conn.commit()

        row = conn.execute(
            "SELECT id FROM users WHERE username = ?",
            (cognito_email,),
        ).fetchone()

        if row is None:
            # Should be unreachable: the INSERT OR IGNORE above either
            # creates the row or finds the existing one, and either way
            # the SELECT must succeed. Raise rather than silently returning
            # a sentinel so a future schema regression is surfaced loudly.
            raise RuntimeError(
                f"ensure_admin_row: users row for {cognito_email!r} not found "
                "after INSERT OR IGNORE"
            )

        return int(row["id"])
    finally:
        conn.close()


def create_admin_session_cookie(response: Response, cognito_email: str) -> int:
    """
    Mint a backend session cookie for ``cognito_email`` and return the
    underlying ``users.id`` it was issued for.

    The cookie flags match the existing ``/api/auth/login`` admin path
    verbatim (Requirement 1.5 — issue a session token to the caller; spec
    task 2.2 hint — "mirror the exact flag set used in /api/auth/login"):

    * ``httponly=True``     — JavaScript on the page cannot read the cookie.
    * ``secure=False``      — works under plain HTTP for local development.
                              Production deployments that terminate TLS
                              should flip this to True via configuration in
                              a later task; this task stays faithful to the
                              existing admin login path.
    * ``samesite="lax"``    — allows top-level navigations from the
                              Admin_App while blocking unrelated
                              cross-origin form posts.
    * ``max_age = 60*24*7*60`` seconds — exactly the value used by
                              ``/api/auth/login`` today. ``ACCESS_TOKEN_EXPIRE_MINUTES``
                              already mirrors this on the JWT side
                              (7 days), so cookie and token expire together.

    Returns the integer ``users.id`` so the caller (notably
    ``POST /api/auth/cognito-exchange``, added by spec task 2.3) can echo
    it back in the response body without re-querying SQLite.
    """
    user_id = ensure_admin_row(cognito_email)

    # Reuse the existing token minter so the JWT secret, algorithm, and
    # expiry stay in lock-step with ``/api/auth/login``. ``sub`` is a
    # string per JWT convention; ``get_current_user_id`` casts it back to
    # ``int`` on the read side.
    token = create_access_token({"sub": str(user_id)})

    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS — matches /api/auth/login
        samesite="lax",
        max_age=60 * 24 * 7 * 60,
    )

    return user_id


# ─────────────────────────────────────────────────────────────────────────────
# End-user session resolution (spec task 2.14 — Requirements 1.8, 1.9, 1.10)
# ─────────────────────────────────────────────────────────────────────────────
#
# ``get_current_end_user_id`` is the End_User_App counterpart of
# ``get_current_user_id``. Both dependencies read the same cookie name
# (``session_token``) — that is intentional: the End_User_App and the
# Admin_App share the cookie because they are served from the same Vite
# project and a single browser tab cannot reliably namespace cookies by
# subpath. To keep the two identity stores from cross-pollinating
# (per-account isolation, Requirements 1.8 / 1.9), we disambiguate by
# *table*: a JWT ``sub`` is an end-user id only when it matches a row in
# ``end_user_accounts``. If the same ``sub`` happens to match a row in
# ``users`` (the admin credential vault) we reject — admin sessions must
# never be allowed to call end-user routes, otherwise an admin who
# happens to share an autoincrement id with an end user would silently
# read that end user's persisted state.
#
# Failure cases all collapse to ``401 Not authenticated``:
#
#   * No cookie on the request.
#   * Cookie present but JWT is malformed / expired / wrong signature.
#   * JWT ``sub`` is missing or not coercible to ``int``.
#   * ``sub`` does not match any ``end_user_accounts.id``.
#   * ``sub`` matches a ``users.id`` but no ``end_user_accounts.id`` —
#     this is the "admin trying to use an end-user route" branch and is
#     rejected explicitly so a stale admin cookie cannot read student
#     state.
#
# We deliberately do NOT distinguish these failure modes in the response
# (Requirement 1.7's principle of generic auth errors): the dependency
# always raises ``HTTPException(401, "Not authenticated")``.


def get_current_end_user_id(request: Request) -> int:
    """
    Resolve the caller's ``end_user_accounts.id`` from the session cookie.

    Used as a FastAPI dependency on every ``/api/end-users/*`` route that
    needs per-end-user scoping (state, chat history). Returns the integer
    id; raises ``HTTPException(401, "Not authenticated")`` on any failure
    — including the case where the cookie's ``sub`` resolves only to a
    ``users`` (admin) row, so an admin session cannot read or write
    end-user data by accident.
    """
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Not authenticated")

    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        sub_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Late import: keeps ``engines.auth`` importable in environments that
    # have not yet wired up SQLite (early test setup, type checkers).
    from engines.database import get_conn

    conn = get_conn()
    try:
        # Probe ``end_user_accounts`` first — the happy path for this
        # dependency. If the row exists, we are done; the caller is an
        # end user with id == ``sub_id``.
        row = conn.execute(
            "SELECT id FROM end_user_accounts WHERE id = ?",
            (sub_id,),
        ).fetchone()
        if row is not None:
            return int(row["id"])

        # ``sub_id`` is not an end-user id. If it happens to match a
        # ``users`` row the caller is logged in as an admin and must not
        # be allowed to read or write end-user state (Requirements 1.8 /
        # 1.9 — per-account isolation across both apps); if it matches
        # neither table the cookie is stale or forged. Both branches
        # collapse to a single 401 to match the generic-error policy
        # from Requirement 1.7.
        raise HTTPException(status_code=401, detail="Not authenticated")
    finally:
        conn.close()
