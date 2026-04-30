import { Typography } from "@nous-research/ui";
import { useSidebarStatus } from "@/hooks/useSidebarStatus";
import { useI18n } from "@/i18n";

export function SidebarFooter() {
  const status = useSidebarStatus();
  const { t } = useI18n();

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2 border-t border-white/10">
      <Typography className="text-xs text-white/40 tabular-nums">
        {status?.version != null ? `v${status.version}` : "—"}
      </Typography>

      <a
        href="https://nousresearch.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-white/40 hover:text-white/60 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
      >
        {t.app.footer.org}
      </a>
    </div>
  );
}