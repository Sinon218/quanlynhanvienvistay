// ===================================================================
// SERVER-SENT EVENTS (SSE) MODULE - server/sse.js
// Cấu trúc 3 tầng: App Layer (Real-time Communication)
// ===================================================================
let clients = [];
const MAX_CLIENTS = 100; // Giới hạn số client SSE để tránh memory leak

function sseMiddleware(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx support
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };

  // Giới hạn số client
  if (clients.length >= MAX_CLIENTS) {
    // Đóng client cũ nhất
    const oldest = clients.shift();
    try {
      if (oldest && oldest.res && !oldest.res.destroyed) {
        oldest.res.end();
      }
    } catch (e) {}
  }

  clients.push(newClient);
  console.log(`📡 SSE Client connected: ${clientId}. Total: ${clients.length}`);

  // Send initial connection confirmation
  try {
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId })}\n\n`);
  } catch (e) {}

  // Keep-alive every 20 seconds
  const keepAliveInterval = setInterval(() => {
    try {
      if (!res.destroyed && res.writable) {
        res.write(': keep-alive\n\n');
      } else {
        clearInterval(keepAliveInterval);
      }
    } catch (e) {
      clearInterval(keepAliveInterval);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    clients = clients.filter(client => client.id !== clientId);
    console.log(`📡 SSE Client disconnected: ${clientId}. Total: ${clients.length}`);
  });
}

function sendEventToAll(data) {
  if (clients.length === 0) return;
  
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  const deadClients = [];

  clients.forEach(client => {
    try {
      if (!client.res.destroyed && client.res.writable) {
        client.res.write(payload);
      } else {
        deadClients.push(client.id);
      }
    } catch (err) {
      deadClients.push(client.id);
    }
  });

  // Cleanup dead clients
  if (deadClients.length > 0) {
    clients = clients.filter(c => !deadClients.includes(c.id));
  }
}

function getClientCount() {
  return clients.length;
}

module.exports = { sseMiddleware, sendEventToAll, getClientCount };
