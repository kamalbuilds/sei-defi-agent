// WebSocket Server Implementation
import { WebSocketServer } from 'ws';
import { logger } from '../../utils/logger';

let wss: WebSocketServer | null = null;

export async function startWebSocketServer(port: number | string): Promise<void> {
  wss = new WebSocketServer({ port: Number(port) });
  
  wss.on('connection', (ws) => {
    logger.info('New WebSocket connection established');
    
    ws.on('message', (data) => {
      logger.debug('WebSocket message received:', data.toString());
    });
    
    ws.on('close', () => {
      logger.info('WebSocket connection closed');
    });
    
    // Send initial message
    ws.send(JSON.stringify({ 
      type: 'connected', 
      message: 'Welcome to NEXUS AI WebSocket'
    }));
  });
  
  logger.info(`🔌 WebSocket server running on port ${port}`);
}

export function broadcast(data: any): void {
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(data));
      }
    });
  }
}