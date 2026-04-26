const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    console.log("Starting browser...");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    console.log("Navigating to Blacket Values...");
    await page.goto('https://www.blacketvalues.com/blooks', { waitUntil: 'networkidle2' });

    console.log("Waiting for values to load...");
    // page.waitForTimeout is deprecated/removed in newer puppeteer, use a manual delay
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log("Extracting values...");
    const values = await page.evaluate(() => {
        let result = {};
        const cards = document.querySelectorAll('.blook-card');
        for (let card of cards) {
            try {
                let name = card.querySelector('.blook-name').innerText.trim();
                let spans = Array.from(card.querySelectorAll('span'));
                let valStr = '';
                
                // Find the span that says "Value:" and get the one after it
                const valueLabelIndex = spans.findIndex(s => s.innerText.includes('Value:'));
                if (valueLabelIndex !== -1 && spans[valueLabelIndex + 1]) {
                    valStr = spans[valueLabelIndex + 1].innerText.trim();
                }
                
                if (valStr && valStr !== '—') {
                    // Clean value string (e.g. "1.5K", "2M")
                    let cleanVal = valStr.toUpperCase().replace(/,/g, '');
                    let num = parseFloat(cleanVal);
                    if (cleanVal.includes('K')) num *= 1000;
                    if (cleanVal.includes('M')) num *= 1000000;
                    if (cleanVal.includes('B')) num *= 1000000000;
                    result[name] = num;
                }
            } catch(e) {
                // skip
            }
        }
        return result;
    });

    console.log(`Extracted ${Object.keys(values).length} values.`);
    fs.writeFileSync('market_values.json', JSON.stringify(values, null, 4));
    console.log("Saved to market_values.json");

    await browser.close();
})();
