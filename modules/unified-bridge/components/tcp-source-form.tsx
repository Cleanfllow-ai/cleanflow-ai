"use client"

import { useState } from "react"
import { Network, Loader2, CheckCircle, Shield, Eye, EyeOff, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fileManagementAPI, type TcpIngestionConfig } from "@/modules/files"

interface TcpSourceFormProps {
    mode?: "source" | "destination"
    token: string
    onIngestionStart: () => void
    onIngestionComplete: (result: { success: boolean; message: string; uploadId?: string }) => void
    onError: (error: string) => void
    disabled?: boolean
}

type TcpAuthType = "none" | "token" | "userpass"

export default function TcpSourceForm({
    mode = "source",
    token,
    onIngestionStart,
    onIngestionComplete,
    onError,
    disabled,
}: TcpSourceFormProps) {
    const [host, setHost] = useState("")
    const [port, setPort] = useState("")
    const [timeout, setTimeout] = useState("30")
    const [delimiter, setDelimiter] = useState("")
    const [requestData, setRequestData] = useState("")
    const [filename, setFilename] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isTesting, setIsTesting] = useState(false)
    // TLS settings
    const [tlsEnabled, setTlsEnabled] = useState(false)
    const [tlsVerifyCert, setTlsVerifyCert] = useState(true)
    // Auth settings
    const [authType, setAuthType] = useState<TcpAuthType>("none")
    const [authToken, setAuthToken] = useState("")
    const [authUsername, setAuthUsername] = useState("")
    const [authPassword, setAuthPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)

    const handleTest = async () => {
        setIsTesting(true)
        try {
            const result = await fileManagementAPI.testTcpConnection({
                host,
                port: parseInt(port),
                timeout_seconds: parseInt(timeout),
                delimiter,
            })
            if (result.success) {
                onIngestionComplete({ success: true, message: result.message })
            } else {
                onError(result.message)
            }
        } catch (err: any) {
            onError(err.message || "Connection test failed")
        } finally {
            setIsTesting(false)
        }
    }

    const handleIngest = async () => {
        if (!host || !port || !filename) {
            onError("Please fill in all required fields")
            return
        }

        setIsLoading(true)
        onIngestionStart()

        try {
            const config: TcpIngestionConfig = {
                host,
                port: parseInt(port),
                timeout_seconds: parseInt(timeout) || 30,
                delimiter: delimiter || undefined,
                request_data: requestData || undefined,
                filename,
            }

            // Add TLS config if enabled
            if (tlsEnabled) {
                config.tls = {
                    enabled: true,
                    verify_cert: tlsVerifyCert,
                }
            }

            // Add auth config
            if (authType === "token") {
                config.auth = {
                    type: "token",
                    token: authToken,
                }
            } else if (authType === "userpass") {
                config.auth = {
                    type: "userpass",
                    username: authUsername,
                    password: authPassword,
                }
            }

            const result = await fileManagementAPI.ingestFromTcp(config, token)

            onIngestionComplete({
                success: true,
                message: `Successfully ingested ${result.filename} (${(result.size_bytes / 1024).toFixed(1)} KB)`,
                uploadId: result.upload_id,
            })
        } catch (err: any) {
            onError(err.message || "TCP ingestion failed")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Host & Port */}
            <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                    <Label htmlFor="tcp-host">Host *</Label>
                    <Input
                        id="tcp-host"
                        placeholder="192.168.1.100"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        disabled={disabled || isLoading}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="tcp-port">Port *</Label>
                    <Input
                        id="tcp-port"
                        type="number"
                        placeholder="9000"
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        disabled={disabled || isLoading}
                    />
                </div>
            </div>

            {/* TLS Settings */}
            <div className="space-y-3 p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="tls-toggle" className="cursor-pointer">Enable TLS Encryption</Label>
                    </div>
                    <Switch
                        id="tls-toggle"
                        checked={tlsEnabled}
                        onCheckedChange={setTlsEnabled}
                        disabled={disabled || isLoading}
                    />
                </div>
                {tlsEnabled && (
                    <div className="flex items-center justify-between pt-2 border-t">
                        <Label htmlFor="verify-cert" className="text-sm text-muted-foreground cursor-pointer">
                            Verify server certificate
                        </Label>
                        <Switch
                            id="verify-cert"
                            checked={tlsVerifyCert}
                            onCheckedChange={setTlsVerifyCert}
                            disabled={disabled || isLoading}
                        />
                    </div>
                )}
            </div>

            {/* Authentication */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <Label>Authentication</Label>
                </div>
                <Select value={authType} onValueChange={(v) => setAuthType(v as TcpAuthType)} disabled={disabled || isLoading}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="token">Token</SelectItem>
                        <SelectItem value="userpass">Username & Password</SelectItem>
                    </SelectContent>
                </Select>

                {/* Token Auth */}
                {authType === "token" && (
                    <div className="space-y-2">
                        <Label htmlFor="tcp-token">Auth Token</Label>
                        <Input
                            id="tcp-token"
                            type="password"
                            placeholder="Enter authentication token"
                            value={authToken}
                            onChange={(e) => setAuthToken(e.target.value)}
                            disabled={disabled || isLoading}
                        />
                        <p className="text-xs text-muted-foreground">
                            Will send: AUTH {"{token}"}\n to the server
                        </p>
                    </div>
                )}

                {/* Username & Password Auth */}
                {authType === "userpass" && (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="tcp-username">Username</Label>
                            <Input
                                id="tcp-username"
                                placeholder="username"
                                value={authUsername}
                                onChange={(e) => setAuthUsername(e.target.value)}
                                disabled={disabled || isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tcp-password">Password</Label>
                            <div className="relative">
                                <Input
                                    id="tcp-password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="password"
                                    value={authPassword}
                                    onChange={(e) => setAuthPassword(e.target.value)}
                                    disabled={disabled || isLoading}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Timeout & Delimiter */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label htmlFor="tcp-timeout">Timeout (seconds)</Label>
                    <Input
                        id="tcp-timeout"
                        type="number"
                        placeholder="30"
                        value={timeout}
                        onChange={(e) => setTimeout(e.target.value)}
                        disabled={disabled || isLoading}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="tcp-delimiter">End Delimiter</Label>
                    <Input
                        id="tcp-delimiter"
                        placeholder="\n---END---\n"
                        value={delimiter}
                        onChange={(e) => setDelimiter(e.target.value)}
                        disabled={disabled || isLoading}
                    />
                </div>
            </div>

            {/* Request Data */}
            <div className="space-y-2">
                <Label htmlFor="tcp-request">Request Data (Optional)</Label>
                <Textarea
                    id="tcp-request"
                    placeholder="Data to send to initiate transfer..."
                    value={requestData}
                    onChange={(e) => setRequestData(e.target.value)}
                    disabled={disabled || isLoading}
                    rows={3}
                />
                <p className="text-xs text-muted-foreground">
                    Optional data to send when connection is established
                </p>
            </div>

            {/* Output Filename */}
            <div className="space-y-2">
                <Label htmlFor="tcp-filename">Save As *</Label>
                <Input
                    id="tcp-filename"
                    placeholder="tcp_data.csv"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    disabled={disabled || isLoading}
                />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
                <Button
                    variant="outline"
                    onClick={handleTest}
                    disabled={disabled || isLoading || isTesting || !host || !port}
                    className="gap-2"
                >
                    {isTesting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <CheckCircle className="h-4 w-4" />
                    )}
                    Test Connection
                </Button>
                <Button
                    onClick={handleIngest}
                    disabled={disabled || isLoading || !host || !port || !filename}
                    className="gap-2 flex-1"
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Network className="h-4 w-4" />
                    )}
                    {isLoading ? "Ingesting..." : mode === "source" ? "Ingest Data" : "Push Data"}
                </Button>
            </div>
        </div>
    )
}
