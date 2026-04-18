export interface User {
  id: string; username: string; name: string; email: string
  plan: 'FREE' | 'BASIC' | 'PRO'; createdAt: string
}
