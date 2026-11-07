export function isNativeLessonVideo(url: string) {
  return /\/admin\/media\/lesson\/|\/api\/media\/lesson\/|\.mp4(?:[?#]|$)/i.test(
    url,
  );
}
export function nativeLessonVideoUrl(url: string) {
  const match = url.match(/\/admin\/media\/lesson\/([0-9a-f-]+)/i);
  return match ? `/api/media/lesson/${match[1]}` : url;
}
