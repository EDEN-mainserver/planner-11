interface Props { onClick: () => void; label?: string }
export default function AiStartButton({ onClick, label='기획 시작하기 →' }: Props) {
  return (
    <button onClick={onClick}
      className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-700 transition shadow-lg shadow-indigo-100">
      {label}
    </button>
  )
}
