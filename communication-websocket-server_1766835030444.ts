/**
 * WEBSOCKET SERVER FOR VIDEO & MESSAGING
 * server/websocket/communication-server.ts
 * 
 * Handles:
 * - Video chat signaling (WebRTC)
 * - Real-time messaging
 * - Message delivery notifications
 * - Online status
 */

import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Pool } from 'pg';

interface Client {
  ws: WebSocket;
  userId: string;
  type: 'video' | 'messages';
}

export class CommunicationWebSocketServer {
  private videoClients = new Map<string, Client>();
  private messageClients = new Map<string, Client>();
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  public setupWebSocket(server: any) {
    // Video chat WebSocket
    const videoWSS = new WebSocketServer({ 
      server, 
      path: '/ws/video' 
    });

    videoWSS.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleVideoConnection(ws, req);
    });

    // Messaging WebSocket
    const messageWSS = new WebSocketServer({ 
      server, 
      path: '/ws/messages' 
    });

    messageWSS.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleMessageConnection(ws, req);
    });

    console.log('[WebSocket] Communication servers initialized');
  }

  // =========================================================================
  // VIDEO CHAT HANDLERS
  // =========================================================================

  private handleVideoConnection(ws: WebSocket, req: IncomingMessage) {
    console.log('[Video WS] New connection');

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleVideoMessage(ws, message);
      } catch (error) {
        console.error('[Video WS] Parse error:', error);
      }
    });

    ws.on('close', () => {
      this.handleVideoDisconnect(ws);
    });

    ws.on('error', (error) => {
      console.error('[Video WS] Error:', error);
    });
  }

  private handleVideoMessage(ws: WebSocket, message: any) {
    switch (message.type) {
      case 'join':
        // Register client
        this.videoClients.set(message.userId, {
          ws,
          userId: message.userId,
          type: 'video'
        });

        console.log(`[Video WS] User ${message.userId} joined session ${message.sessionId}`);

        // Notify other participants
        this.broadcastToSession(message.sessionId, message.userId, {
          type: 'user-joined',
          userId: message.userId,
          sessionId: message.sessionId
        });
        break;

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        // Forward signaling messages to target user
        const targetClient = this.videoClients.get(message.targetUserId);
        if (targetClient) {
          targetClient.ws.send(JSON.stringify({
            ...message,
            fromUserId: this.getUserIdByWs(ws)
          }));
        }
        break;
    }
  }

  private handleVideoDisconnect(ws: WebSocket) {
    const userId = this.getUserIdByWs(ws);
    if (userId) {
      this.videoClients.delete(userId);
      console.log(`[Video WS] User ${userId} disconnected`);
    }
  }

  private broadcastToSession(sessionId: string, excludeUserId: string, message: any) {
    this.videoClients.forEach((client) => {
      if (client.userId !== excludeUserId) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  // =========================================================================
  // MESSAGING HANDLERS
  // =========================================================================

  private handleMessageConnection(ws: WebSocket, req: IncomingMessage) {
    console.log('[Message WS] New connection');

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleChatMessage(ws, message);
      } catch (error) {
        console.error('[Message WS] Parse error:', error);
      }
    });

    ws.on('close', () => {
      this.handleMessageDisconnect(ws);
    });

    ws.on('error', (error) => {
      console.error('[Message WS] Error:', error);
    });
  }

  private async handleChatMessage(ws: WebSocket, message: any) {
    switch (message.type) {
      case 'subscribe':
        // Register client for receiving messages
        this.messageClients.set(message.userId, {
          ws,
          userId: message.userId,
          type: 'messages'
        });

        console.log(`[Message WS] User ${message.userId} subscribed`);

        // Send message history
        await this.sendMessageHistory(ws, message.userId);
        break;

      case 'send-message':
        // Save message to database
        await this.saveMessage(message.message);

        // Forward to recipient if online
        const recipientClient = this.messageClients.get(message.message.receiverId);
        if (recipientClient) {
          recipientClient.ws.send(JSON.stringify({
            type: 'new-message',
            message: message.message
          }));
        }

        // Confirm to sender
        ws.send(JSON.stringify({
          type: 'message-sent',
          messageId: message.message.id
        }));
        break;

      case 'mark-read':
        // Mark message as read
        await this.markMessageRead(message.messageId);

        // Notify sender
        const msg = await this.getMessage(message.messageId);
        if (msg) {
          const senderClient = this.messageClients.get(msg.senderId);
          if (senderClient) {
            senderClient.ws.send(JSON.stringify({
              type: 'message-read',
              messageId: message.messageId
            }));
          }
        }
        break;
    }
  }

  private handleMessageDisconnect(ws: WebSocket) {
    const userId = this.getUserIdByWs(ws);
    if (userId) {
      this.messageClients.delete(userId);
      console.log(`[Message WS] User ${userId} disconnected`);
    }
  }

  private async sendMessageHistory(ws: WebSocket, userId: string) {
    try {
      const result = await this.pool.query(`
        SELECT * FROM messages 
        WHERE sender_id = $1 OR receiver_id = $1
        ORDER BY created_at ASC
        LIMIT 100
      `, [userId]);

      ws.send(JSON.stringify({
        type: 'messages-history',
        messages: result.rows.map(row => ({
          id: row.id,
          senderId: row.sender_id,
          receiverId: row.receiver_id,
          content: row.content,
          timestamp: row.created_at,
          read: row.read
        }))
      }));
    } catch (error) {
      console.error('[Message WS] Failed to load history:', error);
    }
  }

  private async saveMessage(message: any) {
    try {
      await this.pool.query(`
        INSERT INTO messages (id, sender_id, receiver_id, content, read, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        message.id,
        message.senderId,
        message.receiverId,
        message.content,
        false,
        message.timestamp
      ]);

      console.log(`[Message WS] Saved message ${message.id}`);
    } catch (error) {
      console.error('[Message WS] Failed to save message:', error);
    }
  }

  private async markMessageRead(messageId: string) {
    try {
      await this.pool.query(`
        UPDATE messages 
        SET read = true, read_at = NOW()
        WHERE id = $1
      `, [messageId]);

      console.log(`[Message WS] Marked message ${messageId} as read`);
    } catch (error) {
      console.error('[Message WS] Failed to mark read:', error);
    }
  }

  private async getMessage(messageId: string) {
    try {
      const result = await this.pool.query(`
        SELECT * FROM messages WHERE id = $1
      `, [messageId]);

      return result.rows[0] ? {
        id: result.rows[0].id,
        senderId: result.rows[0].sender_id,
        receiverId: result.rows[0].receiver_id,
        content: result.rows[0].content,
        read: result.rows[0].read,
        timestamp: result.rows[0].created_at
      } : null;
    } catch (error) {
      console.error('[Message WS] Failed to get message:', error);
      return null;
    }
  }

  // =========================================================================
  // UTILITY
  // =========================================================================

  private getUserIdByWs(ws: WebSocket): string | null {
    // Check video clients
    for (const [userId, client] of this.videoClients.entries()) {
      if (client.ws === ws) return userId;
    }

    // Check message clients
    for (const [userId, client] of this.messageClients.entries()) {
      if (client.ws === ws) return userId;
    }

    return null;
  }

  public getOnlineUsers(): string[] {
    return Array.from(new Set([
      ...this.videoClients.keys(),
      ...this.messageClients.keys()
    ]));
  }

  public isUserOnline(userId: string): boolean {
    return this.videoClients.has(userId) || this.messageClients.has(userId);
  }
}

// Singleton instance
let instance: CommunicationWebSocketServer | null = null;

export function initializeCommunicationWS(pool: Pool): CommunicationWebSocketServer {
  if (!instance) {
    instance = new CommunicationWebSocketServer(pool);
  }
  return instance;
}

export function getCommunicationWS(): CommunicationWebSocketServer | null {
  return instance;
}
