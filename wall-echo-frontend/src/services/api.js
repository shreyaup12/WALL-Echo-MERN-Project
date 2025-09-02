const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4001/api/v1';

export const authAPI = {
  login: async (credentials) => {
    const response = await fetch(`${API_BASE_URL}/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors || 'Login failed');
    }
    
    return response.json();
  },

  signup: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/user/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors || 'Signup failed');
    }
    
    return response.json();
  }
};

export const chatAPI = {
  sendMessage: async (content) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/ai/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ content }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }
    
    return response.json();
  }
};