import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

/**
 * Uploads attachment files to Supabase Storage (a public bucket) and returns
 * their public URLs. Replaces the previous local `uploads/` directory, which
 * did not survive redeploys and could not scale across instances.
 *
 * Requires:
 *  - SUPABASE_URL
 *  - SUPABASE_SECRET_KEY     (server-side only — never expose to the client;
 *                            a Supabase "secret key" sb_secret_…)
 *  - SUPABASE_STORAGE_BUCKET (optional, defaults to "attachments")
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: ReturnType<typeof createClient>;
  private readonly bucket: string;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'attachments';

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be defined');
    }

    // This key bypasses RLS; never use it in client code.
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /**
   * Upload a binary attachment and return its permanent public URL.
   * @param data        raw file bytes
   * @param contentType MIME type (e.g. "image/jpeg")
   * @param ext         file extension WITHOUT the leading dot (e.g. "jpg")
   */
  async upload(
    data: Buffer,
    contentType: string,
    ext: string,
  ): Promise<string> {
    const objectPath = `${randomUUID()}.${ext}`;

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(objectPath, data, { contentType, upsert: false });

    if (error) {
      this.logger.error(`Supabase Storage upload failed: ${error.message}`);
      throw new InternalServerErrorException('Attachment upload failed');
    }

    const { data: pub } = this.client.storage
      .from(this.bucket)
      .getPublicUrl(objectPath);

    return pub.publicUrl;
  }
}
