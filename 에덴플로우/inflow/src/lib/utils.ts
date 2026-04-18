export function cn(...classes: (string|undefined|false|null)[]) {
  return classes.filter(Boolean).join(' ')
}
export function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'})
}
