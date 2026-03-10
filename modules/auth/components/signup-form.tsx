"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Building2, Briefcase, Eye, EyeOff, FileText, Globe, Lock, Mail, User, Phone, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmailVerification } from "./email-verification";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useAuth } from "@/modules/auth/providers/auth-provider";
import { orgAPI } from "@/modules/auth/api/org-api";
import { useToast } from "@/shared/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

export function SignUpForm() {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { signup, login } = useAuth();
  const { toast } = useToast();

  // Organization fields
  const [orgName, setOrgName] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgPhone, setOrgPhone] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [industry, setIndustry] = useState("");
  const [gst, setGst] = useState("");
  const [pan, setPan] = useState("");
  const [contactPerson, setContactPerson] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const validateStep1 = () => {
    if (!fullName || !email || !password || !confirmPassword) {
      setError("Please fill in all account details.");
      return false;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return false;
    }
    setError("");
    return true;
  };

  const nextStep = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const prevStep = () => {
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      const isInvited = new URLSearchParams(window.location.search).get("invite_id");
      if (isInvited) {
        // Skip step 2 if invited
      } else {
        nextStep();
        return;
      }
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      // If we have an invite, we don't need org details from step 1
      const inviteId = new URLSearchParams(window.location.search).get("invite_id");
      const orgId = new URLSearchParams(window.location.search).get("org_id");

      if (!inviteId) {
        // Always create organization details for Priority 3
        const orgDetails = {
          name: orgName,
          email: orgEmail || email, // Fallback to user email if org email empty
          phone: orgPhone,
          address: orgAddress,
          industry,
          gst,
          pan,
          contact_person: contactPerson || fullName,
        };
        sessionStorage.setItem("pending_org_details", JSON.stringify(orgDetails));
      }

      const result = await signup(
        email,
        password,
        confirmPassword,
        fullName || undefined,
      );
      setSuccess(result.message);
      if (!result.confirmed) {
        setShowVerification(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationComplete = async () => {
    setIsLoading(true);
    setError("");
    try {
      const loginResult = await login(email, password);
      if (loginResult?.mfaRequired || loginResult?.mfaSetupRequired) {
        const message =
          "MFA is required. Please log in and complete MFA setup to finish account setup.";
        toast({
          title: "MFA required",
          description: message,
        });
        setSuccess(message);
        setTimeout(() => {
          window.location.href = "/";
        }, 900);
        return;
      }

      try {
        await orgAPI.getMe();
        sessionStorage.removeItem("pending_org_details");
        const searchParams = new URLSearchParams(window.location.search);
        const inviteId = searchParams.get("invite_id");
        const orgId = searchParams.get("org_id");

        if (inviteId && orgId) {
          window.location.href = `/create-organization${window.location.search}`;
        } else {
          window.location.href = "/dashboard";
        }
      } catch (orgErr: any) {
        const message = orgErr?.message || "";
        if (message.includes("Organization membership required")) {
          // Check if we have pending org details
          const pendingOrgRaw = sessionStorage.getItem("pending_org_details");
          if (pendingOrgRaw) {
            try {
              const pendingOrg = JSON.parse(pendingOrgRaw);
              await orgAPI.registerOrg({
                name: pendingOrg.name,
                email: pendingOrg.email,
                phone: pendingOrg.phone,
                address: pendingOrg.address,
                industry: pendingOrg.industry,
                gst: pendingOrg.gst,
                pan: pendingOrg.pan,
                contact_person: pendingOrg.contact_person,
                subscriptionPlan: "standard",
              });
              sessionStorage.removeItem("pending_org_details");
              toast({
                title: "Organization registered",
                description: "Your organization setup is complete.",
              });
              window.location.href = `/dashboard${window.location.search}`;
              return;
            } catch (regErr: any) {
              console.error("Auto-reg failed:", regErr);
              window.location.href = `/create-organization${window.location.search}`;
              return;
            }
          }
          window.location.href = `/create-organization${window.location.search}`;
          return;
        }
        window.location.href = `/dashboard${window.location.search}`;
      }
    } catch (err: any) {
      setError(err?.message || "Failed to finish signup.");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToSignup = () => {
    setShowVerification(false);
    setError("");
    setSuccess("");
  };

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const getPasswordStrengthLabel = (strength: number) => {
    switch (strength) {
      case 0:
      case 1:
        return "Very Weak";
      case 2:
        return "Weak";
      case 3:
        return "Fair";
      case 4:
        return "Good";
      case 5:
        return "Strong";
      default:
        return "";
    }
  };

  const getPasswordStrengthColor = (strength: number) => {
    switch (strength) {
      case 0:
      case 1:
        return "bg-red-500";
      case 2:
        return "bg-orange-500";
      case 3:
        return "bg-yellow-500";
      case 4:
        return "bg-blue-500";
      case 5:
        return "bg-green-500";
      default:
        return "bg-gray-200";
    }
  };

  if (!mounted) return null;

  if (showVerification) {
    return (
      <EmailVerification
        email={email}
        onVerified={handleVerificationComplete}
        onBack={handleBackToSignup}
      />
    );
  }

  return (
    <div className="w-full">
      {/* Header Section with Logo */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-6">
          <div className="relative w-16 h-16">
            <Image
              src="/images/infiniqon-logo-light.png"
              alt="CleanFlowAI"
              width={64}
              height={64}
              className="rounded-xl object-contain"
            />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {step === 1 ? "Create account" : "Organization Details"}
        </h1>
        <p className="text-muted-foreground">
          {step === 1
            ? "Get started with your account"
            : "Tell us about your organization"}
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex justify-center mb-8 px-4">
        <div className="w-full max-w-[320px] space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className={step >= 1 ? "text-foreground" : ""}>User details</span>
            <span className={step >= 2 ? "text-foreground" : ""}>Organization details</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          </div>
        </div>
      </div>

      <Card className="w-full border-0 shadow-none bg-transparent">
        <CardContent className="space-y-6 p-0">
          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 1 ? (
              <>
                {/* Step 1: User details */}
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium text-muted-foreground">
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      id="fullName"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="pl-10 h-12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 h-12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-10 pr-10 h-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-12 px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {password && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-muted rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-300 ${getPasswordStrengthColor(getPasswordStrength(password))}`}
                            style={{ width: `${(getPasswordStrength(password) / 5) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                          {getPasswordStrengthLabel(getPasswordStrength(password))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pb-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-muted-foreground">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="pl-10 pr-10 h-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-12 px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Step 2: Org details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="orgName">Organization Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        id="orgName"
                        placeholder="e.g. Acme Corp"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        required
                        className="pl-10 h-12"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        id="industry"
                        placeholder="e.g. Finance, Healthcare"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        required
                        className="pl-10 h-12"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="orgEmail">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        id="orgEmail"
                        type="email"
                        placeholder="contact@acme.com"
                        value={orgEmail}
                        onChange={(e) => setOrgEmail(e.target.value)}
                        className="pl-10 h-12"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="orgPhone">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        id="orgPhone"
                        placeholder="+91 000 000 0000"
                        value={orgPhone}
                        onChange={(e) => setOrgPhone(e.target.value)}
                        required
                        className="pl-10 h-12"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orgAddress">Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      id="orgAddress"
                      placeholder="Full organization address"
                      value={orgAddress}
                      onChange={(e) => setOrgAddress(e.target.value)}
                      required
                      className="pl-10 h-12"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gst">GST Number</Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                        id="gst"
                        placeholder="GSTIN"
                        value={gst}
                        onChange={(e) => setGst(e.target.value)}
                        className="pl-10 h-12 uppercase"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pan">PAN Number</Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                        id="pan"
                        placeholder="ABCDE1234F"
                        value={pan}
                        onChange={(e) => setPan(e.target.value)}
                        className="pl-10 h-12 uppercase"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Terms and Privacy - Only show on last step */}
            {step === 2 && (
              <div className="flex items-start space-x-2 py-2">
                <input
                  id="terms"
                  type="checkbox"
                  required
                  className="h-4 w-4 mt-0.5 rounded border-input text-primary focus:ring-ring"
                />
                <Label htmlFor="terms" className="text-sm text-muted-foreground leading-5">
                  I agree to the{" "}
                  <Link href="/terms" className="text-primary hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                </Label>
              </div>
            )}

            {/* Alerts */}
            {error && (
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="bg-green-500/10 border-green-500/20 text-green-600">
                <AlertDescription className="text-xs">{success}</AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <div className="flex gap-3">
              {step === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  className="h-12 px-6"
                  disabled={isLoading}
                >
                  Back
                </Button>
              )}
              <Button
                type="submit"
                className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading
                  ? "Processing..."
                  : step === 1
                    ? "Next: Organization Details"
                    : "Create Account"}
              </Button>
            </div>
          </form>

          {/* Sign in link */}
          <p className="text-center text-sm text-muted-foreground pt-2">
            Already have an account?{" "}
            <Link href={`/auth/login${window.location.search}`} className="text-primary hover:underline font-bold">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
