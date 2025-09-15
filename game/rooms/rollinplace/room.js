import { rollinTileData } from './tilemap.js';

export const rollinRoomData = {
    backgroundMusic: 'room2Music',
    backgroundKey: 'room2Background',
    tileData: rollinTileData,
    wallIndex: 1,
    portalIndex: 2,
    spawnIndexMap: {
        3: 'default',
        4: 'fromTown',
        5: 'upper',
        6: 'lower',
        7: 'leftSide',
        8: 'rightSide'
    },
    // defaultSpawnKey was 'default' but tile value 3 not present in rollinTileData.
    // Use an actually present spawn value:
    defaultSpawnKey: 'fromTown',
    arrivalMap: {
        town: 'fromTown'
    },
    portalTarget: 'town'
};