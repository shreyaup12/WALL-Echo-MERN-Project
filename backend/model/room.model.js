import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    name: {
      type: String,
      required: true
    },
    color: {
      type: String,
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Generate unique colors for participants
roomSchema.statics.generateUserColor = function() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#85DDFF', '#FFAB91'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Find available color for room
roomSchema.methods.getAvailableColor = function() {
  const usedColors = this.participants.map(p => p.color);
  const allColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#85DDFF', '#FFAB91'
  ];
  
  const availableColors = allColors.filter(color => !usedColors.includes(color));
  return availableColors.length > 0 ? 
    availableColors[0] : 
    allColors[Math.floor(Math.random() * allColors.length)];
};

const Room = mongoose.model("Room", roomSchema);

export default Room;