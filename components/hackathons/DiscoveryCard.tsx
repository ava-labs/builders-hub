import Image from 'next/image';

interface DiscoveryCardProps {
  title: string;
  description: string;
  image: string;
  url: string;
}

export default function DiscoveryCard({ title, description, image, url }: DiscoveryCardProps) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      {/* eco-photo-cards: one shadow per card, changed in 200ms ease; the photo zooms to 1.03 in 700ms and comes back in
          300ms on the strong ease-out, and not at all under Reduce Motion */}
      <div className="group relative overflow-hidden rounded-lg transition-[box-shadow] duration-200 ease-[ease] hover:shadow-lg h-[400px]">
        <div className="relative bg-card border border-border rounded-lg h-full flex flex-col overflow-hidden">
          <div className="w-full h-64 relative overflow-hidden flex-shrink-0">
            <Image
              src={image}
              alt={title}
              fill
              style={{ objectFit: 'cover' }}
              className="transition-[scale] duration-300 group-hover:duration-700 ease-out motion-safe:group-hover:scale-103"
            />
          </div>
          <div className="flex-1 flex flex-col p-6">
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </div>
      </div>
    </a>
  );
}
