import React, { useState, useEffect, useRef } from 'react';

const WallEchoChat = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authData, setAuthData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/verify', {
        credentials: 'include',
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
      }
    } catch (error) {
      console.log('User not authenticated');
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(authData),
      });

      const data = await response.json();
      
      if (response.ok) {
        setUser(data.user);
        setAuthData({ email: '', password: '', name: '' });
        
        // Load existing chat history
        loadChatHistory();
      } else {
        alert(data.message || 'Authentication failed');
      }
    } catch (error) {
      console.error('Auth error:', error);
      alert('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadChatHistory = async () => {
    try {
      const response = await fetch('/api/prompt/all', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        const formattedMessages = data.prompts.map(prompt => ({
          id: prompt._id,
          text: prompt.content,
          sender: prompt.role === 'user' ? 'user' : 'ai',
          timestamp: new Date(prompt.createdAt)
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    const messageToSend = inputMessage;
    setInputMessage('');

    try {
      const response = await fetch('/api/prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content: messageToSend,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        const aiMessage = {
          id: Date.now() + 1,
          text: data.aiResponse,
          sender: 'ai',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        // Even if backend returns an error, try to extract any AI response
        if (data.aiResponse) {
          const aiMessage = {
            id: Date.now() + 1,
            text: data.aiResponse,
            sender: 'ai',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, aiMessage]);
        } else {
          throw new Error(data.message || 'Failed to send message');
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      //  WALL-Echo error messages
      const errorResponses = [
        '[confused beep] Oops! My circuits got tangled. Let me try to reconnect... [whirr]',
        '[apologetic boop] Something went sideways in my systems! [diagnostic beep]',
        '[patient whirr] My connection hiccupped! Give me a moment to recalibrate... [hopeful ding]',
        '[gentle malfunction sound] Whoops! My wires got crossed. Trying again? [encouraging beep]'
      ];
      
      const randomError = errorResponses[Math.floor(Math.random() * errorResponses.length)];
      
      const errorMessage = {
        id: Date.now() + 1,
        text: randomError,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
      setMessages([]);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20 shadow-2xl">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🤖</div>
            <h1 className="text-3xl font-bold text-white mb-2">WALL-Echo</h1>
            <p className="text-gray-300">Your AI Collection Assistant</p>
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
              {authMode === 'signup' && (
                <input
                  type="text"
                  placeholder="Full Name"
                  value={authData.name}
                  onChange={(e) => setAuthData(prev => ({...prev, name: e.target.value}))}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}
              
              <input
                type="email"
                placeholder="Email"
                value={authData.email}
                onChange={(e) => setAuthData(prev => ({...prev, email: e.target.value}))}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
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
                {isLoading ? 'Processing...' : (authMode === 'login' ? 'Login' : 'Sign Up')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-3xl">🤖</div>
            <div>
              <h1 className="text-xl font-bold text-white">WALL-Echo</h1>
              <p className="text-sm text-gray-300">AI Collection Assistant</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-white">Welcome, {user.name}!</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="max-w-4xl mx-auto p-4 h-[calc(100vh-80px)] flex flex-col">
        {/* Messages Area */}
        <div className="flex-1 bg-white/5 backdrop-blur-lg rounded-t-2xl border border-white/20 border-b-0 overflow-hidden">
          <div className="h-full overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 mt-12">
                <div className="text-4xl mb-4">💫</div>
                <p>Your WALL-Echo Collection is empty.</p>
                <p>Start a conversation to begin!</p>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl px-4 py-3 rounded-2xl ${
                    message.sender === 'user'
                      ? 'bg-blue-500 text-white rounded-br-sm'
                      : 'bg-white/10 text-gray-100 rounded-bl-sm border border-white/20'
                  }`}
                >
                  {message.sender === 'ai' && (
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-yellow-400">🤖</span>
                      <span className="text-xs text-gray-300 font-medium">WALL-Echo</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  <div className="text-xs opacity-70 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/10 border border-white/20 rounded-2xl rounded-bl-sm px-4 py-3 max-w-xs">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-yellow-400">🤖</span>
                    <span className="text-xs text-gray-300 font-medium">WALL-Echo</span>
                  </div>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white/10 backdrop-blur-lg rounded-b-2xl border border-white/20 border-t-0 p-4">
          <div className="flex space-x-3">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message to WALL-Echo..."
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
  );
};

export default WallEchoChat;