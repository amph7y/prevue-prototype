import { auth } from '../config/firebase.js';
import { logApi } from './logApi.js';
const ADMIN_API_BASE_URL = import.meta.env.VITE_ADMIN_FB_URL ;

// Helper function to get auth token
const getAuthToken = async () => {
  if (!auth.currentUser) {
    throw new Error('User not authenticated');
  }
  return await auth.currentUser.getIdToken();
};

// Helper function to make authenticated requests
const makeAuthenticatedRequest = async (endpoint, options = {}) => {
  const token = await getAuthToken();
  
  const response = await fetch(`${ADMIN_API_BASE_URL}/${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
};

// Admin API functions
export const adminApi = {
  // Get all users
  getUsers: async () => {
    return makeAuthenticatedRequest('getUsers', {
      method: 'GET',
    });
  },

  // Create new user
  createUser: async (userData) => {
    return makeAuthenticatedRequest('createUser', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  // Update user access level
  updateUserAccess: async (userId, accessData) => {
    return makeAuthenticatedRequest('updateUserAccess', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        ...accessData,
      }),
    });
  },

  // Delete user
  deleteUser: async (userId) => {
    return makeAuthenticatedRequest('deleteUser', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  // Backfill Firestore users schema for existing Auth users
  backfillUsersSchema: async () => {
    return makeAuthenticatedRequest('backfillUsersSchema', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  // Activity Logs Management
  getActivityLogs: async (options = {}) => {
    return logApi.getActivityLogs(options);
  },

  getBusiestHours: async (options = {}) => {
    return logApi.getBusiestHours(options);
  },

  getBusiestDays: async (options = {}) => {
    return logApi.getBusiestDays(options);
  },

  getActivitySummary: async (options = {}) => {
    return logApi.getActivitySummary(options);
  },

  getUserActivitySummary: async (userId, options = {}) => {
    return logApi.getUserActivitySummary(userId, options);
  },

  getRealTimeActivity: async (options = {}) => {
    return logApi.getRealTimeActivity(options);
  },
};

export default adminApi;

