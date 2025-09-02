import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

const Login = ({ onSwitchToSignup }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await authAPI.login(formData);
      
      if (response.data.user && response.data.token) {
        login(response.data.user, response.data.token);
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.response?.data?.errors || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0B1E3F' }}>
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#FFD447' }}>
            <span className="text-2xl">🤖</span>
          </div>
          <h2 className="text-3xl font-bold text-white">Welcome to WALL-Echo</h2>
          <p className="mt-2 text-gray-400">Sign in to continue your conversations</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="p-3 rounded-lg bg-red-600 bg-opacity-20 border border-red-500 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <input
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              placeholder="Email address"
              disabled={isLoading}
              style={{ backgroundColor: '#374151', borderColor: '#4B5563' }}
            />
            
            <input
              name="password"
              type="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              placeholder="Password"
              disabled={isLoading}
              style={{ backgroundColor: '#374151', borderColor: '#4B5563' }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 disabled:opacity-50"
            style={{ 
              backgroundColor: '#FFD447', 
              color: '#2E2E2E'
            }}
          >
            {isLoading ? 'Signing in... [whirr]' : 'Sign In'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="text-yellow-400 hover:text-yellow-300 text-sm transition-colors"
            >
              Don't have an account? Sign up here
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;