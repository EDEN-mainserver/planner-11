export default function ErrorBox({ msg, onRetry }) {
  return (
    <div className="space-y-3">
      <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
        {msg}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="w-full py-2.5 bg-pink-500 text-white text-sm font-bold rounded-xl hover:bg-pink-600 transition-all"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
