"use client";

interface Tab<T extends string> {
  key: T;
  label: string;
}

interface TabsProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (key: T) => void;
}

export default function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: TabsProps<T>) {
  return (
    <div className="flex gap-2 flex-wrap">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            active === tab.key
              ? "bg-[#6C63FF] text-white"
              : "bg-[#F4F4F8] text-[#555] hover:bg-[#EEEEF8]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
