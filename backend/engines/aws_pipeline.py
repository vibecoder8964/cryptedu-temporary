"""
CryptEdu AWS Content Pipeline — Amazon Bedrock and S3 integration.
Credentials are loaded from the database per-user, not from environment variables.
"""
import os
import json
import logging
import re
import boto3
from botocore.exceptions import ClientError
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class BedrockError(Exception):
    """Raised when the Bedrock SDK call itself fails (network, auth, throttle, etc.)."""


class BedrockParseError(Exception):
    """Raised when the Bedrock response cannot be resolved to 'approved' or 'rejected'."""


class CompanionWriteError(Exception):
    """Raised when writing the S3 companion JSON object fails."""


# Constants
BEDROCK_MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0"

MODERATION_PROMPT = """You are an educational content moderator for the Ministry of Education (MoE).

Analyze the following transcript from an uploaded educational video and determine if it contains suitable, accurate educational content that aligns with the local national curriculum.

Consider:
1. Is the content educational in nature?
2. Is the information factually accurate?
3. Is the content appropriate for school-age students?
4. Does it align with the local curriculum standards?

Transcript:
\"\"\"
{transcript}
\"\"\"

Respond ONLY with valid JSON in this exact format, no other text:
{{"status": "Approved" or "Declined", "reason": "Provide EXACTLY two sentences. Sentence 1: Briefly state what the video is about based on the transcript. Sentence 2: Explain why you approved or declined it.", "confidence": 0 to 100}}"""


def _get_bedrock_client(aws_creds: dict):
    """Create a Bedrock Runtime client using explicit credentials from DB.

    Raises ValueError if aws_access_key or aws_secret_key is missing.
    No fall-back to environment variables or IAM roles (Req 3.11, Property 7).
    """
    access_key = aws_creds.get("aws_access_key", "")
    secret_key = aws_creds.get("aws_secret_key", "")
    region = aws_creds.get("aws_region", "us-east-1")

    if not access_key or not secret_key:
        raise ValueError("AWS_Bedrock_Credentials missing")

    return boto3.client(
        "bedrock-runtime",
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )


def _get_s3_client(aws_creds: dict):
    """Create an S3 client using explicit credentials from DB.

    Raises ValueError if aws_access_key or aws_secret_key is missing, or if
    s3_training_bucket is missing (Req 3.11, Property 7).
    No fall-back to environment variables or IAM roles.
    """
    access_key = aws_creds.get("aws_access_key", "")
    secret_key = aws_creds.get("aws_secret_key", "")
    region = aws_creds.get("aws_region", "us-east-1")
    bucket = aws_creds.get("s3_training_bucket", "")

    if not access_key or not secret_key:
        raise ValueError("S3_Credentials missing")
    if not bucket:
        raise ValueError("S3_Credentials.s3_training_bucket missing")

    return boto3.client(
        "s3",
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )


def moderate_with_lambda(transcript: str, aws_creds: dict) -> dict:
    """Call friend's Lambda function for moderation."""
    import requests as req_lib
    lambda_url = aws_creds.get("lambda_url", "").strip()
    lambda_api_key = aws_creds.get("lambda_api_key", "").strip()

    prompt = MODERATION_PROMPT.format(transcript=transcript)

    headers = {"Content-Type": "application/json"}
    if lambda_api_key:
        headers["x-api-key"] = lambda_api_key

    payload = {
        "prompt": prompt,
        "transcript": transcript
    }

    response = req_lib.post(lambda_url, json=payload, headers=headers, timeout=60)
    response.raise_for_status()

    data = response.json()
    # Handle both direct JSON response and nested body
    if "body" in data:
        import json as json_mod
        body = data["body"]
        if isinstance(body, str):
            body = json_mod.loads(body)
        return body
    return data


