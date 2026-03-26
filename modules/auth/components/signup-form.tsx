"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Briefcase, Eye, EyeOff, FileText, Lock, Mail, User, Phone, MapPin } from "lucide-react";
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
        return "bg-emerald-500";
      default:
        return "bg-muted";
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
      {/* Header */}
      <div className="mb-6">
        {/* Mobile-only logo */}
        <div className="flex justify-center mb-6 lg:hidden">
          <div className="relative w-10 h-10">
            <Image src="/images/infiniqon-logo-light.png" alt="CleanFlowAI" width={40} height={40} className="object-contain" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {step === 1 ? "Create account" : "Organization details"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {step === 1 ? "Set up your account to get started" : "Tell us about your organization"}
        </p>
      </div>

      {/* Step Indicator */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className={`h-1 flex-1 rounded-full transition-colors duration-300 ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
            <div className={`h-1 flex-1 rounded-full transition-colors duration-300 ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
          </div>
          <span className="text-xs text-muted-foreground font-medium tabular-nums">Step {step} of 2</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {step === 1 ? (
          <>
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Full Name
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
                <Input
                  id="fullName"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 h-11 bg-muted/30 border-border/50 focus:bg-background focus:border-primary/50 transition-colors"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          i <= getPasswordStrength(password) ? getPasswordStrengthColor(getPasswordStrength(password)) : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider min-w-[60px] text-right">
                    {getPasswordStrengthLabel(getPasswordStrength(password))}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 h-11 bg-muted/30 border-border/50 focus:bg-background focus:border-primary/50 transition-colors"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Step 2: Org details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="orgName" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Organization Name</Label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
                  <Input id="orgName" placeholder="e.g. Acme Corp" value={orgName} onChange={(e) => setOrgName(e.target.value)} required className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background focus:border-primary/50 transition-colors" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="industry" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Industry</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
                  <Input id="industry" placeholder="e.g. Finance, Healthcare" value={industry} onChange={(e) => setIndustry(e.target.value)} required className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background focus:border-primary/50 transition-colors" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="orgEmail" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
                  <Input id="orgEmail" type="email" placeholder="contact@acme.com" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background focus:border-primary/50 transition-colors" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="orgPhone" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
                  <Input id="orgPhone" placeholder="+91 000 000 0000" value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} required className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background focus:border-primary/50 transition-colors" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="orgAddress" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
                <Input id="orgAddress" placeholder="Full organization address" value={orgAddress} onChange={(e) => setOrgAddress(e.target.value)} required className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background focus:border-primary/50 transition-colors" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="gst" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">GST Number</Label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
                  <Input id="gst" placeholder="GSTIN" value={gst} onChange={(e) => setGst(e.target.value)} className="pl-10 h-11 uppercase bg-muted/30 border-border/50 focus:bg-background focus:border-primary/50 transition-colors" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pan" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">PAN Number</Label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4" />
                  <Input id="pan" placeholder="ABCDE1234F" value={pan} onChange={(e) => setPan(e.target.value)} className="pl-10 h-11 uppercase bg-muted/30 border-border/50 focus:bg-background focus:border-primary/50 transition-colors" />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Terms - only on last step */}
        {step === 2 && (
          <div className="flex items-start space-x-2.5 pt-1">
            <input id="terms" type="checkbox" required className="h-3.5 w-3.5 mt-0.5 rounded border-border text-primary focus:ring-ring" />
            <Label htmlFor="terms" className="text-xs text-muted-foreground leading-5 cursor-pointer">
              I agree to the{" "}
              <Link href="/terms" className="text-primary hover:text-primary/80 transition-colors">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-primary hover:text-primary/80 transition-colors">
                Privacy Policy
              </Link>
            </Label>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
            <AlertDescription className="text-destructive text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-500/5 border-green-500/20">
            <AlertDescription className="text-green-600 dark:text-green-400 text-sm">{success}</AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          {step === 2 && (
            <Button type="button" variant="outline" onClick={prevStep} className="h-11 px-5" disabled={isLoading}>
              Back
            </Button>
          )}
          <Button
            type="submit"
            className="flex-1 h-11 font-medium transition-all"
            disabled={isLoading}
          >
            {isLoading
              ? "Processing..."
              : step === 1
                ? "Continue"
                : "Create Account"}
          </Button>
        </div>
      </form>

      {/* Sign in link */}
      <p className="text-center text-sm text-muted-foreground mt-8">
        Already have an account?{" "}
        <Link href={`/auth/login${window.location.search}`} className="text-primary hover:text-primary/80 font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
