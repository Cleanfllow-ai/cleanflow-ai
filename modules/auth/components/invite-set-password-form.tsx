"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { orgAPI } from "@/modules/auth/api/org-api";
import { useToast } from "@/shared/hooks/use-toast";
import { isApiError } from "@/modules/shared/api-error";

export function InviteSetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const orgId = searchParams.get("org_id") || "";
  const inviteId = searchParams.get("invite_id") || "";
  const token = searchParams.get("token") || "";
  const emailFromQuery = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailFromQuery);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLinkValid = Boolean(orgId && inviteId && token && email);

  // Inline password strength validation (mirrors backend PasswordPolicyError)
  const passwordStrengthError = (() => {
    if (!password) return "";
    if (password.length < 8) return "Password must be 8+ chars with letters and numbers.";
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
      return "Password must be 8+ chars with letters and numbers.";
    return "";
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isLinkValid) {
      setError("Invalid invite link. Please request a new invitation.");
      return;
    }
    if (passwordStrengthError) {
      setError(passwordStrengthError);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await orgAPI.setInvitePassword(orgId, inviteId, token, email, password, null);
      toast({
        id: "org-password-set",
        title: "Password set",
        description: "Sign in to complete organization joining.",
      });
      // Do NOT include the invite ``token`` in the redirect URL — that single-
      // use secret should not appear in browser history, the address bar, or
      // any Referer header sent from /auth/login. The login page only needs
      // the email pre-fill; org_id + invite_id are kept for the post-login
      // accept-invite step on the dashboard side.
      const params = new URLSearchParams({
        org_id: orgId,
        invite_id: inviteId,
        email,
      });
      router.push(`/auth/login?${params.toString()}`);
    } catch (err: any) {
      if (isApiError(err)) {
        const code = err.code ?? "";
        if (err.action === "request_new_invite" || code === "InviteExpiredError" || code === "InvalidInviteTokenError") {
          toast({
            id: "org-INVITE_EXPIRED",
            title: "This invite expired.",
            description: "Ask the sender to send a new one.",
            variant: "destructive",
          });
          setError("");
          return;
        }
        if (err.action === "signin" || code === "InviteRaceError" || code === "InviteAlreadyAcceptedError") {
          toast({
            id: "org-INVITE_ALREADY_USED",
            title: "This invite was already used.",
            description: "Sign in instead.",
            variant: "destructive",
            action: {
              label: "Sign In",
              onClick: () => router.push("/auth/login"),
            },
          } as any);
          setError("");
          return;
        }
        if (code === "PasswordPolicyError") {
          setError("Password must be 8+ chars with letters and numbers.");
          return;
        }
      }
      setError((err as any)?.message || "Could not set password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Set Your Password</CardTitle>
        <CardDescription>
          Create your password to continue with this organization invite.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isLinkValid && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>Invite link is invalid or incomplete.</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              required
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-password">Password</Label>
            <Input
              id="invite-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {password && passwordStrengthError && (
              <p className="text-xs text-destructive" role="alert" aria-live="polite">
                {passwordStrengthError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-confirm-password">Confirm Password</Label>
            <Input
              id="invite-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting || !isLinkValid}>
            {isSubmitting ? "Setting password..." : "Set Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
