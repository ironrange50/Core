# VIDEO CHAT & MESSENGER FIXES - COMPLETE SETUP

## Issues Fixed

### Video Chat ✅
- ✅ **Self-view camera** - Can now see yourself to check framing
- ✅ **Proper positioning** - Fixed in upper corner of display
- ✅ **Picture-in-picture layout** - Remote video main, local video small corner

### Messenger ✅
- ✅ **Real-time delivery** - Messages arrive instantly
- ✅ **Browser notifications** - Desktop alerts for new messages
- ✅ **Sound alerts** - Audio notification on message receive
- ✅ **Unread badges** - Shows count of unread messages
- ✅ **Read receipts** - Double checkmarks when read

---

## File Structure

```
server/
├── websocket/
│   └── communication-websocket-server.ts  ← WebSocket handlers
└── migrations/
    └── 005_messages_table.sql             ← Database schema

src/
└── components/
    ├── VideoChat-Fixed.tsx                ← Video with self-view
    └── Messenger-WithAlerts.tsx           ← Messenger with alerts
```

---

## Setup Steps

### Step 1: Database Migration (2 minutes)

Run the messages table migration:

```bash
psql $DATABASE_URL -f 005_messages_table.sql
```

Or if using a migration tool:

```typescript
// Add to your migrations list
import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(
  path.join(__dirname, 'migrations', '005_messages_table.sql'),
  'utf-8'
);

await pool.query(sql);
```

### Step 2: Install Dependencies (1 minute)

```bash
npm install ws
npm install --save-dev @types/ws
```

### Step 3: Copy Files (1 minute)

```bash
# Copy server files
cp communication-websocket-server.ts server/websocket/

# Copy UI components
cp VideoChat-Fixed.tsx src/components/
cp Messenger-WithAlerts.tsx src/components/
```

### Step 4: Initialize WebSocket Server (3 minutes)

In your main server file (e.g., `server/index.ts`):

```typescript
import express from 'express';
import { createServer } from 'http';
import { Pool } from 'pg';
import { initializeCommunicationWS } from './websocket/communication-websocket-server';

const app = express();
const server = createServer(app);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Initialize WebSocket server
const communicationWS = initializeCommunicationWS(pool);
communicationWS.setupWebSocket(server);

// Start server (use server, not app)
server.listen(3001, () => {
  console.log('[Server] Listening on port 3001');
  console.log('[WebSocket] Video chat ready at ws://localhost:3001/ws/video');
  console.log('[WebSocket] Messaging ready at ws://localhost:3001/ws/messages');
});
```

### Step 5: Update UI Components (2 minutes)

**Replace old VideoChat component:**

```typescript
// REPLACE:
// import { VideoChat } from '../components/VideoChat';

// WITH:
import { VideoChatFixed } from '../components/VideoChat-Fixed';

// REPLACE:
// <VideoChat ... />

// WITH:
<VideoChatFixed
  sessionId="session-123"
  localUserId={currentUser.id}
  remoteUserId={otherUser.id}
  onClose={() => setShowVideo(false)}
/>
```

**Replace old Messenger component:**

```typescript
// REPLACE:
// import { Messenger } from '../components/Messenger';

// WITH:
import { MessengerWithAlerts } from '../components/Messenger-WithAlerts';

// REPLACE:
// <Messenger ... />

// WITH:
<MessengerWithAlerts
  currentUserId={currentUser.id}
  recipientId={otherUser.id}
  recipientName={otherUser.name}
  onClose={() => setShowMessenger(false)}
/>
```

---

## How It Works - Complete Flow

### Video Chat Flow

```
User 1 opens video chat
         ↓
getUserMedia() → Local camera stream
         ↓
Display in localVideoRef (self-view)
         ↓
Connect to ws://localhost:3001/ws/video
         ↓
Send: { type: 'join', sessionId, userId }
         ↓
Create RTCPeerConnection
         ↓
User 2 joins
         ↓
Server: broadcasts 'user-joined' to User 1
         ↓
User 1 creates offer → sends to User 2
         ↓
User 2 receives offer → creates answer → sends to User 1
         ↓
ICE candidates exchanged
         ↓
Connection established
         ↓
User 1 sees:
  - Local video (bottom-right, mirrored, "You" label)
  - Remote video (full screen)
User 2 sees:
  - Local video (bottom-right, mirrored, "You" label)  
  - Remote video (full screen)
```

### Messenger Flow

```
User A sends message
         ↓
WebSocket: { type: 'send-message', message }
         ↓
Server saves to database:
  INSERT INTO messages (id, sender_id, receiver_id, content, read)
         ↓
Server checks if User B is online
         ↓
If online:
  → Send via WebSocket to User B
  → User B receives instantly
  → Play notification sound 🔔
  → Show browser notification 📱
  → Add to message list
  → Increment unread count
         ↓
If User B has window focused:
  → Auto-mark as read
  → Send read receipt to User A
  → User A sees ✓✓ (double checkmark)
         ↓
If User B window not focused:
  → Message stays unread
  → Unread badge shows count
  → When User B focuses window → mark as read
```

---

## UI Features Explained

### Video Chat Features

**1. Self-View (Bottom-Right Corner)**
- Shows your own camera feed
- Mirrored (like a mirror)
- 160x120px size
- Blue border with "You" label
- Lets you check if you're in frame

