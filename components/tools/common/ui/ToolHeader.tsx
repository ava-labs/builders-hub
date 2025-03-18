import React from "react"
import Link from "next/link"
import { Clock, GithubIcon, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import RequestUpdateButtonWrapper from "@/components/client/request-update-button-wrapper"

interface ToolHeaderProps {
  title: string
  duration: string
  description: string
  githubDir: string
  updatePath?: string
  updateTitle?: string
}

const ToolHeader: React.FC<ToolHeaderProps> = ({
  title,
  duration,
  description,
  githubDir,
  updatePath,
  updateTitle,
}) => {
  return (
    <div className="space-y-4 mb-4">
      <div className="space-y-2">
        <div className="flex flex-row flex-wrap items-center gap-4">
            <h1 className="text-5xl font-medium">{title}</h1>
            <div className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-800 text-secondary-foreground px-3 py-1 rounded-full text-md">
                <Clock className="w-4 h-4" />
                <span>{duration}</span>
            </div>
            <div className="sm:ml-auto flex items-center gap-2">
              <Link href={`https://github.com/ava-labs/builders-hub/blob/master/components/tools/${githubDir}`} target="_blank" rel="noopener noreferrer" >
                    <Button variant="outline" size="sm">
                    <GithubIcon className="w-4 h-4" />
                    </Button>
              </Link>
              <Link href="https://t.me/+4kKgMmWAknxjY2Ey" target="_blank" rel="noopener noreferrer" >
                  <Button variant="outline" size="sm">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Give Feedback
                  </Button>
              </Link>
              {updatePath && updateTitle && (
                <RequestUpdateButtonWrapper
                  pagePath={updatePath}
                  title={updateTitle}
                />
              )}
            </div>
            
        </div>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <hr className="border-t border-gray-200 dark:border-gray-700" />
    </div>
  )
}

export default ToolHeader

