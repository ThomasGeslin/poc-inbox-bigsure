/**
 * Strips the quoted reply/forward chain from an incoming HTML email body.
 *
 * Mail clients append the previous message below the actual reply, separated by
 * a well-known boundary marker:
 *   - Outlook / OWA: `<div id="appendonsend">` then `<hr>` then
 *     `<div id="divRplyFwdMsg">` containing the "De :/Envoyé :/À :/Objet :" header
 *   - Gmail: `<div class="gmail_quote">`
 *   - Apple Mail / generic: `<blockquote type="cite">`
 *
 * We already surface the sender, subject and thread elsewhere in the inbox, so
 * the quoted block is redundant noise. This keeps only the part above the first
 * boundary marker. If no marker is found the original HTML is returned unchanged.
 */
export function stripQuotedReply(html: string): string {
  if (!html) return html;

  // Boundary markers, in the order they typically appear in the document.
  // The earliest match wins so we never keep quoted content.
  const markers: RegExp[] = [
    /<div[^>]*\bid=["']?appendonsend["']?/i,
    /<div[^>]*\bid=["']?divRplyFwdMsg["']?/i,
    /<div[^>]*\bclass=["'][^"']*\bgmail_quote\b/i,
    /<blockquote/i,
  ];

  let cutIndex = -1;
  for (const marker of markers) {
    const match = marker.exec(html);
    if (match && (cutIndex === -1 || match.index < cutIndex)) {
      cutIndex = match.index;
    }
  }

  if (cutIndex === -1) return html;

  let result = html.slice(0, cutIndex);

  // Outlook inserts a horizontal rule just before the quoted header — drop a
  // trailing <hr> (and any whitespace) left dangling after the cut.
  result = result.replace(/<hr[^>]*>\s*$/i, '');

  return result.trim();
}
