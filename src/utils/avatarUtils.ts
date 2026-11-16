/**
 * STROOM Profile Photo Utilities
 * 
 * Enforces authentic user-uploaded profile photos only.
 * Disallows generated avatars, cartoon characters, and decorative illustration services
 * (e.g. Dicebear, Robohash, Multiavatar).
 */

export function isUploadedPhoto(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  // Filter out any generated or illustration avatar services, or known conference sample images
  if (
    lower.includes('dicebear.com') ||
    lower.includes('robohash.org') ||
    lower.includes('multiavatar.com') ||
    lower.includes('placeholder') ||
    lower.includes('photo-1540575467063-178a50c2df87')
  ) {
    return false;
  }

  // Must be a valid http(s) URL, relative image asset, or local blob preview URL
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('/') ||
    lower.startsWith('blob:')
  );
}
