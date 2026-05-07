/**
 * Unit tests for ImportProgressCard.
 *
 * Covers:
 *  1. Byte / percent rendering matches input (downloading state)
 *  2. Speed calculation across rolling 5-sample window
 *  3. ETA calculation rendering for typical mid-import state
 *  4. State transitions: downloading → completed shows ✓ + "took N s"
 *  5. Failed state shows error message + Retry button
 *  6. Cancel button fires onCancel callback
 *  7. EMA smoothing reduces variance vs raw samples
 *  8. formatEta helper boundary cases
 */
import { act, render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import React from "react"

import {
  ImportProgressCard,
  formatEta,
  formatDuration,
} from "@/modules/files/components/import-progress-card"

const MB = 1024 * 1024

const baseProps = {
  filename: "huge-export.csv",
  importStatus: "downloading" as const,
  bytesDownloaded: 248 * MB,
  bytesTotal: 765 * MB,
  startedAt: "2026-05-07T12:00:00Z",
  updatedAt: "2026-05-07T12:00:10Z",
  providerLabel: "Google Drive",
}

describe("ImportProgressCard — rendering", () => {
  it("renders bytes and percent for the downloading state", () => {
    render(<ImportProgressCard {...baseProps} />)
    const bytes = screen.getByTestId("import-progress-bytes").textContent ?? ""
    const pct = screen.getByTestId("import-progress-percent").textContent ?? ""
    // Should mention both numerator and denominator MBs
    expect(bytes).toMatch(/MB/)
    expect(bytes).toMatch(/\//) // numerator/denominator
    // 248/765 ≈ 32.4 %
    expect(pct).toMatch(/32\.[0-9]%/)
  })

  it("uses CloudDownload status copy referencing the provider", () => {
    render(<ImportProgressCard {...baseProps} />)
    expect(
      screen.getByTestId("import-progress-status"),
    ).toHaveTextContent(/Downloading from Google Drive/i)
  })

  it("on completed: shows ✓ + 'Imported successfully' subtitle with duration", () => {
    render(
      <ImportProgressCard
        {...baseProps}
        importStatus="completed"
        bytesDownloaded={765 * MB}
        startedAt="2026-05-07T12:00:00Z"
        updatedAt="2026-05-07T12:04:12Z"
        finishedAt="2026-05-07T12:04:12Z"
      />,
    )
    expect(screen.getByTestId("import-progress-status")).toHaveTextContent(
      /Imported successfully/i,
    )
    expect(screen.getByTestId("import-progress-status")).toHaveTextContent(
      /4 m 12 s/,
    )
    // Speed/ETA row hidden on completed
    expect(
      screen.queryByTestId("import-progress-speed-eta"),
    ).not.toBeInTheDocument()
    // Bar fills to 100 %
    expect(
      screen.getByTestId("import-progress-percent"),
    ).toHaveTextContent("100.0%")
  })

  it("on failed: shows error message + Retry button + onRetry fires", () => {
    const onRetry = jest.fn()
    render(
      <ImportProgressCard
        {...baseProps}
        importStatus="failed"
        errorMessage="Network unreachable"
        onRetry={onRetry}
      />,
    )
    expect(
      screen.getByTestId("import-progress-error"),
    ).toHaveTextContent("Network unreachable")
    const retry = screen.getByTestId("import-progress-retry")
    expect(retry).toBeInTheDocument()
    fireEvent.click(retry)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("cancel button fires onCancel and is hidden on terminal states", () => {
    const onCancel = jest.fn()
    const { rerender } = render(
      <ImportProgressCard {...baseProps} onCancel={onCancel} />,
    )
    fireEvent.click(screen.getByTestId("import-progress-cancel"))
    expect(onCancel).toHaveBeenCalledTimes(1)

    rerender(
      <ImportProgressCard
        {...baseProps}
        importStatus="completed"
        bytesDownloaded={baseProps.bytesTotal}
        finishedAt="2026-05-07T12:00:30Z"
        onCancel={onCancel}
      />,
    )
    expect(
      screen.queryByTestId("import-progress-cancel"),
    ).not.toBeInTheDocument()
  })
})

describe("ImportProgressCard — speed + ETA", () => {
  it("computes speed across the rolling sample window (props-driven)", () => {
    // Feed 5 evenly spaced samples that climb from 100 → 500 MB across 4 s
    // → expected raw speed ≈ 100 MB/s; EMA-smoothed display should be in the
    // ballpark of 100 MB/s.
    const start = "2026-05-07T12:00:00Z"
    const samples = [
      { t: "2026-05-07T12:00:00Z", b: 100 * MB },
      { t: "2026-05-07T12:00:01Z", b: 200 * MB },
      { t: "2026-05-07T12:00:02Z", b: 300 * MB },
      { t: "2026-05-07T12:00:03Z", b: 400 * MB },
      { t: "2026-05-07T12:00:04Z", b: 500 * MB },
    ]
    const { rerender } = render(
      <ImportProgressCard
        {...baseProps}
        startedAt={start}
        updatedAt={samples[0].t}
        bytesDownloaded={samples[0].b}
      />,
    )
    samples.slice(1).forEach((s) => {
      rerender(
        <ImportProgressCard
          {...baseProps}
          startedAt={start}
          updatedAt={s.t}
          bytesDownloaded={s.b}
        />,
      )
    })

    const speedTxt = screen.getByTestId("import-progress-speed").textContent ?? ""
    expect(speedTxt).toMatch(/MB\/s/)
    // Ballpark: 30–250 MB/s (EMA + rounding) — never "Calculating speed…"
    const num = parseFloat(speedTxt)
    expect(num).toBeGreaterThan(30)
    expect(num).toBeLessThan(250)

    const etaTxt = screen.getByTestId("import-progress-eta").textContent ?? ""
    // 765 - 500 = 265 MB remaining @ ~100 MB/s ⇒ ~2-3 s remaining
    expect(etaTxt).toMatch(/(remaining|< 1 s|Almost done)/i)
  })

  it("formatEta produces sensible boundaries", () => {
    expect(formatEta(0, 1_000_000)).toBe("Almost done…")
    expect(formatEta(100 * MB, 0)).toBe("Calculating…")
    // 50 MB @ 100 MB/s ⇒ 0.5 s
    expect(formatEta(50 * MB, 100 * MB)).toBe("< 1 s")
    // 50 MB @ 5 MB/s ⇒ 10 s
    expect(formatEta(50 * MB, 5 * MB)).toMatch(/^10 s remaining$/)
    // 60 MB @ 1 MB/s ⇒ 60 s ⇒ "1 m 0 s remaining"
    expect(formatEta(60 * MB, 1 * MB)).toMatch(/^1 m 0 s remaining$/)
    // 1 GB @ 100 KB/s ⇒ ~10485 s ⇒ "2 h 55 m remaining"
    const longEta = formatEta(1024 * MB, 100 * 1024)
    expect(longEta).toMatch(/h .* m remaining/)
  })

  it("formatDuration formats elapsed times", () => {
    expect(formatDuration(45_000)).toBe("45 s")
    expect(formatDuration(252_000)).toBe("4 m 12 s")
    expect(formatDuration(60_000)).toBe("1 m")
    expect(formatDuration(3_660_000)).toBe("1 h 1 m")
  })
})

describe("ImportProgressCard — EMA smoothing", () => {
  /**
   * EMA smoothing claim: feeding a jittery byte stream should yield a
   * displayed speed series whose variance is strictly less than the
   * variance of the raw point-to-point speed. We capture the displayed
   * speeds from the DOM after each rerender and compare variances.
   */
  it("displayed speed has lower variance than raw point-to-point speed", () => {
    // Jittery sequence: alternates ~50 MB and ~200 MB jumps every second
    const start = "2026-05-07T12:00:00Z"
    const series: { t: string; b: number; rawDelta: number }[] = []
    let bytes = 0
    let rawDeltas: number[] = []
    for (let i = 0; i < 12; i++) {
      const delta = i % 2 === 0 ? 50 * MB : 200 * MB
      bytes += delta
      const ts = new Date(Date.parse(start) + i * 1000).toISOString()
      series.push({ t: ts, b: bytes, rawDelta: delta })
      rawDeltas.push(delta) // bytes/sec (1 s spacing)
    }

    const displayedSpeeds: number[] = []
    const Wrapper: React.FC<{ idx: number }> = ({ idx }) => {
      const s = series[idx]
      return (
        <ImportProgressCard
          {...baseProps}
          startedAt={start}
          updatedAt={s.t}
          bytesDownloaded={s.b}
          bytesTotal={10_000 * MB}
        />
      )
    }
    const { rerender } = render(<Wrapper idx={0} />)
    for (let i = 1; i < series.length; i++) {
      act(() => {
        rerender(<Wrapper idx={i} />)
      })
      const txt = screen.getByTestId("import-progress-speed").textContent ?? ""
      const m = txt.match(/([0-9.]+)\s*([KMG])B\/s/)
      if (m) {
        const v = parseFloat(m[1])
        const unit = m[2]
        const mul = unit === "K" ? 1024 : unit === "M" ? MB : 1024 * MB
        displayedSpeeds.push(v * mul)
      }
    }

    // Use the last 8 samples once EMA has warmed up.
    const tail = displayedSpeeds.slice(-8)
    const rawTail = rawDeltas.slice(-8)
    const variance = (xs: number[]) => {
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length
      return xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length
    }
    expect(variance(tail)).toBeLessThan(variance(rawTail))
  })
})
