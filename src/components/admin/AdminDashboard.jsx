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
  const [signups, setSignups] = useState([]);
  const [showClearModal, setShowClearModal] = useState(false);
  const [backfillInfo, setBackfillInfo] = useState(null);


  useEffect(() => {
    loadUsers();
    const saved = JSON.parse(localStorage.getItem('joinListSignups') || '[]');
    setSignups(saved);
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

  const handleBackfillUsersSchema = async () => {
    try {
      const result = await adminApi.backfillUsersSchema();
      setBackfillInfo(result);
      if ((result.created || 0) > 0 || (result.updated || 0) > 0) {
        toast.success(`Backfill complete: created ${result.created || 0}, updated ${result.updated || 0}`);
      } else if ((result.errors || 0) > 0) {
        toast.error(`Backfill had ${result.errors} errors. See details below.`);
      } else {
        toast("No changes were needed.");
      }
      loadUsers();
    } catch (error) {
      console.error('Error backfilling users schema:', error);
      toast.error('Failed to backfill users: ' + error.message);
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
            <button
              onClick={() => setActiveTab('signups')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'signups'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Join List Signups
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
            onBackfillSchema={handleBackfillUsersSchema}
          />
        )}
        {activeTab === 'stats' && <AdminStats users={users} />}
        {activeTab === 'signups' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-lg font-semibold text-gray-900">Join the List Signups</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    try {
                      const raw = localStorage.getItem('joinListSignups') || '[]';
                      const data = JSON.parse(raw);
                      const headers = ['Name','Email','Phone','Notify','SubmittedAt'];
                      const rows = data.map(item => [
                        item.name || '',
                        item.email || '',
                        item.phone || '',
                        item.notify ? 'Yes' : 'No',
                        item.submittedAt || ''
                      ]);
                      const csv = [headers, ...rows]
                        .map(r => r
                          .map(field => {
                            const v = String(field ?? '');
                            const needsQuote = /[",\n]/.test(v);
                            return needsQuote ? '"' + v.replace(/"/g, '""') + '"' : v;
                          })
                          .join(','))
                        .join('\n');
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'prevue_join_list.csv';
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (e) {
                      console.error('Export failed', e);
                      toast.error('Failed to export signups.');
                    }
                  }}
                  className="rounded-md bg-main px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-main-dark"
                >
                  Download Signups (CSV)
                </button>

                {/* Clear Button */}
                <button
                  onClick={() => setShowClearModal(true)}
                  className="rounded-md bg-gray-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500"
                >
                  Clear Signups
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notify</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {signups.length > 0 ? (
                    signups.map((r, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm text-gray-900">{r.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{r.email}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{r.phone}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{r.notify ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{r.submittedAt}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center py-6 text-gray-500 text-sm">
                        No signups found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Clear Confirmation Modal */}
            {showClearModal && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Clear All Signups</h4>
                  <p className="text-sm text-gray-600 mb-5">
                    Are you sure you want to clear all collected signups? This action cannot be undone.
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowClearModal(false)}
                      className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        try {
                          localStorage.removeItem('joinListSignups');
                          setSignups([]);
                          setShowClearModal(false);
                          toast.success('All signups cleared successfully');
                        } catch (e) {
                          console.error('Clear failed', e);
                          toast.error('Failed to clear signups.');
                        }
                      }}
                      className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;