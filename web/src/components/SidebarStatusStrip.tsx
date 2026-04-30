import { Link } from "react-router-dom";
import type { StatusResponse } from "@/lib/api";
import { useSidebarStatus } from "@/hooks/useSidebarStatus";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

/** Gateway + session summary for the System sidebar block. */
export function SidebarStatusStrip() {
  const status = useSidebarStatus();
  const { t } = useI18n();

  if (status === null) {
    return (
      <div className="px-4 py-1.5" aria-hidden>
        <div className="h-2 w-[80%] max-w-full animate-pulse rounded bg-white/10" />
      </div>
    );
  }

  const gw = gatewayLine(status, t);
  const { activeSessionsLabel, gatewayStatusLabel } = t.app;

  return (
    <Link
      to="/sessions"
      title={t.app.statusOverview}
      className={cn(
        "block text-left px-4 pb-1.5 pt-0.5",
        "text-white/50 hover:text-white/70 transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30",
      )}
    >
      <div className="flex flex-col gap-0.5 text-xs leading-snug">
        <p className="break-words">
          <span className="text-white/40">{gatewayStatusLabel}</span>{" "}
          <span className={cn("font-medium", gw.tone)}>{gw.label}</span>
        </p>

        <p className="break-words">
          <span className="text-white/40">{activeSessionsLabel}</span>{" "}
          <span className="tabular-nums text-white/50">
            {status.active_sessions}
          </span>
        </p>
      </div>
    </Link>
  );
}

function gatewayLine(
  status: StatusResponse,
  t: ReturnType<typeof useI18n>["t"],
): { label: string; tone: string } {
  const g = t.app.gatewayStrip;
  const byState: Record<string, { label: string; tone: string }> = {
    running: { label: g.running, tone: "text-green-400" },
    starting: { label: g.starting, tone: "text-yellow-400" },
    startup_failed: { label: g.failed, tone: "text-red-400" },
    stopped: { label: g.stopped, tone: "text-white/40" },
  };
  if (status.gateway_state && byState[status.gateway_state]) {
    return byState[status.gateway_state];
  }
  return status.gateway_running
    ? { label: g.running, tone: "text-green-400" }
    : { label: g.off, tone: "text-white/40" };
}