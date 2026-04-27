import type { Room } from "partykit/server";

interface ChatMessage {
  from: string;
  body: string;
  ts: number;
}

interface GameState {
  users: Record<string, object>;
  clans: Record<string, object>;
  market: unknown[];
  posts: unknown[];
  news: unknown[];
  chat: ChatMessage[];
  bannedUsers: string[];
  adminUsers: string[];
  globalLuckBoost: unknown | null;
  onlinePresence: Record<string, string>;
  lastUpdate: number;
}

const DEFAULT_STATE: GameState = {
  users: {},
  clans: {},
  market: [],
  posts: [],
  news: [],
  chat: [],
  bannedUsers: [],
  adminUsers: [],
  globalLuckBoost: null,
  onlinePresence: {},
  lastUpdate: Date.now()
};

export default class Server {
  state: GameState = JSON.parse(JSON.stringify(DEFAULT_STATE));

  constructor(readonly room: Room) {}

  onConnect(conn: WebSocket, ctx: { request: Request }) {
    conn.send(JSON.stringify({ type: "sync", data: this.state }));
  }

  onMessage(message: string, sender: WebSocket) {
    try {
      const msg = JSON.parse(message);
      
      if (msg.type === "update" && msg.key && msg.value !== undefined) {
        (this.state as Record<string, unknown>)[msg.key] = msg.value;
        this.state.lastUpdate = Date.now();
        this.room.broadcast(JSON.stringify({ type: "sync", data: this.state }));
      } 
      else if (msg.type === "chat") {
        const { from, body } = msg;
        if (!from || !body) return;
        this.state.chat.push({ from, body, ts: Date.now() });
        if (this.state.chat.length > 800) this.state.chat = this.state.chat.slice(-800);
        this.state.lastUpdate = Date.now();
        this.room.broadcast(JSON.stringify({ type: "sync", data: this.state }));
      }
      else if (msg.type === "fullSync") {
        this.state = { ...DEFAULT_STATE, ...(msg.data || {}), lastUpdate: Date.now() };
        this.room.broadcast(JSON.stringify({ type: "sync", data: this.state }));
      }
    } catch (e) {
      console.error("Failed to parse message:", e);
    }
  }
}

export const onConnect = (conn: WebSocket, room: Room) => new Server(room).onConnect(conn, { request: new Request("") });
export const onMessage = (message: string, sender: WebSocket, room: Room) => new Server(room).onMessage(message, sender);