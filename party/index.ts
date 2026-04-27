import type { Room } from "partykit/server";

export default class Server {
  onConnect(conn: WebSocket) {
    conn.send(JSON.stringify({ type: "connected" }));
  }
  onMessage(message: string, sender: WebSocket, room: Room) {
    const msg = JSON.parse(message);
    if (msg.type === "chat") {
      room.storage.put("chat_" + Date.now(), { from: msg.from, body: msg.body, ts: Date.now() }).then(() => {
        room.broadcast(JSON.stringify({ type: "sync" }));
      });
    }
  }
}

export const onConnect = (conn: WebSocket, room: Room) => new Server().onConnect(conn);
export const onMessage = (message: string, sender: WebSocket, room: Room) => new Server().onMessage(message, sender, room);