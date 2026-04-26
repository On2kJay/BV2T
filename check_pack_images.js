const https = require('https');

https.get('https://www.blacketvalues.com/', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const matches = data.match(/<a href="\/pack\/[^"]+"[^>]*>[\s\S]*?<\/a>/g);
        if (matches) {
            console.log("Found " + matches.length + " packs.");
            console.log(matches[0]);
        }
    });
}).on("error", (err) => console.error(err));
