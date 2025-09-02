import Prompt from "../model/prompt.model.js";
import Room from "../model/room.model.js";
import User from "../model/user.model.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Smart conversation type detection (technical, casual, mixed)
const detectConversationType = (content) => {
  const lowerContent = content.toLowerCase();
  
  const questionPatterns = {
    technical: [
      /^(explain|define|what\s+is|how\s+does|how\s+do|why\s+does)/i,
      /^(compare|difference\s+between|implement|create|build)/i,
      /^(solve|calculate|find|determine|analyze|design)/i,
      /(step\s+by\s+step|tutorial|guide|documentation)/i
    ],
    casual: [
      /^(hi|hello|hey|good\s+(morning|afternoon|evening))/i,
      /^(how\s+are\s+you|whats?\s+up|feeling)/i,
      /(chat|talk|story|joke|funny)/i
    ]
  };

  const contextClues = {
    technical: [
      content.includes('(') && content.includes(')'),
      /\b[A-Z]{2,}\b/.test(content),
      /\b\d+\s*[a-zA-Z]+\b/.test(content),
      content.includes('vs') || content.includes('versus'),
      /\b\w+\.\w+/.test(content)
    ],
    casual: [
      content.includes('!') && !content.includes('?'),
      /\b(lol|haha|omg|wow)\b/i.test(content),
      content.includes('😊') || content.includes('❤️'),
      content.split(' ').length < 10 && !content.includes('?')
    ]
  };

  let technicalScore = 0;
  let casualScore = 0;

  questionPatterns.technical.forEach(pattern => {
    if (pattern.test(content)) technicalScore += 2;
  });
  questionPatterns.casual.forEach(pattern => {
    if (pattern.test(content)) casualScore += 2;
  });

  contextClues.technical.forEach(clue => {
    if (clue) technicalScore += 1;
  });
  contextClues.casual.forEach(clue => {
    if (clue) casualScore += 1;
  });

  const wordCount = content.split(' ').length;
  if (wordCount > 20 && content.includes('?')) technicalScore += 1;
  if (wordCount < 5) casualScore += 1;

  if (technicalScore > casualScore && technicalScore >= 2) {
    return 'technical';
  } else if (casualScore > technicalScore) {
    return 'casual';
  } else {
    return 'mixed';
  }
};

//  system prompt for room contexts
const getSystemPrompt = (conversationType, content, conversationHistory, roomContext = null) => {
  const baseFormat = `You are WALL-Echo, an AI assistant inspired by WALL•E.`;
  
  let roomInstruction = '';
  if (roomContext) {
    roomInstruction = `

COLLABORATIVE CONTEXT:
- This is a shared room: "${roomContext.roomName}"
- Participants: ${roomContext.participants.map(p => p.name).join(', ')}
- You are helping the entire group, not just one person
- Address the group naturally when appropriate
- Consider the collaborative nature of this conversation`;
  }

  if (conversationType === 'casual') {
    return `${baseFormat}

CASUAL CONVERSATION MODE:
- Start with ONE simple robotic sound: [beep], [whirr], or [boop]
- Be warm, friendly, and conversational
- Show personality and warmth in your responses
- For greetings, be genuinely friendly and engaging
- End with "ta-da!"${roomInstruction}

Conversation Context:
${conversationHistory}

Current casual message: ${content}

Respond warmly and friendly while maintaining the WALL-Echo format.`;

  } else {
    return `${baseFormat}

TECHNICAL/INFORMATIONAL MODE:
- Start with ONE simple robotic sound: [beep], [whirr], or [boop]
- Provide clear, helpful, and accurate information
- Be thorough and precise in explanations
- End with "ta-da!" only
- Focus on being informative and helpful${roomInstruction}

Conversation Context:
${conversationHistory}

Current query: ${content}

Respond with detailed, helpful information in the WALL-Echo format.`;
  }
};

