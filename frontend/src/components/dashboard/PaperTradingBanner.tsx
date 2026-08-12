interface PaperTradingBannerProps {
  compact?: boolean;
}

export default function PaperTradingBanner({
  compact = false,
}: PaperTradingBannerProps) {
  return (
    <div
      className={`rounded-xl border border-amber-500/30 bg-amber-500/10 ${
        compact ? "px-3 py-2" : "px-4 py-3"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="font-semibold text-amber-300">
          PAPER TRADING MODE
        </span>
      </div>

      <p className="mt-1 text-xs text-slate-300">
        Orders are simulated locally. No real broker order will be executed.
      </p>
    </div>
  );
}
