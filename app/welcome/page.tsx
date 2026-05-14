"use client"

/**
 * AA3 Sprint 1 — post-signup welcome screen. Steps: pick plan, try sample,
 * done. POSTs to /org/plan-tier (Stripe deferred). Spec:
 * docs/CUSTOMER_ONBOARDING_UX_WALKTHROUGH_2026-05-14.md.
 */
import { useCallback, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AuthGuard, useAuth } from "@/modules/auth"
import { AWS_CONFIG } from "@/shared/config/aws-config"
import { Check, FileText, ArrowRight } from "lucide-react"

type PlanTier = "free" | "starter" | "pro" | "enterprise"

const PLANS: { id: PlanTier; name: string; price: string; limit: string }[] = [
  { id: "free", name: "Free", price: "$0", limit: "100 MB / file" },
  { id: "starter", name: "Starter", price: "$49/mo", limit: "5 GB / file" },
  { id: "pro", name: "Pro", price: "$199/mo", limit: "50 GB / file" },
  { id: "enterprise", name: "Enterprise", price: "Custom", limit: "200 GB / file" },
]
const DEMO_CSV = "id,name,email,amount\n1,Alice,alice@example.com,100.00\n2,Bob,bad-email,200\n3,,c@x.com,-50\n"

function Inner() {
  const { getValidToken } = useAuth()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [plan, setPlan] = useState<PlanTier>("free")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const savePlan = useCallback(async () => {
    setSaving(true); setErr(null)
    try {
      const token = await getValidToken()
      const res = await fetch(`${AWS_CONFIG.API_BASE_URL}/org/plan-tier`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan_tier: plan }),
      })
      if (!res.ok) throw new Error(`Failed to save plan (${res.status})`)
      setStep(2)
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed") }
    finally { setSaving(false) }
  }, [getValidToken, plan])

  const downloadDemo = () => {
    const url = URL.createObjectURL(new Blob([DEMO_CSV], { type: "text/csv" }))
    const a = document.createElement("a"); a.href = url; a.download = "cleanflowai-demo.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-center mb-10 gap-3" data-testid="welcome-stepper">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {step > n ? <Check className="w-4 h-4" /> : n}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div data-testid="welcome-step-plan">
            <h1 className="text-3xl font-bold mb-2 text-center">Pick your plan</h1>
            <p className="text-muted-foreground text-center mb-8">You can change tiers anytime.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {PLANS.map((p) => (
                <Card key={p.id} data-testid={`plan-card-${p.id}`} className={`cursor-pointer ${plan === p.id ? "ring-2 ring-primary" : ""}`} onClick={() => setPlan(p.id)}>
                  <CardContent className="p-5">
                    <div className="font-semibold text-lg">{p.name}</div>
                    <div className="text-2xl font-bold my-2">{p.price}</div>
                    <div className="text-sm">{p.limit}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {err && <div className="text-sm text-destructive mb-4 text-center">{err}</div>}
            <div className="flex justify-center">
              <Button onClick={savePlan} disabled={saving} size="lg" data-testid="welcome-plan-continue">
                {saving ? "Saving…" : "Continue"} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div data-testid="welcome-step-sample">
            <h1 className="text-3xl font-bold mb-2 text-center">Try a sample file</h1>
            <p className="text-muted-foreground text-center mb-8">Drop a CSV or use our 1 KB demo.</p>
            <Card className="mb-6"><CardContent className="p-10 border-2 border-dashed rounded-lg text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <div className="text-sm text-muted-foreground mb-4">Drag & drop a file here</div>
              <Button variant="outline" data-testid="welcome-demo-csv" onClick={downloadDemo}>Use our 1 KB demo CSV</Button>
            </CardContent></Card>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)} data-testid="welcome-sample-continue">Skip for now <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center" data-testid="welcome-step-done">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">You're all set</h1>
            <p className="text-muted-foreground mb-8">Your <span className="font-semibold capitalize">{plan}</span> plan is ready.</p>
            <Link href="/dashboard"><Button size="lg" data-testid="welcome-goto-dashboard">Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function WelcomePage() { return (<AuthGuard><Inner /></AuthGuard>) }
