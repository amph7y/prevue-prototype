import { db } from '../config/firebase.js';
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

// Log action types
export const LOG_ACTIONS = {
  // Authentication
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_REGISTER: 'user_register',
  
  // Project Management
  PROJECT_CREATE: 'project_create',
  PROJECT_UPDATE: 'project_update',
  PROJECT_DELETE: 'project_delete',
  PROJECT_VIEW: 'project_view',
  
  // Search Operations
  SEARCH_PERFORM: 'search_perform',
  SEARCH_REFINE: 'search_refine',
  SEARCH_EXPORT: 'search_export',
  LIVE_SEARCH_INITIATED: 'live_search_initiated',
  
  // Article Operations
  ARTICLE_VIEW: 'article_view',
  ARTICLE_DOWNLOAD: 'article_download',
  ARTICLE_SAVE: 'article_save',
  
  // Admin Operations
  ADMIN_USER_CREATE: 'admin_user_create',
  ADMIN_USER_UPDATE: 'admin_user_update',
  ADMIN_USER_DELETE: 'admin_user_delete',
  ADMIN_STATS_VIEW: 'admin_stats_view',
  
  // System Operations
  PAGE_VIEW: 'page_view',
  ERROR_OCCURRED: 'error_occurred',
  FEATURE_USED: 'feature_used',
  
  // Feature Usage
  CONCEPT_GENERATION_INITIATED: 'concept_generation_initiated',
  KEYWORD_GENERATION_INITIATED: 'keyword_generation_initiated',
  EXPORT_INITIATED: 'export_initiated',
};

// Log severity levels
export const LOG_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  DEBUG: 'debug',
};

class Logger {
  constructor() {
    this.isEnabled = true;
    this.batchSize = 10;
    this.logBuffer = [];
    this.cachedIpAddress = null;
  }

  // Generate unique log ID
  generateLogId() {
    return uuidv4();
  }

