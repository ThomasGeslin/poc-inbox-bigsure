import { StorageService } from './storage.service';

const uploadMock = jest.fn();
const getPublicUrlMock = jest.fn();
const fromMock = jest.fn(() => ({
  upload: uploadMock,
  getPublicUrl: getPublicUrlMock,
}));
const createClientMock = jest.fn(() => ({ storage: { from: fromMock } }));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

describe('StorageService', () => {
  let service: StorageService;

  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
    process.env.SUPABASE_STORAGE_BUCKET = 'attachments';
  });

  beforeEach(() => {
    uploadMock.mockReset();
    getPublicUrlMock.mockReset();
    fromMock.mockClear();
    service = new StorageService();
  });

  it('uploads bytes to the configured bucket and returns the public URL', async () => {
    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockReturnValue({
      data: {
        publicUrl:
          'https://proj.supabase.co/storage/v1/object/public/attachments/abc.jpg',
      },
    });

    const buf = Buffer.from('image-bytes');
    const url = await service.upload(buf, 'image/jpeg', 'jpg');

    expect(fromMock).toHaveBeenCalledWith('attachments');
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^[\w-]+\.jpg$/),
      buf,
      { contentType: 'image/jpeg', upsert: false },
    );
    expect(url).toBe(
      'https://proj.supabase.co/storage/v1/object/public/attachments/abc.jpg',
    );
  });

  it('generates a unique object path per upload', async () => {
    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: 'x' } });

    await service.upload(Buffer.from('a'), 'image/png', 'png');
    await service.upload(Buffer.from('b'), 'image/png', 'png');

    const path1 = uploadMock.mock.calls[0][0] as string;
    const path2 = uploadMock.mock.calls[1][0] as string;
    expect(path1).not.toBe(path2);
  });

  it('throws when Supabase returns an upload error', async () => {
    uploadMock.mockResolvedValue({ error: { message: 'bucket not found' } });

    await expect(
      service.upload(Buffer.from('x'), 'image/png', 'png'),
    ).rejects.toThrow('Attachment upload failed');
  });

  it('throws at construction when required env vars are missing', () => {
    const saved = process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    try {
      expect(() => new StorageService()).toThrow(
        'SUPABASE_URL and SUPABASE_SECRET_KEY must be defined',
      );
    } finally {
      process.env.SUPABASE_SECRET_KEY = saved;
    }
  });
});
