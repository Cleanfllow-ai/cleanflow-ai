import {
  AssociateSoftwareTokenCommand,
  AuthFlowType,
  ChallengeNameType,
  CognitoIdentityProvider,
  RespondToAuthChallengeCommand,
  VerifySoftwareTokenCommand,
} from "@aws-sdk/client-cognito-identity-provider"

import { AWS_CONFIG } from "@/shared/config/aws-config"

export const COGNITO_CONFIG = {
  userPoolId: AWS_CONFIG.COGNITO.USER_POOL_ID,
  clientId: AWS_CONFIG.COGNITO.CLIENT_ID,
  region: AWS_CONFIG.COGNITO.REGION,
}

const cognitoClient = new CognitoIdentityProvider({
  region: COGNITO_CONFIG.region,
})

export const cognitoApi = {
  async refreshSession(refreshToken: string) {
    return cognitoClient.initiateAuth({
      ClientId: COGNITO_CONFIG.clientId,
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    })
  },

  async signUp(email: string, password: string, name?: string) {
    const userAttributes = [{ Name: "email", Value: email }]
    if (name) {
      userAttributes.push({ Name: "name", Value: name })
    }

    return cognitoClient.signUp({
      ClientId: COGNITO_CONFIG.clientId,
      Username: email,
      Password: password,
      UserAttributes: userAttributes,
    })
  },

  async confirmSignUp(email: string, code: string) {
    return cognitoClient.confirmSignUp({
      ClientId: COGNITO_CONFIG.clientId,
      Username: email,
      ConfirmationCode: code,
    })
  },

  async login(email: string, password: string) {
    return cognitoClient.initiateAuth({
      ClientId: COGNITO_CONFIG.clientId,
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    })
  },

  async verifySoftwareTokenMfa(session: string, username: string, mfaCode: string) {
    return cognitoClient.send(
      new RespondToAuthChallengeCommand({
        ClientId: COGNITO_CONFIG.clientId,
        ChallengeName: ChallengeNameType.SOFTWARE_TOKEN_MFA,
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
          SOFTWARE_TOKEN_MFA_CODE: mfaCode,
        },
      })
    )
  },

  async associateSoftwareTokenFromAccessToken(accessToken: string) {
    return cognitoClient.send(
      new AssociateSoftwareTokenCommand({
        AccessToken: accessToken,
      })
    )
  },

  async associateSoftwareTokenFromSession(session: string) {
    return cognitoClient.send(
      new AssociateSoftwareTokenCommand({
        Session: session,
      })
    )
  },

  async verifySoftwareTokenFromAccessToken(accessToken: string, mfaCode: string) {
    return cognitoClient.send(
      new VerifySoftwareTokenCommand({
        AccessToken: accessToken,
        UserCode: mfaCode,
        FriendlyDeviceName: "Authenticator App",
      })
    )
  },

  async respondNewPasswordChallenge(session: string, username: string, newPassword: string) {
    return cognitoClient.send(
      new RespondToAuthChallengeCommand({
        ClientId: COGNITO_CONFIG.clientId,
        ChallengeName: ChallengeNameType.NEW_PASSWORD_REQUIRED,
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
          NEW_PASSWORD: newPassword,
        },
      })
    )
  },

  async verifySoftwareTokenFromSession(session: string, mfaCode: string) {
    return cognitoClient.send(
      new VerifySoftwareTokenCommand({
        Session: session,
        UserCode: mfaCode,
        FriendlyDeviceName: "Authenticator App",
      })
    )
  },

  async respondMfaSetupChallenge(session: string, username: string) {
    return cognitoClient.send(
      new RespondToAuthChallengeCommand({
        ClientId: COGNITO_CONFIG.clientId,
        ChallengeName: ChallengeNameType.MFA_SETUP,
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
        },
      })
    )
  },
}

