const https = require('https');

https.get('https://www.blacketvalues.com/blooks', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        // Find any blook that does NOT have "—" for value or demand
        const matches = data.match(/<article class="blook-card"[^>]*>[\s\S]*?<\/article>/g);
        let foundAny = false;
        if (matches) {
            matches.forEach(m => {
                const valueMatch = m.match(/<span>Value:<\/span>\s*<span>([^<]+)<\/span>/);
                const demandMatch = m.match(/<span>Demand:<\/span>\s*<span>([^<]+)<\/span>/);
                const nameMatch = m.match(/<div class="blook-name">([^<]+)<\/div>/);
                
                if (valueMatch && demandMatch && nameMatch) {
                    const value = valueMatch[1].trim();
                    const demand = demandMatch[1].trim();
                    if (value !== '—' || demand !== '—') {
                        console.log(`${nameMatch[1].trim()} - Value: ${value}, Demand: ${demand}`);
                        foundAny = true;
                    }
                }
            });
        }
        if (!foundAny) console.log("NO BLOOKS HAVE VALUES OR DEMANDS SET.");
    });
}).on("error", (err) => console.error(err));
