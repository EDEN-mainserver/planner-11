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

// BGM 프리셋 — public/bgm/ 폴더의 파일 기반
// 새 파일 추가 시: public/bgm/ 에 MP3 넣고 아래 목록에 추가
export const BGM_LIST = [
  { key: "none",          label: "없음",                file: null },
  { key: "brain_trust",   label: "Brain Trust",         file: "/bgm/Brain Trust - Wayne Jones.mp3",                                   mood: "경쾌" },
  { key: "humorous",      label: "Humorous Escalation", file: "/bgm/Humorous Escalation - Creable Music - Julieta Alcantara Kids.mp3", mood: "개그" },
  { key: "mystery_box",   label: "Mystery Box",         file: "/bgm/Mystery box - VML.mp3",                                           mood: "긴장" },
  { key: "omc",           label: "OMC",                 file: "/bgm/OMC - VML.mp3",                                                   mood: "경쾌" },
  { key: "white_color",   label: "White Color",         file: "/bgm/White Color - Lunatic Souls.mp3",                                 mood: "감성" },
  { key: "coral",         label: "🪸 Eliza Ivanova",   file: "/bgm/🪸 - Eliza Ivanova.mp3",                                         mood: "감성" },
  { key: "rabbit",        label: "엉뚱한토끼",           file: "/bgm/엉뚱한토끼 - VML (1).mp3",                                       mood: "개그" },
];

export const FONT_OPTIONS = [
  { key: "Noto Sans KR",   label: "노토 산스 (기본)" },
  { key: "Black Han Sans", label: "검은 한 산스 (굵게)" },
  { key: "Nanum Gothic",   label: "나눔 고딕" },
];


export const VOICE_OPTIONS = [
  { id: "cgSgspJ2msm6clMCkdW9", name: "서준 (남성)", desc: "차분하고 신뢰감" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "채원 (여성)", desc: "밝고 에너지 넘침" },
  { id: "iP95p4xoKVk53GoZ742B", name: "민호 (남성)", desc: "낮고 중후함" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "지아 (여성)", desc: "부드럽고 감성적" },
];

export const POPULAR_SCRIPTS = [
  {
    title: "회사 화장실에서 팀장이랑 마주쳤는데",
    text: "아 진짜 이거 들어봐 너무 민망했어\n오늘 점심 먹고 화장실 갔는데\n칸에 들어가서 볼일 보고 있었거든\n근데 갑자기 옆 칸에서 전화 소리가 나는 거야\n목소리 들어보니까 우리 팀장이잖아\n전화로 와이프한테 투정부리는 거 다 들었어\n나 왜 이렇게 운이 없냐\n나오는 타이밍도 겹쳐서 둘이 눈 마주쳤는데\n팀장이 먼저 나가면서 오늘 야근 없다고 했어\n이게 다 연결된 거 맞지",
  },
  {
    title: "소개팅 나갔다가 전 남친 만난 썰",
    text: "이거 진짜 드라마도 이렇게 못 쓴다\n친구가 괜찮은 사람 있다고 소개팅 잡아줬거든\n카페에 먼저 가서 기다리고 있었어\n문 열리고 들어오는 사람 봤는데\n세상에 전 남친이 들어오는 거야\n걔도 나 보고 완전 굳어버렸어\n둘 다 말도 못 하고 있었는데\n알고 보니까 우리 친구랑 걔 친구가 짜고 한 거였어\n재결합 시켜보려고\n나 진짜 웃겨서 커피 다 뿜을 뻔 했어",
  },
  {
    title: "배달 시켰는데 사장님이 직접 오신 썰",
    text: "어제 치킨 시켰거든\n30분 기다리니까 초인종이 울렸어\n문 열었더니 라이더가 아니라\n앞치마 두른 아저씨가 서 계시는 거야\n사장님이 직접 오신 거 있잖아\n배달 기사가 갑자기 사고가 났대\n다른 기사 구하려면 너무 늦을 것 같아서\n본인이 직접 오셨다고\n치킨이 식으면 안 된다면서\n진짜 감동받아서 그날 리뷰 엄청 길게 썼어",
  },
  {
    title: "부모님께 남자친구 들켰을 때",
    text: "저번 주에 진짜 심장 떨어지는 줄 알았어\n남자친구가 집에 놀러 왔는데\n부모님이 당연히 외출하셨을 시간이었거든\n같이 영화 보고 있었는데\n갑자기 현관 비밀번호 누르는 소리가 나는 거야\n남자친구 화장실에 밀어 넣고 나갔더니\n엄마가 반반무많이 들고 서 계셨어\n치킨 사 왔다고\n화장실에서 나오는 남자친구 보고 엄마가 그랬어\n짜장면도 시킬걸 그랬네",
  },
  {
    title: "지하철에서 싸운 할머니들 중재한 썰",
    text: "어제 퇴근길 지하철에서 진짜 긴장됐어\n내 앞에 할머니 두 분이 앉아 계셨는데\n갑자기 한 분이 에어컨 너무 세다고 하시는 거야\n다른 할머니는 지금 딱 좋다고 하시고\n점점 목소리가 커지더니\n진짜 싸우시는 거 있잖아\n옆에 아무도 말을 못 하고 있는데\n내가 용기 내서 할머니 담요 꺼내드렸어\n그랬더니 두 분이 나한테 한 번에 고맙다 하시면서\n화해하셨어 나 그날 영웅된 줄 알았어",
  },
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
