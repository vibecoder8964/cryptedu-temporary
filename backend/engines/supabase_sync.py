"""
Supabase sync stub — fire-and-forget row push.

This module is imported lazily by database.py only when
``SUPABASE_ENABLED`` is True.  When Supabase is not configured,
it is never called.
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")


def push_row(table: str, data: dict) -> None:
    """Push a single row to Supabase (best-effort, non-blocking).

    If the supabase-py client is not installed or the URL/key is
    missing, this is a silent no-op.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return

    try:
        from supabase import create_client
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        client.table(table).insert(data).execute()
    except ImportError:
        logger.debug("supabase-py not installed; skipping sync")
    except Exception as e:
        logger.warning("Supabase push_row(%s) failed: %s", table, e)
