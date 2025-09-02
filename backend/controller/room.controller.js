
import Room from "../model/room.model.js";
import User from "../model/user.model.js";
import { v4 as uuidv4 } from 'uuid';

// Create a new shared room
const createRoom = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    console.log("🚀 Creating room:", { name, userId });

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate unique room ID
    const roomId = uuidv4().slice(0, 8); // Short, shareable ID

    // Create room with owner as first participant
    const room = await Room.create({
      roomId,
      name: name || `${user.firstName}'s Room`,
      owner: userId,
      participants: [{
        userId,
        name: `${user.firstName} ${user.lastName}`,
        color: Room.schema.statics.generateUserColor(),
        joinedAt: new Date(),
        addedBy: userId
      }]
    });

    await room.populate('owner', 'firstName lastName email');
    await room.populate('participants.userId', 'firstName lastName email');

    console.log("✅ Room created:", room.roomId);

    res.status(201).json({
      message: "Room created successfully",
      room: {
        id: room.roomId,
        name: room.name,
        owner: room.owner,
        participants: room.participants,
        createdAt: room.createdAt,
        shareLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/room/${room.roomId}`
      }
    });

  } catch (error) {
    console.error("❌ Error creating room:", error);
    res.status(500).json({ 
      message: "Error creating room", 
      error: error.message 
    });
  }
};

// Join an existing room
const joinRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    console.log("🚪 Joining room:", { roomId, userId });

    const room = await Room.findOne({ roomId, isActive: true });
    if (!room) {
      return res.status(404).json({ message: "Room not found or inactive" });
    }

    // Check if user is already a participant
    const existingParticipant = room.participants.find(
      p => p.userId.toString() === userId
    );

    if (existingParticipant) {
      await room.populate('owner', 'firstName lastName email');
      await room.populate('participants.userId', 'firstName lastName email');

      return res.json({
        message: "Already a participant",
        room: {
          id: room.roomId,
          name: room.name,
          owner: room.owner,
          participants: room.participants,
          userColor: existingParticipant.color
        }
      });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add user to room with unique color
    const userColor = room.getAvailableColor();
    room.participants.push({
      userId,
      name: `${user.firstName} ${user.lastName}`,
      color: userColor,
      joinedAt: new Date(),
      addedBy: userId // Self-joined
    });

    room.lastActivity = new Date();
    await room.save();

    await room.populate('owner', 'firstName lastName email');
    await room.populate('participants.userId', 'firstName lastName email');

    console.log("✅ User joined room:", { roomId, userId, color: userColor });

    res.json({
      message: "Joined room successfully",
      room: {
        id: room.roomId,
        name: room.name,
        owner: room.owner,
        participants: room.participants,
        userColor
      }
    });

  } catch (error) {
    console.error("❌ Error joining room:", error);
    res.status(500).json({ 
      message: "Error joining room", 
      error: error.message 
    });
  }
};

// Get room details
const getRoomDetails = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    const room = await Room.findOne({ roomId, isActive: true })
      .populate('owner', 'firstName lastName email')
      .populate('participants.userId', 'firstName lastName email');

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Check if user is a participant
    const userParticipant = room.participants.find(
      p => p.userId._id.toString() === userId
    );

    if (!userParticipant) {
      return res.status(403).json({ message: "Not a participant of this room" });
    }

    res.json({
      message: "Room details retrieved",
      room: {
        id: room.roomId,
        name: room.name,
        owner: room.owner,
        participants: room.participants,
        userColor: userParticipant.color,
        lastActivity: room.lastActivity
      }
    });

  } catch (error) {
    console.error("❌ Error getting room details:", error);
    res.status(500).json({ 
      message: "Error getting room details", 
      error: error.message 
    });
  }
};

// Get user's rooms
const getUserRooms = async (req, res) => {
  try {
    const userId = req.user.id;

    const rooms = await Room.find({
      'participants.userId': userId,
      isActive: true
    })
    .populate('owner', 'firstName lastName')
    .populate('participants.userId', 'firstName lastName')
    .sort({ lastActivity: -1 });

    const roomsWithUserColors = rooms.map(room => {
      const userParticipant = room.participants.find(
        p => p.userId._id.toString() === userId
      );

      return {
        id: room.roomId,
        name: room.name,
        owner: room.owner,
        participants: room.participants,
        userColor: userParticipant?.color,
        lastActivity: room.lastActivity,
        isOwner: room.owner._id.toString() === userId,
        participantCount: room.participants.length
      };
    });

    res.json({
      message: "User rooms retrieved",
      rooms: roomsWithUserColors
    });

  } catch (error) {
    console.error("❌ Error getting user rooms:", error);
    res.status(500).json({ 
      message: "Error getting user rooms", 
      error: error.message 
    });
  }
};

// Leave room
const leaveRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Can't leave if you're the owner and there are other participants
    if (room.owner.toString() === userId && room.participants.length > 1) {
      return res.status(400).json({ 
        message: "Room owner cannot leave while others are present. Transfer ownership first." 
      });
    }

    // Remove participant
    room.participants = room.participants.filter(
      p => p.userId.toString() !== userId
    );

    if (room.participants.length === 0) {
      room.isActive = false;
    }

    room.lastActivity = new Date();
    await room.save();

    res.json({ 
      message: "Left room successfully",
      roomDeactivated: !room.isActive
    });

  } catch (error) {
    console.error("❌ Error leaving room:", error);
    res.status(500).json({ 
      message: "Error leaving room", 
      error: error.message 
    });
  }
};

export {
  createRoom,
  joinRoom,
  getRoomDetails,
  getUserRooms,
  leaveRoom
};