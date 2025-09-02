import express from "express";
import { 
  createRoom, 
  joinRoom, 
  getRoomDetails, 
  getUserRooms, 
  leaveRoom 
} from "../controller/room.controller.js";
import { isAuthenticated } from "../middleware/prompt.middleware.js";

const roomRoutes = express.Router();

// Create a new shared room
roomRoutes.post("/create", isAuthenticated, createRoom);

// Join an existing room via roomId
roomRoutes.post("/join/:roomId", isAuthenticated, joinRoom);

// Get details of a specific room
roomRoutes.get("/:roomId", isAuthenticated, getRoomDetails);

// Get all rooms user is part of
roomRoutes.get("/", isAuthenticated, getUserRooms);

// Leave a room
roomRoutes.delete("/:roomId/leave", isAuthenticated, leaveRoom);

export default roomRoutes;