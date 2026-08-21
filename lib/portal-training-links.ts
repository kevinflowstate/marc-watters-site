const LESSON_HASH_PREFIX = "#lesson-";

export function trainingLessonAnchorId(lessonId: string) {
  return `lesson-${encodeURIComponent(lessonId)}`;
}

export function trainingLessonHref(moduleId: string, lessonId: string) {
  return `/portal/training/${encodeURIComponent(moduleId)}#${trainingLessonAnchorId(lessonId)}`;
}

export function lessonIdFromTrainingHash(hash: string) {
  if (!hash.startsWith(LESSON_HASH_PREFIX)) return null;

  try {
    const lessonId = decodeURIComponent(hash.slice(LESSON_HASH_PREFIX.length));
    return lessonId || null;
  } catch {
    return null;
  }
}
