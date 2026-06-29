import { stripQuotedReply } from './mail-content.utils';

describe('stripQuotedReply', () => {
  it('returns empty/undefined input unchanged', () => {
    expect(stripQuotedReply('')).toBe('');
    expect(stripQuotedReply(undefined as never)).toBeUndefined();
  });

  it('returns the body unchanged when there is no quoted chain', () => {
    const html = '<p>Bonjour, voici ma demande de devis.</p>';
    expect(stripQuotedReply(html)).toBe(html);
  });

  it('strips the Outlook quoted chain (appendonsend + hr + divRplyFwdMsg)', () => {
    const html = [
      '<div>Voici ma réponse au chantier.</div>',
      '<div id="appendonsend"></div>',
      '<hr style="display:inline-block;width:98%" tabindex="-1">',
      '<div id="divRplyFwdMsg" dir="ltr">',
      '<font><b>De :</b> Thomas Geslin &lt;tgeslin@batibig.com&gt;<br>',
      '<b>Envoyé :</b> lundi 29 juin 2026 10:29<br>',
      '<b>À :</b> plomberie-bigsur@batibig.com<br>',
      '<b>Objet :</b> RE: Nouveau Chantier 2</font>',
      '</div>',
      '<p>Message original ici</p>',
    ].join('');

    const result = stripQuotedReply(html);
    expect(result).toBe('<div>Voici ma réponse au chantier.</div>');
    expect(result).not.toContain('De :');
    expect(result).not.toContain('Objet :');
    expect(result).not.toContain('<hr');
  });

  it('strips the Outlook chain when only divRplyFwdMsg is present', () => {
    const html =
      '<div>Ma réponse</div>' +
      '<hr tabindex="-1">' +
      '<div id="divRplyFwdMsg"><b>De :</b> ...</div><p>orig</p>';

    expect(stripQuotedReply(html)).toBe('<div>Ma réponse</div>');
  });

  it('strips a Gmail quoted chain', () => {
    const html =
      '<div dir="ltr">Réponse Gmail</div>' +
      '<div class="gmail_quote"><blockquote>old message</blockquote></div>';

    expect(stripQuotedReply(html)).toBe('<div dir="ltr">Réponse Gmail</div>');
  });

  it('strips a generic blockquote-cited chain', () => {
    const html =
      '<p>Nouvelle réponse</p>' +
      '<blockquote type="cite">Le 29 juin, X a écrit :</blockquote>';

    expect(stripQuotedReply(html)).toBe('<p>Nouvelle réponse</p>');
  });

  it('cuts at the earliest marker when several are present', () => {
    const html =
      '<p>reply</p>' +
      '<div id="appendonsend"></div>' +
      '<blockquote>quoted</blockquote>';

    expect(stripQuotedReply(html)).toBe('<p>reply</p>');
  });
});
