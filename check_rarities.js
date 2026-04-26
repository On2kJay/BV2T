const https = require('https');

https.get('https://www.blacketvalues.com/blooks', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const rarities = new Set();
        const matches = data.match(/<div class="blook-rarity\s*">([\s\S]*?)<\/div>/g);
        if (matches) {
            matches.forEach(m => {
                const r = m.replace(/<[^>]+>/g, '').trim();
                if (r) rarities.add(r);
            });
        }
        console.log("Rarities found on site:", Array.from(rarities));
    });
}).on("error", (err) => console.error(err));
