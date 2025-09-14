import React from "react"
import { AlertCircle, Clock, GithubIcon, MessageSquare } from "lucide-react"
import { Button } from "./Button"

interface ToolHeaderProps {
  title: string
  duration: string
  description: string
  githubDir: string
  issuePath?: string
  issueTitle?: string
}

const ToolHeader: React.FC<ToolHeaderProps> = ({
  title,
  duration,
  description,
  githubDir,
  issuePath,
  issueTitle,
}) => {
  const openGithubIssue = () => {
    if (!issuePath || !issueTitle) return

    const issueUrl = new URL("https://github.com/ava-labs/builders-hub/issues/new")

    const params = new URLSearchParams()
    params.append("title", issueTitle || `Outdated Information on ${issuePath}`)
    params.append("labels", "outdated,documentation")

    const body = `It appears that the information on this page might be outdated. Please review and update as needed.

Page: [${issuePath}](https://build.avax.network${issuePath})

[Provide more details here...]`

    params.append("body", body)
    issueUrl.search = params.toString()

    window.open(issueUrl.toString(), "_blank")
  }

  return (
    <div className="space-y-4 mb-4">
      <div className="space-y-2">
        <div className="flex flex-row flex-wrap items-center gap-4">
          <h1 className="text-5xl font-medium">{title}</h1>
          <div className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-800 text-secondary-foreground px-3 py-1 rounded-full text-md">
            <Clock className="w-4 h-4" />
            <span>{duration}</span>
          </div>
          <div className="sm:ml-auto flex items-center gap-3">
            <a href={`https://github.com/ava-labs/builders-hub/tree/master/toolbox/src/${githubDir}`} target="_blank" rel="noopener noreferrer" >
              <Button variant="secondary" size="sm" className="rounded-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <GithubIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </Button>
            </a>
            <a href="https://t.me/+4kKgMmWAknxjY2Ey" target="_blank" rel="noopener noreferrer" >
              <Button variant="secondary" size="sm" className="rounded-full px-4 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
                Give&nbsp;Feedback
              </Button>
            </a>
            {issuePath && issueTitle && (
              <Button
                variant="secondary"
                size="sm"
                onClick={openGithubIssue}
                className="rounded-full px-4 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              >
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
                Report Issue
              </Button>
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

