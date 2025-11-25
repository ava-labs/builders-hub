"use client";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";

interface EditOnGitHubButtonProps {
  className?: string;
  githubUrl?: string;
  toolTitle?: string;
}

export function EditOnGitHubButton({
  className,
  githubUrl,
  toolTitle,
}: EditOnGitHubButtonProps) {
  const handleEditOnGitHub = () => {
    if (!githubUrl) return;
    window.open(githubUrl, "_blank");
  };

  // Don't render the button if no GitHub URL is provided
  if (!githubUrl) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleEditOnGitHub}
      className={className}
    >
      <Github className="h-4 w-4 mr-2" />
      Edit on GitHub
    </Button>
  );
}

