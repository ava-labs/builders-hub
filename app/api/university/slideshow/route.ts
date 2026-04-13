import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { blobService } from '@/server/services/blob';

export const GET = withApi(async () => {
  const blobs = await blobService.listFiles('University-Slideshow/');

  const filteredBlobs = blobs.filter((blob) => {
    const filename = blob.pathname.split('/').pop() || '';
    return filename && filename.length > 0 && blob.size > 0;
  });

  const sortedBlobs = filteredBlobs.sort((a, b) => {
    const aName = a.pathname.split('/').pop() || '';
    const bName = b.pathname.split('/').pop() || '';
    const aNum = parseInt(aName.match(/\d+/)?.[0] || '0');
    const bNum = parseInt(bName.match(/\d+/)?.[0] || '0');
    return aNum - bNum;
  });

  return successResponse({
    images: sortedBlobs.map((blob) => ({
      url: blob.url,
      filename: blob.pathname.split('/').pop(),
      size: blob.size,
      uploadedAt: blob.uploadedAt,
    })),
  });
});
