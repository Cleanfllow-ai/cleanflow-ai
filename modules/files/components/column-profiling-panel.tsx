import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  BarChart, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Database,
  BrainCircuit,
  Search
} from "lucide-react"
import type { ProfilingResponse } from "@/modules/files/api/file-management-api"
import { getRuleMeta } from "@/shared/lib/rule-metadata"

const RULE_SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/10 text-red-700 border-red-500/20",
  warning: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  info: "bg-blue-500/10 text-blue-700 border-blue-500/20",
}

interface ColumnProfilingPanelProps {
  data: ProfilingResponse | null
  loading: boolean
  embedded?: boolean
}

export function ColumnProfilingPanel({ data, loading, embedded }: ColumnProfilingPanelProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground animate-pulse">Loading profiling data...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">No profiling data available for this file.</p>
      </div>
    )
  }

  const { summary, profiles } = data
  const columns = Object.entries(profiles)

  const totalRules = summary.total_rules || columns.reduce((acc, [_, p]) => acc + p.rules.length, 0)
  const totalAuto = columns.reduce(
    (acc, [_, p]) => acc + p.rules.filter(r => r.decision === 'auto').length, 0
  )
  const totalHuman = columns.reduce(
    (acc, [_, p]) => acc + p.rules.filter(r => r.decision === 'human').length, 0
  )
  const totalNoRules = columns.reduce((acc, [_, p]) => acc + (p.rules.length === 0 ? 1 : 0), 0)
  const totalProfileTime = columns.reduce((acc, [_, p]) => acc + (p.profile_time_sec || 0), 0)
  const totalLlmTime = columns.reduce((acc, [_, p]) => acc + (p.llm_time_sec || 0), 0)
  const avgProfileTime = columns.length ? totalProfileTime / columns.length : 0
  const avgLlmTime = columns.length ? totalLlmTime / columns.length : 0

  const summaryCards = (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Columns</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_columns}</div>
            <p className="text-xs text-muted-foreground">
              {totalRules} rules suggested
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rules Suggested</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRules}</div>
            <p className="text-xs text-muted-foreground">
              {summary.total_columns} columns analyzed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto Rules</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAuto}</div>
            <div className="text-xs text-muted-foreground mt-1">
              <Progress value={(totalAuto / (totalRules || 1)) * 100} className="h-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Human Review</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHuman}</div>
            <p className="text-xs text-muted-foreground">
              {((totalHuman / (totalRules || 1)) * 100).toFixed(0)}% of suggestions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Columns With No Rules</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalNoRules}</div>
            <p className="text-xs text-muted-foreground">
              {((totalNoRules / (summary.total_columns || 1)) * 100).toFixed(0)}% of columns
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profiling Time (total)</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProfileTime.toFixed(2)}s</div>
            <p className="text-xs text-muted-foreground">
              {summary.total_columns} columns profiled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profiling Avg/col</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgProfileTime.toFixed(2)}s</div>
            <p className="text-xs text-muted-foreground">Average per column</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CleanAI Time (total)</CardTitle>
            <BrainCircuit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLlmTime.toFixed(2)}s</div>
            <p className="text-xs text-muted-foreground">CleanAI suggestions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CleanAI Avg/col</CardTitle>
            <BrainCircuit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgLlmTime.toFixed(2)}s</div>
            <p className="text-xs text-muted-foreground">Average per column</p>
          </CardContent>
        </Card>
      </div>
    </>
  )

  const detailsTable = (
    <div className="w-full rounded-md border overflow-x-auto">
      <div className="min-w-[960px] max-h-[60vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Column</TableHead>
              <TableHead className="w-[160px]">Type Guess</TableHead>
              <TableHead className="w-[90px]">Type Conf</TableHead>
              <TableHead>Top Rules</TableHead>
              <TableHead className="w-[90px] text-right">Rule Count</TableHead>
              <TableHead className="w-[70px] text-right">Auto</TableHead>
              <TableHead className="w-[70px] text-right">Human</TableHead>
              <TableHead className="w-[110px] text-right">Null Rate</TableHead>
              <TableHead className="w-[120px] text-right">Unique Ratio</TableHead>
              <TableHead className="w-[120px] text-right">Profile Time (s)</TableHead>
              <TableHead className="w-[110px] text-right">CleanAI Time (s)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {columns.map(([name, profile]) => {
              const autoCount = profile.rules.filter(r => r.decision === 'auto').length
              const humanCount = profile.rules.filter(r => r.decision === 'human').length
              return (
              <TableRow key={name}>
                <TableCell className="font-medium align-top">
                  {name}
                  <div className="flex gap-1 mt-1">
                    <Badge variant="outline" className="text-[10px] px-1 h-5">
                      {profile.rules.length} rules
                    </Badge>
                  </div>
                </TableCell>

                <TableCell className="align-top">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-xs font-semibold">
                      {profile.type_guess}
                    </span>
                  </div>
                </TableCell>

                <TableCell className="align-top text-xs text-right tabular-nums">
                  {profile.type_confidence > 0
                    ? `${(profile.type_confidence * 100).toFixed(0)}%`
                    : "-"}
                </TableCell>

                <TableCell className="align-top">
                  <div className="space-y-2">
                    {profile.rules.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">No specific rules suggested</span>
                    ) : (
                      profile.rules.slice(0, 3).map((rule, idx) => (
                        <div key={idx} className="bg-muted/30 p-2 rounded-md text-xs">
                          {(() => {
                            const meta = getRuleMeta(rule.rule_id)
                            const displayName = rule.rule_name || meta.name
                            return (
                              <>
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-semibold text-primary">{displayName}</span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] h-4 px-1 uppercase ${
                                      RULE_SEVERITY_STYLES[meta.severity] || RULE_SEVERITY_STYLES.info
                                    }`}
                                  >
                                    {meta.severity}
                                  </Badge>
                                  <Badge 
                                    variant={rule.decision === 'auto' ? "default" : "secondary"}
                                    className={`text-[10px] h-4 px-1 ${
                                      rule.decision === 'auto' 
                                        ? 'bg-green-500/10 text-green-700 hover:bg-green-500/20' 
                                        : 'bg-orange-500/10 text-orange-700 hover:bg-orange-500/20'
                                    }`}
                                  >
                                    {rule.decision}
                                  </Badge>
                                  <span className="text-muted-foreground">
                                    {(rule.confidence * 100).toFixed(0)}%
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">Rule ID: {rule.rule_id}</span>
                                </div>
                                <p className="text-muted-foreground leading-tight">
                                  {meta.description}
                                </p>
                                {rule.reasoning && (
                                  <p className="text-muted-foreground mt-1 leading-tight">
                                    Why: {rule.reasoning}
                                  </p>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      ))
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-right align-top text-xs tabular-nums">
                  {profile.rules.length}
                </TableCell>
                <TableCell className="text-right align-top text-xs tabular-nums">
                  {autoCount}
                </TableCell>
                <TableCell className="text-right align-top text-xs tabular-nums">
                  {humanCount}
                </TableCell>
                <TableCell className="text-right align-top text-xs tabular-nums">
                  {(profile.null_rate * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="text-right align-top text-xs tabular-nums">
                  {(profile.unique_ratio * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="text-right align-top text-xs font-mono text-muted-foreground">
                  {(profile.profile_time_sec || 0).toFixed(2)}
                </TableCell>
                <TableCell className="text-right align-top text-xs font-mono text-muted-foreground">
                  {(profile.llm_time_sec || 0).toFixed(2)}
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </div>
    </div>
  )

  if (embedded) {
    return (
      <div className="space-y-4">
        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="space-y-6">
            {summaryCards}
          </TabsContent>
          <TabsContent value="details">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Detail Analysis
                </CardTitle>
                <CardDescription>
                  Per-column type detection and rule suggestions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {detailsTable}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {summaryCards}
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Detail Analysis
          </CardTitle>
          <CardDescription>
            Per-column type detection and rule suggestions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] w-full rounded-md border">
            {detailsTable}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

