const https = require('https');

https.get('https://www.blacketvalues.com/blooks', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const matches = data.match(/<article class="blook-card"[^>]*>.*?<\/article>/gs);
        if (matches && matches.length > 0) {
            console.log("Found " + matches.length + " blooks on the page.");
            console.log("Sample of first blook:");
            console.log(matches[0]);
        } else {
            console.log("Could not parse blooks. Raw HTML (first 2000 chars):");
            console.log(data.substring(0, 2000));
        }
    });
}).on("error", (err) => console.error(err));
