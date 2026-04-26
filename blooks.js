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

export default BLOOK_DATA;
