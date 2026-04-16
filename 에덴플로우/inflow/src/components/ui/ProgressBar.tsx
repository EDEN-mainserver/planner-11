interface ProgressBarProps {
  value: number; // 0~100
}

export default function ProgressBar({ value }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="w-full h-[3px] bg-[#E5E5EF] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{
          width: `${clamped}%`,
          background: "linear-gradient(90deg, #6C63FF, #9B93FF)",
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}
