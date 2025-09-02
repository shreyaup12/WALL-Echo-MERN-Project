import mongoose from "mongoose";

const promptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  //  Room support for shared chats
  roomId: {
    type: String,
    default: null,
    index: true // For efficient room-based queries
  },
  userName: {
    type: String,
    default: null // Cache user name for shared chats
  },
  userColor: {
    type: String,
    default: null // Cache user color for shared chats
  },
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  metadata: {
    conversationType: {
      type: String,
      enum: ["technical", "casual", "mixed"],
      default: null
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null
    },
    scores: {
      technical: {
        type: Number,
        default: 0
      },
      casual: {
        type: Number,
        default: 0
      }
    },
    // Room-specific metadata
    isShared: {
      type: Boolean,
      default: false
    }
  }
}, { timestamps: true });

// Index for efficient room queries
promptSchema.index({ roomId: 1, createdAt: 1 });
promptSchema.index({ userId: 1, roomId: 1 });

const Prompt = mongoose.model("Prompt", promptSchema);

export default Prompt;