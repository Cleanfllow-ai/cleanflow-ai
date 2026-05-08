"""Bootstrap a Playwright-owned Cognito test user with a TOTP secret we control.

End state:
  - User exists with permanent password
  - TOTP enrolled (we know the secret)
  - User is a member of the existing test org
  - TOTP secret saved to e2e/.auth/totp_secret.txt (gitignored)

Re-runnable: detects existing user/membership and skips already-done steps.

Run:
    conda run -n mcc-project python e2e/bootstrap_test_user.py
"""
import boto3
import botocore
import pyotp
import json
import os
import sys
from pathlib import Path

USER_POOL_ID = "ap-south-1_wgdr8tHyP"
CLIENT_ID = "13ucambt8aqqdk2n7gcmlk7gp4"
EMAIL = "kparthiban+playwrighttest@infiniqon.com"
PASSWORD = "PlaywrightTest123!"
TARGET_ORG_ID = "e81ba273-d808-4ba1-9483-f6e507909424"   # same org kparthiban+test123 belongs to
ORG_MEMBERS_TABLE = "CleanFlowAI-OrgMembers"
TOTP_SECRET_PATH = Path(__file__).parent / ".auth" / "totp_secret.txt"
CREDS_PATH = Path(__file__).parent / ".auth" / "creds.json"

cog = boto3.client("cognito-idp", region_name="ap-south-1")
ddb = boto3.client("dynamodb", region_name="ap-south-1")


def get_or_create_user() -> str:
    """Return user_sub. Creates the user if missing."""
    try:
        u = cog.admin_get_user(UserPoolId=USER_POOL_ID, Username=EMAIL)
        sub = next(a["Value"] for a in u["UserAttributes"] if a["Name"] == "sub")
        print(f"  user already exists, sub={sub}, status={u['UserStatus']}")
        return sub
    except cog.exceptions.UserNotFoundException:
        pass

    print("  creating user ...")
    cog.admin_create_user(
        UserPoolId=USER_POOL_ID,
        Username=EMAIL,
        UserAttributes=[
            {"Name": "email", "Value": EMAIL},
            {"Name": "email_verified", "Value": "true"},
        ],
        MessageAction="SUPPRESS",                              # don't email a temp password
        TemporaryPassword="TempPass123!Reset",
    )
    cog.admin_set_user_password(
        UserPoolId=USER_POOL_ID, Username=EMAIL,
        Password=PASSWORD, Permanent=True,
    )
    u = cog.admin_get_user(UserPoolId=USER_POOL_ID, Username=EMAIL)
    sub = next(a["Value"] for a in u["UserAttributes"] if a["Name"] == "sub")
    print(f"  created user_sub={sub}")
    return sub


def login_and_get_session() -> dict:
    """Returns the InitiateAuth response (which will challenge for MFA setup or MFA)."""
    return cog.initiate_auth(
        ClientId=CLIENT_ID,
        AuthFlow="USER_PASSWORD_AUTH",
        AuthParameters={"USERNAME": EMAIL, "PASSWORD": PASSWORD},
    )


def enroll_totp(session: str) -> str:
    """Associate + verify a software token; returns the TOTP secret."""
    print("  associating software token ...")
    a = cog.associate_software_token(Session=session)
    secret = a["SecretCode"]
    new_session = a["Session"]
    code = pyotp.TOTP(secret).now()
    print(f"  verifying with first code ...")
    v = cog.verify_software_token(
        Session=new_session,
        UserCode=code,
        FriendlyDeviceName="PlaywrightAutoBot",
    )
    if v["Status"] != "SUCCESS":
        raise RuntimeError(f"verify_software_token returned {v['Status']}")
    cog.admin_set_user_mfa_preference(
        UserPoolId=USER_POOL_ID, Username=EMAIL,
        SoftwareTokenMfaSettings={"Enabled": True, "PreferredMfa": True},
    )
    return secret


