export const CONTACT_US_GOOGLE_FORM_CONFIG = {
  ACTION_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSeEw_gyn8T8s5n07FqAwRlydF_F53xznVXovh6MJMD8vprBKw/formResponse',
  
  ENTRY_IDS: {
    NAME: 'entry.715723866',
    EMAIL: 'entry.1571564004', 
    PHONE: 'entry.251944743',
    MESSAGE: 'entry.418275632'
  }
};

export const RATE_LIMIT_CONFIG = {
  MAX_SUBMISSIONS_PER_HOUR: 3,
  
  MIN_TIME_BETWEEN_SUBMISSIONS: 60000, // 1 minute
  
  MAX_MESSAGE_LENGTH: 1000,
      
  REQUIRED_FIELDS: ['name', 'email', 'phone', 'message'],
  
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  
  PHONE_REGEX: /^[\+]?[\s\-\(\)]*([0-9][\s\-\(\)]*){8,}$/
};

export const validateContactForm = (formData) => {
  const errors = [];
  
  RATE_LIMIT_CONFIG.REQUIRED_FIELDS.forEach(field => {
    if (!formData[field] || !formData[field].trim()) {
      errors.push(`${field} is required`);
    }
  });
  
  if (formData.email && !RATE_LIMIT_CONFIG.EMAIL_REGEX.test(formData.email)) {
    errors.push('Please enter a valid email address');
  }
  
  if (formData.phone && !RATE_LIMIT_CONFIG.PHONE_REGEX.test(formData.phone)) {
    errors.push('Please enter a valid phone number');
  }
  
  if (formData.message && formData.message.length > RATE_LIMIT_CONFIG.MAX_MESSAGE_LENGTH) {
    errors.push(`Message must be less than ${RATE_LIMIT_CONFIG.MAX_MESSAGE_LENGTH} characters`);
  }
    
  return errors;
};
