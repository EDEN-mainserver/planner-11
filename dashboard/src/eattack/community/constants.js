// 커뮤니티 영상 자동화 — 상수 정의

// bgPreset: site(커뮤니티 사이트 정보) + character(애니 캐릭터 감정/색상) 조합
export const BG_PRESETS = [
  { key: "fmkorea_angry",   label: "에펨코리아 열혈글", emoji: "🔥", category: "커뮤니티",
    color: "from-blue-600 to-blue-800",      desc: "FM코리아 분노 썰",
    site: { name: "에펨코리아",   color: "#1e6dc8" },
    character: { mood: "angry",   hairColor: "#2c1a0e", clothesColor: "#dc2626" } },
  { key: "ruliweb_shocked", label: "루리웹 경악글",     emoji: "😱", category: "커뮤니티",
    color: "from-orange-500 to-red-500",     desc: "루리웹 황당 썰",
    site: { name: "루리웹",       color: "#e8500a" },
    character: { mood: "shocked", hairColor: "#1a1a2e", clothesColor: "#7c3aed" } },
  { key: "dcinside_laugh",  label: "디씨 웃긴 글",     emoji: "😂", category: "커뮤니티",
    color: "from-yellow-500 to-orange-500",  desc: "디씨인사이드 병맛 썰",
    site: { name: "디씨인사이드", color: "#0066cc" },
    character: { mood: "laugh",   hairColor: "#4a3728", clothesColor: "#16a34a" } },
  { key: "theqoo_happy",    label: "더쿠 수다글",       emoji: "💬", category: "커뮤니티",
    color: "from-pink-400 to-rose-500",      desc: "더쿠 연예인 수다",
    site: { name: "더쿠",         color: "#e91e8c" },
    character: { mood: "happy",   hairColor: "#7c2d12", clothesColor: "#ec4899" } },
  { key: "instiz_sad",      label: "인스티즈 공감글",   emoji: "😢", category: "커뮤니티",
    color: "from-blue-400 to-slate-500",     desc: "인스티즈 감성 공감",
    site: { name: "인스티즈",     color: "#4c75af" },
    character: { mood: "sad",     hairColor: "#374151", clothesColor: "#3b82f6" } },
  { key: "blind_work",      label: "블라인드 직장 썰",  emoji: "🏢", category: "직장",
    color: "from-gray-600 to-gray-800",      desc: "블라인드 직장 공감 썰",
    site: { name: "블라인드",     color: "#222222" },
    character: { mood: "angry",   hairColor: "#1c1c1c", clothesColor: "#374151" } },
];

export const FONT_OPTIONS = [
  { key: "Noto Sans KR",   label: "노토 산스 (기본)" },
  { key: "Black Han Sans", label: "검은 한 산스 (굵게)" },
  { key: "Nanum Gothic",   label: "나눔 고딕" },
];

export const HIGHLIGHT_COLORS = [
  { key: "#FFE600", label: "노랑" },
  { key: "#FF3D3D", label: "빨강" },
  { key: "#00FF9D", label: "연두" },
  { key: "#00CFFF", label: "하늘" },
  { key: "#FF6BF5", label: "분홍" },
  { key: "#FF8800", label: "주황" },
];

export const VOICE_OPTIONS = [
  { id: "cgSgspJ2msm6clMCkdW9", name: "서준 (남성)", desc: "차분하고 신뢰감" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "채원 (여성)", desc: "밝고 에너지 넘침" },
  { id: "iP95p4xoKVk53GoZ742B", name: "민호 (남성)", desc: "낮고 중후함" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "지아 (여성)", desc: "부드럽고 감성적" },
];

export const EXAMPLE_SCRIPTS = [
  {
    label: "직장 상사 썰 🏢",
    text: "아 진짜 오늘 있었던 일 들어봐\n회사 점심시간에 편의점 갔는데\n거기서 팀장이 나를 발견한 거야\n그런데 팀장 손에 뭐가 있는 줄 알아?\n오이맛 아이스크림이었어\n평소에 그렇게 근엄하게 굴더니\n혼자 편의점에서 그걸 먹고 있는 거 보고\n나도 팀장도 얼어버렸지\n팀장이 먼저 말했어\n오늘 본 거 없는 걸로 하자고",
  },
  {
    label: "지하철 썰 🚇",
    text: "어제 지하철에서 진짜 신기한 거 봤어\n자리가 꽉 찼는데 내 옆에 아저씨가\n갑자기 휴대폰으로 뭘 열심히 보더라고\n슬쩍 봤더니 뜨개질 영상이었어\n그리고 가방에서 실이랑 바늘을 꺼내서\n지하철에서 뜨개질을 시작하는 거야\n진짜 너무 자연스럽게\n내리기 전에 보니까 벌써 손바닥만큼 뜬 거 있잖아",
  },
  {
    label: "편의점 알바 썰 🏪",
    text: "알바 3년 동안 겪은 거 중에 제일 황당한 거\n손님이 들어오더니 대뜸\n여기 도토리묵 있어요 묻는 거야\n편의점인데 도토리묵을\n없다고 하니까 왜 없냐는 거 있지\n그래서 여기 편의점이라서요 했더니\n편의점에 왜 도토리묵이 없냐며 나가시더라\n나 아직도 그분 생각하면 웃겨",
  },
];
