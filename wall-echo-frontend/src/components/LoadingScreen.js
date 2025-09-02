const LoadingScreen = () => {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0B1E3F' }}>
      <div className="text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto animate-pulse" style={{ backgroundColor: '#FFD447' }}>
          <span className="text-3xl">🤖</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">WALL-Echo</h2>
        <p className="text-gray-400">[whirr] Starting up...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;