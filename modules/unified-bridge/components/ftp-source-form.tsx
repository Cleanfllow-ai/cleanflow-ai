"use client"

import { useState } from "react"
import { FolderDown, Eye, EyeOff, Loader2, CheckCircle, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { fileManagementAPI, type FtpIngestionConfig } from "@/modules/files"

interface FtpSourceFormProps {
    mode?: "source" | "destination"
    token: string
    onIngestionStart: () => void
    onIngestionComplete: (result: { success: boolean; message: string; uploadId?: string }) => void
    onError: (error: string) => void
    disabled?: boolean
}

type FtpProtocol = "ftp" | "ftps" | "ftps_implicit" | "sftp"
type SftpAuthType = "password" | "ssh_key"

export default function FtpSourceForm({
    mode = "source",
    token,
    onIngestionStart,
    onIngestionComplete,
    onError,
    disabled,
}: FtpSourceFormProps) {
    const [host, setHost] = useState("")
    const [port, setPort] = useState("21")
    const [protocol, setProtocol] = useState<FtpProtocol>("ftp")
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [remotePath, setRemotePath] = useState("")
    const [filename, setFilename] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isTesting, setIsTesting] = useState(false)
    // SFTP SSH Key auth
    const [sftpAuthType, setSftpAuthType] = useState<SftpAuthType>("password")
    const [sshPrivateKey, setSshPrivateKey] = useState("")
    const [sshKeyPassphrase, setSshKeyPassphrase] = useState("")

    const handleProtocolChange = (value: FtpProtocol) => {
        setProtocol(value)
        if (value === "sftp") {
            setPort("22")
        } else if (value === "ftps_implicit") {
            setPort("990")
        } else {
            setPort("21")
        }
    }

    const handleTest = async () => {
        setIsTesting(true)
        try {
            const result = await fileManagementAPI.testFtpConnection({
                host,
                port: parseInt(port),
                protocol,
                username,
                password,
                remote_path: remotePath,
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
        if (!host || !remotePath || !filename) {
            onError("Please fill in all required fields")
            return
        }

        setIsLoading(true)
        onIngestionStart()

        try {
            const config: FtpIngestionConfig = {
                host,
                port: parseInt(port),
                protocol,
                username: username || undefined,
                password: password || undefined,
                remote_path: remotePath,
                filename,
            }

            // Add SSH key auth for SFTP
            if (protocol === "sftp" && sftpAuthType === "ssh_key") {
                config.auth = {
                    type: "ssh_key",
                    private_key: sshPrivateKey,
                    key_passphrase: sshKeyPassphrase || undefined,
                }
            }

            const result = await fileManagementAPI.ingestFromFtp(config, token)

            onIngestionComplete({
                success: true,
                message: `Successfully ingested ${result.filename} (${(result.size_bytes / 1024).toFixed(1)} KB)`,
                uploadId: result.upload_id,
            })
        } catch (err: any) {
            onError(err.message || "FTP ingestion failed")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Protocol Selection */}
            <div className="space-y-2">
                <Label>Protocol</Label>
                <RadioGroup
                    value={protocol}
                    onValueChange={handleProtocolChange}
                    className="flex flex-wrap gap-4"
                    disabled={disabled || isLoading}
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ftp" id="ftp" />
                        <Label htmlFor="ftp" className="cursor-pointer">FTP</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ftps" id="ftps" />
                        <Label htmlFor="ftps" className="cursor-pointer">FTPS (TLS)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sftp" id="sftp" />
                        <Label htmlFor="sftp" className="cursor-pointer">SFTP (SSH)</Label>
                    </div>
                </RadioGroup>
            </div>

            {/* Host & Port */}
            <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                    <Label htmlFor="host">Host *</Label>
                    <Input
                        id="host"
                        placeholder="ftp.example.com"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        disabled={disabled || isLoading}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                        id="port"
                        type="number"
                        placeholder={protocol === "sftp" ? "22" : "21"}
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        disabled={disabled || isLoading}
                    />
                </div>
            </div>

            {/* Credentials */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                        id="username"
                        placeholder="anonymous"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={disabled || isLoading}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={disabled || isLoading}
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={disabled || isLoading}
                        >
                            {showPassword ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* SFTP Auth Type Selection */}
            {protocol === "sftp" && (
                <div className="space-y-3">
                    <div className="space-y-2">
                        <Label>SFTP Authentication</Label>
                        <RadioGroup
                            value={sftpAuthType}
                            onValueChange={(v) => setSftpAuthType(v as SftpAuthType)}
                            className="flex gap-4"
                            disabled={disabled || isLoading}
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="password" id="auth-password" />
                                <Label htmlFor="auth-password" className="cursor-pointer">Password</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="ssh_key" id="auth-sshkey" />
                                <Label htmlFor="auth-sshkey" className="cursor-pointer flex items-center gap-1">
                                    <Key className="h-3 w-3" /> SSH Key
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* SSH Key Fields */}
                    {sftpAuthType === "ssh_key" && (
                        <div className="space-y-3 p-3 rounded-lg border bg-muted/50">
                            <div className="space-y-2">
                                <Label htmlFor="ssh-key">Private Key (PEM format)</Label>
                                <Textarea
                                    id="ssh-key"
                                    placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                                    value={sshPrivateKey}
                                    onChange={(e) => setSshPrivateKey(e.target.value)}
                                    disabled={disabled || isLoading}
                                    rows={4}
                                    className="font-mono text-xs"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="key-passphrase">Key Passphrase (optional)</Label>
                                <Input
                                    id="key-passphrase"
                                    type="password"
                                    placeholder="Enter passphrase if key is encrypted"
                                    value={sshKeyPassphrase}
                                    onChange={(e) => setSshKeyPassphrase(e.target.value)}
                                    disabled={disabled || isLoading}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Remote Path */}
            <div className="space-y-2">
                <Label htmlFor="remotePath">Remote Path *</Label>
                <Input
                    id="remotePath"
                    placeholder="/export/data/customers.csv"
                    value={remotePath}
                    onChange={(e) => setRemotePath(e.target.value)}
                    disabled={disabled || isLoading}
                />
                <p className="text-xs text-muted-foreground">
                    Full path to the file on the remote server
                </p>
            </div>

            {/* Output Filename */}
            <div className="space-y-2">
                <Label htmlFor="filename">Save As *</Label>
                <Input
                    id="filename"
                    placeholder="customers.csv"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    disabled={disabled || isLoading}
                />
                <p className="text-xs text-muted-foreground">
                    Filename to use in the DQ pipeline
                </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
                <Button
                    variant="outline"
                    onClick={handleTest}
                    disabled={disabled || isLoading || isTesting || !host}
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
                    disabled={disabled || isLoading || !host || !remotePath || !filename}
                    className="gap-2 flex-1"
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <FolderDown className="h-4 w-4" />
                    )}
                    {isLoading ? "Ingesting..." : mode === "source" ? "Ingest Data" : "Push Data"}
                </Button>
            </div>
        </div>
    )
}
