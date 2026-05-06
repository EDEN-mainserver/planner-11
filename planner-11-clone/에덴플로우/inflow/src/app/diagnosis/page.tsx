import EmptyState from "@/components/ui/EmptyState";

export default function DiagnosisPage() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-[#111] mb-6">계정진단 보고서</h1>
      <div className="bg-white rounded-[20px] shadow-card p-8">
        <EmptyState message="계정진단 데이터가 없습니다. 진단을 요청해주세요." />
      </div>
    </div>
  );
}
