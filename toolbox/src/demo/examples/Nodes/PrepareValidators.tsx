"use client"
import { useState } from "react"
import { Button } from "../../../components/button"
import { CodeHighlighter } from "../../ui/CodeHighlighter"

const dockerInstallInstructions: Record<string, string> = {
  "Ubuntu/Debian": `sudo apt-get update && \\
    sudo apt-get install -y docker.io && \\
    sudo usermod -aG docker $USER && \\
    newgrp docker

# Test docker installation
docker run -it --rm hello-world
`,
  "Amazon Linux 2023+": `sudo yum update -y && \\
    sudo yum install -y docker && \\
    sudo service docker start && \\
    sudo usermod -a -G docker $USER && \\
    newgrp docker

# Test docker installation
docker run -it --rm hello-world
`,
  Fedora: `sudo dnf update -y && \\
    sudo dnf -y install docker && \\
    sudo systemctl start docker && \\
    sudo usermod -a -G docker $USER && \\
    newgrp docker

# Test docker installation
docker run -it --rm hello-world
`,
  macOS: `# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Docker Desktop
brew install --cask docker

# Start Docker Desktop
open /Applications/Docker.app

# Test docker installation
docker run -it --rm hello-world
`,
}

export default function PrepareValidators() {
  const [activeOS, setActiveOS] = useState(Object.keys(dockerInstallInstructions)[0])

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-2xl font-medium mb-4">Prepare your Validator Nodes</h1>
        <p>
          This step will guide you through preparing your validator nodes. For long-lived environments we recommend
          using an infrastructure provider such as AWS or Google Cloud. For short-lived environments you can use your
          local machine or any other machine you have access to.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-2">Requirements for validator nodes:</h3>
        <ul className="list-disc list-inside ml-4">
          <li>16GB RAM (you might try with 8GB)</li>
          <li>8 cores CPU (you might try 4 cores)</li>
          <li>At least 100GB of any disk space (EBS or SSD), except for HDD</li>
          <li className="font-medium text-amber-600 dark:text-amber-400">
            Important: make sure port 9651 is open on your node!
          </li>
        </ul>
        <p className="mt-2">If you are hosting the validators on AWS you can use t2.2xlarge EC2 instances.</p>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Docker</h3>
        <p className="mb-4">
          We will retrieve the binary images of{" "}
          <a
            href="https://github.com/ava-labs/avalanchego"
            target="_blank"
            className="text-blue-600 dark:text-blue-400 hover:underline"
            rel="noreferrer"
          >
            AvalancheGo
          </a>{" "}
          from the Docker Hub. Make sure you have Docker installed on your system.
        </p>

        <div className="mb-4">
          <p className="block text-sm font-medium mb-2">Select your operating system:</p>
          <div className="flex flex-row flex-nowrap overflow-x-auto pb-2">
            {Object.keys(dockerInstallInstructions).map((os) => (
              <Button
                key={os}
                onClick={() => setActiveOS(os)}
                variant={activeOS === os ? "primary" : "secondary"}
                className={`mr-2 whitespace-nowrap ${
                  activeOS === os ? "" : "hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {os}
              </Button>
            ))}
          </div>
        </div>

        <div className="bg-gray-100 dark:bg-gray-800 rounded-md overflow-x-auto">
          <CodeHighlighter code={dockerInstallInstructions[activeOS]} lang="bash" />
        </div>

        <p className="mt-4">
          If you do not want to use Docker, you can follow the instructions{" "}
          <a
            href="https://github.com/ava-labs/avalanchego?tab=readme-ov-file#installation"
            target="_blank"
            className="text-blue-600 dark:text-blue-400 hover:underline"
            rel="noreferrer"
          >
            here
          </a>
          .
        </p>
      </div>
    </div>
  )
}

