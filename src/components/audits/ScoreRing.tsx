import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number | null;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
}

const getScoreColor = (score: number | null) => {
  if (score === null) return "text-muted-foreground";
  if (score >= 8) return "text-emerald-500";
  if (score >= 6) return "text-amber-500";
  return "text-red-500";
};

const getScoreStroke = (score: number | null) => {
  if (score === null) return "stroke-muted";
  if (score >= 8) return "stroke-emerald-500";
  if (score >= 6) return "stroke-amber-500";
  return "stroke-red-500";
};

export const getScoreLabel = (score: number | null) => {
  if (score === null) return "—";
  if (score >= 9) return "Uitstekend";
  if (score >= 8) return "Goed";
  if (score >= 7) return "Voldoende";
  if (score >= 6) return "Matig";
  return "Onvoldoende";
};

export const getScoreBadgeClass = (score: number | null) => {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 8) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (score >= 6) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
};

const ScoreRing = ({ score, size = 56, strokeWidth = 4, className, showLabel = false }: ScoreRingProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score !== null ? (score / 10) * circumference : 0;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={getScoreStroke(score)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <span className={cn("absolute text-sm font-bold font-mono", getScoreColor(score))} style={{ lineHeight: `${size}px` }}>
        {score !== null ? score.toFixed(1) : "—"}
      </span>
      {showLabel && score !== null && (
        <span className={cn("text-[10px] font-medium mt-0.5", getScoreColor(score))}>
          {getScoreLabel(score)}
        </span>
      )}
    </div>
  );
};

export default ScoreRing;
