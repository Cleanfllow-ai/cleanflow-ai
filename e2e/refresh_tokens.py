"""Refresh expired Cognito tokens using the refresh token from inject-tokens.json.

Run:
    conda run -n mcc-project python e2e/refresh_tokens.py

If refresh token is itself expired, falls back to printing a message.
"""
import boto3
import json
import sys
from pathlib import Path

CLIENT_ID = "13ucambt8aqqdk2n7gcmlk7gp4"
USERNAME = "b163ad3a-d041-7004-8e62-002358952ba9"
TOKENS_PATH = Path(__file__).parent / ".auth" / "inject-tokens.json"

tokens = json.loads(TOKENS_PATH.read_text())
client = boto3.client("cognito-idp", region_name="ap-south-1")
try:
    resp = client.initiate_auth(
        ClientId=CLIENT_ID,
        AuthFlow="REFRESH_TOKEN_AUTH",
        AuthParameters={"REFRESH_TOKEN": tokens["refreshToken"], "USERNAME": USERNAME},
    )
    auth = resp["AuthenticationResult"]
    new_tokens = {
        "idToken": auth["IdToken"],
        "accessToken": auth["AccessToken"],
        "refreshToken": tokens["refreshToken"],
    }
    TOKENS_PATH.write_text(json.dumps(new_tokens))
    print("refreshed OK")
except Exception as e:
    print(f"refresh failed: {e}", file=sys.stderr)
    sys.exit(1)
