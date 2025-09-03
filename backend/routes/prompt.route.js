import express from "express";
import { createNewChatSession, submitPrompt, getAllChatSessions, getChatSession, deleteChatSession, getAllPrompts, getRoomMessages, deleteChat } from "../controller/prompt.controller.js";
import { isAuthenticated } from "../middleware/prompt.middleware.js";

const promptRoutes = express.Router();

// Create new chat session
promptRoutes.post("/chat-sessions", isAuthenticated, createNewChatSession);

// Get all chat sessions
promptRoutes.get("/chat-sessions", isAuthenticated, getAllChatSessions);

// Get specific chat session
promptRoutes.get("/chat-sessions/:chatSessionId", isAuthenticated, getChatSession);

// Delete chat session
promptRoutes.delete("/chat-sessions/:chatSessionId", isAuthenticated, deleteChatSession);

// Submit a new prompt and get AI response (now supports roomId)
promptRoutes.post("/", isAuthenticated, submitPrompt);

// Get all prompts for the authenticated user (supports roomId query param)
promptRoutes.get("/all", isAuthenticated, getAllPrompts);

// NEW: Get messages for a specific room
promptRoutes.get("/room/:roomId", isAuthenticated, getRoomMessages);

// Delete a chat session (personal chats only)
promptRoutes.delete("/chat/:chatId", isAuthenticated, deleteChat);

export default promptRoutes;
