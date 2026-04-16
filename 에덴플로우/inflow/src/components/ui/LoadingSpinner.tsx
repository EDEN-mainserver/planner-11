export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div
        className="w-10 h-10 rounded-full border-4 border-[#E5E5EF] border-t-[#6C63FF] animate-spin"
      />
    </div>
  );
}