def ensure_org_membership(user_sub: str):
    """Add user to TARGET_ORG_ID as a member if not already."""
    try:
        existing = ddb.get_item(
            TableName=ORG_MEMBERS_TABLE,
            Key={"org_id": {"S": TARGET_ORG_ID}, "user_id": {"S": user_sub}},
        ).get("Item")
        if existing:
            print(f"  org membership already exists")
            return
    except botocore.exceptions.ClientError as e:
        print(f"  warning: org check failed: {e}")
    print(f"  adding user to org {TARGET_ORG_ID} ...")
    ddb.put_item(
        TableName=ORG_MEMBERS_TABLE,
        Item={
            "org_id": {"S": TARGET_ORG_ID},
            "user_id": {"S": user_sub},
            "role": {"S": "member"},
            "email": {"S": EMAIL},
            "joined_at": {"S": "2026-05-08T00:00:00Z"},
        },
    )


def authenticate_with_mfa(secret: str) -> dict:
    """End-to-end auth using the saved TOTP secret. Returns IdToken/AccessToken/RefreshToken."""
    r = login_and_get_session()
    if r.get("ChallengeName") != "SOFTWARE_TOKEN_MFA":
        # No MFA required (shouldn't happen post-enrollment) — return tokens directly.
        if "AuthenticationResult" in r:
            return r["AuthenticationResult"]
        raise RuntimeError(f"unexpected challenge: {r.get('ChallengeName')}")
    code = pyotp.TOTP(secret).now()
    resp = cog.respond_to_auth_challenge(
        ClientId=CLIENT_ID,
        ChallengeName="SOFTWARE_TOKEN_MFA",
        Session=r["Session"],
        ChallengeResponses={"USERNAME": EMAIL, "SOFTWARE_TOKEN_MFA_CODE": code},
    )
    return resp["AuthenticationResult"]


def main():
    TOTP_SECRET_PATH.parent.mkdir(parents=True, exist_ok=True)

    print("\n[1/4] User")
    user_sub = get_or_create_user()

    print("\n[2/4] TOTP enrollment")
    if TOTP_SECRET_PATH.exists():
        secret = TOTP_SECRET_PATH.read_text().strip()
        print(f"  reusing saved secret ({TOTP_SECRET_PATH.name})")
    else:
        # Login to get a SETUP session
        r = login_and_get_session()
        chal = r.get("ChallengeName")
        if chal == "MFA_SETUP":
            secret = enroll_totp(r["Session"])
        elif chal == "SOFTWARE_TOKEN_MFA":
            print("  user already has TOTP enrolled but we don't have the secret.")
            print("  (Resetting via admin-set-user-mfa-preference doesn't clear the secret server-side.)")
            print("  Workaround: delete + recreate the user.")
            cog.admin_delete_user(UserPoolId=USER_POOL_ID, Username=EMAIL)
            print("  recreating ...")
            user_sub = get_or_create_user()
            r = login_and_get_session()
            secret = enroll_totp(r["Session"])
        else:
            if "AuthenticationResult" in r:
                # Pool-level MFA not actually enforced for this client? unlikely, but handle.
                print("  no MFA challenge issued — pool config may have changed.")
                secret = ""
            else:
                raise RuntimeError(f"unexpected first-login response: {chal}")
        TOTP_SECRET_PATH.write_text(secret)
        print(f"  saved secret -> {TOTP_SECRET_PATH}")

    print("\n[3/4] Org membership")
    ensure_org_membership(user_sub)

    print("\n[4/4] Smoke auth (verify end-to-end)")
    if secret:
        tokens = authenticate_with_mfa(secret)
    else:
        r = login_and_get_session()
        tokens = r["AuthenticationResult"]
    print(f"  IdToken bytes: {len(tokens['IdToken'])}")
    print(f"  AccessToken bytes: {len(tokens['AccessToken'])}")

    CREDS_PATH.write_text(json.dumps({
        "email": EMAIL,
        "password": PASSWORD,
        "user_pool_id": USER_POOL_ID,
        "client_id": CLIENT_ID,
        "user_sub": user_sub,
        "org_id": TARGET_ORG_ID,
        "totp_secret_path": str(TOTP_SECRET_PATH.relative_to(Path(__file__).parent)),
    }, indent=2))
    print(f"  saved creds metadata -> {CREDS_PATH}")
    print("\nDone. Playwright auth.setup.ts can now use these creds + TOTP secret.")


if __name__ == "__main__":
    main()
