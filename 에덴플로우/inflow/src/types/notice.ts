export interface Notice {
  id: string
  title: string
  content?: string
  important?: boolean
  isPinned?: boolean
  views?: number
  createdAt: string
}
