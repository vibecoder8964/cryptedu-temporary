import type { Page } from "../lib/types";
import { useSettings } from "../../../lib/SettingsContext";

const order: Page[] = ["textbooks", "exam", "ready"];

export default function Stepper({ current }: { current: Page }) {
  const { t } = useSettings();
  const currentIdx = order.indexOf(current);

  const steps: { key: Page; label: string }[] = [
    { key: "textbooks", label: t("step_textbooks") },
    { key: "exam", label: t("step_exam") },
    { key: "ready", label: t("step_export") },
  ];

  return (
    <div className="hidden sm:flex items-center gap-0">
      {steps.map((step, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center">
            {i > 0 && (
              <div className={`w-8 h-px ${isDone ? "bg-[#10B981]" : "bg-gray-200"}`} />
            )}
            <div className="flex items-center gap-3 px-4">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold border-2 transition-all duration-300 ${
                  isDone
                    ? "bg-[#10B981] border-[#10B981] text-white"
                    : isActive
                    ? "border-[#10B981] text-[#10B981]"
                    : "border-gray-200 text-gray-400"
                }`}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <span
                className={`text-[16px] transition-colors duration-300 ${
                  isActive ? "text-[#10B981] font-bold" : "text-gray-400 font-medium"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
