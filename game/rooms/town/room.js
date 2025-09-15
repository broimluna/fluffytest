import { townTileData } from './tilemap.js';

export const townRoomData = {
    backgroundMusic: 'town1Music',
    backgroundKey: 'townBackground',
    tileData: townTileData,
    wallIndex: 1,
    portalIndex: "p",

    // MULTI SPAWN:
    // Tile values in the tilemap representing different spawn connectors.
    // Add these numeric values into townTileData where you want those spawn points.
    spawnIndexMap: {
        3: 'default',
        4: 'fromRollin',     // spawn when arriving from rollinplace
        5: 'northGate',
        6: 'southGate',
        7: 'eastGate',
        8: 'secret'
    },
    defaultSpawnKey: 'default',

    // When arriving FROM <roomName>, use spawnKey
    arrivalMap: {
        rollinplace: 'fromRollin'
        // add more mappings if more rooms later
    },

    portalTarget: 'rollinplace'
};