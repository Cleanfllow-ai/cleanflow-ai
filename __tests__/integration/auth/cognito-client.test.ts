/**
 * Phase 1 - cognito-client.ts integration tests.
 * Target: modules/auth/api/cognito-client.ts
 *
 * The trick: cognito-client.ts does `new CognitoIdentityProvider(...)` at
 * module-load time, which happens during the `import` below. So the mock
 * factory must be completely self-contained (no closures over test-file
 * locals, which would be in the TDZ when the factory runs). We define the
 * fake client INSIDE the factory and expose it via a module-level property
 * the tests read back after import.
 */
jest.mock("@aws-sdk/client-cognito-identity-provider", () => {
  const actual = jest.requireActual(
    "@aws-sdk/client-cognito-identity-provider"
  );
  const instance = {
    signUp: jest.fn(),
    confirmSignUp: jest.fn(),
    initiateAuth: jest.fn(),
    send: jest.fn(),
  };
  const CognitoIdentityProvider = jest
    .fn()
    .mockImplementation(() => instance);
  return {
    ...actual,
    CognitoIdentityProvider,
    __mockInstance: instance,
  };
});

import { cognitoApi } from "@/modules/auth/api/cognito-client";
import * as cognitoModule from "@aws-sdk/client-cognito-identity-provider";
import { AuthFlowType } from "@aws-sdk/client-cognito-identity-provider";

const mockCognito = (cognitoModule as unknown as {
  __mockInstance: {
    signUp: jest.Mock;
    confirmSignUp: jest.Mock;
    initiateAuth: jest.Mock;
    send: jest.Mock;
  };
}).__mockInstance;

beforeEach(() => {
  mockCognito.initiateAuth.mockReset();
  mockCognito.signUp.mockReset();
  mockCognito.confirmSignUp.mockReset();
  mockCognito.send.mockReset();
});

describe("cognitoApi.signUp", () => {
  it("calls signUp with email, password, and name attributes", async () => {
    mockCognito.signUp.mockResolvedValue({
      UserConfirmed: false,
      UserSub: "user-abc-123",
    });

    await cognitoApi.signUp("alice@example.com", "StrongPass1!", "Alice Smith");

    expect(mockCognito.signUp).toHaveBeenCalledTimes(1);
    const arg = mockCognito.signUp.mock.calls[0][0];
    expect(arg).toMatchObject({
      ClientId: "test-client-id-abc123",
      Username: "alice@example.com",
      Password: "StrongPass1!",
    });
    expect(arg.UserAttributes).toContainEqual({
      Name: "email",
      Value: "alice@example.com",
    });
    expect(arg.UserAttributes).toContainEqual({
      Name: "name",
      Value: "Alice Smith",
    });
  });

  it("omits the name attribute when not provided", async () => {
    mockCognito.signUp.mockResolvedValue({});

    await cognitoApi.signUp("bob@example.com", "StrongPass1!");

    const arg = mockCognito.signUp.mock.calls[0][0];
    expect(arg.UserAttributes).toHaveLength(1);
    expect(arg.UserAttributes).toContainEqual({
      Name: "email",
      Value: "bob@example.com",
    });
  });

  it("propagates UsernameExistsException from Cognito", async () => {
    const err = new Error("User already exists");
    err.name = "UsernameExistsException";
    mockCognito.signUp.mockRejectedValue(err);

    await expect(
      cognitoApi.signUp("existing@example.com", "StrongPass1!")
    ).rejects.toThrow("User already exists");
  });
});

describe("cognitoApi.confirmSignUp", () => {
  it("calls confirmSignUp with code", async () => {
    mockCognito.confirmSignUp.mockResolvedValue({});

    await cognitoApi.confirmSignUp("alice@example.com", "123456");

    expect(mockCognito.confirmSignUp).toHaveBeenCalledTimes(1);
    expect(mockCognito.confirmSignUp.mock.calls[0][0]).toMatchObject({
      ClientId: "test-client-id-abc123",
      Username: "alice@example.com",
      ConfirmationCode: "123456",
    });
  });

  it("propagates CodeMismatchException on wrong code", async () => {
    const err = new Error("Invalid verification code");
    err.name = "CodeMismatchException";
    mockCognito.confirmSignUp.mockRejectedValue(err);

    await expect(
      cognitoApi.confirmSignUp("alice@example.com", "000000")
    ).rejects.toThrow("Invalid verification code");
  });
});

describe("cognitoApi.login", () => {
  it("calls initiateAuth with USER_PASSWORD_AUTH flow", async () => {
    mockCognito.initiateAuth.mockResolvedValue({
      AuthenticationResult: {
        IdToken: "id-tok",
        AccessToken: "access-tok",
        RefreshToken: "refresh-tok",
      },
    });

    const result = await cognitoApi.login("alice@example.com", "StrongPass1!");

    expect(mockCognito.initiateAuth).toHaveBeenCalledTimes(1);
    expect(mockCognito.initiateAuth.mock.calls[0][0]).toMatchObject({
      ClientId: "test-client-id-abc123",
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: "alice@example.com",
        PASSWORD: "StrongPass1!",
      },
    });
    expect(result.AuthenticationResult?.IdToken).toBe("id-tok");
  });

  it("propagates NotAuthorizedException for wrong password", async () => {
    const err = new Error("Incorrect username or password.");
    err.name = "NotAuthorizedException";
    mockCognito.initiateAuth.mockRejectedValue(err);

    await expect(
      cognitoApi.login("alice@example.com", "WrongPass!")
    ).rejects.toThrow("Incorrect username or password.");
  });

  it("propagates UserNotConfirmedException for unverified email", async () => {
    const err = new Error("User is not confirmed.");
    err.name = "UserNotConfirmedException";
    mockCognito.initiateAuth.mockRejectedValue(err);

    await expect(
      cognitoApi.login("unconfirmed@example.com", "StrongPass1!")
    ).rejects.toThrow("User is not confirmed.");
  });
});

describe("cognitoApi.refreshSession", () => {
  it("calls initiateAuth with REFRESH_TOKEN_AUTH flow", async () => {
    mockCognito.initiateAuth.mockResolvedValue({
      AuthenticationResult: {
        IdToken: "new-id-tok",
        AccessToken: "new-access-tok",
      },
    });

    await cognitoApi.refreshSession("refresh-tok-xyz");

    expect(mockCognito.initiateAuth).toHaveBeenCalledTimes(1);
    expect(mockCognito.initiateAuth.mock.calls[0][0]).toMatchObject({
      ClientId: "test-client-id-abc123",
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      AuthParameters: {
        REFRESH_TOKEN: "refresh-tok-xyz",
      },
    });
  });
});
