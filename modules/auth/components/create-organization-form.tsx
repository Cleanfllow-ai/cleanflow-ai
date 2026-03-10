"use client";

import { useAuth } from "@/modules/auth/providers/auth-provider";
import { orgAPI } from "@/modules/auth/api/org-api";
import { useToast } from "@/shared/hooks/use-toast";
import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Briefcase, Mail, Phone, MapPin, FileText, CheckCircle2, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CreateOrganizationForm() {
    const { user, isAuthenticated, isLoading: isAuthLoading, refreshPermissions } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    // Flow detection
    const inviteId = searchParams.get("invite_id");
    const orgId = searchParams.get("org_id");
    const inviteToken = searchParams.get("token");
    const isInviteFlow = !!(inviteId && orgId && inviteToken);
    const hasInvalidInviteLink = !!(inviteId && orgId && !inviteToken);

    // Form fields for registration
    const [orgName, setOrgName] = useState("");
    const [orgEmail, setOrgEmail] = useState("");
    const [orgPhone, setOrgPhone] = useState("");
    const [orgAddress, setOrgAddress] = useState("");
    const [industry, setIndustry] = useState("");
    const [gst, setGst] = useState("");
    const [pan, setPan] = useState("");
    const autoRegisterAttempted = useRef(false);

    useEffect(() => {
        if (!isAuthLoading && !isAuthenticated) {
            const params = new URLSearchParams(searchParams.toString());
            if (inviteId && orgId) {
                router.push(`/auth/login?${params.toString()}`);
            } else {
                router.push(`/auth/signup?${params.toString()}`);
            }
        }
    }, [isAuthenticated, isAuthLoading, router, searchParams, inviteId, orgId]);

    useEffect(() => {
        const checkMembership = async () => {
            if (!isAuthenticated || isAuthLoading || !orgId) return;
            try {
                const me = await orgAPI.getMe();
                if (me.membership && me.membership.org_id === orgId) {
                    setError("You are already a member of this organization.");
                } else if (me.membership) {
                    // They are in a DIFFERENT org. We allow joining, but could show a notice.
                    console.log(`User already in org ${me.membership.org_id}, joining ${orgId}`);
                }
            } catch (err: any) {
                // If "Organization membership required" or other error, it means they can join.
                console.log("No existing membership found, proceeding...");
            }
        };
        checkMembership();
    }, [isAuthenticated, isAuthLoading, orgId]);

    useEffect(() => {
        const autoRegisterFromSignup = async () => {
            if (!isAuthenticated || isAuthLoading || isInviteFlow || autoRegisterAttempted.current) return;
            autoRegisterAttempted.current = true;
            const pendingOrgRaw = sessionStorage.getItem("pending_org_details");
            if (!pendingOrgRaw) return;

            setIsLoading(true);
            setError("");
            try {
                const pendingOrg = JSON.parse(pendingOrgRaw);
                await orgAPI.registerOrg({
                    name: pendingOrg.name,
                    email: pendingOrg.email || user?.email || "",
                    phone: pendingOrg.phone,
                    address: pendingOrg.address,
                    industry: pendingOrg.industry,
                    gst: pendingOrg.gst,
                    pan: pendingOrg.pan,
                    contact_person: pendingOrg.contact_person || user?.name,
                    subscriptionPlan: "standard",
                });
                sessionStorage.removeItem("pending_org_details");
                await refreshPermissions();
                router.replace("/dashboard");
                return;
            } catch {
                // Keep form available as fallback if auto-registration fails.
            } finally {
                setIsLoading(false);
            }
        };
        autoRegisterFromSignup();
    }, [isAuthenticated, isAuthLoading, isInviteFlow, refreshPermissions, router, user?.email, user?.name]);

    const handleAcceptInvite = async () => {
        if (!orgId || !inviteId || !inviteToken) return;
        setIsLoading(true);
        setError("");

        try {
            await orgAPI.acceptInvite(orgId, inviteId, inviteToken);
            setSuccess(true);
            toast({
                title: "Success",
                description: "You have joined the organization.",
            });
            await refreshPermissions();
            setTimeout(() => router.push("/dashboard"), 1500);
        } catch (err: any) {
            setError(err.message || "Failed to accept invitation.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegisterOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            await orgAPI.registerOrg({
                name: orgName,
                email: orgEmail || user?.email,
                phone: orgPhone,
                address: orgAddress,
                industry,
                gst,
                pan,
                contact_person: user?.name,
                subscriptionPlan: "standard",
            });
            setSuccess(true);
            toast({
                title: "Success",
                description: "Organization created successfully.",
            });
            await refreshPermissions();
            setTimeout(() => router.push("/dashboard"), 1500);
        } catch (err: any) {
            setError(err.message || "Failed to register organization.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isAuthLoading) {
        return (
            <Card className="w-full max-w-lg mx-auto mt-12">
                <CardContent className="py-12 flex flex-col items-center justify-center space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-muted-foreground">Checking authentication...</p>
                </CardContent>
            </Card>
        );
    }

    if (success) {
        return (
            <Card className="w-full max-w-lg mx-auto mt-12 border-green-200 bg-green-50/30">
                <CardContent className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
                    <CheckCircle2 className="h-16 w-16 text-green-500" />
                    <CardTitle className="text-2xl text-green-700">Setup Complete!</CardTitle>
                    <CardDescription className="text-green-600">
                        {isInviteFlow
                            ? "You've successfully joined the organization."
                            : "Your organization is ready to go."}
                    </CardDescription>
                    <p className="text-sm text-green-600 animate-pulse">Redirecting to dashboard...</p>
                </CardContent>
            </Card>
        );
    }

    if (hasInvalidInviteLink) {
        return (
            <Card className="w-full max-w-lg mx-auto mt-12">
                <CardHeader>
                    <CardTitle>Invalid Invite Link</CardTitle>
                    <CardDescription>
                        This invite link is missing required security parameters.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertDescription>
                            Please ask your administrator to revoke and resend the invitation.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    if (isInviteFlow) {
        return (
            <Card className="w-full max-w-lg mx-auto mt-12 overflow-hidden border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
                <CardHeader className="text-center pb-2">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-primary/10 rounded-full text-primary">
                            <UserPlus className="h-8 w-8" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl">Join Organization</CardTitle>
                    <CardDescription>
                        You've been invited to join an organization. Click below to accept and start collaborating.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    <Button
                        onClick={handleAcceptInvite}
                        className="w-full h-12 font-bold text-lg"
                        disabled={isLoading}
                    >
                        {isLoading ? "Joining..." : "Accept Invitation"}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                        By clicking accept, you will be added as a member with the role assigned by the administrator.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-2xl mx-auto mt-12 mb-12">
            <CardHeader>
                <CardTitle className="text-2xl">Register Organization</CardTitle>
                <CardDescription>
                    Complete your account setup by providing your organization details.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleRegisterOrg} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="orgName">Organization Name</Label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="orgName"
                                    placeholder="e.g. Acme Corp"
                                    value={orgName}
                                    onChange={(e) => setOrgName(e.target.value)}
                                    required
                                    className="pl-10 h-11"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="industry">Industry</Label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="industry"
                                    placeholder="e.g. Technology"
                                    value={industry}
                                    onChange={(e) => setIndustry(e.target.value)}
                                    required
                                    className="pl-10 h-11"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="orgEmail">Contact Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="orgEmail"
                                    type="email"
                                    placeholder="contact@company.com"
                                    value={orgEmail}
                                    onChange={(e) => setOrgEmail(e.target.value)}
                                    className="pl-10 h-11"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="orgPhone">Phone Number</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="orgPhone"
                                    placeholder="+91..."
                                    value={orgPhone}
                                    onChange={(e) => setOrgPhone(e.target.value)}
                                    required
                                    className="pl-10 h-11"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="orgAddress">Address</Label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="orgAddress"
                                placeholder="Full address"
                                value={orgAddress}
                                onChange={(e) => setOrgAddress(e.target.value)}
                                required
                                className="pl-10 h-11"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="gst">GSTIN</Label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="gst"
                                    placeholder="GST Number"
                                    value={gst}
                                    onChange={(e) => setGst(e.target.value)}
                                    className="pl-10 h-11 uppercase"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="pan">PAN</Label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="pan"
                                    placeholder="PAN Number"
                                    value={pan}
                                    onChange={(e) => setPan(e.target.value)}
                                    className="pl-10 h-11 uppercase"
                                />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <Button type="submit" className="w-full h-12 font-bold" disabled={isLoading}>
                        {isLoading ? "Processing..." : "Register & Continue"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
