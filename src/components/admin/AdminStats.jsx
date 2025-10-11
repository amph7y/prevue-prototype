import React from 'react';
import { formatFirestoreTimestamp } from '../../utils/dateUtils.js';

const AdminStats = ({ users }) => {
  const toDateSafe = (timestamp) => {
    if (!timestamp) return null;

    if (typeof timestamp.toDate === 'function') {
      try {
        return timestamp.toDate();
      } catch {
        return null;
      }
    }

    if (typeof timestamp._seconds === 'number') {
      return new Date(timestamp._seconds * 1000);
    }

    if (timestamp instanceof Date) return timestamp;

    if (typeof timestamp === 'string') {
      const parsed = new Date(timestamp);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  };

  // Calculate statistics
  const totalUsers = users.length;
  const premiumUsers = users.filter(user => user.accessLevel === 'premium').length;
  const freeUsers = users.filter(user => user.accessLevel === 'free').length;
  const adminUsers = users.filter(user => user.role === 'admin').length;
  const activeUsers = users.filter(user => user.isActive !== false).length;
  const inactiveUsers = users.filter(user => user.isActive === false).length;

  // Calculate conversion rate
  const conversionRate = totalUsers > 0 ? ((premiumUsers / totalUsers) * 100).toFixed(1) : 0;

  // Get recent users (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentUsers = users.filter(user => {
    const createdDate = toDateSafe(user.createdAt);
    return createdDate && createdDate >= thirtyDaysAgo;
  }).length;


  // Get users by month (last 6 months)
  const getUsersByMonth = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().slice(0, 7); // e.g. "2025-10"

      const monthUsers = users.filter(user => {
        const createdDate = toDateSafe(user.createdAt);
        if (!createdDate) return false;
        return createdDate.toISOString().slice(0, 7) === monthKey;
      }).length;

      months.push({
        month: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        users: monthUsers,
      });
    }
    return months;
  };

  const monthlyData = getUsersByMonth();
  const maxUsers = Math.max(...monthlyData.map(m => m.users), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">System Statistics</h2>
        <p className="text-gray-600">Overview of user activity and system metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-3xl font-bold text-gray-900">{totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Premium Users</p>
              <p className="text-3xl font-bold text-gray-900">{premiumUsers}</p>
              <p className="text-xs text-gray-500">{conversionRate}% conversion</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Recent Users</p>
              <p className="text-3xl font-bold text-gray-900">{recentUsers}</p>
              <p className="text-xs text-gray-500">Last 30 days</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-3xl font-bold text-gray-900">{activeUsers}</p>
              <p className="text-xs text-gray-500">{inactiveUsers} inactive</p>
            </div>
          </div>
        </div>
      </div>

      {/* User Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Access Level Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Access Level Distribution</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Premium</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-gray-900">{premiumUsers}</span>
                <span className="text-xs text-gray-500 ml-2">({conversionRate}%)</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full" 
                style={{ width: `${conversionRate}%` }}
              ></div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-400 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Free</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-gray-900">{freeUsers}</span>
                <span className="text-xs text-gray-500 ml-2">({(100 - conversionRate).toFixed(1)}%)</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gray-400 h-2 rounded-full" 
                style={{ width: `${100 - conversionRate}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Role Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Role Distribution</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Users</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-gray-900">{totalUsers - adminUsers}</span>
                <span className="text-xs text-gray-500 ml-2">
                  ({totalUsers > 0 ? (((totalUsers - adminUsers) / totalUsers) * 100).toFixed(1) : 0}%)
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full" 
                style={{ 
                  width: `${totalUsers > 0 ? (((totalUsers - adminUsers) / totalUsers) * 100) : 0}%` 
                }}
              ></div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Admins</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-gray-900">{adminUsers}</span>
                <span className="text-xs text-gray-500 ml-2">
                  ({totalUsers > 0 ? ((adminUsers / totalUsers) * 100).toFixed(1) : 0}%)
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-500 h-2 rounded-full" 
                style={{ 
                  width: `${totalUsers > 0 ? ((adminUsers / totalUsers) * 100) : 0}%` 
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Growth Chart */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-medium text-gray-900 mb-4">User Growth (Last 6 Months)</h3>
        <div className="space-y-4">
          {monthlyData.map((month, index) => (
            <div key={index} className="flex items-center">
              <div className="w-20 text-sm text-gray-600">{month.month}</div>
              <div className="flex-1 mx-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-blue-500 h-3 rounded-full transition-all duration-300" 
                    style={{ width: `${(month.users / maxUsers) * 100}%` }}
                  ></div>
                </div>
              </div>
              <div className="w-12 text-sm font-medium text-gray-900 text-right">
                {month.users}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminStats;

