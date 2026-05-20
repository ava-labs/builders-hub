import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";
import { Github, ExternalLink, MapPin, Mail, Twitter, Send } from "lucide-react";
import type { GalleryProject } from "@/server/services/projects";

const FALLBACK_COVER =
  "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/project-banner-2whUMzkW6ABHW5GjIAH3NbBHLQIJzw.png";

interface GalleryCardProps {
  project: GalleryProject;
}

export function GalleryCard({ project }: GalleryCardProps) {
  const coverImage = project.screenshots[0]?.trim() || FALLBACK_COVER;

  return (
    <Card className="flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="relative w-full aspect-video bg-zinc-100 dark:bg-zinc-900">
        <Image
          src={coverImage}
          alt={`${project.name} screenshot`}
          fill
          unoptimized
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="space-y-1">
          <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-50">
            {project.name}
          </h3>
          <p className="text-xs text-zinc-500">{project.team.name}</p>
        </div>

        {(project.tracks.length > 0 || project.stack.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {project.tracks.map((t) => (
              <Badge key={`track-${t}`} variant="secondary" className="text-xs">
                {t}
              </Badge>
            ))}
            {project.stack.map((s) => (
              <Badge key={`stack-${s}`} variant="outline" className="text-xs">
                {s}
              </Badge>
            ))}
          </div>
        )}

        <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">
          {project.short_description}
        </p>

        {project.team.members.length > 0 && (
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-2">
            {project.team.members.map((member, idx) => {
              const contactItems: { icon: React.ReactNode; value: string; href?: string }[] = [];
              if (member.country)
                contactItems.push({ icon: <MapPin className="h-3 w-3" />, value: member.country });
              if (member.github)
                contactItems.push({
                  icon: <Github className="h-3 w-3" />,
                  value: member.github,
                  href: `https://github.com/${member.github}`,
                });
              if (member.x)
                contactItems.push({
                  icon: <Twitter className="h-3 w-3" />,
                  value: member.x,
                  href: `https://x.com/${member.x.replace(/^@/, "")}`,
                });
              if (member.telegram)
                contactItems.push({
                  icon: <Send className="h-3 w-3" />,
                  value: member.telegram,
                });
              if (member.email)
                contactItems.push({
                  icon: <Mail className="h-3 w-3" />,
                  value: member.email,
                  href: `mailto:${member.email}`,
                });
              return (
                <div key={idx} className="text-xs">
                  <div className="font-medium text-zinc-700 dark:text-zinc-300">
                    {member.name}
                  </div>
                  {contactItems.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-zinc-500">
                      {contactItems.map((item, j) =>
                        item.href ? (
                          <Link
                            key={j}
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                          >
                            {item.icon}
                            <span>{item.value}</span>
                          </Link>
                        ) : (
                          <span key={j} className="inline-flex items-center gap-1">
                            {item.icon}
                            <span>{item.value}</span>
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 pt-2 mt-auto">
          {project.repo_url && (
            <Link
              href={project.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-zinc-700 dark:text-zinc-300 hover:underline"
            >
              <Github className="h-3.5 w-3.5" />
              Repo
            </Link>
          )}
          {project.demo_url && (
            <Link
              href={project.demo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-zinc-700 dark:text-zinc-300 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Demo
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
