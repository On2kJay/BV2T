const https = require('https');

https.get('https://www.blacketvalues.com/blooks', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const matches = data.match(/<article class="blook-card"[^>]*data-blook-name="Rainbow Astronaut"[^>]*>[\s\S]*?<\/article>/g);
        console.log(matches ? matches[0] : 'Not found');
    });
}).on("error", (err) => console.error(err));
