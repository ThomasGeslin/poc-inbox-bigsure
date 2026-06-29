/**
 * Attachment handling shared across channels (Twilio SMS/WhatsApp, MS Graph mail).
 *
 * The feature accepts images (png, jpg, gif, webp…) and PDF documents. Anything
 * else is silently ignored on receive and rejected on send.
 */

/** MIME types we accept as attachments: any image, plus PDF. */
export function isAcceptedAttachmentType(
  contentType: string | undefined | null,
): boolean {
  if (!contentType) return false;
  const normalized = contentType.toLowerCase();
  return (
    normalized.startsWith('image/') || normalized.startsWith('application/pdf')
  );
}

/** Derive a file extension from a MIME type, e.g. `image/jpeg` → `jpeg`. */
export function extFromContentType(contentType: string): string {
  return contentType.split('/')[1]?.split(';')[0] ?? 'bin';
}

/** Derive a file extension from a filename, falling back to `bin`. */
export function extFromFilename(name: string): string {
  return name.includes('.') ? name.split('.').pop()! : 'bin';
}
