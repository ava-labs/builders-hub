import { createMetadataImage } from 'fumadocs-core/server';
import { documentation } from '@/lib/source';

export const metadataImage = createMetadataImage({
  source: documentation,
  imageRoute: 'og',
});