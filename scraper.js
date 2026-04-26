const https = require('https');
const fs = require('fs');

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
    
    // Find packs
    const packRegex = /<a href="\/pack\/([^"]+)"/g;
    let match;
    const packs = [];
    while ((match = packRegex.exec(homeHtml)) !== null) {
        const packName = decodeURIComponent(match[1]);
        if (!packs.includes(packName)) {
            packs.push(packName);
        }
    }
    
    console.log("Found " + packs.length + " packs.");
    
    const dbPacks = {};
    
    for (const pack of packs) {
        console.log("Fetching " + pack + "...");
        const packHtml = await fetchHTML(`https://www.blacketvalues.com/pack/${encodeURIComponent(pack)}`);
        
        const blooks = [];
        let packPrice = 25;
        const priceMatch = packHtml.match(/<div class="pack-price">(\d+) tokens<\/div>/);
        if (priceMatch) packPrice = parseInt(priceMatch[1]);

        const blookRegex = /<article class="blook-card"[^>]*data-blook-name="([^"]+)"[^>]*>.*?<img class="blook-image"[^>]*src="([^"]+)"[^>]*>.*?<div class="blook-rarity[^>]*>\s*([^<\s][^<]*)\s*<\/div>.*?<span>Chance:<\/span>\s*<span>([^<]+)<\/span>/gs;
        
        let bMatch;
        while ((bMatch = blookRegex.exec(packHtml)) !== null) {
            const name = bMatch[1].trim();
            let img = bMatch[2].trim();
            if (!img.startsWith('http')) {
                img = 'https://www.blacketvalues.com' + img;
            }
            const rarity = bMatch[3].trim();
            let chanceStr = bMatch[4].trim();
            chanceStr = chanceStr.replace('%', '');
            const chance = parseFloat(chanceStr);
            
            blooks.push({
                n: name,
                r: rarity,
                m: img,
                c: chance
            });
        }
        
        dbPacks[pack] = {
            p: packPrice,
            b: blooks
        };
        console.log(`  Scraped ${blooks.length} blooks from ${pack}`);
    }
    
    fs.writeFileSync('black_packs.json', JSON.stringify(dbPacks, null, 2));
    console.log("Done! Saved to black_packs.json");
}

scrapePacks().catch(console.error);
