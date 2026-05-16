export { mapSettingsErrorToToast } from "./error-toast"
export type { SettingsErrorContext } from "./error-toast"

// Client-side validation helpers — keep regex / Polars checks out of the BE
// round-trip (catches malformed rule_spec before POST).
export {
    validateRegex,
    validatePolarsExpr,
    validateRuleSpec,
    buildRuleSpec,
} from "./lib/validation"
export type {
    ValidationResult,
    RuleSpecValidationError,
    BackendRuleSpec,
} from "./lib/validation"
