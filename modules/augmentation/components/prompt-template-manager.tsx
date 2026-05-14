"use client"

import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/modules/auth"
import { useToast } from "@/shared/hooks/use-toast"
import {
    deletePromptTemplateVersion, listPromptTemplates, registerPromptTemplate,
} from "@/modules/augmentation/api/augmentation-api"
import type { PromptCardinality, PromptTemplate, RegisterTemplateBody } from "@/modules/augmentation/types"

export function PromptTemplateManager() {
    const { idToken } = useAuth()
    const { toast } = useToast()
    const [templates, setTemplates] = useState<PromptTemplate[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [tplId, setTplId] = useState("")
    const [text, setText] = useState("")
    const [card, setCard] = useState<PromptCardinality>("ONE_TO_MANY")
    const [inSchema, setInSchema] = useState("{}")
    const [outSchema, setOutSchema] = useState("{}")
    const [busy, setBusy] = useState(false)

    const load = async () => {
        if (!idToken) return
        setLoading(true)
        try { setTemplates(await listPromptTemplates(idToken, { active: true })); setError(null) }
        catch (err) { setError((err as Error).message) }
        finally { setLoading(false) }
    }

    useEffect(() => { void load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [idToken])

    const onRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!idToken) return
        if (!tplId.trim() || !text.trim()) { setError("Template ID and prompt text are required"); return }
        let parsedIn: Record<string, unknown>, parsedOut: Record<string, unknown>
        try { parsedIn = JSON.parse(inSchema || "{}"); parsedOut = JSON.parse(outSchema || "{}") }
        catch { setError("Schema fields must be valid JSON"); return }
        const body: RegisterTemplateBody = {
            template_id: tplId.trim(), prompt_text: text, cardinality: card,
            expected_input_schema: parsedIn, expected_output_schema: parsedOut,
        }
        setBusy(true)
        try {
            await registerPromptTemplate(idToken, body)
            setTplId(""); setText(""); setInSchema("{}"); setOutSchema("{}")
            await load()
            toast({ title: "Template registered", description: `${body.template_id} is now active.` })
        } catch (err) {
            const message = (err as Error).message
            setError(message)
            // The inline error region is below the form, easy to miss on a
            // long page — also fire a toast so mutation failures cannot be
            // silently dismissed.
            toast({ title: "Failed to register template", description: message, variant: "destructive" })
        }
        finally { setBusy(false) }
    }

    const onDeactivate = async (t: PromptTemplate) => {
        if (!idToken) return
        setBusy(true)
        try {
            await deletePromptTemplateVersion(t.template_id, t.version, idToken)
            await load()
            toast({ title: "Template deactivated", description: `${t.template_id} v${t.version} is no longer active.` })
        }
        catch (err) {
            const message = (err as Error).message
            setError(message)
            toast({ title: "Failed to deactivate template", description: message, variant: "destructive" })
        }
        finally { setBusy(false) }
    }

    return (
        <div className="space-y-6" data-testid="prompt-template-manager">
            <form onSubmit={onRegister} className="grid gap-3 rounded-md border p-4">
                <h3 className="font-semibold">Register new template</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <Label htmlFor="tpl-id">Template ID</Label>
                        <Input id="tpl-id" value={tplId} onChange={(e) => setTplId(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="tpl-card">Cardinality</Label>
                        <Select value={card} onValueChange={(v) => setCard(v as PromptCardinality)}>
                            <SelectTrigger id="tpl-card"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ONE_TO_MANY">ONE_TO_MANY</SelectItem>
                                <SelectItem value="MANY_TO_ONE">MANY_TO_ONE</SelectItem>
                                <SelectItem value="MANY_TO_MANY">MANY_TO_MANY</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="tpl-text">Prompt text</Label>
                    <Textarea id="tpl-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <Label htmlFor="tpl-in">Input schema (JSON)</Label>
                        <Textarea id="tpl-in" rows={3} value={inSchema}
                            onChange={(e) => setInSchema(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="tpl-out">Output schema (JSON)</Label>
                        <Textarea id="tpl-out" rows={3} value={outSchema}
                            onChange={(e) => setOutSchema(e.target.value)} />
                    </div>
                </div>
                {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
                <div className="flex justify-end">
                    <Button type="submit" disabled={busy}>Register</Button>
                </div>
            </form>
            <div>
                <h3 className="mb-2 font-semibold">Active templates ({templates.length})</h3>
                {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
                    <Table>
                        <TableHeader><TableRow>
                            <TableHead>Template ID</TableHead><TableHead>Version</TableHead>
                            <TableHead>Cardinality</TableHead><TableHead className="text-right">Actions</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                            {templates.length === 0 && (
                                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">
                                    No active templates yet.</TableCell></TableRow>
                            )}
                            {templates.map((t) => (
                                <TableRow key={`${t.template_id}-${t.version}`}>
                                    <TableCell className="font-mono text-xs">{t.template_id}</TableCell>
                                    <TableCell><Badge variant="outline">v{t.version}</Badge></TableCell>
                                    <TableCell>{t.cardinality}</TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" variant="ghost" disabled={busy}
                                            onClick={() => onDeactivate(t)}
                                            aria-label={`Deactivate ${t.template_id} v${t.version}`}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
    )
}
