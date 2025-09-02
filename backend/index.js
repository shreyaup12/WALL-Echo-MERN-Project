import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import userRoutes from "./routes/user.route.js";
import promptRoutes from "./routes/prompt.route.js";
import roomRoutes from "./routes/room.route.js"; // NEW
import Room from "./model/room.model.js";
import User from "./model/user.model.js";

dotenv.config();

const app = express();
const server = createServer(app); // NEW: HTTP server for Socket.io
const port = process.env.PORT || 4002;
const MONGO_URL = process.env.MONGO_URI;

// Enhanced CORS configuration for Socket.io
const corsOptions = {
  origin: [
    "http://localhost:3000", 
    "http://127.0.0.1:3000",
    "https://wall-echo.netlify.app"  // Add your actual Netlify URL here
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

//  Socket.io setup
const io = new Server(server, {
  cors: corsOptions
});

// Middleware
app.use(express.json());
app.use(cookieParser());

// DB Connection
mongoose.connect(MONGO_URL)
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("MongoDB Connection Error:", error));

// Test route
app.get('/api/v1/test', (req, res) => {
  res.json({ message: 'WALL-Echo backend is working!', timestamp: new Date() });
});

// Routes
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/prompt", promptRoutes);
app.use("/api/v1/room", roomRoutes); // NEW: Room routes

// NEW: Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // Join a room
  socket.on('join-room', async (data) => {
    try {
      const { roomId, userId } = data;
      console.log(`👥 User ${userId} joining room ${roomId}`);
      
      // Verify user is participant of the room
      const room = await Room.findOne({ 
        roomId, 
        'participants.userId': userId 
      }).populate('participants.userId', 'firstName lastName');

      if (room) {
        socket.join(roomId);
        
        // Find user info
        const participant = room.participants.find(
          p => p.userId._id.toString() === userId
        );

        if (participant) {
          // Notify others in the room
          socket.to(roomId).emit('user-joined', {
            userId,
            name: participant.name,
            color: participant.color,
            joinedAt: new Date()
          });

          socket.emit('room-joined', {
            roomId,
            participants: room.participants,
            message: `Joined ${room.name}`
          });
        }
      } else {
        socket.emit('error', { message: 'Room not found or access denied' });
      }
    } catch (error) {
      console.error('❌ Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Leave a room
  socket.on('leave-room', (data) => {
    const { roomId, userId } = data;
    console.log(`👋 User ${userId} leaving room ${roomId}`);
    
    socket.leave(roomId);
    socket.to(roomId).emit('user-left', {
      userId,
      leftAt: new Date()
    });
  });

  // Handle new messages in rooms
  socket.on('room-message', async (data) => {
    try {
      const { roomId, message, userId, userName, userColor, role } = data;
      
      console.log(`💬 New room message in ${roomId} from ${userName}`);

      // Update room last activity
      await Room.updateOne(
        { roomId },
        { lastActivity: new Date() }
      );

      // Broadcast message to all users in the room
      socket.to(roomId).emit('new-room-message', {
        ...message,
        roomId,
        userId,
        userName,
        userColor,
        role,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('❌ Error handling room message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicators for rooms
  socket.on('room-typing', (data) => {
    const { roomId, userId, userName, isTyping } = data;
    socket.to(roomId).emit('user-typing', {
      userId,
      userName,
      isTyping,
      timestamp: new Date()
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });
});

// Start server with Socket.io
server.listen(port, () => {
  console.log(`🚀 WALL-Echo server running on port ${port}`);
  console.log(`📡 Socket.io enabled for real-time collaboration`);
});

