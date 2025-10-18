import { db } from '../config/firebase.js';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  startAfter, 
  endBefore,
  Timestamp 
} from 'firebase/firestore';

// Log API functions for retrieving and analyzing activity logs
export const logApi = {
  // Get all activity logs with pagination
  getActivityLogs: async (options = {}) => {
    try {
      const {
        limitCount = 100,
        startAfterDoc = null,
        orderByField = 'createdAt',
        orderDirection = 'desc',
        userId = null,
        action = null,
        level = null,
        startDate = null,
        endDate = null
      } = options;

      let q = query(collection(db, 'activity_logs'));

      // Apply filters
      if (userId) {
        q = query(q, where('userId', '==', userId));
      }

      if (action) {
        q = query(q, where('action', '==', action));
      }

      if (level) {
        q = query(q, where('level', '==', level));
      }

      if (startDate) {
        const startTimestamp = Timestamp.fromDate(new Date(startDate));
        q = query(q, where('createdAt', '>=', startTimestamp));
      }

      if (endDate) {
        const endTimestamp = Timestamp.fromDate(new Date(endDate));
        q = query(q, where('createdAt', '<=', endTimestamp));
      }

      // Apply ordering and pagination
      q = query(q, orderBy(orderByField, orderDirection));

      if (startAfterDoc) {
        q = query(q, startAfter(startAfterDoc));
      }

      q = query(q, limit(limitCount));

      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
      }));

      return {
        logs,
        lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
        hasMore: snapshot.docs.length === limitCount
      };
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      throw error;
    }
  },

  // Get activity logs by user
  getActivityLogsByUser: async (userId, options = {}) => {
    return logApi.getActivityLogs({
      ...options,
      userId
    });
  },

  // Get activity logs by action type
  getActivityLogsByAction: async (action, options = {}) => {
    return logApi.getActivityLogs({
      ...options,
      action
    });
  },

  // Get activity logs by date range
  getActivityLogsByDateRange: async (startDate, endDate, options = {}) => {
    return logApi.getActivityLogs({
      ...options,
      startDate,
      endDate
    });
  },

  // Get busiest hours of the day
  getBusiestHours: async (options = {}) => {
    try {
      const {
        days = 30,
        startDate = null,
        endDate = null
      } = options;

      let start, end;
      
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        end = new Date();
        start = new Date();
        start.setDate(start.getDate() - days);
      }

      const logs = await logApi.getActivityLogsByDateRange(start, end, {
        limitCount: 10000 // Get more logs for accurate analysis
      });

      // Group logs by hour
      const hourlyActivity = {};
      
      logs.logs.forEach(log => {
        const hour = log.createdAt.getHours();
        hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
      });

      // Convert to array and sort by activity count
      const busiestHours = Object.entries(hourlyActivity)
        .map(([hour, count]) => {
          const hNum = parseInt(hour, 10);
          const ampmHour = (hNum % 12) === 0 ? 12 : (hNum % 12);
          const suffix = hNum < 12 ? 'AM' : 'PM';
          return {
            hour: hNum,
            hourFormatted: `${ampmHour}:00 ${suffix}`,
            count,
            percentage: (count / logs.logs.length) * 100
          };
        })
        .sort((a, b) => b.count - a.count);

      return {
        busiestHours,
        totalLogs: logs.logs.length,
        dateRange: { start, end }
      };
    } catch (error) {
      console.error('Error getting busiest hours:', error);
      throw error;
    }
  },

  // Get busiest days of the week
  getBusiestDays: async (options = {}) => {
    try {
      const {
        weeks = 4,
        startDate = null,
        endDate = null
      } = options;

      let start, end;
      
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        end = new Date();
        start = new Date();
        start.setDate(start.getDate() - (weeks * 7));
      }

      const logs = await logApi.getActivityLogsByDateRange(start, end, {
        limitCount: 10000
      });

      // Group logs by day of week
      const dailyActivity = {};
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      logs.logs.forEach(log => {
        const dayOfWeek = log.createdAt.getDay();
        dailyActivity[dayOfWeek] = (dailyActivity[dayOfWeek] || 0) + 1;
      });

      // Convert to array and sort by activity count
      const busiestDays = Object.entries(dailyActivity)
        .map(([day, count]) => ({
          day: parseInt(day),
          dayName: dayNames[parseInt(day)],
          count,
          percentage: (count / logs.logs.length) * 100
        }))
        .sort((a, b) => b.count - a.count);

      return {
        busiestDays,
        totalLogs: logs.logs.length,
        dateRange: { start, end }
      };
    } catch (error) {
      console.error('Error getting busiest days:', error);
      throw error;
    }
  },

  // Get activity summary by action type
  getActivitySummary: async (options = {}) => {
    try {
      const {
        days = 30,
        startDate = null,
        endDate = null
      } = options;

      let start, end;
      
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        end = new Date();
        start = new Date();
        start.setDate(start.getDate() - days);
      }

      const logs = await logApi.getActivityLogsByDateRange(start, end, {
        limitCount: 10000
      });

      // Group logs by action type
      const actionSummary = {};
      
      logs.logs.forEach(log => {
        actionSummary[log.action] = (actionSummary[log.action] || 0) + 1;
      });

      // Convert to array and sort by count
      const summary = Object.entries(actionSummary)
        .map(([action, count]) => ({
          action,
          count,
          percentage: (count / logs.logs.length) * 100
        }))
        .sort((a, b) => b.count - a.count);

      return {
        summary,
        totalLogs: logs.logs.length,
        dateRange: { start, end }
      };
    } catch (error) {
      console.error('Error getting activity summary:', error);
      throw error;
    }
  },

  // Get user activity summary
  getUserActivitySummary: async (userId, options = {}) => {
    try {
      const {
        days = 30,
        startDate = null,
        endDate = null
      } = options;

      let start, end;
      
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        end = new Date();
        start = new Date();
        start.setDate(start.getDate() - days);
      }

      const logs = await logApi.getActivityLogsByUser(userId, {
        startDate: start,
        endDate: end,
        limitCount: 10000
      });

      // Group logs by action type
      const actionSummary = {};
      
      logs.logs.forEach(log => {
        actionSummary[log.action] = (actionSummary[log.action] || 0) + 1;
      });

      // Convert to array and sort by count
      const summary = Object.entries(actionSummary)
        .map(([action, count]) => ({
          action,
          count,
          percentage: (count / logs.logs.length) * 100
        }))
        .sort((a, b) => b.count - a.count);

      return {
        summary,
        totalLogs: logs.logs.length,
        dateRange: { start, end },
        userId
      };
    } catch (error) {
      console.error('Error getting user activity summary:', error);
      throw error;
    }
  },

  // Get real-time activity (last hour)
  getRealTimeActivity: async () => {
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const logs = await logApi.getActivityLogsByDateRange(oneHourAgo, new Date(), {
        limitCount: 1000
      });

      // Group by 10-minute intervals
      const intervalActivity = {};
      
      logs.logs.forEach(log => {
        const minutes = Math.floor(log.createdAt.getMinutes() / 10) * 10;
        const interval = `${log.createdAt.getHours().toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        intervalActivity[interval] = (intervalActivity[interval] || 0) + 1;
      });

      return {
        intervalActivity,
        totalLogs: logs.logs.length,
        timeRange: { start: oneHourAgo, end: new Date() }
      };
    } catch (error) {
      console.error('Error getting real-time activity:', error);
      throw error;
    }
  }
};

export default logApi;
