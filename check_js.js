const https = require('https');

https.get('https://www.blacketvalues.com/blooks', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const matches = data.match(/<script[^>]*src="([^"]+)"/g);
        console.log(matches);
    });
}).on("error", (err) => console.error(err));
