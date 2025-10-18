import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import adminApi from '../../api/adminApi.js';
import UserManagement from './UserManagement.jsx';
import AdminStats from './AdminStats.jsx';
import Spinner from '../common/Spinner.jsx';
import toast from 'react-hot-toast';
import Header from '../common/Header.jsx';
import logger from '../../utils/logger.js';

const AdminDashboard = ({ onBackToLanding,onGoToAdmin }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getUsers();
      setUsers(response.users || []);
      setError(null);
      
      // Log admin stats view
      //await logger.logAdminStatsView(user?.uid, 'user_management');
    } catch (error) {
      console.error('Error loading users:', error);
      setError(error.message);
      toast.error('Failed to load users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUserUpdate = async (userId, updateData) => {
    try {
      await adminApi.updateUserAccess(userId, updateData);
      
      // Log admin user update
      const existing = users.find(u => u.id === userId) || {};
      const changedOnly = Object.keys(updateData || {}).reduce((acc, key) => {
        const newVal = updateData[key];
        if (typeof newVal !== 'undefined' && existing[key] !== newVal) {
          acc[key] = newVal;
        }
        return acc;
      }, {});
      if (Object.keys(changedOnly).length > 0) {
        await logger.logAdminUserUpdate(user?.uid, userId, changedOnly);
      }
      
      toast.success('User updated successfully');
      loadUsers(); 
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user: ' + error.message);
    }
  };

  const handleUserCreate = async (userData) => {
    try {
      const response = await adminApi.createUser(userData);
      
      // Log admin user creation
      await logger.logAdminUserCreate(user?.uid, response?.user?.id || 'unknown', userData);
      
      const message = response?.message || 'User created successfully';
      toast.success(message);
      loadUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user: ' + error.message);
    }
  };

  const handleUserDelete = async (userId) => {
    try {
      // Get user data before deletion for logging
      const userToDelete = users.find(u => u.id === userId);
      
      await adminApi.deleteUser(userId);
      
      // Log admin user deletion
      await logger.logAdminUserDelete(user?.uid, userId, userToDelete || {});
      
      toast.success('User deleted successfully');
      loadUsers(); 
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <Spinner />
        <span className="ml-2">Loading admin dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={onBackToLanding}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header 
                      subtitle="Admin Dashboard" 
                      onBackButtonClicked={onBackToLanding} 
                      backButtonText="Back to Home" 
                      onLogoClick={onBackToLanding}
                      onGoToAdmin={onGoToAdmin}
                  />
                  

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              User Management
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'stats'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Statistics
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'users' && (
          <UserManagement
            users={users}
            onUserUpdate={handleUserUpdate}
            onUserCreate={handleUserCreate}
            onUserDelete={handleUserDelete}
            onRefresh={loadUsers}
          />
        )}
        {activeTab === 'stats' && <AdminStats users={users} />}
      </div>
    </div>
  );
};

export default AdminDashboard;