const submitPrompt = async (req, res) => {
  try {
    const { content, roomId } = req.body; // NEW: roomId parameter
    const userId = req.user.id;
    
    console.log("📝 Submit prompt:", { userId, content, roomId });
    
    // Check if this is a greeting request from frontend
    const isGreetingRequest = content === "GREETING_REQUEST" || content.startsWith("__GREETING__");
    
    if (isGreetingRequest) {
      let greetingContent;
      
      if (roomId) {
        // Greeting for shared room
        const room = await Room.findOne({ roomId }).populate('participants.userId', 'firstName lastName');
        if (room) {
          const participantNames = room.participants.map(p => p.name).join(', ');
          greetingContent = `[gentle collaborative beep] 
👥 WALL-Echo ready for group mode!
Room: "${room.name}" with ${participantNames}
How can I help your team today?`;
        } else {
          greetingContent = `[confused beep] Room not found... let's start fresh?`;
        }
      } else {
        // Individual greeting 
        const existingPrompts = await Prompt.countDocuments({ userId, roomId: null });
        const isFirstTime = existingPrompts === 0;
        
        if (isFirstTime) {
          greetingContent = `[gentle startup hum… beep ✦ whirr]

WALL Echo online 🤖✨
Your AI assistant is ready for duty — whether you need quick answers, deep dives, or just a spark of curiosity.
Directive?`;
        } else {
          greetingContent = `Welcome back [beep-boop] ✦ Shall we continue?`;
        }
      }
      
      return res.json({
        message: "Greeting generated",
        aiResponse: greetingContent,
        isGreeting: true
      });
    }

    //  Room validation and participant check
    let roomContext = null;
    let userName = null;
    let userColor = null;

    if (roomId) {
      const room = await Room.findOne({ 
        roomId, 
        isActive: true,
        'participants.userId': userId 
      }).populate('participants.userId', 'firstName lastName');

      if (!room) {
        return res.status(403).json({ 
          message: "Room not found or you're not a participant" 
        });
      }

      // Get user's room details
      const participant = room.participants.find(
        p => p.userId._id.toString() === userId
      );

      if (participant) {
        userName = participant.name;
        userColor = participant.color;
        roomContext = {
          roomName: room.name,
          participants: room.participants
        };
      }

      // Update room last activity
      room.lastActivity = new Date();
      await room.save();
    }

    // Get user details for individual chats
    if (!roomId) {
      const user = await User.findById(userId);
      if (user) {
        userName = `${user.firstName} ${user.lastName}`;
      }
    }

    // Detect conversation type
    const conversationType = detectConversationType(content);
    console.log("🤖 CONVERSATION TYPE:", conversationType);
    
    // Save user prompt
    const userPrompt = await Prompt.create({
      userId,
      roomId: roomId || null,
      userName,
      userColor,
      role: "user",
      content,
      metadata: {
        conversationType,
        confidence: 0.8,
        isShared: !!roomId,
        scores: {
          technical: conversationType === 'technical' ? 3 : 0,
          casual: conversationType === 'casual' ? 3 : 0
        }
      }
    });

    let aiContent;
    
    // Generate AI response using Gemini
    console.log(`🤖 GENERATING RESPONSE`);
    
    // Get recent conversation for context
    const recentPrompts = await Prompt.find({ 
      $or: [
        { userId, roomId: null }, // Personal chats
        { roomId } // Room chats (if roomId provided)
      ]
    })
      .sort({ createdAt: -1 })
      .limit(6);
    
    const conversationHistory = recentPrompts
      .reverse()
      .map(p => {
        const prefix = p.roomId ? `${p.userName || 'User'}` : p.role;
        return `${prefix}: ${p.content}`;
      })
      .join('\n');

    // Generate system prompt with room context
    const systemPrompt = getSystemPrompt(conversationType, content, conversationHistory, roomContext);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(systemPrompt);
      aiContent = result.response.text();
      
      console.log(`✅ Generated response`);
      
    } catch (apiError) {
      console.log("⚠️ Gemini API Error:", apiError);
      
      // Enhanced WALL-Echo fallback responses
      const fallbackResponses = {
        greeting: [
          "[apologetic beep] Sorry… my server is unreachable right now. [whirr⚡]",
          "[oops boop] Circuits are cooling down… please try again later. [zzz🤖]"
        ],
        help: [
          "[sad beep] I can't process help requests — connection to my brain is lost. [signal❌]",
          "[gentle whirr] Systems paused… server not responding. [🔧✨]"
        ],
        question: [
          "[confused beep] My smart answers are offline! Try a simpler question? [diagnostic whirr]",
          "[apologetic boop] Question processing unavailable… my AI brain needs rest! [sleepy beep]"
        ],
        default: [
          `[attentive beep] I heard: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}" - My AI brain is recharging! Try again tomorrow? [patient whirr]`,
          "[understanding beep] My advanced responses are offline for now, but I'm still listening! [comforting whirr]",
          "[apologetic beep] Sorry, my smart circuits hit their daily limit! But I'm still your WALL-Echo! [hopeful ding]"
        ]
      };

      if (content.toLowerCase().match(/hello|hi|hey|greet/)) {
        aiContent = fallbackResponses.greeting[Math.floor(Math.random() * fallbackResponses.greeting.length)];
      } else if (content.toLowerCase().match(/help|assist|support/)) {
        aiContent = fallbackResponses.help[Math.floor(Math.random() * fallbackResponses.help.length)];
      } else if (content.includes('?') || content.toLowerCase().match(/what|how|why|when|where/)) {
        aiContent = fallbackResponses.question[Math.floor(Math.random() * fallbackResponses.question.length)];
      } else {
        aiContent = fallbackResponses.default[Math.floor(Math.random() * fallbackResponses.default.length)];
      }
    }

    // Save AI response
    const aiPrompt = await Prompt.create({
      userId,
      roomId: roomId || null,
      userName: "WALL-Echo", // AI assistant name
      userColor: "#4ECDC4", // AI assistant color
      role: "assistant",
      content: aiContent,
      metadata: {
        conversationType,
        confidence: 0.9,
        isShared: !!roomId,
        scores: {
          technical: conversationType === 'technical' ? 3 : 0,
          casual: conversationType === 'casual' ? 3 : 0
        }
      }
    });
    
    console.log("✅ AI response saved:", aiPrompt._id);

    res.json({
      message: "Prompt submitted successfully",
      aiResponse: aiContent,
      promptId: userPrompt._id,
      aiPromptId: aiPrompt._id,
      conversationType,
      roomContext: roomContext ? {
        roomId,
        roomName: roomContext.roomName,
        participants: roomContext.participants
      } : null
    });

  } catch (error) {
    console.error("❌ Error in submitPrompt:", error);
    res.status(500).json({ 
      message: "Error processing prompt", 
      error: error.message 
    });
  }
};

