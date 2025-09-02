import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.currentRoom = null;
    this.callbacks = {
      newMessage: [],
      userJoined: [],
      userLeft: [],
      userTyping: [],
      error: []
    };
  }

  connect(serverUrl = 'http://localhost:4002') {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(serverUrl, {
      cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.setupEventListeners();
    return this.socket;
  }

  setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to server:', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    // Room events
    this.socket.on('room-joined', (data) => {
      console.log('Successfully joined room:', data);
      this.currentRoom = data.roomId;
    });

    this.socket.on('new-room-message', (message) => {
      console.log('New room message:', message);
      this.callbacks.newMessage.forEach(callback => callback(message));
    });

    this.socket.on('user-joined', (data) => {
      console.log('User joined room:', data);
      this.callbacks.userJoined.forEach(callback => callback(data));
    });

    this.socket.on('user-left', (data) => {
      console.log('User left room:', data);
      this.callbacks.userLeft.forEach(callback => callback(data));
    });

    this.socket.on('user-typing', (data) => {
      this.callbacks.userTyping.forEach(callback => callback(data));
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.callbacks.error.forEach(callback => callback(error));
    });
  }

  // Join a room
  joinRoom(roomId, userId) {
    if (!this.socket || !roomId || !userId) return;
    
    console.log('Joining room:', { roomId, userId });
    this.socket.emit('join-room', { roomId, userId });
  }

  // Leave current room
  leaveRoom(userId) {
    if (!this.socket || !this.currentRoom) return;
    
    console.log('Leaving room:', { roomId: this.currentRoom, userId });
    this.socket.emit('leave-room', { 
      roomId: this.currentRoom, 
      userId 
    });
    this.currentRoom = null;
  }

  // Send message to room
  sendRoomMessage(messageData) {
    if (!this.socket || !this.currentRoom) return;
    
    console.log('Sending room message:', messageData);
    this.socket.emit('room-message', {
      ...messageData,
      roomId: this.currentRoom
    });
  }

  // Send typing indicator
  sendTyping(userId, userName, isTyping) {
    if (!this.socket || !this.currentRoom) return;
    
    this.socket.emit('room-typing', {
      roomId: this.currentRoom,
      userId,
      userName,
      isTyping
    });
  }

  // Event listeners
  onNewMessage(callback) {
    this.callbacks.newMessage.push(callback);
  }

  onUserJoined(callback) {
    this.callbacks.userJoined.push(callback);
  }

  onUserLeft(callback) {
    this.callbacks.userLeft.push(callback);
  }

  onUserTyping(callback) {
    this.callbacks.userTyping.push(callback);
  }

  onError(callback) {
    this.callbacks.error.push(callback);
  }

  // Remove event listeners
  removeCallback(event, callback) {
    if (this.callbacks[event]) {
      const index = this.callbacks[event].indexOf(callback);
      if (index > -1) {
        this.callbacks[event].splice(index, 1);
      }
    }
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentRoom = null;
    }
  }

  // Get connection status
  isConnected() {
    return this.socket?.connected || false;
  }

  getCurrentRoom() {
    return this.currentRoom;
  }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;