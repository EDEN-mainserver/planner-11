import { STEP_KEYS, STEP_LABELS } from "./steps";

// onStepClick(stepKey) — 단계 아이콘 클릭 시 호출. 이미 거친 단계(i <= cur)만 활성.
export default function StepBar({ step, onStepClick }) {
  const cur = STEP_KEYS.indexOf(step);
  return (
    <div className="flex items-center">
      {STEP_LABELS.map((label, i) => {
        const clickable = i <= cur && typeof onStepClick === "function";
        const Tag = clickable ? "button" : "div";
        const tagProps = clickable
          ? { type: "button", onClick: () => onStepClick(STEP_KEYS[i]), title: `${label} 단계로 이동` }
          : {};
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <Tag
              {...tagProps}
              className={`flex flex-col items-center gap-1 flex-shrink-0 transition-opacity bg-transparent border-0 p-0
                ${i <= cur ? "opacity-100" : "opacity-30"}
                ${clickable ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all
                ${i < cur ? "bg-violet-500 border-violet-500 text-white" : i === cur ? "border-violet-500 text-violet-600 bg-violet-50" : "border-gray-300 text-gray-400 bg-white"}
                ${clickable ? "hover:scale-110" : ""}`}
              >
                {i < cur ? "✓" : i + 1}
              </div>
              <span
                className={`text-[9px] font-medium whitespace-nowrap hidden sm:block ${i === cur ? "text-violet-600" : "text-gray-400"}`}
              >
                {label}
              </span>
            </Tag>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 mb-5 sm:mb-3 transition-colors ${i < cur ? "bg-violet-400" : "bg-gray-200"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
