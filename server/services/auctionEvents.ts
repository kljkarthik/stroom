import { Response } from 'express';

// In-Memory Real-Time SSE Connection Registry per Auction Room
const roomClients: Map<string, Set<Response>> = new Map();

/**
 * Register a client's SSE response stream to an auction room
 */
export function addAuctionStreamClient(auctionId: string, res: Response): void {
  if (!roomClients.has(auctionId)) {
    roomClients.set(auctionId, new Set());
  }
  roomClients.get(auctionId)!.add(res);
}

/**
 * Unregister a client's SSE response stream
 */
export function removeAuctionStreamClient(auctionId: string, res: Response): void {
  const clients = roomClients.get(auctionId);
  if (clients) {
    clients.delete(res);
    if (clients.size === 0) {
      roomClients.delete(auctionId);
    }
  }
}

/**
 * Broadcast an event payload to all clients connected to an auction room
 */
export function broadcastAuctionEvent(auctionId: string, event: { type: string; [key: string]: any }): void {
  const clients = roomClients.get(auctionId);
  if (!clients || clients.size === 0) return;

  const dataString = `data: ${JSON.stringify({ ...event, timestamp: new Date().toISOString() })}\n\n`;

  for (const client of clients) {
    try {
      client.write(dataString);
    } catch (err) {
      // Client abruptly disconnected
      clients.delete(client);
    }
  }
}

/**
 * Return total active live stream listeners for an auction room
 */
export function getActiveListenersCount(auctionId: string): number {
  return roomClients.get(auctionId)?.size || 0;
}
