const fs = require('fs');

const blackPacks = JSON.parse(fs.readFileSync('black_packs.json', 'utf8'));
let indexHtml = fs.readFileSync('index.html', 'utf8');

// Update DB.packs
// Find the DB object and its packs property
// DB = { packs: { ... } }
const dbMatch = indexHtml.match(/const DB = \{[\s\n]*packs: \{/);
if (dbMatch) {
    const startIndex = indexHtml.indexOf('packs: {', dbMatch.index) + 8;
    // We need to find the matching closing brace for the packs object
    let braceCount = 1;
    let endIndex = startIndex;
    while (braceCount > 0 && endIndex < indexHtml.length) {
        if (indexHtml[endIndex] === '{') braceCount++;
        else if (indexHtml[endIndex] === '}') braceCount--;
        endIndex++;
    }
    
    // indexHtml.substring(startIndex, endIndex - 1) is the content of the packs object
    // We will replace it with our new JSON, but we want to merge it with existing if possible
    // Actually, the user said "add every pack", so I'll just REPLACE it to avoid duplicates and bloat.
    // Or better, MERGE them.
    
    // Let's just create a string for the new packs object
    const newPacksStr = JSON.stringify(blackPacks, null, 4).slice(1, -1); // remove outer braces
    indexHtml = indexHtml.slice(0, startIndex) + newPacksStr + indexHtml.slice(endIndex - 1);
}

// Update PACK_ICONS
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
    
    const existingIconsStr = indexHtml.substring(startIndex, endIndex - 1);
    // Parse existing icons if possible (this is hard because it's JS, not JSON)
    // I'll just append new ones that don't exist
    
    let newIconsStr = existingIconsStr.trim();
    if (newIconsStr.endsWith(',')) newIconsStr = newIconsStr.slice(0, -1);
    
    const existingPacks = existingIconsStr.match(/"[^"]+"/g) || [];
    const packNames = Object.keys(blackPacks);
    
    const icons = ['📦', '🎁', '💎', '🔥', '🌟', '🍀', '🎃', '👻', '🌌', '🌑', '🍔', '🍦', '🎮', '🦕', '🤖', '🦋', '🍭', '🍎', '🪄', '🎵', '🕹️', '🪐', '🍂', '⚔️', '🏴‍☠️', '🦁', '🛸', '🏀', '🏖️', '🐸', '🍰', '🐨', '🧪', '❄️', '👑', '🥞', '🔥', '🕰️', '🏜️', '🎨', '🐣', '🎡', '🎪', '🧸', '🌈', '🌴', '🧩'];
    const grads = [
        ['#4f46e5', '#312e81'], ['#10b981', '#064e3b'], ['#f59e0b', '#78350f'], ['#ef4444', '#7f1d1d'],
        ['#8b5cf6', '#4c1d95'], ['#ec4899', '#831843'], ['#06b6d4', '#164e63'], ['#f97316', '#7c2d12'],
        ['#6366f1', '#3730a3'], ['#14b8a6', '#134e4a'], ['#facc15', '#713f12'], ['#f43f5e', '#881337']
    ];
    
    packNames.forEach((name, i) => {
        if (!existingIconsStr.includes(`"${name}"`)) {
            const icon = icons[i % icons.length];
            const grad = grads[i % grads.length];
            newIconsStr += `,\n            "${name}": { grad: ['${grad[0]}','${grad[1]}'], icon: '${icon}' }`;
        }
    });
    
    indexHtml = indexHtml.slice(0, startIndex) + "\n            " + newIconsStr + "\n        " + indexHtml.slice(endIndex - 1);
}

fs.writeFileSync('index.html', indexHtml);
console.log("Updated index.html with all Blacket packs and icons.");
