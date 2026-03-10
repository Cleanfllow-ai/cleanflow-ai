"use client";

import { Building2, Loader2, Mail, MapPin, Phone, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionWrapper } from "@/modules/auth/components/permission-wrapper";
import type { AppRole } from "./use-org-settings";

interface OrgGeneralTabProps {
  currentUserRole: AppRole | undefined;
  canManageSettingsPermission: boolean;
  canManageOrganization: boolean;
  logoDataUrl: string;
  logoInputRef: React.RefObject<HTMLInputElement | null>;
  orgSettings: {
    name: string;
    email: string;
    phone: string;
    address: string;
    industry: string;
    gst: string;
    pan: string;
    contact_person: string;
    subscriptionPlan: string;
  };
  isSavingOrg: boolean;
  handleLogoUploadClick: () => void;
  handleLogoSelected: (file?: File) => void;
  handleOrgChange: (field: string, value: string) => void;
  handleSaveOrg: () => Promise<void>;
}

export function OrgGeneralTab({
  currentUserRole,
  canManageSettingsPermission,
  canManageOrganization,
  logoDataUrl,
  logoInputRef,
  orgSettings,
  isSavingOrg,
  handleLogoUploadClick,
  handleLogoSelected,
  handleOrgChange,
  handleSaveOrg,
}: OrgGeneralTabProps) {
  return (
    <PermissionWrapper
      permission={canManageSettingsPermission}
      permissionKey="settings"
      userRole={currentUserRole}
      message="You do not have permission to manage organization profile."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Organization Details
          </CardTitle>
          <CardDescription>
            Manage your organization's information and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Section */}
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-muted-foreground/30 overflow-hidden">
              {logoDataUrl ? (
                <img
                  src={logoDataUrl}
                  alt="Organization logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <Building2 className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Organization Logo</h4>
              <p className="text-sm text-muted-foreground">
                Upload a logo for your organization
              </p>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogoSelected(e.target.files?.[0])}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogoUploadClick}
                disabled={!canManageOrganization}
              >
                Upload Logo
              </Button>
            </div>
          </div>

          <Separator />

          {/* Organization Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="Infiniqon"
                value={orgSettings.name}
                onChange={(e) => handleOrgChange("name", e.target.value)}
                disabled={!canManageOrganization}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="org-email"
                  className="pl-10"
                  placeholder="contact@infiniqon.com"
                  value={orgSettings.email}
                  onChange={(e) => handleOrgChange("email", e.target.value)}
                  disabled={!canManageOrganization}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-phone">Contact Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="org-phone"
                  className="pl-10"
                  placeholder="+91 63 4567 8900"
                  value={orgSettings.phone}
                  onChange={(e) => handleOrgChange("phone", e.target.value)}
                  disabled={!canManageOrganization}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-address">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="org-address"
                  className="pl-10"
                  placeholder="Ekkaduthangal, Chennai, Tamil Nadu"
                  value={orgSettings.address}
                  onChange={(e) => handleOrgChange("address", e.target.value)}
                  disabled={!canManageOrganization}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Subscription Plan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select
                value={orgSettings.subscriptionPlan}
                onValueChange={(value) =>
                  handleOrgChange("subscriptionPlan", value)
                }
                disabled={!canManageOrganization}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button
              onClick={handleSaveOrg}
              disabled={isSavingOrg || !canManageOrganization}
            >
              {isSavingOrg && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {isSavingOrg ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PermissionWrapper>
  );
}
