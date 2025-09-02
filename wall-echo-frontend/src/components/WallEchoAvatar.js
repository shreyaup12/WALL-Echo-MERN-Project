import React from 'react';

// Sparkles icon component (simple SVG)
const Sparkles = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0V6H3a1 1 0 110-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 8.134a1 1 0 010 1.732L14.146 10.8l-1.179 4.456a1 1 0 01-1.934 0L9.854 10.8 6.5 9.866a1 1 0 010-1.732L9.854 7.2l1.179-4.456A1 1 0 0112 2z" clipRule="evenodd" />
  </svg>
);

const WallEchoAvatar = ({ 
  emotion = 'default', 
  isAnimated = false, 
  size = 'md',
  showSounds = false,
  currentSound = ''
}) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10', 
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const innerSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10', 
    xl: 'w-12 h-12'
  };

  const eyeSizes = {
    sm: 'w-1 h-1',
    md: 'w-1.5 h-1.5',
    lg: 'w-2 h-2',
    xl: 'w-2.5 h-2.5'
  };

  const getEyeColor = (emotion) => {
    switch(emotion) {
      case 'ready': return 'bg-green-400';
      case 'processing': return 'bg-blue-400 animate-pulse';
      case 'helpful': return 'bg-cyan-400';
      case 'inspired': return 'bg-purple-400';
      case 'concerned': return 'bg-red-400';
      case 'loading': return 'bg-yellow-400 animate-bounce';
      case 'thinking': return 'bg-orange-400 animate-pulse';
      case 'happy': return 'bg-green-300';
      case 'excited': return 'bg-pink-400 animate-ping';
      default: return 'bg-yellow-400';
    }
  };

  const getBodyAnimation = (emotion) => {
    if (isAnimated) {
      switch(emotion) {
        case 'processing': return 'animate-pulse';
        case 'excited': return 'animate-bounce';
        case 'thinking': return 'animate-pulse';
        case 'loading': return 'animate-spin';
        default: return 'animate-pulse';
      }
    }
    return '';
  };

  return (
    <div className={`relative ${sizes[size]} ${getBodyAnimation(emotion)}`}>
      {/* Outer Robot Body */}
      <div className={`${sizes[size]} bg-gradient-to-br from-orange-500 via-yellow-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg border-2 border-gray-700 transition-all duration-300`}>
        
        {/* Inner Robot Face/Screen */}
        <div className={`${innerSizes[size]} bg-gradient-to-br from-gray-800 to-black rounded-md flex items-center justify-center relative`}>
          
          {/* Robot Eyes */}
          <div className="flex space-x-1">
            <div className={`${eyeSizes[size]} rounded-full transition-colors duration-300 ${getEyeColor(emotion)}`}></div>
            <div className={`${eyeSizes[size]} rounded-full transition-colors duration-300 ${getEyeColor(emotion)}`}></div>
          </div>
          
          {/* Special Effect for "Inspired" State */}
          {emotion === 'inspired' && (
            <div className="absolute -top-0.5 -right-0.5">
              <Sparkles className="w-2 h-2 text-purple-400 animate-spin" />
            </div>
          )}

          {/* Processing indicator */}
          {emotion === 'processing' && (
            <div className="absolute inset-0 rounded-md border border-blue-400 animate-ping"></div>
          )}

          {/* Happy mouth indicator */}
          {emotion === 'happy' && (
            <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2">
              <div className="w-2 h-0.5 bg-green-300 rounded-full"></div>
            </div>
          )}
        </div>

        {/* Robot antenna/details */}
        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
          <div className="w-0.5 h-1 bg-gray-600"></div>
          <div className="w-1 h-1 bg-red-400 rounded-full"></div>
        </div>
      </div>

      {/* Sound indicator */}
      {showSounds && currentSound && (
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
          <div className="bg-gray-800 text-yellow-400 text-xs px-2 py-1 rounded-full border border-gray-600">
            {currentSound}
          </div>
        </div>
      )}

      {/* Glow effect for special emotions */}
      {(emotion === 'inspired' || emotion === 'excited') && (
        <div className={`absolute inset-0 ${sizes[size]} bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg opacity-30 blur-sm -z-10 animate-pulse`}></div>
      )}
    </div>
  );
};

export default WallEchoAvatar;