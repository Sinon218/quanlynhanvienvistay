// ===================================================================
// SERVER-SENT EVENTS (SSE) MODULE - server/sse.js
// ===================================================================
let clients = [];

function sseMiddleware(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = {
    id: clientId,
    res
  };
  clients.push(newClient);

  console.log(`📡 New SSE Client connected: ${clientId}. Current total: ${clients.length}`);

  // Send a keep-alive comment every 20 seconds to prevent connections from dropping
  const keepAliveInterval = setInterval(() => {
    try {
      if (!res.destroyed && res.writable) {
        res.write(': keep-alive\n\n');
      }
    } catch (e) {
      console.error('SSE keepAlive error:', e.message);
      clearInterval(keepAliveInterval);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    clients = clients.filter(client => client.id !== clientId);
    console.log(`📡 SSE Client disconnected: ${clientId}. Current total: ${clients.length}`);
  });
}

function sendEventToAll(data) {
  console.log(`📢 Broadcasting SSE event:`, data);
  clients.forEach(client => {
    try {
      if (!client.res.destroyed && client.res.writable) {
        client.res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    } catch (err) {
      console.error(`❌ Failed to write to SSE client ${client.id}:`, err.message);
    }
  });
}

module.exports = { sseMiddleware, sendEventToAll };
