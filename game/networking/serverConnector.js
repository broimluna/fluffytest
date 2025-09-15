// REWORK: proper singleton accessor + always return same socket.
let socketInstance = null;

export class ServerConnector {
    constructor({ initialName } = {}) {
        if (socketInstance) {
            this.socket = socketInstance;
            return;
        }
        this.socket = io('https://testing12-2t2h.onrender.com', {
            transports: ['websocket', 'polling'],
            autoConnect: true,
            query: initialName ? { name: initialName } : {}
        });
        socketInstance = this.socket;

        this.socket.on('connect', () => {
            const ioMeta = this.socket.io;
            const urlTarget = ioMeta?.uri ||
                `${ioMeta?.opts?.secure ? 'https' : 'http'}://${ioMeta?.opts?.hostname || 'localhost'}:${ioMeta?.opts?.port || 3000}`;
            console.log(`[ServerConnector] connected to server ${urlTarget} with id ${this.socket.id}`);
        });
        this.socket.on('reconnect_attempt', (n) => {
            console.log('[ServerConnector] reconnect_attempt', n);
        });
        this.socket.on('reconnect', (n) => {
            console.log('[ServerConnector] reconnected', n, 'id=', this.socket.id);
        });
        this.socket.on('disconnect', (reason) => {
            console.log('[ServerConnector] disconnected', reason);
        });
        this.socket.on('connect_error', (err) => {
            console.error('[ServerConnector] connect_error', err.message);
        });
    }

    static getInstance(opts) {
        if (!socketInstance) new ServerConnector(opts);
        return socketInstance;
    }
}

export function getServerSocket() {
    return ServerConnector.getInstance();
}

export function ensureServerConnector(opts) {
    return ServerConnector.getInstance(opts);
}