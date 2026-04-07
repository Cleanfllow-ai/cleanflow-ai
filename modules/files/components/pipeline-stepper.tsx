import { cn } from "@/shared/lib/utils";

type StepState = "done" | "active" | "failed" | "pending";

interface StepConfig {
  upload: StepState;
  process: StepState;
  complete: StepState;
  label: string;
}

function resolveSteps(status: string): StepConfig {
  const upper = status.toUpperCase();

  switch (upper) {
    case "DQ_FIXED":
    case "COMPLETED":
    case "DQ_COMPLETE":
      return { upload: "done", process: "done", complete: "done", label: "Complete" };

    case "DQ_RUNNING":
    case "NORMALIZING":
      return { upload: "done", process: "active", complete: "pending", label: "Processing..." };

    case "QUEUED":
    case "DQ_DISPATCHED":
      return { upload: "done", process: "active", complete: "pending", label: "Queued" };

    case "UPLOADED":
    case "VALIDATED":
      return { upload: "done", process: "pending", complete: "pending", label: "Uploaded" };

    case "UPLOADING":
      return { upload: "active", process: "pending", complete: "pending", label: "Uploading..." };

    case "DQ_FAILED":
    case "FAILED":
      return { upload: "done", process: "failed", complete: "pending", label: "Failed" };

    case "UPLOAD_FAILED":
      return { upload: "failed", process: "pending", complete: "pending", label: "Failed" };

    case "REJECTED":
      return { upload: "done", process: "failed", complete: "pending", label: "Rejected" };

    default:
      return { upload: "pending", process: "pending", complete: "pending", label: upper || "Unknown" };
  }
}

const dotClass: Record<StepState, string> = {
  done: "bg-emerald-500",
  active: "bg-primary animate-pulse",
  failed: "bg-destructive",
  pending: "bg-border",
};

const lineClass: Record<StepState, string> = {
  done: "bg-emerald-500",
  active: "bg-primary",
  failed: "bg-destructive",
  pending: "bg-border",
};

function lineBetween(left: StepState, right: StepState): string {
  // The line takes its color from the "destination" step, unless the destination
  // is pending — in that case it stays gray.
  if (right === "done") return lineClass.done;
  if (right === "active") return lineClass.active;
  if (right === "failed") return lineClass.failed;
  return lineClass.pending;
}

const labelColor: Record<string, string> = {
  done: "text-emerald-600",
  active: "text-primary",
  failed: "text-destructive",
  pending: "text-muted-foreground",
};

function overallTone(steps: StepConfig): string {
  if (steps.complete === "done") return "done";
  if (steps.upload === "failed" || steps.process === "failed" || steps.complete === "failed") return "failed";
  if (steps.upload === "active" || steps.process === "active" || steps.complete === "active") return "active";
  return "pending";
}

export function PipelineStepper({ status }: { status: string }) {
  const steps = resolveSteps(status);
  const tone = overallTone(steps);

  const stepStates: StepState[] = [steps.upload, steps.process, steps.complete];

  return (
    <div className="inline-flex items-center gap-1.5">
      {/* Stepper dots and lines */}
      <div className="inline-flex items-center">
        {stepStates.map((state, i) => (
          <div key={i} className="inline-flex items-center">
            {/* Connecting line before this dot (skip for the first dot) */}
            {i > 0 && (
              <div
                className={cn(
                  "w-4 h-[2px] rounded-full",
                  lineBetween(stepStates[i - 1], state),
                )}
              />
            )}
            {/* Dot */}
            <div
              className={cn(
                "w-[7px] h-[7px] rounded-full shrink-0",
                dotClass[state],
              )}
            />
          </div>
        ))}
      </div>

      {/* Label */}
      <span
        className={cn(
          "text-[11px] font-medium leading-none whitespace-nowrap",
          labelColor[tone],
        )}
      >
        {steps.label}
      </span>
    </div>
  );
}
