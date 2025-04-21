
import { put, del, head, type HeadBlobResult } from '@vercel/blob';

export class BlobService {
  private token: string;

  constructor() {
    this.token = process.env.BLOB_READ_WRITE_TOKEN || "";
    if (!this.token) {
      throw new Error("BLOB_READ_WRITE_TOKEN is not defined in environment variables");
    }
  }


  async uploadFile(file: File, customId?: string): Promise<{ id: string; url: string }> {
    try {
      const fileId = customId || `${Date.now()}-${file.name}`;
      const blob = await put(fileId, file, {
        access: "public",
        token: this.token,
      });
      return {
        id: fileId,
        url: blob.url,
      };
    } catch (error) {
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }


  async deleteFile(id: string): Promise<void> {
    try {
      await del(id, { token: this.token });
    } catch (error) {
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async getFileById(id: string): Promise<HeadBlobResult> {
    try {
      const blob = await head(id, { token: this.token });
      if (!blob) {
        throw new Error("File not found");
      }
      return blob;
    } catch (error) {
      throw new Error(`Failed to fetch file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

export const blobService = new BlobService();