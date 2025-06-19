import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

export const dockerOnlyInstructions: Record<string, string> = {
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
    'Fedora': `# Install Docker using convenience script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Test installation
docker run -it --rm hello-world
`,
} as const;

export const dockerInstallInstructions: Record<string, string> = {
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
    'Fedora': `# Install Docker using convenience script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Test installation
docker run -it --rm hello-world
docker compose version
`,
} as const;

export type OS = keyof typeof dockerInstallInstructions;

interface DockerInstallationProps {
    title?: string;
    description?: string;
    includeCompose?: boolean;
}

export const DockerInstallation = ({
    title,
    description,
    includeCompose = true
}: DockerInstallationProps) => {
    const instructions = includeCompose ? dockerInstallInstructions : dockerOnlyInstructions;
    const defaultTitle = includeCompose ? "Docker & Docker Compose Installation" : "Docker Installation";
    const defaultDescription = includeCompose
        ? "Make sure you have Docker and Docker Compose installed on your system. You can use the following commands to install both:"
        : "Make sure you have Docker installed on your system. You can use the following commands to install it:";

    return (
        <div>
            <h3 className="text-xl font-bold mb-4">{title || defaultTitle}</h3>
            <p>{description || defaultDescription}</p>

            <Tabs items={Object.keys(instructions)}>
                {Object.keys(instructions).map((os) => (
                    <Tab
                        key={os}
                        value={os as OS}
                    >
                        <DynamicCodeBlock lang="bash" code={instructions[os]} />
                    </Tab>
                ))}
            </Tabs>
        </div>
    );
}; 