// --- Blook Data ---
const BLOOK_DATA = {
    packs: {
        "Medieval": {
            price: 20,
            blooks: [
                { name: "Elf", rarity: "Uncommon", emoji: "🧝" },
                { name: "Witch", rarity: "Uncommon", emoji: "🧙‍♀️" },
                { name: "Knight", rarity: "Rare", emoji: "🛡️" },
                { name: "Jester", rarity: "Rare", emoji: "🤡" },
                { name: "Dragon", rarity: "Epic", emoji: "🐉" },
                { name: "Queen", rarity: "Legendary", emoji: "👸" },
                { name: "King", rarity: "Legendary", emoji: "🤴" }
            ]
        },
        "Space": {
            price: 20,
            blooks: [
                { name: "Earth", rarity: "Uncommon", emoji: "🌎" },
                { name: "Meteor", rarity: "Uncommon", emoji: "☄️" },
                { name: "Stars", rarity: "Uncommon", emoji: "✨" },
                { name: "Alien", rarity: "Rare", emoji: "👽" },
                { name: "UFO", rarity: "Epic", emoji: "🛸" },
                { name: "Astronaut", rarity: "Legendary", emoji: "🧑‍🚀" },
                { name: "Megabot", rarity: "Chroma", emoji: "🤖" }
            ]
        },
        "Wonderland": {
            price: 25,
            blooks: [
                { name: "Alice", rarity: "Uncommon", emoji: "👧" },
                { name: "White Rabbit", rarity: "Uncommon", emoji: "🐇" },
                { name: "Mad Hatter", rarity: "Rare", emoji: "🎩" },
                { name: "Cheshire Cat", rarity: "Epic", emoji: "🐱" },
                { name: "Queen of Hearts", rarity: "Legendary", emoji: "👑" }
            ]
        },
        "Breakfast": {
            price: 15,
            blooks: [
                { name: "Toast", rarity: "Uncommon", emoji: "🍞" },
                { name: "Cereal", rarity: "Uncommon", emoji: "🥣" },
                { name: "Yogurt", rarity: "Uncommon", emoji: "🍦" },
                { name: "Breakfast Combo", rarity: "Rare", emoji: "🍳" },
                { name: "Orange Juice", rarity: "Epic", emoji: "🍹" },
                { name: "Waffle", rarity: "Legendary", emoji: "🧇" }
            ]
        }
    },
    rarities: {
        "Uncommon": { color: "#4bc22e", chance: 0.8 },
        "Rare": { color: "#0a93ff", chance: 0.15 },
        "Epic": { color: "#be00ff", chance: 0.04 },
        "Legendary": { color: "#ff9100", chance: 0.009 },
        "Chroma": { color: "#00ffff", chance: 0.001 },
        "Mystical": { color: "#ff0000", chance: 0.0001 }
    }
};

// --- State Management ---
let state = {
    coins: 99999999999,
    inventory: {} // { blookName: count }
};

// Load from LocalStorage
const savedState = localStorage.getItem('blooket_clone_state');
if (savedState) {
    const parsed = JSON.parse(savedState);
    state.coins = parsed.coins;
    state.inventory = parsed.inventory || {};
}

function saveState() {
    localStorage.setItem('blooket_clone_state', JSON.stringify(state));
}

// --- DOM Elements ---
const coinDisplay = document.getElementById('coin-balance');
const marketGrid = document.getElementById('packs-grid');
const inventoryGrid = document.getElementById('inventory-grid');
const marketView = document.getElementById('market-view');
const blooksView = document.getElementById('blooks-view');
const navMarket = document.getElementById('nav-market');
const navBlooks = document.getElementById('nav-blooks');

const modalOverlay = document.getElementById('modal-overlay');
const packShaking = document.getElementById('pack-image-shaking');
const blookReveal = document.getElementById('blook-reveal');
const revealEmoji = document.getElementById('reveal-emoji');
const revealName = document.getElementById('reveal-name');
const revealRarity = document.getElementById('reveal-rarity');
const closeModalBtn = document.getElementById('close-modal');

// --- Initialization ---
function init() {
    updateCoinDisplay();
    renderMarket();
    renderInventory();
    setupNavigation();
}

function updateCoinDisplay() {
    coinDisplay.textContent = state.coins.toLocaleString();
}

