const Icon = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export const IconSend = () => <Icon d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" size={15} />;
export const IconArrowUp = () => <Icon d="M12 19V5M5 12l7-7 7 7" size={16} />;
