import { NextResponse } from 'next/server';
import { blobService } from '@/server/services/blob';

// GET - Fetch all slideshow photos from University-Slideshow folder
export async function GET() {
  try {
    // List all blobs in the University-Slideshow directory
    const blobs = await blobService.listFiles('University-Slideshow/');

    // Filter out empty entries and sort blobs by filename to ensure proper order (numbered images)
    const filteredBlobs = blobs.filter(blob => {
      const filename = blob.pathname.split('/').pop() || '';
      return filename && filename.length > 0 && blob.size > 0;
    });

    const sortedBlobs = filteredBlobs.sort((a, b) => {
      const aName = a.pathname.split('/').pop() || '';
      const bName = b.pathname.split('/').pop() || '';
      
      // Extract numbers from filenames for sorting
      const aNum = parseInt(aName.match(/\d+/)?.[0] || '0');
      const bNum = parseInt(bName.match(/\d+/)?.[0] || '0');
      
      return aNum - bNum;
    });

    return NextResponse.json({ 
      images: sortedBlobs.map(blob => ({
        url: blob.url,
        filename: blob.pathname.split('/').pop(),
        size: blob.size,
        uploadedAt: blob.uploadedAt
      }))
    });
  } catch (error) {
    console.error('Error fetching university slideshow photos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch slideshow photos' },
      { status: 500 }
    );
  }
}
