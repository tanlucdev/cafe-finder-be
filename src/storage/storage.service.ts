import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly supabaseUrl: string;
  private readonly supabaseKey: string;
  private readonly bucket: string;

  constructor(private config: ConfigService) {
    this.supabaseUrl = config.get('SUPABASE_URL', '');
    this.supabaseKey = config.get('SUPABASE_SERVICE_KEY', '');
    this.bucket = config.get('SUPABASE_BUCKET', 'cafe-images');
  }

  async uploadImage(file: Express.Multer.File, folder: string = 'cafes'): Promise<string> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new InternalServerErrorException('Supabase chưa được cấu hình');
    }

    const fileName = `${folder}/${Date.now()}-${file.originalname.replace(/\s/g, '_')}`;

    const response = await fetch(
      `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${fileName}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.supabaseKey}`,
          'Content-Type': file.mimetype,
        },
        body: file.buffer as any,
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new InternalServerErrorException(`Upload ảnh thất bại: ${error}`);
    }

    return `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${fileName}`;
  }

  async deleteImage(imageUrl: string): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseKey) return;

    const path = imageUrl.replace(
      `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/`,
      '',
    );

    await fetch(`${this.supabaseUrl}/storage/v1/object/${this.bucket}/${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.supabaseKey}` },
    });
  }
}
