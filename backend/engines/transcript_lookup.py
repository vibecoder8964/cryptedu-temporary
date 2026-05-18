"""
Transcript reverse-lookup for the End_User_App (spec task 4.1).

Acceptance Criterion 2.4 says the End_User_App must retrieve the
``Video_Transcript`` for the active video by reverse-looking up the
``S3_Companion_JSON`` written next to the video object — i.e. for a
video stored at S3 key ``K`` the companion JSON lives at ``K.json`` —
and that lookup must complete inside 10 seconds.

This module exposes a single helper, :func:`get_transcript_for_video`,
that performs the ``GetObject`` call against a caller-supplied
``boto3`` S3 client with bounded read/connect timeouts and translates
the four interesting outcomes into ``HTTPException`` instances with the
exact status codes the design's "Local AI Tutor errors" table mandates:

* ``404`` — companion JSON is absent (``NoSuchKey`` from S3).
* ``504`` — the fetch exceeded its budget (botocore connect/read timeout).
* ``502`` — the companion JSON is present but malformed (missing field,
  wrong type, or non-JSON body).
* ``200`` — every required field is present with the right type; the
  parsed dict is returned to the caller.

The function never logs or echoes AWS credential material, in line with
Requirement 3.7's no-secret-in-error rule that the calling routes
inherit.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict

from botocore.exceptions import (
    ClientError,
    ConnectTimeoutError,
    ReadTimeoutError,
)
from fastapi import HTTPException

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

#: Three string fields mandated by Acceptance Criterion 3.5.
_REQUIRED_STRING_FIELDS = ("title", "description", "transcription_paragraph")

#: Forward-compatibility hatch from the design's S3_Companion_JSON contract.
_SCHEMA_VERSION_FIELD = "schema_version"


def get_transcript_for_video(s3: Any, bucket: str, video_key: str) -> Dict[str, Any]:
    """
    Fetch and validate the companion JSON for ``video_key``.

    The companion key convention is ``"<video_key>.json"`` — for example
    a video stored at ``"lessons/intro.mp4"`` has its companion at
    ``"lessons/intro.mp4.json"``. The function performs a single
    ``GetObject`` call on that key using the caller-supplied ``s3``
    client and returns a dictionary with keys ``title``, ``description``,
    ``transcription_paragraph``, and ``schema_version``.

    Parameters
    ----------
    s3:
        A configured ``boto3`` S3 client. The caller is responsible for
        binding it to the admin's ``S3_Credentials``. To respect the
        10-second budget set by Requirement 2.4, the client should be
        built with
        ``botocore.config.Config(connect_timeout=5, read_timeout=10)``;
        if it is not, a slow S3 endpoint can still exceed the budget,
        but the botocore timeout exceptions are nevertheless caught
        here and translated to HTTP 504.
    bucket:
        The S3 bucket name — typically the admin's ``s3_training_bucket``.
    video_key:
        The S3 key of the video object. The companion JSON is fetched
        from ``video_key + ".json"``.

    Returns
    -------
    dict
        ``{"title": str, "description": str,
        "transcription_paragraph": str, "schema_version": int}``.

    Raises
    ------
    HTTPException
        * ``404`` if the companion JSON does not exist (``NoSuchKey``).
        * ``504`` if the fetch times out at the connect or read stage.
        * ``502`` if the body is not valid JSON or is missing / mistyping
          any required field.
    """
    companion_key = f"{video_key}.json"

    # --- Stage 1: GetObject -------------------------------------------------
    # We catch the three S3-side error families separately so each maps to
    # the specific HTTP status the design's error table demands. Anything
    # we do not explicitly recognise is re-raised as a 502 — if S3 is
    # speaking to us at all but in a way we do not understand, the body is
    # by definition not the contract we promised the End_User_App.
    try:
        response = s3.get_object(Bucket=bucket, Key=companion_key)
    except (ConnectTimeoutError, ReadTimeoutError) as exc:
        # Requirement 2.4: the lookup must complete in 10 s. botocore
        # raises these when the connect_timeout / read_timeout on the
        # client config is exceeded.
        logger.warning(
            "Transcript fetch timed out for bucket=%s key=%s: %s",
            bucket,
            companion_key,
            exc,
        )
        raise HTTPException(
            status_code=504,
            detail="Transcript fetch timed out",
        ) from exc
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code == "NoSuchKey":
            # Requirement 2.4 / 2.5: a missing companion JSON means there
            # is no transcript for this video; the End_User_App will block
            # the chat and quiz CTAs.
            raise HTTPException(
                status_code=404,
                detail="Companion JSON missing",
            ) from exc
        # Any other S3 client error (NoSuchBucket, AccessDenied, throttle,
        # etc.) means the bucket is in a state we cannot reconcile with the
        # contract — surface it as a 502 without leaking AWS internals.
        logger.error(
            "S3 error fetching companion JSON bucket=%s key=%s code=%s",
            bucket,
            companion_key,
            error_code,
        )
        raise HTTPException(
            status_code=502,
            detail="Companion JSON unreachable",
        ) from exc

    # --- Stage 2: read body ------------------------------------------------
    body_stream = response.get("Body")
    if body_stream is None:
        raise HTTPException(
            status_code=502,
            detail="Companion JSON has no body",
        )
    try:
        raw = body_stream.read()
    except (ConnectTimeoutError, ReadTimeoutError) as exc:
        # Streaming the body can also time out under botocore's read budget;
        # that is the same 504 case as above.
        raise HTTPException(
            status_code=504,
            detail="Transcript fetch timed out",
        ) from exc

    # --- Stage 3: decode JSON ----------------------------------------------
    try:
        if isinstance(raw, (bytes, bytearray)):
            raw = raw.decode("utf-8")
        payload = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Companion JSON is not valid JSON",
        ) from exc

    # --- Stage 4: validate schema -----------------------------------------
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=502,
            detail="Companion JSON must be a JSON object",
        )

    for field in _REQUIRED_STRING_FIELDS:
        if field not in payload:
            raise HTTPException(
                status_code=502,
                detail=f"Companion JSON missing required field: {field}",
            )
        if not isinstance(payload[field], str):
            raise HTTPException(
                status_code=502,
                detail=f"Companion JSON field {field!r} must be a string",
            )

    if _SCHEMA_VERSION_FIELD not in payload:
        raise HTTPException(
            status_code=502,
            detail=f"Companion JSON missing required field: {_SCHEMA_VERSION_FIELD}",
        )
    # ``isinstance(True, int)`` is True in Python — exclude bools explicitly
    # so a payload like ``{"schema_version": true}`` is rejected as malformed
    # rather than silently accepted as 1.
    schema_version = payload[_SCHEMA_VERSION_FIELD]
    if isinstance(schema_version, bool) or not isinstance(schema_version, int):
        raise HTTPException(
            status_code=502,
            detail=(
                f"Companion JSON field {_SCHEMA_VERSION_FIELD!r} must be an integer"
            ),
        )

    # The four contract fields are all that the End_User_App's
    # ``VideoTranscriptResponse`` shape promises; advisory fields like
    # ``uploaded_by`` and ``uploaded_at`` are intentionally not surfaced.
    return {
        "title": payload["title"],
        "description": payload["description"],
        "transcription_paragraph": payload["transcription_paragraph"],
        _SCHEMA_VERSION_FIELD: schema_version,
    }
