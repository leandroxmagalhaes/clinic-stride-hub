import { useEffect, useState, useRef } from "react";
import { UserPlus, ClipboardList, Calendar } from "lucide-react";

interface Props {
  waitingCount: number;
  notesCount: number;
  hasUrgent: boolean;
  missingSessions: number;
  onClick: () => void;
}

export function QuickPanelButton({ waitingCount, notesCount, hasUrgent, missingSessions, onClick }: Props) {
  const [pulse, setPulse] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const shouldPulse = hasUrgent || missingSessions > 0;

  useEffect(() => {
    if (shouldPulse) {
      intervalRef.current = setInterval(() => {
        setPulse(true);
        setTimeout(() => setPulse(false), 1000);
      }, 10000);
      setPulse(true);
      setTimeout(() => setPulse(false), 1000);
    } else {
      setPulse(false);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [shouldPulse]);

  return (
    <button
      onClick={onClick}
      className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-0 rounded-l-[10px] shadow-lg transition-shadow"
      style={{
        background: "linear-gradient(180deg, #1e40af, #1d4ed8)",
        boxShadow: pulse ? "0 0 0 6px rgba(239,68,68,0.35), -2px 2px 8px rgba(0,0,0,0.2)" : "-2px 2px 8px rgba(0,0,0,0.2)",
        transition: "box-shadow 0.4s ease",
      }}
    >
      {/* Fixed clients badge */}
      {missingSessions > 0 && (
        <>
          <div className="flex flex-col items-center px-2.5 py-2.5 gap-0.5">
            <Calendar className="h-4 w-4 text-white/90" />
            <span className="text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white">
              !{missingSessions}
            </span>
          </div>
          <div className="w-6 border-t border-white/20" />
        </>
      )}
      <div className="flex flex-col items-center px-2.5 py-3 gap-0.5">
        <UserPlus className="h-4 w-4 text-white/90" />
        <span className={`text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full ${hasUrgent ? "bg-red-500 text-white" : "bg-white/20 text-white"}`}>
          {waitingCount}
        </span>
      </div>
      <div className="w-6 border-t border-white/20" />
      <div className="flex flex-col items-center px-2.5 py-3 gap-0.5">
        <ClipboardList className="h-4 w-4 text-white/90" />
        <span className="text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-white/20 text-white">
          {notesCount}
        </span>
      </div>
    </button>
  );
}
