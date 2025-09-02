import { useState, useEffect } from 'react';

const RoomManager = ({ user, onRoomSelect, onClose, currentRoom }) => {
  const [activeTab, setActiveTab] = useState('join');
  const [roomName, setRoomName] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [userRooms, setUserRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Load user's existing rooms
  useEffect(() => {
    loadUserRooms();
  }, []);

  const loadUserRooms = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/room/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserRooms(data.rooms || []);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
    }
  };

  // Create new room
  const createRoom = async () => {
    if (!roomName.trim()) {
      setFeedback({ type: 'error', message: 'Room name is required' });
      return;
    }

    setIsLoading(true);
    setFeedback({ type: '', message: '' });

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/room/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: roomName.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        setFeedback({ 
          type: 'success', 
          message: `Room "${roomName}" created! Room ID: ${data.room.id}` 
        });
        setRoomName('');
        loadUserRooms();
        
        // Auto-join the newly created room
        setTimeout(() => {
          onRoomSelect(data.room);
          onClose();
        }, 1500);
      } else {
        setFeedback({ 
          type: 'error', 
          message: data.message || 'Failed to create room' 
        });
      }
    } catch (error) {
      console.error('Error creating room:', error);
      setFeedback({ 
        type: 'error', 
        message: 'Connection error. Please try again.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Join existing room
  const joinRoom = async () => {
    if (!joinRoomId.trim()) {
      setFeedback({ type: 'error', message: 'Room ID is required' });
      return;
    }

    setIsLoading(true);
    setFeedback({ type: '', message: '' });

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/room/join/${joinRoomId.trim()}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        setFeedback({ 
          type: 'success', 
          message: `Joined "${data.room.name}" successfully!` 
        });
        setJoinRoomId('');
        loadUserRooms();
        
        // Auto-select the joined room
        setTimeout(() => {
          onRoomSelect(data.room);
          onClose();
        }, 1500);
      } else {
        setFeedback({ 
          type: 'error', 
          message: data.message || 'Failed to join room' 
        });
      }
    } catch (error) {
      console.error('Error joining room:', error);
      setFeedback({ 
        type: 'error', 
        message: 'Connection error. Please try again.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Select existing room
  const selectRoom = (room) => {
    onRoomSelect(room);
    onClose();
  };

  // Leave room
  const leaveRoom = async (roomId) => {
    if (!window.confirm('Are you sure you want to leave this room?')) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/room/${roomId}/leave`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        loadUserRooms();
        setFeedback({ type: 'success', message: 'Left room successfully' });
      } else {
        const data = await response.json();
        setFeedback({ type: 'error', message: data.message || 'Failed to leave room' });
      }
    } catch (error) {
      console.error('Error leaving room:', error);
      setFeedback({ type: 'error', message: 'Connection error' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-white/20 rounded-xl p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Shared Rooms</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-white/5 rounded-lg p-1 mb-6">
          <button
            onClick={() => setActiveTab('join')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === 'join'
                ? 'bg-blue-500 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Join Room
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === 'create'
                ? 'bg-blue-500 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Create Room
          </button>
          <button
            onClick={() => setActiveTab('my-rooms')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === 'my-rooms'
                ? 'bg-blue-500 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            My Rooms
          </button>
        </div>

        {/* Feedback Messages */}
        {feedback.message && (
          <div className={`p-3 rounded-lg border text-sm mb-4 ${
            feedback.type === 'success'
              ? 'bg-green-500/20 border-green-500/50 text-green-300'
              : 'bg-red-500/20 border-red-500/50 text-red-300'
          }`}>
            {feedback.message}
          </div>
        )}

        {/* Join Room Tab */}
        {activeTab === 'join' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Room ID
              </label>
              <input
                type="text"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                placeholder="Enter room ID to join"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>
            <button
              onClick={joinRoom}
              disabled={isLoading || !joinRoomId.trim()}
              className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        )}

        {/* Create Room Tab */}
        {activeTab === 'create' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Room Name
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Enter room name"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>
            <button
              onClick={createRoom}
              disabled={isLoading || !roomName.trim()}
              className="w-full py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        )}

        {/* My Rooms Tab */}
        {activeTab === 'my-rooms' && (
          <div className="space-y-3">
            {userRooms.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <div className="text-4xl mb-2">👥</div>
                <p className="text-sm">No rooms yet!</p>
                <p className="text-xs">Create or join a room to get started</p>
              </div>
            ) : (
              userRooms.map(room => (
                <div
                  key={room.id}
                  className={`p-4 rounded-lg border transition-all ${
                    currentRoom?.id === room.id
                      ? 'bg-blue-500/20 border-blue-400/50'
                      : 'bg-white/5 border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-white font-medium">{room.name}</h3>
                      <p className="text-xs text-gray-400">
                        ID: {room.id} • {room.participantCount} participants
                        {room.isOwner && ' • Owner'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => selectRoom(room)}
                        className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded text-xs hover:bg-blue-500/30 transition-colors"
                      >
                        {currentRoom?.id === room.id ? 'Current' : 'Select'}
                      </button>
                      <button
                        onClick={() => leaveRoom(room.id)}
                        className="px-3 py-1 bg-red-500/20 text-red-300 rounded text-xs hover:bg-red-500/30 transition-colors"
                      >
                        Leave
                      </button>
                    </div>
                  </div>
                  
                  {/* Participant Colors */}
                  <div className="flex items-center space-x-1">
                    {room.participants.slice(0, 8).map((participant, index) => (
                      <div
                        key={index}
                        className="w-4 h-4 rounded-full border border-white/20"
                        style={{ backgroundColor: participant.color }}
                        title={participant.name}
                      />
                    ))}
                    {room.participants.length > 8 && (
                      <span className="text-xs text-gray-400 ml-2">
                        +{room.participants.length - 8} more
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomManager;
