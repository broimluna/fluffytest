
export function loadTextures(scene) {
    // Load textures here, e.g., scene.load.image('player', 'assets/player.png');
    // For now, it's a placeholder
    scene.load.image('eyes', 'game/player/assets/eyes.png'); 
    scene.load.audio('town1Music', './game/rooms/town/music.ogg'); // Adjust path as needed
    scene.load.image('townBackground', './game/rooms/town/bg.png'); // Adjust path as needed
    scene.load.audio('room2Music', './game/rooms/rollinplace/music.ogg'); // Adjust path as needed
    scene.load.image('room2Background', './game/rooms/rollinplace/bg.png'); // Adjust path as needed


}