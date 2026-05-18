"""
CLI entry point for the deterministic identity-store seed routine
(spec task 2.8 — Requirements 1.3, 1.4).

Runs the same wipe-then-seed pipeline as ``POST /api/admin/seed`` (in
``backend/main.py``) but without the HTTP transport, so an operator can
re-seed a fresh deployment from the shell without first standing up a
logged-in admin session.

Usage
-----

The task brief documents the entry as ``python -m backend.seed``. That
form requires ``backend/`` to be a Python package (``backend/__init__.py``
present) and the working directory to be the *parent* of ``backend/``.
The repo deliberately keeps ``backend/`` un-packaged so that test
scaffolding and ``main.py`` itself can ``from engines import ...`` with
``backend/`` on ``sys.path`` (see ``backend/tests/conftest.py``). The
two invocation forms that work today are therefore::

    # From the project root (``admin_and_end_user_apps/``):
    python backend/seed.py

    # From inside ``backend/``:
    python seed.py
    python -m seed

If you want ``python -m backend.seed`` to work, add an empty
``backend/__init__.py``; nothing in this file needs to change.

Credentials
-----------

This is a one-shot administrative tool, not a per-user route, so there is
no logged-in user whose stored credentials could be loaded. AWS
credentials are therefore read from environment variables here — which is
*not* a Property 6 violation, because Property 6 governs per-user routes
inside the running web app. The relevant variables are:

* ``CRYPTEDU_SEED_AWS_ACCESS_KEY_ID`` (preferred) or
  ``AWS_ACCESS_KEY_ID``
* ``CRYPTEDU_SEED_AWS_SECRET_ACCESS_KEY`` (preferred) or
  ``AWS_SECRET_ACCESS_KEY``
* ``CRYPTEDU_SEED_AWS_REGION`` (preferred) or ``AWS_REGION`` /
  ``AWS_DEFAULT_REGION`` — falls back to the User Pool ID prefix when
  unset (matches ``config.COGNITO_REGION``).

The ``CRYPTEDU_SEED_*`` namespace is preferred so the operator can keep
their normal AWS profile env vars pointed elsewhere (or unset) while
still running this tool with explicitly-scoped seed credentials.

Side effects
------------

This script is **destructive**:

1. Calls ``init_db()`` to ensure the SQLite schema is current.
2. Calls ``seed_users(cognito_client)``, which wipes
   ``end_user_chat``, ``end_user_state``, ``end_user_accounts``,
   ``user_actions``, ``users``, every user in the configured Cognito
   User Pool, and then re-creates exactly the two seed accounts.

There is no ``--dry-run`` mode. Run with care.

Exit codes
----------

* ``0`` — seed completed successfully.
* ``1`` — missing or empty AWS credentials in the environment.
* ``2`` — ``COGNITO_USER_POOL_ID`` is not configured.
* ``3`` — ``seed_users`` (or the underlying boto3 client) raised. The
  exception message is printed to stderr.
"""

from __future__ import annotations

import os
import sys


def _resolve_env(*names: str) -> str:
    """
    Return the first non-empty value among the given env-var names,
    or ``""`` if none is set. Names are checked in order so callers can
    encode preference (e.g. seed-specific override → standard AWS var).
    """
    for name in names:
        value = os.environ.get(name, "")
        if value:
            return value
    return ""


def main() -> int:
    """
    Entry point invoked by ``python backend/seed.py`` and by the
    ``if __name__ == "__main__"`` guard at the bottom of this module.

    Returns the process exit code so the caller (or a test) can assert
    on it without trapping ``SystemExit``.
    """
    # ── Locate the backend module namespace ─────────────────────────────
    # When invoked via ``python backend/seed.py`` from the project root,
    # the script's own directory (``backend/``) is added to ``sys.path``
    # by the interpreter, so ``import config`` and ``from engines import
    # ...`` resolve to the backend's modules. We mirror that here for
    # the ``python -m seed`` case where the working dir already contains
    # ``seed.py`` as a top-level module — both invocations end up with
    # ``backend/`` (the parent of this file) on the path.
    _here = os.path.dirname(os.path.abspath(__file__))
    if _here not in sys.path:
        sys.path.insert(0, _here)

    # Late imports so the ``sys.path`` mutation above takes effect
    # *before* anything tries to resolve ``config`` or ``engines.*``.
    import config
    from engines.database import init_db, seed_users

    # ── Resolve AWS credentials from the environment ────────────────────
    aws_access_key = _resolve_env(
        "CRYPTEDU_SEED_AWS_ACCESS_KEY_ID",
        "AWS_ACCESS_KEY_ID",
    )
    aws_secret_key = _resolve_env(
        "CRYPTEDU_SEED_AWS_SECRET_ACCESS_KEY",
        "AWS_SECRET_ACCESS_KEY",
    )
    aws_region = (
        _resolve_env(
            "CRYPTEDU_SEED_AWS_REGION",
            "AWS_REGION",
            "AWS_DEFAULT_REGION",
        )
        or config.COGNITO_REGION
        or "us-east-1"
    )

    if not aws_access_key or not aws_secret_key:
        sys.stderr.write(
            "seed: missing AWS credentials. Set "
            "CRYPTEDU_SEED_AWS_ACCESS_KEY_ID and "
            "CRYPTEDU_SEED_AWS_SECRET_ACCESS_KEY (or the standard "
            "AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY pair) in the "
            "environment before running this tool.\n"
        )
        return 1

    if not config.COGNITO_USER_POOL_ID:
        sys.stderr.write(
            "seed: COGNITO_USER_POOL_ID is not configured. Set the "
            "env var or update backend/config.py before running.\n"
        )
        return 2

    # ── Build the Cognito client and run the seed routine ───────────────
    # ``boto3`` is imported lazily so the help/usage path above stays
    # cheap and so a developer running ``--help``-style probing does
    # not have to wait for boto3 to load.
    import boto3  # noqa: WPS433 — late import is intentional

    cognito = boto3.client(
        "cognito-idp",
        aws_access_key_id=aws_access_key,
        aws_secret_access_key=aws_secret_key,
        region_name=aws_region,
    )

    # ``init_db`` is idempotent (spec task 1.2) and ``seed_users`` is
    # destructive but also idempotent (spec task 2.7). Running them in
    # this order gives us a fresh, schema-current DB followed by the
    # canonical two-account final state.
    init_db()

    try:
        seed_users(cognito)
    except Exception as exc:  # noqa: BLE001 — we want a single exit point
        sys.stderr.write(f"seed: failed: {exc}\n")
        return 3

    sys.stdout.write(
        "seed: done. Identity stores now contain exactly the two "
        "seed accounts (cryptedu-admin@school.edu.my and roshi).\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
