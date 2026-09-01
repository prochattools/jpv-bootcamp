import type { MemberManagedVideo } from '@/lib/payloadContent/memberMedia'

export type AdminCourseMediaOption = {
  id: string
  label: string
  url: string
  mimeType: string | null
  kind: 'image' | 'file'
}

export type AdminCourseVideoOption = {
  id: string
  title: string
  status: MemberManagedVideo['status']
  thumbnailUrl: string | null
}

export type AdminCourseMediaLibrary = {
  images: AdminCourseMediaOption[]
  files: AdminCourseMediaOption[]
  videos: AdminCourseVideoOption[]
}
