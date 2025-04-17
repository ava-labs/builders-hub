import https from 'https';
import fs from 'fs';
import path from 'path';

function readVersionsFile() {
    const versionsPath = path.join('src', 'versions.json');
    const content = fs.readFileSync(versionsPath, 'utf8');
    return JSON.parse(content);
}

function fetchTags(repoName) {
    return new Promise((resolve, reject) => {
        const request = https.get(`https://hub.docker.com/v2/repositories/${repoName}/tags?page_size=1000`, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    const results = parsedData.results;

                    // Find semantic version tags like v0.7.1
                    const semanticTags = results
                        .map(tag => tag.name)
                        .filter(name => /^v\d+\.\d+\.\d+/.test(name))
                        .filter(name => !name.includes("-rc."));

                    if (semanticTags.length > 0) {
                        resolve(semanticTags[0]);
                    } else {
                        reject(new Error('No semantic version tags found'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        request.setTimeout(3000, () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });

        request.on('error', reject);
    });
}

async function main() {
    try {
        // Check for subnet-evm updates
        const latestSubnetEvmTag = await fetchTags('avaplatform/subnet-evm');
        const versions = readVersionsFile();
        const currentSubnetEvmVersion = versions['avaplatform/subnet-evm'];

        if (latestSubnetEvmTag !== currentSubnetEvmVersion) {
            versions['avaplatform/subnet-evm'] = latestSubnetEvmTag;
            fs.writeFileSync('src/versions.json', JSON.stringify(versions, null, 2));

            console.error(`New version ${latestSubnetEvmTag} is available for subnet-evm. Current version is ${currentSubnetEvmVersion}`);
        }

        // Check for icm-relayer updates
        const latestRelayerTag = await fetchTags('avaplatform/icm-relayer');
        const currentRelayerVersion = versions['avaplatform/icm-relayer'] || '';

        if (latestRelayerTag !== currentRelayerVersion) {
            versions['avaplatform/icm-relayer'] = latestRelayerTag;
            fs.writeFileSync('src/versions.json', JSON.stringify(versions, null, 2));

            console.error(`New version ${latestRelayerTag} is available for icm-relayer. Current version is ${currentRelayerVersion}`);
        }

        if (latestSubnetEvmTag !== currentSubnetEvmVersion || latestRelayerTag !== currentRelayerVersion) {
            console.error('Please run `node toolbox/update_docker_tags.js` and commit the changes');
            // process.exit(1);
        }
    } catch (error) {
        console.warn('Warning:', error.message);
        process.exit(0);
    }
}

main();