function setupNavigation() {
    navMarket.addEventListener('click', () => {
        marketView.classList.remove('hidden');
        blooksView.classList.add('hidden');
        navMarket.classList.add('active');
        navBlooks.classList.remove('active');
    });

    navBlooks.addEventListener('click', () => {
        marketView.classList.add('hidden');
        blooksView.classList.remove('hidden');
        navMarket.classList.remove('active');
        navBlooks.classList.add('active');
        renderInventory();
    });
}

// --- Market Logic ---
function renderMarket() {
    marketGrid.innerHTML = '';
    Object.entries(BLOOK_DATA.packs).forEach(([name, pack]) => {
        const card = document.createElement('div');
        card.className = 'pack-card';
        card.innerHTML = `
            <div class="pack-image">📦</div>
            <div class="pack-name">${name} Pack</div>
            <div class="pack-price">🪙 ${pack.price}</div>
        `;
        card.onclick = () => buyPack(name);
        marketGrid.appendChild(card);
    });
}

function buyPack(packName) {
    const pack = BLOOK_DATA.packs[packName];
    if (state.coins >= pack.price) {
        state.coins -= pack.price;
        updateCoinDisplay();
        openPack(packName);
    } else {
        alert("Not enough coins!");
    }
}

// --- Pack Opening Logic ---
function openPack(packName) {
    const pack = BLOOK_DATA.packs[packName];
    const blook = getRandomBlook(pack.blooks);
    
    // Show Modal
    modalOverlay.classList.remove('hidden');
    packShaking.classList.remove('hidden');
    blookReveal.classList.add('hidden');
    closeModalBtn.classList.add('hidden');

    // Simulate animation delay
    setTimeout(() => {
        packShaking.classList.add('hidden');
        blookReveal.classList.remove('hidden');
        blookReveal.classList.add('reveal-anim');
        
        // Update reveal content
        revealEmoji.textContent = blook.emoji;
        revealName.textContent = blook.name;
        revealRarity.textContent = blook.rarity;
        
        const rarityInfo = BLOOK_DATA.rarities[blook.rarity];
        const color = rarityInfo ? rarityInfo.color : '#fff';
        document.querySelector('#blook-reveal .blook-card').style.borderColor = color;
        revealRarity.style.color = color;

        // Update inventory
        state.inventory[blook.name] = (state.inventory[blook.name] || 0) + 1;
        saveState();
        
        closeModalBtn.classList.remove('hidden');
    }, 1500);
}

function getRandomBlook(packBlooks) {
    // Simplified approach: Pick a blook from the pack based on weighted rarity
    const weights = packBlooks.map(b => BLOOK_DATA.rarities[b.rarity]?.chance || 0.1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < packBlooks.length; i++) {
        random -= weights[i];
        if (random <= 0) return packBlooks[i];
    }
    return packBlooks[0];
}

closeModalBtn.onclick = () => {
    modalOverlay.classList.add('hidden');
};

// --- Inventory Logic ---
function renderInventory() {
    inventoryGrid.innerHTML = '';
    
    // Sort all possible blooks by rarity
    const allBlooks = [];
    Object.values(BLOOK_DATA.packs).forEach(p => {
        p.blooks.forEach(b => {
            if (!allBlooks.find(x => x.name === b.name)) allBlooks.push(b);
        });
    });

    allBlooks.sort((a, b) => {
        const rarityOrder = ["Uncommon", "Rare", "Epic", "Legendary", "Chroma", "Mystical"];
        const orderA = rarityOrder.indexOf(a.rarity);
        const orderB = rarityOrder.indexOf(b.rarity);
        return orderA - orderB;
    });

    allBlooks.forEach(blook => {
        const count = state.inventory[blook.name] || 0;
        const card = document.createElement('div');
        card.className = `blook-card ${count === 0 ? 'locked' : ''}`;
        
        const rarityColor = BLOOK_DATA.rarities[blook.rarity].color;
        card.style.borderColor = count > 0 ? rarityColor : '#334155';
        card.style.opacity = count > 0 ? '1' : '0.4';

        card.innerHTML = `
            ${count > 1 ? `<div class="blook-count">x${count}</div>` : ''}
            <div class="blook-emoji">${blook.emoji}</div>
            <div class="blook-name">${blook.name}</div>
            <div class="blook-rarity" style="color: ${rarityColor}">${blook.rarity}</div>
        `;
        inventoryGrid.appendChild(card);
    });
}

init();
