export const NAV_SECTIONS = [
  {
    label: '계정진단',
    items: [{ href: '/engagement', icon: '📋', label: '보고서 확인하기' }],
  },
  {
    label: 'AI 기획',
    items: [
      { href: '/ai/direction', icon: '⊙', label: '계정 방향성 기획' },
      { href: '/ai/name', icon: 'AA', label: '이름 추천' },
      { href: '/ai/profile', icon: '👤', label: '프로필 세팅' },
      { href: '/ai/reelsPlanning', icon: '🎬', label: '릴스 기획' },
      { href: '/ai/history', icon: '🕐', label: 'AI기획 보관함' },
    ],
  },
  {
    label: '콘텐츠',
    items: [{ href: '/findReels', icon: '▶', label: '릴스 모음' }],
  },
  {
    label: '지원',
    items: [
      { href: '/board/notice', icon: '🔔', label: '공지사항' },
      { href: 'https://www.helpu.kr/agcglobal', icon: '❓', label: '원격지원', external: true },
    ],
  },
]
