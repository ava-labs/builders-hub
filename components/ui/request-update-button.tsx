import React from 'react';
import newGithubIssueUrl from 'new-github-issue-url';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export interface RequestUpdateButtonProps {
  title: string;
  pagePath: string;
  buttonText?: string;
  buttonVariant?: "link" | "default" | "destructive" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

const RequestUpdateButton: React.FC<RequestUpdateButtonProps> = ({
  title,
  pagePath,
  buttonText = "Report Issue",
  buttonVariant,
  size = "sm",
  className,
}) => {
  const issueUrl = newGithubIssueUrl({
    user: 'ava-labs',
    repo: 'builders-hub',
    title: title || `Outdated Information on ${pagePath || 'this page'}`,
    body: `It appears that the information on this page might be outdated. Please review and update as needed.

Page: [${pagePath || 'Unknown'}](https://docs.avax.network${pagePath})

[Provide more details here...]`,
    labels: ['outdated', 'documentation'],
  });

  const openIssue = () => {
    window.open(issueUrl, '_blank');
  };

  return (
    <Button className={`inline-flex items-center gap-2 ${className}`} variant={buttonVariant || "outline"} size={size} onClick={openIssue}>
      <AlertCircle className="size-4" />
      {buttonText || "Report Issue"}
    </Button>
  );
};

export default RequestUpdateButton; 