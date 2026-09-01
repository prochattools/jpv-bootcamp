export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (match, decimal: string) => {
      const codePoint = Number(decimal)
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match
    })
    .replace(/&#x([0-9a-f]+);/gi, (match, hexadecimal: string) => {
      const codePoint = Number.parseInt(hexadecimal, 16)
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match
    })
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#039;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
}

export function isHiddenLegacyWelcomeLesson(args: { courseSlug: string | null | undefined; moduleTitle: string | null | undefined; lessonSlug: string | null | undefined; lessonTitle: string | null | undefined }): boolean {
  const courseSlug = args.courseSlug?.trim().toLowerCase()
  const moduleTitle = decodeHtmlEntities(args.moduleTitle?.trim() ?? '').toLowerCase()
  const lessonSlug = args.lessonSlug?.trim().toLowerCase()
  const lessonTitle = decodeHtmlEntities(args.lessonTitle?.trim() ?? '').toLowerCase()

  return courseSlug === 'propertytraining_uk' && moduleTitle === 'welcome' && (lessonSlug === 'lesson-2-welcome-to-the-course' || lessonTitle === 'lesson 2 - welcome to the course')
}
