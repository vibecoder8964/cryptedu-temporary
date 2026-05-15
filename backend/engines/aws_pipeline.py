"""
CryptEdu AWS Content Pipeline — Amazon Bedrock and S3 integration.
Credentials are loaded from the database per-user, not from environment variables.
"""
import os
import json
import logging
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

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
    """Create a Bedrock Runtime client using explicit credentials from DB."""
    access_key = aws_creds.get("aws_access_key", "")
    secret_key = aws_creds.get("aws_secret_key", "")
    region = aws_creds.get("aws_region", "us-east-1")

    if access_key and secret_key:
        return boto3.client(
            "bedrock-runtime",
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )
    else:
        # Fall back to environment / IAM role
        return boto3.client("bedrock-runtime", region_name=region)


def _get_s3_client(aws_creds: dict):
    """Create an S3 client using explicit credentials from DB."""
    access_key = aws_creds.get("aws_access_key", "")
    secret_key = aws_creds.get("aws_secret_key", "")
    region = aws_creds.get("aws_region", "us-east-1")

    if access_key and secret_key:
        return boto3.client(
            "s3",
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )
    else:
        return boto3.client("s3", region_name=region)


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


def moderate_with_bedrock(transcript: str, aws_creds: dict = None) -> dict:
    """Send transcript to Amazon Bedrock for moderation using Claude 3 Haiku.
    If lambda_url is configured in aws_creds, delegates to Lambda instead.
    
    Args:
        transcript: The video transcript text to moderate.
        aws_creds: Dict with aws_access_key, aws_secret_key, aws_region from DB.
    """
    if aws_creds is None:
        aws_creds = {}

    # Delegate to Lambda if configured
    if aws_creds.get("lambda_url", "").strip():
        return moderate_with_lambda(transcript, aws_creds)

    if not transcript or len(transcript.strip()) < 10:
        return {
            "status": "Rejected",
            "reason": "Transcript is too short or empty to evaluate.",
            "confidence": 100,
        }

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
        
        response = bedrock_runtime.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            body=body,
            accept="application/json",
            contentType="application/json"
        )
        
        response_body = json.loads(response.get("body").read())
        
        # Claude returns the response in content[0].text
        raw = response_body.get("content", [])[0].get("text", "")
        logger.info(f"Bedrock raw response: {raw[:200]}")
        
        # Parse JSON
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1]) if len(lines) > 2 else cleaned
            
        import re
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            json_match = re.search(r'\{[^}]+\}', raw)
            if json_match:
                return json.loads(json_match.group())
            return {"status": "Error", "reason": "Failed to parse JSON", "confidence": 0}
        
    except ClientError as e:
        logger.error(f"Bedrock API error: {e}")
        return {
            "status": "Error",
            "reason": f"AWS Bedrock error: {str(e)}",
            "confidence": 0,
        }
    except Exception as e:
        logger.error(f"Failed to parse Bedrock response: {e}")
        return {
            "status": "Error",
            "reason": f"System error: {str(e)}",
            "confidence": 0,
        }

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
