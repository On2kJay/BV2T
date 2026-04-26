const fs = require('fs');

let indexHtml = fs.readFileSync('index.html', 'utf8');

indexHtml = indexHtml.replace(/https:\/\/www\.blacketvalues\.comhttps:\/\/blacket\.org/g, 'https://blacket.org');

fs.writeFileSync('index.html', indexHtml);
console.log("Fixed URLs in index.html");
