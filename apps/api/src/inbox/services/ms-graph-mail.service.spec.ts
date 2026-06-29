import axios from 'axios';
import { MsGraphMailService } from './ms-graph-mail.service';
import { StorageService } from './storage.service';

jest.mock('axios');

const b64 = (s: string) => Buffer.from(s).toString('base64');

describe('MsGraphMailService.getMessageAttachmentUrls', () => {
  let service: MsGraphMailService;
  let storage: { upload: jest.Mock };
  const MAILBOX = 'box@example.com';

  beforeAll(() => {
    process.env.ENTRA_TENANT_ID = 'tenant';
    process.env.ENTRA_CLIENT_ID = 'client';
    process.env.ENTRA_CLIENT_SECRET = 'secret';
    process.env.TEST_MAIL = MAILBOX;
  });

  beforeEach(() => {
    storage = {
      upload: jest
        .fn()
        .mockImplementation((_buf: Buffer, _ct: string, ext: string) =>
          Promise.resolve(`https://store.test/${ext}`),
        ),
    };
    service = new MsGraphMailService(storage as unknown as StorageService);
    // Avoid real OAuth — stub the private token fetch.
    jest
      .spyOn(
        service as unknown as { getAccessToken: () => Promise<string> },
        'getAccessToken',
      )
      .mockResolvedValue('fake-token');
  });

  afterEach(() => jest.restoreAllMocks());

  const mockGraphAttachments = (value: unknown[]) =>
    (axios.get as jest.Mock).mockResolvedValue({ data: { value } });

  it('uploads image and PDF attachments and returns their storage URLs', async () => {
    mockGraphAttachments([
      {
        id: '1',
        name: 'photo.JPG',
        contentType: 'image/jpeg',
        contentBytes: b64('the-image'),
        size: 9,
      },
      {
        id: '2',
        name: 'quote.pdf',
        contentType: 'application/pdf',
        contentBytes: b64('the-pdf'),
        size: 7,
      },
    ]);

    const urls = await service.getMessageAttachmentUrls(MAILBOX, 'msg-1');

    expect(storage.upload).toHaveBeenCalledTimes(2);
    // Bytes passed to storage are the decoded base64, content type + ext preserved
    expect(storage.upload).toHaveBeenNthCalledWith(
      1,
      Buffer.from('the-image'),
      'image/jpeg',
      'JPG',
    );
    expect(storage.upload).toHaveBeenNthCalledWith(
      2,
      Buffer.from('the-pdf'),
      'application/pdf',
      'pdf',
    );
    expect(urls).toEqual(['https://store.test/JPG', 'https://store.test/pdf']);
  });

  it('skips inline attachments such as signature logos', async () => {
    mockGraphAttachments([
      {
        id: '1',
        name: 'logo.png',
        contentType: 'image/png',
        contentBytes: b64('logo'),
        size: 4,
        isInline: true,
      },
    ]);

    const urls = await service.getMessageAttachmentUrls(MAILBOX, 'msg-1');

    expect(urls).toEqual([]);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('skips attachments whose content type is neither image nor PDF', async () => {
    mockGraphAttachments([
      {
        id: '1',
        name: 'invite.ics',
        contentType: 'text/calendar',
        contentBytes: b64('cal'),
        size: 3,
      },
    ]);

    const urls = await service.getMessageAttachmentUrls(MAILBOX, 'msg-1');

    expect(urls).toEqual([]);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('skips attachments that have no contentBytes', async () => {
    mockGraphAttachments([
      { id: '1', name: 'photo.jpg', contentType: 'image/jpeg', size: 1 },
    ]);

    const urls = await service.getMessageAttachmentUrls(MAILBOX, 'msg-1');

    expect(urls).toEqual([]);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('does NOT $select contentBytes (only valid on the fileAttachment derived type)', async () => {
    mockGraphAttachments([]);

    await service.getMessageAttachmentUrls(MAILBOX, 'msg-1');

    // Regression guard: `$select=...,contentBytes` makes Graph reject the
    // request with "Could not find a property named 'contentBytes' on type
    // 'microsoft.graph.attachment'". The unselected GET returns it instead.
    const requestedUrl = (axios.get as jest.Mock).mock.calls[0][0] as string;
    expect(requestedUrl).not.toContain('$select');
    expect(requestedUrl).toMatch(/\/messages\/msg-1\/attachments$/);
  });

  it('returns [] (and does not throw) when the Graph request fails', async () => {
    (axios.get as jest.Mock).mockRejectedValue(new Error('Graph 500'));

    const urls = await service.getMessageAttachmentUrls(MAILBOX, 'msg-1');

    expect(urls).toEqual([]);
  });
});
