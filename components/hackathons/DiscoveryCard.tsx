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
      <div className="group relative overflow-hidden rounded-lg transition-all duration-300 hover:shadow-lg h-[400px]">
        <div className="relative bg-card border border-border rounded-lg hover:shadow-lg transition-shadow duration-200 h-full flex flex-col overflow-hidden">
          <div className="w-full h-64 relative overflow-hidden flex-shrink-0">
            <Image
              src={image}
              alt={title}
              fill
              style={{ objectFit: 'cover' }}
              className="transition-transform duration-300 group-hover:scale-105"
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