**2. Remote Video (Main)**
- Full screen view
- Shows other user's camera
- Falls back to placeholder if no stream

**3. Controls**
- 🎥 Video On/Off
- 🎤 Audio On/Off
- 📞 End Call

**4. Positioning**
- Top-right corner when expanded
- Can minimize to bottom-right
- 480px width when expanded
- 320px width when minimized

### Messenger Features

**1. Real-Time Delivery**
- Messages arrive instantly (WebSocket)
- No page refresh needed
- Typing appears immediately

**2. Notifications**
```
New message arrives
    ↓
Sound: 🔔 beep
    ↓
Browser notification:
  "New message from John"
  "Hey, are you there?"
    ↓
Click notification → focuses window
```

**3. Read Receipts**
```
You send: "Hi"
  → ✓ (sent)

Other user reads it
  → ✓✓ (read)
```

**4. Unread Badges**
```
Header shows: "John (3)"
  → 3 unread messages from John
```

**5. Controls**
- 🔔 Notifications On/Off
- 🔊 Sound On/Off
- ▼ Minimize/Expand
- ✕ Close

---

## Testing

### Test Video Chat

1. Open in two browser windows (or two devices)
2. User 1: Start video chat
3. User 2: Join same session
4. **Check self-view:**
   - Each user should see small video of themselves in bottom-right
   - Should be mirrored (raise left hand, see right hand move)
   - Should say "You" label
5. **Check remote view:**
   - Each user should see the other user's video full screen
6. **Check positioning:**
   - Video window should be in top-right corner
   - Should not block main content

### Test Messenger

1. Open in two browser windows
2. User 1: Send message "Hello"
3. User 2 should:
   - Hear notification sound 🔔
   - See browser notification popup
   - See message appear instantly
   - See unread badge if window not focused
4. User 2: Click message area (focus)
   - Message should be marked as read
5. User 1 should:
   - See ✓✓ (double checkmark) next to message
6. Test with window not focused:
   - Send message from User 1
   - User 2 should get desktop notification
   - Click notification → window focuses
   - Message marked as read automatically

---

## Troubleshooting

### Video Chat Issues

**Self-view not showing**
- Check camera permissions
- Look in browser console for errors
- Verify localVideoRef is connected

**Remote video not showing**
- Check WebSocket connection (look for "Connecting...")
- Verify both users in same session
- Check firewall/STUN server access

**Video in wrong position**
- Check CSS styles are applied
- Verify `position: fixed; top: 1rem; right: 1rem;`
- Clear browser cache

### Messenger Issues

**No alerts/notifications**
- Check browser notification permission (should auto-request)
- Verify sound is enabled (speaker icon)
- Check WebSocket connection in network tab

**Messages not arriving**
- Check WebSocket is connected
- Look for "Connected" in console logs
- Verify database table exists

**Read receipts not working**
- Check both users are connected to WebSocket
- Verify database UPDATE queries succeed
- Look for "Marked message as read" in server logs

---

## Database Queries

### Get conversation history
```sql
SELECT * FROM messages
WHERE (sender_id = 'user1' AND receiver_id = 'user2')
   OR (sender_id = 'user2' AND receiver_id = 'user1')
ORDER BY created_at ASC;
```

### Get unread count
```sql
SELECT COUNT(*) FROM messages
WHERE receiver_id = 'user1'
  AND read = FALSE;
```

### Mark messages as read
```sql
UPDATE messages
SET read = TRUE, read_at = NOW()
WHERE receiver_id = 'user1'
  AND sender_id = 'user2'
  AND read = FALSE;
```

### Get all conversations
```sql
SELECT * FROM conversation_threads
WHERE user1_id = 'user1' OR user2_id = 'user1'
ORDER BY last_message_at DESC;
```

---

## Browser Notification API

The messenger requests notification permission automatically:

```typescript
if ('Notification' in window && Notification.permission === 'default') {
  const permission = await Notification.requestPermission();
  // Result: 'granted', 'denied', or 'default'
}
```

When a message arrives:

```typescript
new Notification('New message from John', {
  body: 'Hey, are you there?',
  icon: '/icon-192.png',
  tag: 'message-user123',  // Prevents duplicates
  requireInteraction: false // Auto-dismiss after 5s
});
```

---

## Performance Notes

### Video Chat
- Uses STUN servers (Google's public servers)
- Peer-to-peer connection (not relayed through server)
- ~1-2 Mbps bandwidth for 720p video
- Low latency (<100ms typically)

### Messenger
- WebSocket keeps single connection open
- Messages delivered in <10ms on local network
- Browser notifications use native OS
- Sound is inline Base64 (no extra HTTP request)

---

## Summary

**What you get:**

### Video Chat ✅
1. **Self-view camera** in bottom-right corner
2. **Remote video** full screen
3. **Positioned correctly** in top-right corner
4. **Picture-in-picture layout** that works
5. Controls for video/audio/end call

### Messenger ✅
1. **Real-time delivery** via WebSocket
2. **Browser notifications** with sound
3. **Unread badges** showing count
4. **Read receipts** (double checkmarks)
5. **Message history** from database
6. **Auto-reconnect** if disconnected

Just follow the 5 setup steps and everything works!
