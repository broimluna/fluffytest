import { townRoomData } from './town/room.js';
import { rollinRoomData } from './rollinplace/room.js';

export const roomList = [
  { name: 'town', data: townRoomData },
  { name: 'rollinplace', data: rollinRoomData }
];

// Ensure we inject name BEFORE constructing Room instances elsewhere
export function registerRooms(roomManager) {
  roomList.forEach(r => {
    r.data.name = r.name; // ensure Room can read its name
    roomManager.addRoom(r.name, r.data);
  });
}