import { useState, useEffect } from "react";

interface Props {
  startHour: number; // e.g. 6
  endHour: number;   // e.g. 22 (exclusive)
  slotHeight: number; // px per 15-min slot
}

const CurrentTimeIndicator = ({ startHour, endHour, slotHeight }: Props) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const hours = now.getHours();
  const minutes = now.getMinutes();

  if (hours < startHour || hours >= endHour) return null;

  // Calculate position: each hour = 4 slots, each slot = slotHeight px
  const minutesSinceStart = (hours - startHour) * 60 + minutes;
  const topPx = (minutesSinceStart / 15) * slotHeight;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${topPx}px` }}
    >
      <div className="relative flex items-center">
        <div className="w-2 h-2 rounded-full bg-destructive -ml-1 flex-shrink-0" />
        <div className="flex-1 h-[2px] bg-destructive" />
      </div>
    </div>
  );
};

export default CurrentTimeIndicator;