  // Helper to fetch client IP (cached)
  async getClientIpAddress() {
    try {
      if (this.cachedIpAddress) return this.cachedIpAddress;
      // Try multiple providers for resilience
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const resp = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
        clearTimeout(timeout);
        if (resp.ok) {
          const data = await resp.json();
          this.cachedIpAddress = data?.ip || null;
          return this.cachedIpAddress;
        }
      } catch (_) { /* noop, fallback below */ }
      // Fallback providers
      try {
        const resp2 = await fetch('https://ifconfig.me/all.json');
        if (resp2.ok) {
          const data2 = await resp2.json();
          this.cachedIpAddress = data2?.ip_addr || data2?.ip || null;
          return this.cachedIpAddress;
        }
      } catch (_) { /* noop */ }
      return null;
    } catch (_) {
      return null;
    }
  }

  // Create log entry
  async log(action, details = {}, level = LOG_LEVELS.INFO, userId = null) {
    if (!this.isEnabled) return;

    try {
      const ipAddress = await this.getClientIpAddress();
      const logEntry = {
        logId: this.generateLogId(),
        userId: userId || this.getCurrentUserId(),
        action,
        details: {
          ...details,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        },
        level,
        createdAt: serverTimestamp(),
        ipAddress: ipAddress,
      };

      // Add to Firestore
      if (db) {
        await addDoc(collection(db, 'activity_logs'), logEntry);
      }

      // Also add to buffer for batch processing if needed
      this.logBuffer.push(logEntry);

      // Process buffer if it reaches batch size
      if (this.logBuffer.length >= this.batchSize) {
        await this.processBuffer();
      }

      return logEntry.logId;
    } catch (error) {
      console.error('Failed to log activity:', error);
      // Fallback to console logging
      console.log('Activity Log:', {
        action,
        details,
        level,
        userId: userId || this.getCurrentUserId(),
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Get current user ID from auth context
  getCurrentUserId() {
    // This will be set by the auth context
    return window.currentUserId || 'anonymous';
  }

  // Process log buffer
  async processBuffer() {
    if (this.logBuffer.length === 0) return;

    try {
      // Here you could implement batch processing to Firestore
      // For now, we'll just clear the buffer
      this.logBuffer = [];
    } catch (error) {
      console.error('Failed to process log buffer:', error);
    }
  }

  // Convenience methods for common actions
  async logUserLogin(userId, method = 'email') {
    return this.log(LOG_ACTIONS.USER_LOGIN, { method }, LOG_LEVELS.INFO, userId);
  }

  async logUserLogout(userId) {
    return this.log(LOG_ACTIONS.USER_LOGOUT, {}, LOG_LEVELS.INFO, userId);
  }

  async logUserRegister(userId, method = 'email') {
    return this.log(LOG_ACTIONS.USER_REGISTER, { method }, LOG_LEVELS.INFO, userId);
  }

  async logProjectCreate(userId, projectId, projectName) {
    return this.log(LOG_ACTIONS.PROJECT_CREATE, { 
      projectId, 
      projectName 
    }, LOG_LEVELS.INFO, userId);
  }

  async logProjectUpdate(userId, projectId, changes) {
    return this.log(LOG_ACTIONS.PROJECT_UPDATE, { 
      projectId, 
      changes 
    }, LOG_LEVELS.INFO, userId);
  }

  async logProjectDelete(userId, projectId, projectName) {
    return this.log(LOG_ACTIONS.PROJECT_DELETE, { 
      projectId, 
      projectName 
    }, LOG_LEVELS.INFO, userId);
  }

  async logProjectView(userId, projectId, projectName) {
    return this.log(LOG_ACTIONS.PROJECT_VIEW, { 
      projectId, 
      projectName 
    }, LOG_LEVELS.INFO, userId);
  }

  async logSearchPerform(userId, queriesByDb, resultsCountByDb, searchType) {
    // Store full queries and per-DB result counts
    return this.log(LOG_ACTIONS.SEARCH_PERFORM, { 
      queriesByDb, 
      resultsCountByDb, 
      totalResults: Object.values(resultsCountByDb || {}).reduce((sum, n) => sum + (Number(n) || 0), 0),
      searchType 
    }, LOG_LEVELS.INFO, userId);
  }

  async logSearchRefine(userId, originalQuery, refinedQuery, resultsCount) {
    return this.log(LOG_ACTIONS.SEARCH_REFINE, { 
      originalQuery: originalQuery.substring(0, 100),
      refinedQuery: refinedQuery.substring(0, 100),
      resultsCount 
    }, LOG_LEVELS.INFO, userId);
  }

  async logSearchExport(userId, exportType, itemCount) {
    return this.log(LOG_ACTIONS.SEARCH_EXPORT, { 
      exportType, 
      itemCount 
    }, LOG_LEVELS.INFO, userId);
  }

  async logArticleView(userId, articleId, articleTitle) {
    return this.log(LOG_ACTIONS.ARTICLE_VIEW, { 
      articleId, 
      articleTitle: articleTitle?.substring(0, 100) 
    }, LOG_LEVELS.INFO, userId);
  }

  async logArticleDownload(userId, articleId, articleTitle, downloadType) {
    return this.log(LOG_ACTIONS.ARTICLE_DOWNLOAD, { 
      articleId, 
      articleTitle: articleTitle?.substring(0, 100),
      downloadType 
    }, LOG_LEVELS.INFO, userId);
  }

  async logPageView(userId, pageName, pagePath) {
    return this.log(LOG_ACTIONS.PAGE_VIEW, { 
      pageName, 
      pagePath 
    }, LOG_LEVELS.INFO, userId);
  }

  async logError(userId, error, context = {}) {
    return this.log(LOG_ACTIONS.ERROR_OCCURRED, { 
      error: error.message || error,
      stack: error.stack,
      context 
    }, LOG_LEVELS.ERROR, userId);
  }

  async logFeatureUsed(userId, featureName, details = {}) {
    return this.log(LOG_ACTIONS.FEATURE_USED, { 
      featureName, 
      ...details 
    }, LOG_LEVELS.INFO, userId);
  }

  // Feature-specific logging methods
  async logConceptGenerationInitiated(userId, details = {}) {
    return this.log(LOG_ACTIONS.CONCEPT_GENERATION_INITIATED, details, LOG_LEVELS.INFO, userId);
  }

  async logKeywordGenerationInitiated(userId, details = {}) {
    return this.log(LOG_ACTIONS.KEYWORD_GENERATION_INITIATED, details, LOG_LEVELS.INFO, userId);
  }

  async logLiveSearchInitiated(userId, details = {}) {
    return this.log(LOG_ACTIONS.LIVE_SEARCH_INITIATED, details, LOG_LEVELS.INFO, userId);
  }

  async logExportInitiated(userId, details = {}) {
    return this.log(LOG_ACTIONS.EXPORT_INITIATED, details, LOG_LEVELS.INFO, userId);
  }

  // Admin logging methods
  async logAdminUserCreate(adminUserId, targetUserId, userData) {
    return this.log(LOG_ACTIONS.ADMIN_USER_CREATE, { 
      targetUserId, 
      userData: {
        email: userData.email,
        accessLevel: userData.accessLevel,
        role: userData.role
      }
    }, LOG_LEVELS.INFO, adminUserId);
  }

  async logAdminUserUpdate(adminUserId, targetUserId, changes) {
    return this.log(LOG_ACTIONS.ADMIN_USER_UPDATE, { 
      targetUserId, 
      changes 
    }, LOG_LEVELS.INFO, adminUserId);
  }

  async logAdminUserDelete(adminUserId, targetUserId, userData) {
    return this.log(LOG_ACTIONS.ADMIN_USER_DELETE, { 
      targetUserId, 
      userData: {
        email: userData.email,
        accessLevel: userData.accessLevel,
        role: userData.role
      }
    }, LOG_LEVELS.INFO, adminUserId);
  }

  async logAdminStatsView(adminUserId, statsType) {
    return this.log(LOG_ACTIONS.ADMIN_STATS_VIEW, { 
      statsType 
    }, LOG_LEVELS.INFO, adminUserId);
  }

  // Enable/disable logging
  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }

  // Set current user ID (called by auth context)
  setCurrentUserId(userId) {
    window.currentUserId = userId;
  }

  // Clear current user ID
  clearCurrentUserId() {
    window.currentUserId = null;
  }
}

// Create singleton instance
const logger = new Logger();

// Export the logger instance and utilities
export default logger;
export { Logger };
