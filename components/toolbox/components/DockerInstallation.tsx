'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CodeBlock } from './NodeSetupUI';

const dockerOnlyInstructions: Record<string, string> = {
  'Ubuntu/Debian': `# Install Docker using convenience script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Test installation
docker run -it --rm hello-world
`,
  'Amazon Linux 2023+': `# Install Docker
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

newgrp docker

# Test installation
docker run -it --rm hello-world
`,
  Fedora: `# Install Docker using convenience script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Test installation
docker run -it --rm hello-world
`,
  macOS: `# Install Docker Desktop for Mac
# Download from: https://www.docker.com/products/docker-desktop/
echo "Please download and install Docker Desktop for Mac from the official Docker website."

# After installation, you can test it by running:
docker run -it --rm hello-world
`,
} as const;

const dockerInstallInstructions: Record<string, string> = {
  'Ubuntu/Debian': `# Install Docker using convenience script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Test installation
docker run -it --rm hello-world
docker compose version
`,
  'Amazon Linux 2023+': `# Install Docker
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Install Docker Compose v2 plugin (Amazon Linux specific)
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/download/v2.26.1/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

newgrp docker

# Test installation
docker run -it --rm hello-world
docker compose version
`,
  Fedora: `# Install Docker using convenience script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Test installation
docker run -it --rm hello-world
docker compose version
`,
  macOS: `# Install Docker Desktop for Mac
# Download from: https://www.docker.com/products/docker-desktop/
echo "Please download and install Docker Desktop for Mac from the official Docker website."
echo "Docker Compose is included with Docker Desktop."

# After installation, you can test it by running:
docker run -it --rm hello-world
docker compose version
`,
} as const;

type OS = keyof typeof dockerInstallInstructions;

interface DockerInstallationProps {
  title?: string;
  description?: string;
  includeCompose?: boolean;
}

export const DockerInstallation = ({ title, description, includeCompose = true }: DockerInstallationProps) => {
  const instructions = includeCompose ? dockerInstallInstructions : dockerOnlyInstructions;
  const systems = Object.keys(instructions) as OS[];
  const [os, setOs] = useState<OS>(systems[0]);
  const defaultTitle = includeCompose ? 'Docker & Docker Compose Installation' : 'Docker Installation';
  const defaultDescription = includeCompose
    ? 'Make sure you have Docker and Docker Compose installed on your system. You can use the following commands to install both:'
    : 'Make sure you have Docker installed on your system. You can use the following commands to install it:';

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">{title || defaultTitle}</h3>
      <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {description || defaultDescription}
      </p>

      <div className="flex flex-col">
        <div
          role="tablist"
          aria-label="Operating system"
          className="flex overflow-x-auto border-x border-t border-zinc-200 dark:border-zinc-800"
        >
          {systems.map((system) => (
            <button
              key={system}
              type="button"
              role="tab"
              aria-selected={os === system}
              onClick={() => setOs(system)}
              className={cn(
                'shrink-0 border-b-2 px-4 py-2.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] transition-colors',
                os === system
                  ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-50'
                  : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
              )}
            >
              {system}
            </button>
          ))}
        </div>
        <div role="tabpanel" aria-label={os}>
          <CodeBlock code={instructions[os]} />
        </div>
      </div>
    </div>
  );
};
