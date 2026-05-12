export default function UserBar({ session, onLogout }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-violet-50 border border-violet-100 rounded-xl mb-1">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold">
          {session.displayName.charAt(0)}
        </div>
        <span className="text-xs font-semibold text-violet-700">{session.displayName}</span>
      </div>
      <button
        onClick={onLogout}
        aria-label="로그아웃"
        className="px-2 py-1 text-[10px] text-gray-500 border border-transparent rounded-md hover:text-red-500 hover:bg-red-50 hover:border-red-100 focus:outline-none focus:ring-2 focus:ring-red-200 transition-colors cursor-pointer"
      >
        로그아웃
      </button>
    </div>
  );
}
