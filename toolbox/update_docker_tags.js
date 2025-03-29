import https from 'https';
import fs from 'fs';
import path from 'path';

function readVersionsFile() {
    const versionsPath = path.join('src', 'versions.json');
    const content = fs.readFileSync(versionsPath, 'utf8');
    return JSON.parse(content);
}

function fetchTags() {
    return new Promise((resolve, reject) => {
        const request = https.get('https://hub.docker.com/v2/repositories/avaplatform/subnet-evm/tags?page_size=1000', (res) => {
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
                        .filter(name => /^v\d+\.\d+\.\d+/.test(name));

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
        const latestTag = await fetchTags();
        const versions = readVersionsFile();
        const currentVersion = versions['avaplatform/subnet-evm'];

        if (latestTag !== currentVersion) {

            versions['avaplatform/subnet-evm'] = latestTag;
            fs.writeFileSync('src/versions.json', JSON.stringify(versions, null, 2));

            console.error(`New version ${latestTag} is available. Current version is ${currentVersion}`);
            console.error('Please run `node toolbox/update_docker_tags.js` and commit the changes');
            // process.exit(1);
        }
    } catch (error) {
        console.warn('Warning:', error.message);
        process.exit(0);
    }
}

main();
