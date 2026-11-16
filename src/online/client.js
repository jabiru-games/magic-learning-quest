// Address of the duel server, set at build time; online play stays hidden without it.
export const DUEL_SERVER = import.meta.env?.VITE_DUEL_SERVER ?? '';

// A thin JSON channel to the duel server. Every message carries its type in `t`.
export function connectDuels(url, { onOpen, onMessage, onClose }) {
  const socket = new WebSocket(url);
  let closed = false;
  socket.onopen = () => onOpen?.();
  socket.onmessage = (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message && typeof message.t === 'string') onMessage(message);
  };
  socket.onclose = () => {
    if (!closed) onClose?.();
  };
  return {
    send(message) {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    },
    close() {
      closed = true;
      socket.close();
    },
  };
}
