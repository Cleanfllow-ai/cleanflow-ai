/**
 * Centralised theme-token helpers for status pills, banners, avatars, etc.
 *
 * These helpers exist so feature modules stop hand-rolling
 * `bg-red-500 text-red-500` (a1.0:1 contrast) and instead pick one of the
 * audited variants below. The colour values live in `app/globals.css` as
 * CSS variables — touch those, NOT these strings.
 *
 * Tone semantics
 *   success → "Fixed" / "No Issues" / approved
 *   warning → "Needs Attention" / partial
 *   danger  → "Failed" / "Quarantined" / destructive actions
 *   info    → neutral progress (DQ Running, etc.)
 *   neutral → default chip / no status
 */

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

/* ─── Filled status pills ────────────────────────────────────────────────────
 * Use for the numbered counters on dashboard cards (the audit found these
 * rendering same-colour-on-same-colour). The label/number ALWAYS uses the
 * `*-on-fill` foreground (white) regardless of theme.
 */
export const STATUS_PILL_FILLED: Record<StatusTone, string> = {
  success:
    "bg-[var(--status-success-fill)] text-[var(--status-success-on-fill)] border-transparent",
  warning:
    "bg-[var(--status-warning-fill)] text-[var(--status-warning-on-fill)] border-transparent",
  danger:
    "bg-[var(--status-danger-fill)] text-[var(--status-danger-on-fill)] border-transparent",
  info: "bg-[var(--status-info-fill)] text-[var(--status-info-on-fill)] border-transparent",
  neutral: "bg-muted text-foreground border-transparent",
};

/* ─── Soft status pills (light tint bg + dark tint text) ─────────────────────
 * Use for "Fixed" / "No Issues" pills on the row-list table where the cell
 * already sits on a white surface. Light/dark mode use different shades so
 * the text always clears 4.5:1.
 */
export const STATUS_PILL_SOFT: Record<StatusTone, string> = {
  success:
    "bg-green-100 text-[color:var(--status-success)] dark:bg-green-900/30 dark:text-[color:var(--status-success)] border border-green-200/60 dark:border-green-900/50",
  warning:
    "bg-amber-100 text-[color:var(--status-warning)] dark:bg-amber-900/30 dark:text-[color:var(--status-warning)] border border-amber-200/60 dark:border-amber-900/50",
  danger:
    "bg-red-100 text-[color:var(--status-danger)] dark:bg-red-900/30 dark:text-[color:var(--status-danger)] border border-red-200/60 dark:border-red-900/50",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50",
  neutral:
    "bg-muted text-muted-foreground border border-border",
};

/* ─── Banner (the "X files need attention" amber callout) ────────────────────
 * Picks correct dark-mode bg/fg so the amber banner stops rendering with a
 * light bg + dark fg on `.dark` (current ratio 1.18:1).
 */
export const BANNER_TONE: Record<StatusTone, string> = {
  success:
    "bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-100 dark:border-green-900/60",
  warning:
    "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-100 dark:border-amber-900/60",
  danger:
    "bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-100 dark:border-red-900/60",
  info: "bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-100 dark:border-blue-900/60",
  neutral:
    "bg-card text-foreground border-border",
};

/* ─── Avatar fallback ────────────────────────────────────────────────────────
 * Sidebar + Members tab were rendering the initial as `text-primary` on
 * `bg-primary` (1.00:1). Use this helper for any avatar fallback that fills
 * with the brand colour.
 */
export const AVATAR_FALLBACK_BRAND =
  "bg-primary text-primary-foreground font-medium";

/**
 * For dark-on-dark surfaces where the brand navy `text-primary` would be
 * invisible: use the brighter brand tint token instead.
 */
export const BRAND_TEXT_ON_DARK = "text-[color:var(--primary-tint)]";

/**
 * Red AS TEXT on a light surface (KPI counts, "Quarantined: 1,701,611" on
 * file-detail). Deepened to red-800 on light (5.94:1) and red-300 on dark
 * (6.6:1). Use this instead of `text-destructive` when red is the foreground
 * — `--destructive` was deepened only enough for white-on-red fills (4.5:1)
 * which leaves it at 4.32:1 when used the other way around.
 */
export const TEXT_DESTRUCTIVE = "text-[color:var(--text-destructive)]";

/**
 * Card / tile primitive helper. Card and connector tiles must explicitly
 * honour `dark:bg-card dark:border-border` so feature modules can drop in.
 */
export const SURFACE_CARD =
  "bg-card text-card-foreground border border-border dark:bg-card dark:border-border";

/**
 * Table row dark-mode helper — apply alongside primitive Table when the
 * surrounding card is dark.
 */
export const TABLE_HEADER_TONE =
  "bg-muted/40 text-foreground dark:bg-card dark:text-foreground";

export const SECTION_LABEL_TEXT =
  "text-[color:var(--text-section-label)] font-medium";
