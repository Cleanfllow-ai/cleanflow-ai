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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isLinkValid) {
      setError("Invalid invite link. Please request a new invitation.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
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
        title: "Password set",
        description: "Sign in to complete organization joining.",
      });
      const params = new URLSearchParams({
        org_id: orgId,
        invite_id: inviteId,
        token,
        email,
      });
      router.push(`/auth/login?${params.toString()}`);
    } catch (err: any) {
      setError(err?.message || "Could not set password.");
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
