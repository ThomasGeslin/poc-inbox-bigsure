import {
  isAcceptedAttachmentType,
  extFromContentType,
  extFromFilename,
} from './attachment.utils';

describe('attachment.utils', () => {
  describe('isAcceptedAttachmentType', () => {
    it.each([
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
      'IMAGE/PNG',
      'application/pdf',
      'application/pdf; charset=binary',
      'APPLICATION/PDF',
    ])('accepts %s', (type) => {
      expect(isAcceptedAttachmentType(type)).toBe(true);
    });

    it.each([
      'application/octet-stream',
      'application/zip',
      'text/calendar',
      'text/plain',
      'video/mp4',
      'audio/mpeg',
      '',
      undefined,
      null,
    ])('rejects %s', (type) => {
      expect(isAcceptedAttachmentType(type)).toBe(false);
    });
  });

  describe('extFromContentType', () => {
    it.each([
      ['image/jpeg', 'jpeg'],
      ['image/png', 'png'],
      ['application/pdf', 'pdf'],
      ['application/pdf; charset=binary', 'pdf'],
    ])('derives %s → %s', (type, expected) => {
      expect(extFromContentType(type)).toBe(expected);
    });

    it('falls back to bin for malformed content types', () => {
      expect(extFromContentType('weird')).toBe('bin');
    });
  });

  describe('extFromFilename', () => {
    it.each([
      ['photo.JPG', 'JPG'],
      ['report.pdf', 'pdf'],
      ['archive.tar.gz', 'gz'],
    ])('derives %s → %s', (name, expected) => {
      expect(extFromFilename(name)).toBe(expected);
    });

    it('falls back to bin when there is no extension', () => {
      expect(extFromFilename('noextension')).toBe('bin');
    });
  });
});