def _parse_bedrock_decision(raw: str) -> str:
    """Parse a Bedrock response into a normalised decision string.

    Accepts ``"Approved"`` / ``"Declined"`` (any case, with surrounding
    whitespace or code fences) and normalises to ``"approved"`` /
    ``"rejected"``.  Anything else raises ``BedrockParseError``.

    The function first attempts to extract a JSON object from the raw
    text (stripping code fences if present) and reads the ``"status"``
    field.  If JSON parsing fails, it falls back to a plain-text scan
    for the decision keywords.

    Returns
    -------
    str
        Exactly one of ``"approved"`` or ``"rejected"``.

    Raises
    ------
    BedrockParseError
        If the response cannot be resolved to one of the two values.
    """
    cleaned = raw.strip()

    # Strip code fences (```json ... ``` or ``` ... ```)
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove first line (```json or ```) and last line (```)
        inner_lines = []
        for i, line in enumerate(lines):
            if i == 0:
                continue
            if i == len(lines) - 1 and line.strip().startswith("```"):
                continue
            inner_lines.append(line)
        cleaned = "\n".join(inner_lines).strip()

    # Attempt JSON parsing
    status_value = None
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            status_value = parsed.get("status", "")
    except (json.JSONDecodeError, ValueError):
        # Try to find a JSON object anywhere in the raw text
        json_match = re.search(r'\{[^{}]*\}', raw)
        if json_match:
            try:
                parsed = json.loads(json_match.group())
                if isinstance(parsed, dict):
                    status_value = parsed.get("status", "")
            except (json.JSONDecodeError, ValueError):
                pass

    # If we got a status from JSON, normalise it
    if status_value:
        normalised = status_value.strip().lower()
        if normalised == "approved":
            return "approved"
        if normalised in ("declined", "rejected"):
            return "rejected"
        raise BedrockParseError("unparseable response")

    # Fallback: scan plain text for keywords (handles responses that are
    # just the word "Approved" or "Declined" with whitespace/fences)
    text_lower = raw.strip().lower()
    # Remove code fences for plain-text scan
    text_lower = re.sub(r'```\w*', '', text_lower).strip().strip('`').strip()
    if text_lower == "approved":
        return "approved"
    if text_lower in ("declined", "rejected"):
        return "rejected"

    raise BedrockParseError("unparseable response")


def moderate_with_bedrock(transcript: str, aws_creds: dict) -> str:
    """Send transcript to Amazon Bedrock for moderation using Claude 3 Haiku.

    The Lambda proxy path is reachable **only** when the admin has
    explicitly opted in via ``use_lambda_proxy=True`` in *aws_creds*
    (default ``False``).  Otherwise, the call always goes through the
    Bedrock SDK (Requirement 3.12).

    Args:
        transcript: The video transcript text to moderate.
        aws_creds: Dict with aws_access_key, aws_secret_key, aws_region
                   from the database.  Required — no default.

    Returns:
        Literal["approved", "rejected"] — the normalised Bedrock decision.

    Raises:
        BedrockError: On any Bedrock SDK / network failure.
        BedrockParseError: When the response cannot be resolved to
                          ``"approved"`` or ``"rejected"``.
    """
    # Delegate to Lambda only when the admin has explicitly opted in
    if aws_creds.get("use_lambda_proxy") and aws_creds.get("lambda_url", "").strip():
        result = moderate_with_lambda(transcript, aws_creds)
        # Normalise the Lambda response to the same contract
        status = result.get("status", "")
        normalised = status.strip().lower()
        if normalised == "approved":
            return "approved"
        if normalised in ("declined", "rejected"):
            return "rejected"
        raise BedrockParseError("unparseable response")

    if not transcript or len(transcript.strip()) < 10:
        return "rejected"

    try:
        bedrock_runtime = _get_bedrock_client(aws_creds)

        # Format the request for Claude 3 Messages API
        prompt = MODERATION_PROMPT.format(transcript=transcript)

        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 512,
            "temperature": 0.1,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        })

        # Use the custom model ID from the DB if available, otherwise fall back to Haiku
        model_id = aws_creds.get("bedrock_role_arn")
        if not model_id or not model_id.strip():
            model_id = BEDROCK_MODEL_ID
            
        response = bedrock_runtime.invoke_model(
            modelId=model_id,
            body=body,
            accept="application/json",
            contentType="application/json"
        )

        response_body = json.loads(response.get("body").read())

        # Claude returns the response in content[0].text
        content_list = response_body.get("content", [])
        if not content_list:
            raise BedrockParseError("unparseable response")

        raw = content_list[0].get("text", "")
        logger.info("Bedrock raw response: %s", raw[:200])

        return _parse_bedrock_decision(raw)

    except (BedrockError, BedrockParseError):
        # Re-raise our own exception types untouched
        raise
    except (ClientError, Exception) as e:
        logger.error("Bedrock invocation failed: %s", e)
        raise BedrockError(str(e)) from e

