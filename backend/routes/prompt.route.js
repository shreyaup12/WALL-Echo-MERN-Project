import express from "express";
import { submitPrompt, getAllPrompts, getRoomMessages, deleteChat } from "../controller/prompt.controller.js";
import { isAuthenticated } from "../middleware/prompt.middleware.js";

const promptRoutes = express.Router();

// Submit a new prompt and get AI response (now supports roomId)
promptRoutes.post("/", isAuthenticated, submitPrompt);

// Get all prompts for the authenticated user (supports roomId query param)
promptRoutes.get("/all", isAuthenticated, getAllPrompts);

// NEW: Get messages for a specific room
promptRoutes.get("/room/:roomId", isAuthenticated, getRoomMessages);

// Delete a chat session (personal chats only)
promptRoutes.delete("/chat/:chatId", isAuthenticated, deleteChat);

export default promptRoutes;