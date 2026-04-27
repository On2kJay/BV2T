import type { Party, Room } from "partykit/server";

export default class Server implements Room {
  constructor(readonly room: Party) {}

  onConnect(conn: WebSocket) {
    conn.send(JSON.stringify({ type: "connected" }));
  }

  onMessage(message: string, sender: WebSocket, room: Room) {
    const msg = JSON.parse(message);
    
    if (msg.type === "saveUser") {
      const key = `user_${msg.name?.toLowerCase()}`;
      room.storage.put(key, msg).then(() => {
        sender.send(JSON.stringify({ type: "ok" }));
      });
    }
    else if (msg.type === "getUser") {
      room.storage.get(`user_${msg.name?.toLowerCase()}`).then(data => {
        sender.send(JSON.stringify({ type: "userData", data }));
      });
    }
    else if (msg.type === "chat") {
      room.storage.list("chat_").then(list => {
        const chatKey = `chat_${Date.now()}`;
        room.storage.put(chatKey, { from: msg.from, body: msg.body, ts: Date.now() }).then(() => {
          room.storage.list("chat_").then(all => {
            const chat = Object.values(all).sort((a: any, b: any) => b.ts - a.ts).slice(-800);
            room.broadcast(JSON.stringify({ type: "sync", data: { chat } }));
          });
        });
      });
    }
    else if (msg.type === "getChat") {
      room.storage.list("chat_").then(all => {
        const chat = Object.values(all).sort((a: any, b: any) => b.ts - a.ts).slice(-800);
        sender.send(JSON.stringify({ type: "chat", data: chat }));
      });
    }
  }
}

export const onConnect = (conn: WebSocket, room: Room) => new Server(room as any).onConnect(conn);
export const onMessage = (message: string, sender: WebSocket, room: Room) => new Server(room as any).onMessage(message, sender, room);