def upload_to_s3(filepath: str, filename: str, aws_creds: dict = None, metadata: dict = None) -> bool:
    """Upload approved video to S3 with optional title/description metadata.
    
    Args:
        filepath: Local path to the file.
        filename: Target filename in S3.
        aws_creds: Dict with aws_access_key, aws_secret_key, aws_region, s3_training_bucket.
        metadata: Optional dict of string key-value pairs stored as S3 object metadata.
    """
    if aws_creds is None:
        aws_creds = {}

    bucket_name = aws_creds.get("s3_training_bucket", "cryptedu-curriculum-storage")

    # S3 metadata values must be strings; sanitise to ASCII-safe
    s3_metadata = {}
    if metadata:
        for k, v in metadata.items():
            if v:
                # Encode non-ASCII characters so S3 header is valid
                s3_metadata[k] = v.encode("ascii", errors="replace").decode("ascii")

    try:
        s3 = _get_s3_client(aws_creds)
        extra_args = {"Metadata": s3_metadata} if s3_metadata else {}
        s3.upload_file(filepath, bucket_name, filename, ExtraArgs=extra_args)
        logger.info(f"Successfully uploaded {filename} to S3 bucket {bucket_name} with metadata {s3_metadata}.")
        return True
    except ClientError as e:
        logger.error(f"S3 Upload Error: {e}")
        return False


def write_companion_json(
    s3,
    bucket: str,
    video_key: str,
    title: str,
    description: str,
    transcription_paragraph: str,
    uploaded_by_email: str,
) -> str:
    """Write a companion JSON object next to the video in S3.

    The companion key is ``<video_key>.json``.  The body matches the
    S3_Companion_JSON schema (design.md S3 layout section):

    .. code-block:: json

        {
            "title": "...",
            "description": "...",
            "transcription_paragraph": "...",
            "uploaded_by": "<email>",
            "uploaded_at": "<ISO-8601 UTC>",
            "schema_version": 1
        }

    Args:
        s3: A boto3 S3 client (already constructed with the caller's creds).
        bucket: The S3 bucket name.
        video_key: The S3 key of the video object (e.g. ``videos/lecture.mp4``).
        title: Human-readable title of the video.
        description: Human-readable description of the video.
        transcription_paragraph: Full transcript text.
        uploaded_by_email: Email address of the admin who uploaded the video.

    Returns:
        The companion JSON key string (``<video_key>.json``).

    Raises:
        CompanionWriteError: If the ``put_object`` call fails for any reason.

    Implements Requirement 3.5.
    """
    companion_key = f"{video_key}.json"

    payload = {
        "title": title,
        "description": description,
        "transcription_paragraph": transcription_paragraph,
        "uploaded_by": uploaded_by_email,
        "uploaded_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "schema_version": 1,
    }

    json_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    try:
        s3.put_object(
            Bucket=bucket,
            Key=companion_key,
            Body=json_bytes,
            ContentType="application/json",
        )
    except Exception as e:
        raise CompanionWriteError(str(e)) from e

    logger.info(
        "Wrote companion JSON for video '%s' to s3://%s/%s",
        video_key,
        bucket,
        companion_key,
    )
    return companion_key
