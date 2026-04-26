const fs = require('fs');
const https = require('https');

function fetchHTML(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function scrapePacks() {
    console.log("Fetching home page...");
    const homeHtml = await fetchHTML('https://www.blacketvalues.com/');
    
    // Find packs and their images
    // <a href="/pack/Garden" ...>
    //   <img class="pack-image" src="/static/images/Garden old.png" ...>
    
    const packRegex = /<a href="\/pack\/([^"]+)"[\s\S]*?<img[^>]*class="pack-image"[^>]*src="([^"]+)"/g;
    let match;
    const packImages = {};
    while ((match = packRegex.exec(homeHtml)) !== null) {
        const packName = decodeURIComponent(match[1]);
        const imgSrc = 'https://www.blacketvalues.com' + match[2];
        packImages[packName] = imgSrc;
    }
    
    console.log(`Found ${Object.keys(packImages).length} pack images.`);
    
    // Now update index.html
    let indexHtml = fs.readFileSync('index.html', 'utf8');
    const packIconsMatch = indexHtml.match(/const PACK_ICONS = \{/);
    
    if (packIconsMatch) {
        const startIndex = indexHtml.indexOf('{', packIconsMatch.index) + 1;
        let braceCount = 1;
        let endIndex = startIndex;
        while (braceCount > 0 && endIndex < indexHtml.length) {
            if (indexHtml[endIndex] === '{') braceCount++;
            else if (indexHtml[endIndex] === '}') braceCount--;
            endIndex++;
        }
        
        let existingIconsStr = indexHtml.substring(startIndex, endIndex - 1);
        
        // We need to inject the `img: '...'` property into existing entries.
        for (const [packName, imgSrc] of Object.entries(packImages)) {
            // Find `"PackName": { grad: ..., icon: ... }`
            const regex = new RegExp(`"${packName}"\\s*:\\s*\\{([^}]+)\\}`, 'g');
            existingIconsStr = existingIconsStr.replace(regex, (match, inner) => {
                // If it already has img, skip
                if (inner.includes('img:')) return match;
                return `"${packName}": {${inner}, img: '${imgSrc}' }`;
            });
        }
        
        indexHtml = indexHtml.slice(0, startIndex) + existingIconsStr + indexHtml.slice(endIndex - 1);
    }
    
    // Also update the render function
    const renderRegex = /<span class="pack-icon-emoji">\$\{icon\.icon\}<\/span>/g;
    if (renderRegex.test(indexHtml)) {
        indexHtml = indexHtml.replace(
            /<span class="pack-icon-emoji">\$\{icon\.icon\}<\/span>/g,
            `\${icon.img ? \`<img src="\${icon.img}" style="width:100%;height:100%;object-fit:contain; border-radius: 8px;">\` : \`<span class="pack-icon-emoji">\${icon.icon}</span>\`}`
        );
        console.log("Updated render code.");
    }
    
    fs.writeFileSync('index.html', indexHtml);
    console.log("Done updating index.html!");
}

scrapePacks().catch(console.error);