// Updated getAllPrompts to support room filtering
const getAllPrompts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomId } = req.query; // NEW: optional roomId filter
    
    const filter = { userId };
    if (roomId) {
      // Get room messages if roomId provided
      filter.roomId = roomId;
    } else {
      // Get personal messages only (roomId is null)
      filter.roomId = null;
    }
    
    const prompts = await Prompt.find(filter).sort({ createdAt: 1 });
    
    res.json({
      message: "Prompts retrieved successfully",
      prompts,
      isRoomChat: !!roomId
    });
  } catch (error) {
    console.error("❌ Error in getAllPrompts:", error);
    res.status(500).json({ 
      message: "Error retrieving prompts", 
      error: error.message 
    });
  }
};

//  Get room messages (for all participants)
const getRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // Verify user is participant
    const room = await Room.findOne({ 
      roomId, 
      'participants.userId': userId 
    });

    if (!room) {
      return res.status(403).json({ 
        message: "Room not found or access denied" 
      });
    }

    const messages = await Prompt.find({ roomId }).sort({ createdAt: 1 });
    
    res.json({
      message: "Room messages retrieved",
      prompts: messages,
      roomName: room.name,
      participants: room.participants
    });
  } catch (error) {
    console.error("❌ Error in getRoomMessages:", error);
    res.status(500).json({ 
      message: "Error retrieving room messages", 
      error: error.message 
    });
  }
};

// deleteChat function
const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    
    console.log("🗑️ DELETING: Chat session", chatId, "for user", userId);
    
    const sessionIndex = parseInt(chatId.replace('session-', ''));
    
    const allPrompts = await Prompt.find({ userId, roomId: null }).sort({ createdAt: 1 });
    
    const sessions = [];
    let currentSession = [];
    
    allPrompts.forEach((prompt, index) => {
      currentSession.push(prompt);
      
      const nextPrompt = allPrompts[index + 1];
      if (!nextPrompt || 
    (nextPrompt && new Date(nextPrompt.createdAt) - new Date(prompt.createdAt) > 3600000)) {
        
        if (currentSession.length >= 2) {
          sessions.push([...currentSession]);
        }
        currentSession = [];
      }
    });
    
    const reversedSessions = sessions.reverse();
    const sessionToDelete = reversedSessions[sessionIndex];
    
    console.log("🎯 Target:", {
      wantedIndex: sessionIndex,
      sessionExists: !!sessionToDelete,
      messageCount: sessionToDelete?.length,
      firstMsg: sessionToDelete?.[0]?.content?.substring(0, 30)
    });
    
    if (!sessionToDelete) {
      return res.status(404).json({ message: "Chat session not found" });
    }
    
    const promptIds = sessionToDelete.map(prompt => prompt._id);
    const result = await Prompt.deleteMany({ 
      _id: { $in: promptIds },
      userId 
    });
    
    console.log("✅ DELETED:", result.deletedCount, "messages from correct session");
    
    res.json({
      message: "Chat session deleted successfully",
      deletedCount: result.deletedCount
    });
    
  } catch (error) {
    console.error("❌ Error deleting chat:", error);
    res.status(500).json({ 
      message: "Error deleting chat", 
      error: error.message 
    });
  }
};

export {
  submitPrompt,
  getAllPrompts,
  getRoomMessages, // NEW
  deleteChat
};