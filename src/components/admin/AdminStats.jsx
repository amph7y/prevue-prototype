import React, { useState, useEffect } from 'react';
import { formatFirestoreTimestamp } from '../../utils/dateUtils.js';
import { adminApi } from '../../api/adminApi.js';
import { logApi } from '../../api/logApi.js';
import logger from '../../utils/logger.js';

const AdminStats = ({ users }) => {
  const [busiestHours, setBusiestHours] = useState([]);
  const [busiestDays, setBusiestDays] = useState([]);
  const [activitySummary, setActivitySummary] = useState([]);
  const [keyActivities, setKeyActivities] = useState(null);
  const formatHourLabel = (hour24) => {
    const h = Number(hour24);
    const hour = (h % 12) === 0 ? 12 : (h % 12);
    const suffix = h < 12 ? 'AM' : 'PM';
    return `${hour}:00 ${suffix}`;
  };
  const formatIntervalLabel = (hhmm) => {
    // expects 'HH:MM'
    const [hh, mm] = (hhmm || '').split(':');
    const h = Number(hh);
    const hour = (h % 12) === 0 ? 12 : (h % 12);
    const suffix = h < 12 ? 'AM' : 'PM';
    return `${hour}:${mm} ${suffix}`;
  };
  const [realTimeActivity, setRealTimeActivity] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // Load activity data
  useEffect(() => {
    const loadActivityData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [hoursData, daysData, summaryData, realTimeData] = await Promise.all([
          adminApi.getBusiestHours({ days: 30 }),
          adminApi.getBusiestDays({ weeks: 4 }),
          adminApi.getActivitySummary({ days: 30 }),
          adminApi.getRealTimeActivity()
        ]);

        setBusiestHours(hoursData.busiestHours || []);
        setBusiestDays(daysData.busiestDays || []);
        setActivitySummary(summaryData.summary || []);
        setRealTimeActivity(realTimeData || {});
        // Build precise Key Activities from raw logs (to use featureName details)
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        const logsResp = await logApi.getActivityLogsByDateRange(start, end, { limitCount: 10000 });
        const logs = logsResp.logs || [];
        const isAdminAction = (action) => action && action.startsWith('admin_');
        const isInitiated = (action) => action && (
          action === 'live_search_initiated' ||
          action === 'concept_generation_initiated' ||
          action === 'keyword_generation_initiated' ||
          action === 'export_initiated'
        );
        const safeGet = (obj, path) => {
          try { return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj); } catch { return undefined; }
        };
        const countWhere = (fn) => logs.filter(l => !isAdminAction(l.action) && !isInitiated(l.action) && fn(l)).length;
        const byAction = (a) => (l) => l.action === a;
        const byFeature = (name) => (l) => l.action === 'feature_used' && safeGet(l, 'details.featureName') === name;

        const ka = {
          features_used: countWhere(byAction('feature_used')),
          projects_viewed: countWhere(byAction('project_view')),
          projects_created: countWhere(byAction('project_create')),
          projects_created_with_ai: countWhere(byFeature('ai_project_created')),
          generate_ai_project: countWhere(byFeature('ai_project_generate_clicked')),
          projects_deleted: countWhere(byAction('project_delete')),
          generate_concepts: countWhere(byFeature('concept_generation')),
          generate_keywords: countWhere(byFeature('keyword_generation')),
          live_searches_performed: countWhere(byAction('search_perform')),
          copy_query: countWhere(byFeature('copy_query')),
          articles_viewed: countWhere(byAction('article_view')),
          search_export: countWhere(byAction('search_export')),
          user_logins: countWhere(byAction('user_login')),
          user_logouts: countWhere(byAction('user_logout')),
        };
        setKeyActivities(ka);
        
        // Log admin stats view
        //await logger.logAdminStatsView('admin', 'activity_analytics');
      } catch (err) {
        console.error('Error loading activity data:', err);
        setError('Failed to load activity data');
      } finally {
        setLoading(false);
      }
    };

    loadActivityData();
  }, []);

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

      {/* Activity Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Busiest Hours */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Busiest Hours (Last 30 Days)</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              <p>{error}</p>
            </div>
          ) : busiestHours.length > 0 ? (
            <div className="space-y-3">
              {busiestHours.slice(0, 8).map((hour, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-16 text-sm text-gray-600">{hour.hourFormatted}</div>
                  <div className="flex-1 mx-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${hour.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-12 text-sm font-medium text-gray-900 text-right">
                    {hour.count}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No activity data available</p>
            </div>
          )}
        </div>

        {/* Busiest Days */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Busiest Days (Last 4 Weeks)</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              <p>{error}</p>
            </div>
          ) : busiestDays.length > 0 ? (
            <div className="space-y-3">
              {busiestDays.map((day, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-20 text-sm text-gray-600">{day.dayName}</div>
                  <div className="flex-1 mx-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-500 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${day.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-12 text-sm font-medium text-gray-900 text-right">
                    {day.count}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No activity data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Activity Summary (Filtered) */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Key Activities (Last 30 Days)</h3>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-600">
            <p>{error}</p>
          </div>
        ) : (
          (() => {
            if (!keyActivities) {
              return (
                <div className="text-center py-8 text-gray-500">
                  <p>No activity data available</p>
                </div>
              );
            }

            // KPI cards
            const kpis = [
              { key: 'generate_concepts', label: 'Generate Concepts' },
              { key: 'generate_keywords', label: 'Generate Keywords' },
              { key: 'live_searches_performed', label: 'Live Searches Performed' },
              { key: 'search_export', label: 'Search Exports' },
            ];

            // Ordered list for full grid per user's requested items
            const items = [
              { key: 'features_used', label: 'Features Used' },
              { key: 'projects_viewed', label: 'Projects Viewed' },
              { key: 'projects_created', label: 'Projects Created' },
              { key: 'projects_created_with_ai', label: 'Projects Created with AI' },
              { key: 'generate_ai_project', label: 'Generate AI Project' },
              { key: 'projects_deleted', label: 'Projects Deleted' },
              { key: 'generate_concepts', label: 'Generate Concepts' },
              { key: 'generate_keywords', label: 'Generate Keywords' },
              { key: 'live_searches_performed', label: 'Live Searches Performed' },
              { key: 'copy_query', label: 'Copy Query' },
              { key: 'articles_viewed', label: 'Articles Viewed' },
              { key: 'search_export', label: 'Search Export' },
              { key: 'user_logins', label: 'User Logins' },
              { key: 'user_logouts', label: 'User Logouts' },
            ];

            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {kpis.map(({ key, label }) => (
                    <div key={key} className="rounded-lg border shadow-sm p-4 bg-gradient-to-br from-indigo-50 to-white">
                      <div className="text-xs font-medium text-indigo-700 mb-1">{label}</div>
                      <div className="text-3xl font-bold text-indigo-900">{(keyActivities[key] || 0).toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map(({ key, label }) => (
                    <div key={key} className="bg-gray-50 p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-700">{label}</h4>
                        <span className="text-lg font-bold text-gray-900">{(keyActivities[key] || 0).toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-indigo-500 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${Math.min(((keyActivities[key] || 0) / Math.max(...Object.values(keyActivities || { a: 1 }))) * 100, 100)}%` }}
                          title={`${(keyActivities[key] || 0).toLocaleString()} events`}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()
        )}
      </div>

      {/* Real-time Activity */}
      {realTimeActivity.intervalActivity && Object.keys(realTimeActivity.intervalActivity).length > 0 && (() => {
        const entries = Object.entries(realTimeActivity.intervalActivity).sort(([a], [b]) => a.localeCompare(b));
        const counts = entries.map(([, c]) => c);
        const total = counts.reduce((s, n) => s + n, 0);
        const peak = Math.max(...counts);
        const peakIdx = counts.indexOf(peak);
        const peakInterval = entries[peakIdx]?.[0];
        const avg = counts.length > 0 ? (total / counts.length) : 0;
        const maxBar = Math.max(peak, 1);
        const colorFor = (pct) => pct > 0.75 ? 'from-rose-500 to-orange-500' : pct > 0.5 ? 'from-orange-400 to-amber-400' : pct > 0.25 ? 'from-amber-300 to-yellow-300' : 'from-teal-300 to-cyan-300';
        return (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Real-time Activity (Last Hour)</h3>
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-100">Total: <span className="font-semibold">{total}</span></div>
                <div className="px-3 py-1 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-100">Peak: <span className="font-semibold">{peak}</span> @ {formatIntervalLabel(peakInterval)}</div>
                <div className="px-3 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-100">Avg/slot: <span className="font-semibold">{avg.toFixed(1)}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2 items-end">
              {entries.map(([interval, count], idx) => {
                const pct = count / maxBar;
                const gradient = colorFor(pct);
                const showLabel = true; 
                return (
                  <div key={interval} className="flex flex-col items-center">
                    <div 
                      className={`w-full h-20 bg-gradient-to-t ${gradient} rounded-md shadow-sm transition-all duration-300`} 
                      style={{ height: `${Math.max(8, pct * 80)}px` }}
                      title={`${interval} — ${count} activities`}
                    ></div>
                    <div className="text-[10px] text-gray-500 mt-1 leading-tight text-center whitespace-nowrap">
                      {showLabel ? formatIntervalLabel(interval) : '\u00A0'}
                    </div>
                    <div className="text-[10px] text-gray-400">{count}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gradient-to-t from-rose-500 to-orange-500 inline-block"></span> High</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gradient-to-t from-orange-400 to-amber-400 inline-block"></span> Med‑High</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gradient-to-t from-amber-300 to-yellow-300 inline-block"></span> Medium</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gradient-to-t from-teal-300 to-cyan-300 inline-block"></span> Low</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default AdminStats;

