export default function Field({ label, type = "text", value, onChange, placeholder, mono }) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-600 block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400 bg-white transition-colors ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}
