import { useState, useEffect, useRef } from 'react';
import WallEchoAvatar from './components/WallEchoAvatar';
import RoomManager from './components/RoomManager';
import socketService from './services/socketService';

const ChatInterface = ({ user, onLogout }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [avatarEmotion, setAvatarEmotion] = useState('ready');
  const [currentSound, setCurrentSound] = useState('');
  const [recentChats, setRecentChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  
  // Room-related state
  const [showRoomManager, setShowRoomManager] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomParticipants, setRoomParticipants] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Function to determine avatar emotion based on message content
  const getEmotionFromMessage = (message) => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('error') || lowerMessage.includes('problem')) return 'concerned';
    if (lowerMessage.includes('excited') || lowerMessage.includes('amazing')) return 'excited';
    if (lowerMessage.includes('think') || lowerMessage.includes('consider')) return 'thinking';
    if (lowerMessage.includes('help') || lowerMessage.includes('assist')) return 'helpful';
    if (lowerMessage.includes('creative') || lowerMessage.includes('idea')) return 'inspired';
    if (lowerMessage.includes('happy') || lowerMessage.includes('great')) return 'happy';
    return 'default';
  };

  //  Socket.io setup and event handlers
  useEffect(() => {
    const connectSocket = () => {
      socketService.connect();
      setIsSocketConnected(socketService.isConnected());

      // Setup event listeners
      socketService.onNewMessage((message) => {
        const formattedMessage = {
          role: message.role,
          content: message.content,
          timestamp: new Date(message.timestamp),
          userName: message.userName,
          userColor: message.userColor,
          userId: message.userId,
          isRoomMessage: true
        };
        setMessages(prev => [...prev, formattedMessage]);
      });

      socketService.onUserJoined((data) => {
        // Add system message when user joins
        const joinMessage = {
          role: 'system',
          content: `${data.name} joined the room`,
          timestamp: new Date(data.joinedAt),
          isRoomMessage: true
        };
        setMessages(prev => [...prev, joinMessage]);
      });

      socketService.onUserLeft((data) => {
        // Add system message when user leaves
        const leaveMessage = {
          role: 'system',
          content: `User left the room`,
          timestamp: new Date(data.leftAt),
          isRoomMessage: true
        };
        setMessages(prev => [...prev, leaveMessage]);
      });

      socketService.onUserTyping((data) => {
        if (data.isTyping) {
          setTypingUsers(prev => {
            const existing = prev.find(u => u.userId === data.userId);
            if (!existing) {
              return [...prev, { userId: data.userId, userName: data.userName }];
            }
            return prev;
          });
        } else {
          setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
        }

        // Auto-remove typing indicator after timeout
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
        }, 3000);
      });

      socketService.onError((error) => {
        console.error('Socket error:', error);
      });
    };

    connectSocket();

    // Cleanup on unmount
    return () => {
      if (currentRoom) {
        socketService.leaveRoom(user.id);
      }
      socketService.disconnect();
    };
  }, [user.id, currentRoom]);

  //  Handle room selection
  const handleRoomSelect = async (room) => {
    try {
      // Leave current room if any
      if (currentRoom) {
        socketService.leaveRoom(user.id);
      }

      setCurrentRoom(room);
      setRoomParticipants(room.participants || []);
      setSelectedChat(null); // Clear individual chat selection
      
      // Join the new room via socket
      socketService.joinRoom(room.id, user.id);

      // Load room messages
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:4002/api/v1/prompt/room/${room.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const roomMessages = data.prompts.map((msg, index) => ({
          id: `room-${room.id}-${index}`,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.createdAt),
          userName: msg.userName,
          userColor: msg.userColor,
          userId: msg.userId,
          isRoomMessage: true
        }));
        setMessages(roomMessages);
      }
      
      setShowRoomManager(false);
    } catch (error) {
      console.error('Error selecting room:', error);
    }
  };

  // NEW: Leave current room
  const leaveCurrentRoom = () => {
    if (currentRoom) {
      socketService.leaveRoom(user.id);
      setCurrentRoom(null);
      setRoomParticipants([]);
      setMessages([]);
      greetUser(); // Go back to individual chat
    }
  };

  // Load recent chats for sidebar (individual chats only)
  const loadRecentChats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:4002/api/v1/prompt/all', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const chatSessions = groupMessagesBySession(data.prompts);
        setRecentChats(chatSessions);
      }
    } catch (error) {
      console.error('Error loading recent chats:', error);
    }
  };

  // Group messages into chat sessions 
  const groupMessagesBySession = (prompts) => {
    const sessions = [];
    let currentSession = [];
    
    prompts.forEach((prompt, index) => {
      currentSession.push(prompt);
      
      const nextPrompt = prompts[index + 1];
      if (!nextPrompt || 
        (nextPrompt && new Date(nextPrompt.createdAt) - new Date(prompt.createdAt) > 3600000)) {
        if (currentSession.length >= 2) {
          const firstUserMessage = currentSession.find(m => m.role === 'user');
          const title = firstUserMessage ? 
            (firstUserMessage.content.length > 30 ? 
              firstUserMessage.content.substring(0, 30) + '...' : 
              firstUserMessage.content) : 
            'Chat Session';
            
          sessions.push({
            originalIndex: sessions.length,
            title: title,
            messages: [...currentSession],
            date: new Date(currentSession[0].createdAt),
            messageCount: currentSession.length
          });
        }
        currentSession = [];
      }
    });
    
    const reversedSessions = sessions.reverse();
    
    return reversedSessions.map((session, index) => ({
      ...session,
      id: `session-${index}`
    }));
  };

  // Greet user
  const greetUser = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      const requestBody = currentRoom ? 
        { content: "GREETING_REQUEST", roomId: currentRoom.id } :
        { content: "GREETING_REQUEST" };

      const response = await fetch('http://localhost:4002/api/v1/prompt/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (response.ok) {
        const data = await response.json();
        const greetingMessage = {
          role: 'assistant',
          content: data.aiResponse,
          timestamp: new Date(),
          userName: 'WALL-Echo',
          userColor: '#4ECDC4',
          isRoomMessage: !!currentRoom
        };
        setMessages([greetingMessage]);
      }
    } catch (error) {
      console.error('Error getting greeting:', error);
    }
  };

  // Load specific chat session (individual chats only)
  const loadChatSession = (session) => {
    if (currentRoom) {
      leaveCurrentRoom(); // Leave room first
    }

    const sessionMessages = session.messages.map((msg, index) => ({
      id: `session-${session.id}-${index}`,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.createdAt),
      isRoomMessage: false
    }));
    
    setMessages(sessionMessages);
    setSelectedChat(session);
    setOpenMenuId(null);
  };

  // Start new individual chat
  const startNewChat = () => {
    if (currentRoom) {
      leaveCurrentRoom();
    }
    
    setMessages([]);
    setSelectedChat(null);
    setOpenMenuId(null);
    greetUser();
  };

  // Delete chat 
  const handleDeleteChat = async (chatId) => {
    if (!window.confirm('Delete this chat? This cannot be undone.')) return;
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:4002/api/v1/prompt/chat/${chatId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        setOpenMenuId(null);
        
        if (selectedChat?.id === chatId) {
          startNewChat();
        }
        
        setRecentChats(prev => prev.filter(chat => chat.id !== chatId));
        
        setTimeout(() => {
          loadRecentChats();
        }, 100);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      alert('Failed to delete chat. Please try again.');
    }
  };

  //  Send typing indicator
  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    
    if (currentRoom) {
      // Send typing indicator for room chat
      socketService.sendTyping(user.id, `${user.firstName} ${user.lastName}`, true);
      
      // Clear typing indicator after 1 second of inactivity
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketService.sendTyping(user.id, `${user.firstName} ${user.lastName}`, false);
      }, 1000);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    // Get user's room color if in a room
    const userParticipant = currentRoom ? 
      roomParticipants.find(p => p.userId === user.id) : null;
    const userColor = userParticipant?.color || '#3B82F6';
    const userName = `${user.firstName} ${user.lastName}`;

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
      userName: userName,
      userColor: userColor,
      userId: user.id,
      isRoomMessage: !!currentRoom
    };
    
    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputMessage;
    setInputMessage('');
    setIsLoading(true);
    setAvatarEmotion('processing');
    setCurrentSound('[processing beep]');

    // Stop typing indicator
    if (currentRoom) {
      socketService.sendTyping(user.id, userName, false);
    }

    try {
      const token = localStorage.getItem('authToken');
      const requestBody = {
        content: messageToSend,
        ...(currentRoom && { roomId: currentRoom.id })
      };

      const response = await fetch('http://localhost:4002/api/v1/prompt/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok && data.aiResponse) {
        const aiMessage = {
          role: 'assistant',
          content: data.aiResponse,
          timestamp: new Date(),
          userName: 'WALL-Echo',
          userColor: '#4ECDC4',
          isRoomMessage: !!currentRoom
        };
        
        setMessages(prev => [...prev, aiMessage]);
        
        // Broadcast message to room if in a room
        if (currentRoom) {
          socketService.sendRoomMessage({
            message: aiMessage,
            userId: 'wall-echo',
            userName: 'WALL-Echo',
            userColor: '#4ECDC4',
            role: 'assistant'
          });
        }
        
        const emotion = getEmotionFromMessage(data.aiResponse);
        setAvatarEmotion(emotion);
        
        const soundMatch = data.aiResponse.match(/\[([^\]]+)\]/);
        setCurrentSound(soundMatch ? soundMatch[1] : '[beep]');
        
        setTimeout(() => {
          setAvatarEmotion('ready');
          setCurrentSound('');
        }, 3000);

        // Only reload individual chats if not in a room
        if (!currentRoom) {
          setTimeout(() => {
            loadRecentChats();
          }, 2000);
        }

      } else {
        throw new Error(data.message || 'Failed to get response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      setAvatarEmotion('concerned');
      setCurrentSound('[error beep]');
      
      const errorResponses = [
        '[confused beep] Oops! My circuits got tangled. Let me try to reconnect... [whirr]',
        '[apologetic boop] Something went sideways in my systems! [diagnostic beep]',
        '[patient whirr] My connection hiccupped! Give me a moment to recalibrate... [hopeful ding]',
        '[gentle malfunction sound] Whoops! My wires got crossed. Trying again? [encouraging beep]'
      ];
      
      const randomError = errorResponses[Math.floor(Math.random() * errorResponses.length)];
      
      const errorMessage = {
        role: 'assistant',
        content: randomError,
        timestamp: new Date(),
        userName: 'WALL-Echo',
        userColor: '#4ECDC4',
        isRoomMessage: !!currentRoom
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Format user name
  const formatUserName = (firstName) => {
    return firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() : '';
  };

  //  Collaboration Header Component
  const CollaborationHeader = () => {
    if (!currentRoom || !roomParticipants.length) return null;

    return (
      <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-3 mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-lg">👥</span>
          <div className="flex-1">
            <div className="text-blue-300 font-medium text-sm">
              Shared with: {roomParticipants.map(p => p.name).join(', ')}
            </div>
            <div className="text-blue-400 text-xs">
              Room: {currentRoom.name} (ID: {currentRoom.id})
            </div>
          </div>
          <button
            onClick={leaveCurrentRoom}
            className="px-3 py-1 bg-red-500/20 text-red-300 rounded text-xs hover:bg-red-500/30 transition-colors"
          >
            Leave Room
          </button>
        </div>

        {/* Participant colors */}
        <div className="flex items-center space-x-1 mt-2">
          {roomParticipants.map((participant, index) => (
            <div
              key={index}
              className="w-3 h-3 rounded-full border border-white/30"
              style={{ backgroundColor: participant.color }}
              title={participant.name}
            />
          ))}
        </div>
      </div>
    );
  };

  // Updated Recent Chats Sidebar with room support
  const RecentChatsSidebar = () => (
    <div className={`bg-black/30 backdrop-blur-lg border-r border-white/20 transition-all duration-300 ${
      isSidebarOpen ? 'w-80' : 'w-12'
    }`}>
      <div className="p-4 border-b border-white/20">
        <div className="flex items-center justify-between">
          {isSidebarOpen && (
            <div>
              <h2 className="text-lg font-bold text-white">
                {currentRoom ? 'Room Chat' : 'WALL-Echo\'s Collection'}
              </h2>
              <p className="text-sm text-gray-300">for {formatUserName(user?.firstName)}</p>
            </div>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            {isSidebarOpen ? '←' : '→'}
          </button>
        </div>
      </div>

      {isSidebarOpen && (
        <div className="flex-1 overflow-y-auto p-4 h-[calc(100vh-160px)]">
          {/* Room Management Button */}
          <button
            onClick={() => setShowRoomManager(true)}
            className="w-full mb-4 p-3 bg-purple-500/20 border border-purple-400/30 rounded-lg text-purple-300 hover:bg-purple-500/30 transition-colors text-left"
          >
            <div className="font-medium">👥 Shared Rooms</div>
            <div className="text-xs opacity-75">Join or create collaborative chats</div>
          </button>

          <button
            onClick={startNewChat}
            className="w-full mb-4 p-3 bg-blue-500/20 border border-blue-400/30 rounded-lg text-blue-300 hover:bg-blue-500/30 transition-colors text-left"
          >
            <div className="font-medium">🆕 New Chat</div>
            <div className="text-xs opacity-75">Start fresh individual conversation</div>
          </button>

          {/* Only show individual chats when not in a room */}
          {!currentRoom && (
            <div className="space-y-3">
              {recentChats.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <div className="text-3xl mb-2">݁ ˖.   ݁🌱 ݁.˖ ݁</div>
                  <p className="text-sm">No recent chats yet!</p>
                  <p className="text-xs">Start chatting with WALL-Echo</p>
                </div>
              ) : (
                recentChats.map(chat => (
                  <div
                    key={chat.id}
                    className={`group relative p-3 rounded-lg border transition-all hover:bg-white/10 ${
                      selectedChat?.id === chat.id
                        ? 'bg-blue-500/20 border-blue-400/50'
                        : 'bg-white/5 border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-lg">💬</div>
                      <div className="flex items-center space-x-2">
                        <div className="text-xs text-gray-400">
                          
                        </div>
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === chat.id ? null : chat.id);
                            }}
                            className="text-gray-400 hover:text-white text-sm p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ⋯
                          </button>
                          
                          {openMenuId === chat.id && (
                            <div className="absolute right-0 top-6 bg-gray-800 border border-white/20 rounded-lg shadow-lg z-50 min-w-32">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteChat(chat.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-red-400 hover:bg-red-500/20 rounded-lg text-sm flex items-center space-x-2"
                              >
                                <span>🗑️</span>
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div 
                      onClick={() => loadChatSession(chat)}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="text-white font-medium text-sm mb-1 line-clamp-2">
                        {chat.title}
                      </div>
                      <div className="text-xs text-gray-400">
                        {chat.messageCount} messages • {chat.date.toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Effects
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!currentRoom) {
      loadRecentChats();
      greetUser();
    }
  }, [currentRoom]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuId(null);
    };
    
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-black relative overflow-hidden flex">
      {/* Starry Night Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Large Stars */}
        <div className="absolute top-10 left-10 w-1 h-1 bg-white rounded-full opacity-80 animate-pulse"></div>
        <div className="absolute top-20 right-20 w-1 h-1 bg-white rounded-full opacity-60 animate-pulse animation-delay-500"></div>
        <div className="absolute top-32 left-1/4 w-1 h-1 bg-white rounded-full opacity-90 animate-pulse animation-delay-1000"></div>
        <div className="absolute top-40 right-1/3 w-1 h-1 bg-white rounded-full opacity-70 animate-pulse animation-delay-1500"></div>
        <div className="absolute top-52 left-1/2 w-1 h-1 bg-white rounded-full opacity-85 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-60 right-10 w-1 h-1 bg-white rounded-full opacity-75 animate-pulse animation-delay-2500"></div>
        
        {/* Medium Stars */}
        <div className="absolute top-16 left-1/3 w-0.5 h-0.5 bg-white rounded-full opacity-60 animate-pulse animation-delay-200"></div>
        <div className="absolute top-24 right-1/4 w-0.5 h-0.5 bg-white rounded-full opacity-80 animate-pulse animation-delay-700"></div>
        <div className="absolute top-36 left-20 w-0.5 h-0.5 bg-white rounded-full opacity-70 animate-pulse animation-delay-1200"></div>
        <div className="absolute top-44 right-1/2 w-0.5 h-0.5 bg-white rounded-full opacity-65 animate-pulse animation-delay-1700"></div>
        <div className="absolute top-56 left-1/4 w-0.5 h-0.5 bg-white rounded-full opacity-85 animate-pulse animation-delay-2200"></div>
        <div className="absolute top-64 right-20 w-0.5 h-0.5 bg-white rounded-full opacity-75 animate-pulse animation-delay-2700"></div>
        
        {/* Small Stars */}
        <div className="absolute top-12 left-1/2 w-px h-px bg-white rounded-full opacity-50 animate-pulse animation-delay-300"></div>
        <div className="absolute top-28 right-1/3 w-px h-px bg-white rounded-full opacity-70 animate-pulse animation-delay-800"></div>
        <div className="absolute top-48 left-10 w-px h-px bg-white rounded-full opacity-60 animate-pulse animation-delay-1300"></div>
        <div className="absolute top-68 right-1/4 w-px h-px bg-white rounded-full opacity-80 animate-pulse animation-delay-1800"></div>
        <div className="absolute top-72 left-1/3 w-px h-px bg-white rounded-full opacity-55 animate-pulse animation-delay-2300"></div>
        
        {/* Bottom area stars */}
        <div className="absolute bottom-20 left-16 w-1 h-1 bg-white rounded-full opacity-70 animate-pulse animation-delay-400"></div>
        <div className="absolute bottom-32 right-16 w-0.5 h-0.5 bg-white rounded-full opacity-80 animate-pulse animation-delay-900"></div>
        <div className="absolute bottom-40 left-1/4 w-px h-px bg-white rounded-full opacity-60 animate-pulse animation-delay-1400"></div>
        <div className="absolute bottom-48 right-1/3 w-1 h-1 bg-white rounded-full opacity-85 animate-pulse animation-delay-1900"></div>
        <div className="absolute bottom-56 left-1/2 w-0.5 h-0.5 bg-white rounded-full opacity-75 animate-pulse animation-delay-2400"></div>
        
        {/* Additional Stars for Denser Effect */}
        <div className="absolute top-5 left-1/5 w-0.5 h-0.5 bg-white rounded-full opacity-65 animate-pulse animation-delay-100"></div>
        <div className="absolute top-35 right-1/5 w-px h-px bg-white rounded-full opacity-45 animate-pulse animation-delay-600"></div>
        <div className="absolute top-55 left-3/4 w-1 h-1 bg-white rounded-full opacity-80 animate-pulse animation-delay-1100"></div>
        <div className="absolute top-75 right-2/3 w-0.5 h-0.5 bg-white rounded-full opacity-70 animate-pulse animation-delay-1600"></div>
        <div className="absolute bottom-15 left-2/3 w-px h-px bg-white rounded-full opacity-55 animate-pulse animation-delay-2100"></div>
        <div className="absolute bottom-35 right-3/4 w-0.5 h-0.5 bg-white rounded-full opacity-75 animate-pulse animation-delay-2600"></div>
        
        {/* Twinkling effect stars with colors */}
        <div className="absolute top-14 right-12 w-0.5 h-0.5 bg-blue-300 rounded-full opacity-40 animate-ping animation-delay-1000"></div>
        <div className="absolute top-38 left-12 w-0.5 h-0.5 bg-purple-400 rounded-full opacity-50 animate-ping animation-delay-2000"></div>
        <div className="absolute bottom-24 right-1/2 w-0.5 h-0.5 bg-cyan-300 rounded-full opacity-45 animate-ping animation-delay-500"></div>
        <div className="absolute top-80 left-1/6 w-0.5 h-0.5 bg-yellow-200 rounded-full opacity-35 animate-ping animation-delay-1500"></div>
        <div className="absolute bottom-60 right-1/6 w-0.5 h-0.5 bg-pink-300 rounded-full opacity-40 animate-ping animation-delay-2500"></div>
        
        {/* Shooting stars */}
        <div className="absolute top-8 left-0 w-16 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-70 animate-pulse rotate-12 animation-delay-3000"></div>
        <div className="absolute top-24 right-0 w-12 h-px bg-gradient-to-l from-transparent via-blue-300 to-transparent opacity-50 animate-pulse -rotate-12 animation-delay-5000"></div>
        <div className="absolute bottom-16 left-0 w-20 h-px bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-60 animate-pulse rotate-6 animation-delay-7000"></div>
      </div>
      
      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-black bg-opacity-20"></div>

      {/* Recent Chats Sidebar */}
      <RecentChatsSidebar />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative z-10">
        {/* Header */}
        <div className="bg-black/30 backdrop-blur-lg border-b border-white/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <WallEchoAvatar 
                emotion={avatarEmotion} 
                isAnimated={true} 
                size="lg"
                showSounds={true}
                currentSound={currentSound}
              />
              <div>
                <h1 className="text-xl font-bold text-white">
                  WALL-Echo {currentRoom && `• ${currentRoom.name}`}
                </h1>
                <p className="text-sm text-gray-300">
                  {selectedChat ? `Viewing: ${selectedChat.title}` : 
                   currentRoom ? `Collaborative room with ${roomParticipants.length} participants` :
                   'AI Assistant'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-white">Welcome, {formatUserName(user?.firstName)}!</span>
              <button
                onClick={onLogout}
                className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 p-4">
          {/* Collaboration Header */}
          <CollaborationHeader />

          {/* Messages Area */}
          <div className="h-[calc(100vh-160px)] bg-black/30 backdrop-blur-lg rounded-t-2xl border border-white/20 border-b-0 overflow-hidden">
            <div className="h-full overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 mt-12">
                  <div className="flex justify-center mb-4">
                    <WallEchoAvatar 
                      emotion="ready" 
                      isAnimated={false} 
                      size="xl"
                    />
                  </div>
                  <p>Ready to start a new conversation!</p>
                  <p>What would you like to talk about?</p>
                </div>
              )}
              
              {messages.map((message, index) => (
                <div key={index}>
                  {message.role === 'system' ? (
                    // System messages (user joined/left)
                    <div className="text-center">
                      <span className="text-xs text-gray-500 bg-gray-800/50 px-3 py-1 rounded-full">
                        {message.content}
                      </span>
                    </div>
                  ) : (
                    <div
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl px-4 py-3 rounded-2xl ${
                          message.role === 'user'
                            ? 'text-white rounded-br-sm border'
                            : 'bg-white/10 text-gray-100 rounded-bl-sm border border-white/20'
                        }`}
                        style={{
                          backgroundColor: message.role === 'user' ? `${message.userColor}40` : undefined,
                          borderColor: message.role === 'user' ? `${message.userColor}60` : undefined
                        }}
                      >
                        {message.role === 'assistant' && (
                          <div className="flex items-center space-x-2 mb-2">
                            <WallEchoAvatar 
                              emotion={getEmotionFromMessage(message.content)} 
                              isAnimated={false} 
                              size="sm"
                            />
                            <span className="text-xs text-gray-300 font-medium">WALL-Echo</span>
                          </div>
                        )}
                        
                        {message.role === 'user' && message.isRoomMessage && (
                          <div className="flex items-center space-x-2 mb-2">
                            <div
                              className="w-4 h-4 rounded-full border border-white/30"
                              style={{ backgroundColor: message.userColor }}
                            />
                            <span className="text-xs font-medium opacity-75">
                              {message.userName}
                            </span>
                          </div>
                        )}
                        
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <div className="text-xs opacity-70 mt-2">
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Typing indicators */}
              {typingUsers.length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-white/10 border border-white/20 rounded-2xl rounded-bl-sm px-4 py-2 max-w-xs">
                    <div className="text-xs text-gray-400 mb-1">
                      {typingUsers.map(u => u.userName).join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
                    </div>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce animation-delay-100"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce animation-delay-200"></div>
                    </div>
                  </div>
                </div>
              )}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/10 border border-white/20 rounded-2xl rounded-bl-sm px-4 py-3 max-w-xs">
                    <div className="flex items-center space-x-2 mb-2">
                      <WallEchoAvatar 
                        emotion="processing" 
                        isAnimated={true} 
                        size="sm"
                      />
                      <span className="text-xs text-gray-300 font-medium">WALL-Echo</span>
                    </div>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce animation-delay-100"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce animation-delay-200"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="bg-black/30 backdrop-blur-lg rounded-b-2xl border border-white/20 border-t-0 p-4">
            <div className="flex space-x-3">
              <textarea
                value={inputMessage}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder={currentRoom ? 
                  `Message ${currentRoom.name}...` : 
                  "Type your message to WALL-Echo..."
                }
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[50px] max-h-32"
                rows="1"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !inputMessage.trim()}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <span>{isLoading ? 'Sending...' : 'Send'}</span>
                <span className="text-lg">📡</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Room Manager Modal */}
      {showRoomManager && (
        <RoomManager 
          user={user}
          onRoomSelect={handleRoomSelect}
          onClose={() => setShowRoomManager(false)}
          currentRoom={currentRoom}
        />
      )}
    </div>
  );
};

const App = () => {
  //User authentication 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authData, setAuthData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: ''
  });
  const [authFeedback, setAuthFeedback] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
      setIsLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    setAuthFeedback({ type: '', message: '' });
  }, [authMode]);

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    if (!authData.email) {
      setAuthFeedback({ type: 'error', message: '📧 Email is required!' });
      return false;
    }
    
    if (!isValidEmail(authData.email)) {
      setAuthFeedback({ type: 'error', message: '📧 Please enter a valid email address (must contain @)!' });
      return false;
    }
    
    if (!authData.password) {
      setAuthFeedback({ type: 'error', message: '🔐 Password is required!' });
      return false;
    }
    
    if (authMode === 'signup') {
      if (!authData.firstName.trim()) {
        setAuthFeedback({ type: 'error', message: '👤 First name is required!' });
        return false;
      }
      if (!authData.lastName.trim()) {
        setAuthFeedback({ type: 'error', message: '👤 Last name is required!' });
        return false;
      }
    }
    
    return true;
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    setAuthFeedback({ type: '', message: '' });

    try {
      const endpoint = authMode === 'login' 
        ? 'http://localhost:4002/api/v1/user/login'
        : 'http://localhost:4002/api/v1/user/signup';
      
      const body = authMode === 'login' 
        ? { email: authData.email, password: authData.password }
        : authData;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok && data.user && data.token) {
        setUser(data.user);
        setIsLoggedIn(true);
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setAuthData({ email: '', password: '', firstName: '', lastName: '' });
        setAuthFeedback({ type: '', message: '' });
      } else {
        if (authMode === 'signup') {
          if (response.status === 409 || 
              (data.message && data.message.toLowerCase().includes('already exists'))) {
            setAuthFeedback({ 
              type: 'error', 
              message: '👤 User already exists! Please try logging in instead.' 
            });
            setTimeout(() => {
              setAuthMode('login');
              setAuthData(prev => ({ ...prev, firstName: '', lastName: '' }));
            }, 3000);
          } else if (response.status === 201 || 
              (data.message && data.message.toLowerCase().includes('created'))) {
            setAuthFeedback({ 
              type: 'success', 
              message: '🎉 Account created successfully! Please log in.' 
            });
            setAuthMode('login');
            setAuthData(prev => ({ ...prev, password: '', firstName: '', lastName: '' }));
          } else {
            setAuthFeedback({ 
              type: 'error', 
              message: data.errors || data.message || 'Signup failed. Please try again.' 
            });
          }
        } else {
          setAuthFeedback({ 
            type: 'error', 
            message: '🔐 Invalid credentials! Please check your email and password.' 
          });
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      setAuthFeedback({ 
        type: 'error', 
        message: '[bzzt] Connection hiccup! Try again? [beep]' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen relative bg-gradient-to-br from-gray-900 via-blue-900 to-black flex items-center justify-center p-4 overflow-hidden">
        {/* Animated Stars Background */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Large Stars */}
          <div className="absolute top-10 left-10 w-1 h-1 bg-white rounded-full opacity-80 animate-pulse"></div>
          <div className="absolute top-20 right-20 w-1 h-1 bg-white rounded-full opacity-60 animate-pulse animation-delay-500"></div>
          <div className="absolute top-32 left-1/4 w-1 h-1 bg-white rounded-full opacity-90 animate-pulse animation-delay-1000"></div>
          <div className="absolute top-40 right-1/3 w-1 h-1 bg-white rounded-full opacity-70 animate-pulse animation-delay-1500"></div>
          <div className="absolute top-52 left-1/2 w-1 h-1 bg-white rounded-full opacity-85 animate-pulse animation-delay-2000"></div>
          <div className="absolute top-60 right-10 w-1 h-1 bg-white rounded-full opacity-75 animate-pulse animation-delay-2500"></div>
          
          {/* Medium Stars */}
          <div className="absolute top-16 left-1/3 w-0.5 h-0.5 bg-white rounded-full opacity-60 animate-pulse animation-delay-200"></div>
          <div className="absolute top-24 right-1/4 w-0.5 h-0.5 bg-white rounded-full opacity-80 animate-pulse animation-delay-700"></div>
          <div className="absolute top-36 left-20 w-0.5 h-0.5 bg-white rounded-full opacity-70 animate-pulse animation-delay-1200"></div>
          <div className="absolute top-44 right-1/2 w-0.5 h-0.5 bg-white rounded-full opacity-65 animate-pulse animation-delay-1700"></div>
          <div className="absolute top-56 left-1/4 w-0.5 h-0.5 bg-white rounded-full opacity-85 animate-pulse animation-delay-2200"></div>
          <div className="absolute top-64 right-20 w-0.5 h-0.5 bg-white rounded-full opacity-75 animate-pulse animation-delay-2700"></div>
          
          {/* Small Stars */}
          <div className="absolute top-12 left-1/2 w-px h-px bg-white rounded-full opacity-50 animate-pulse animation-delay-300"></div>
          <div className="absolute top-28 right-1/3 w-px h-px bg-white rounded-full opacity-70 animate-pulse animation-delay-800"></div>
          <div className="absolute top-48 left-10 w-px h-px bg-white rounded-full opacity-60 animate-pulse animation-delay-1300"></div>
          <div className="absolute top-68 right-1/4 w-px h-px bg-white rounded-full opacity-80 animate-pulse animation-delay-1800"></div>
          <div className="absolute top-72 left-1/3 w-px h-px bg-white rounded-full opacity-55 animate-pulse animation-delay-2300"></div>
          
          {/* Bottom area stars */}
          <div className="absolute bottom-20 left-16 w-1 h-1 bg-white rounded-full opacity-70 animate-pulse animation-delay-400"></div>
          <div className="absolute bottom-32 right-16 w-0.5 h-0.5 bg-white rounded-full opacity-80 animate-pulse animation-delay-900"></div>
          <div className="absolute bottom-40 left-1/4 w-px h-px bg-white rounded-full opacity-60 animate-pulse animation-delay-1400"></div>
          <div className="absolute bottom-48 right-1/3 w-1 h-1 bg-white rounded-full opacity-85 animate-pulse animation-delay-1900"></div>
          <div className="absolute bottom-56 left-1/2 w-0.5 h-0.5 bg-white rounded-full opacity-75 animate-pulse animation-delay-2400"></div>
          
          {/* Additional Stars for Denser Effect */}
          <div className="absolute top-5 left-1/5 w-0.5 h-0.5 bg-white rounded-full opacity-65 animate-pulse animation-delay-100"></div>
          <div className="absolute top-35 right-1/5 w-px h-px bg-white rounded-full opacity-45 animate-pulse animation-delay-600"></div>
          <div className="absolute top-55 left-3/4 w-1 h-1 bg-white rounded-full opacity-80 animate-pulse animation-delay-1100"></div>
          <div className="absolute top-75 right-2/3 w-0.5 h-0.5 bg-white rounded-full opacity-70 animate-pulse animation-delay-1600"></div>
          <div className="absolute bottom-15 left-2/3 w-px h-px bg-white rounded-full opacity-55 animate-pulse animation-delay-2100"></div>
          <div className="absolute bottom-35 right-3/4 w-0.5 h-0.5 bg-white rounded-full opacity-75 animate-pulse animation-delay-2600"></div>
          
          {/* Twinkling effect stars with colors */}
          <div className="absolute top-14 right-12 w-0.5 h-0.5 bg-blue-300 rounded-full opacity-40 animate-ping animation-delay-1000"></div>
          <div className="absolute top-38 left-12 w-0.5 h-0.5 bg-purple-400 rounded-full opacity-50 animate-ping animation-delay-2000"></div>
          <div className="absolute bottom-24 right-1/2 w-0.5 h-0.5 bg-cyan-300 rounded-full opacity-45 animate-ping animation-delay-500"></div>
          <div className="absolute top-80 left-1/6 w-0.5 h-0.5 bg-yellow-200 rounded-full opacity-35 animate-ping animation-delay-1500"></div>
          <div className="absolute bottom-60 right-1/6 w-0.5 h-0.5 bg-pink-300 rounded-full opacity-40 animate-ping animation-delay-2500"></div>
          
          {/* Shooting stars */}
          <div className="absolute top-8 left-0 w-16 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-70 animate-pulse rotate-12 animation-delay-3000"></div>
          <div className="absolute top-24 right-0 w-12 h-px bg-gradient-to-l from-transparent via-blue-300 to-transparent opacity-50 animate-pulse -rotate-12 animation-delay-5000"></div>
          <div className="absolute bottom-16 left-0 w-20 h-px bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-60 animate-pulse rotate-6 animation-delay-7000"></div>
        </div>
        
        <div className="absolute inset-0 bg-black bg-opacity-20"></div>
        <div className="relative z-10 bg-black/30 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/30 shadow-2xl"
             style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 255, 255, 0.1)'}}>
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <WallEchoAvatar 
                emotion={authFeedback.type === 'success' ? 'excited' : authFeedback.type === 'error' ? 'concerned' : 'ready'} 
                isAnimated={true} 
                size="xl"
                showSounds={false}
              />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">WALL-Echo</h1>
            <p className="text-gray-300">Your AI Companion✨ </p>
            <p className="text-blue-200">Collaboration unlocked — start a Room with your crew. </p>
          </div>

          <div className="space-y-4">
            <div className="flex bg-white/5 rounded-lg p-1">
              <button
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 px-4 rounded-md transition-all ${
                  authMode === 'login' 
                    ? 'bg-blue-500 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setAuthMode('signup')}
                className={`flex-1 py-2 px-4 rounded-md transition-all ${
                  authMode === 'signup' 
                    ? 'bg-blue-500 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>

            <div className="space-y-4">
              {authFeedback.message && (
                <div className={`p-4 rounded-xl border text-sm font-medium transition-all duration-300 ${
                  authFeedback.type === 'success' 
                    ? 'bg-green-500/20 border-green-500/50 text-green-300' 
                    : 'bg-red-500/20 border-red-500/50 text-red-300'
                }`}>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">
                      {authFeedback.type === 'success' ? '🎉' : '⚠️'}
                    </span>
                    <span>{authFeedback.message}</span>
                  </div>
                </div>
              )}

              {authMode === 'signup' && (
                <>
                  <input
                    type="text"
                    placeholder="First Name"
                    value={authData.firstName}
                    onChange={(e) => setAuthData(prev => ({...prev, firstName: e.target.value}))}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={authData.lastName}
                    onChange={(e) => setAuthData(prev => ({...prev, lastName: e.target.value}))}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </>
              )}
              
              <div className="relative">
                <input
                  type="email"
                  placeholder="Email "
                  value={authData.email}
                  onChange={(e) => setAuthData(prev => ({...prev, email: e.target.value}))}
                  className={`w-full px-4 py-3 bg-white/10 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
                    authData.email && !isValidEmail(authData.email) 
                      ? 'border-red-500/50 focus:ring-red-500' 
                      : 'border-white/20 focus:ring-blue-500'
                  }`}
                />
                {authData.email && !isValidEmail(authData.email) && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <span className="text-red-400 text-sm">❌</span>
                  </div>
                )}
                {authData.email && isValidEmail(authData.email) && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <span className="text-green-400 text-sm">✅</span>
                  </div>
                )}
              </div>
              
              <input
                type="password"
                placeholder="Password"
                value={authData.password}
                onChange={(e) => setAuthData(prev => ({...prev, password: e.target.value}))}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              <button
                onClick={handleAuth}
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? 'Processing... [whirr]' : (authMode === 'login' ? 'Sign In' : 'Sign Up')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <ChatInterface user={user} onLogout={handleLogout} />;
};

export default App;