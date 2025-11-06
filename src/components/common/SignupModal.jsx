import React, { useState, useMemo } from 'react';
import { getCountries, getCountryCallingCode, isValidPhoneNumber } from 'libphonenumber-js';

// Helper function to get a list of all country codes and labels
const getCountryCodeList = () => {
  const countryCodes = getCountries()
    .filter(country => country !== 'IL'); // Remove Israel (IL)
  
  return countryCodes.map(country => ({
    isoCode: country,
    code: `+${getCountryCallingCode(country)}`,
    label: country,
  }));
};


function SignupModal({ onClose }) {
  const allCountryCodes = useMemo(() => getCountryCodeList(), []);
  const defaultIsoCode = 'QA';
  const defaultCallingCode = `+${getCountryCallingCode(defaultIsoCode)}`;
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    countryIsoCode: defaultIsoCode, 
    phone: '',
    notify: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };


  const validatePhone = (countryIsoCode, phone) => {
    try {
      return isValidPhoneNumber(phone, countryIsoCode);
    } catch (e) {
      return false;
    }
  };

  const validate = () => {
    const { name, email, countryIsoCode, phone } = form;

    if (!name.trim()) return 'Please enter your full name.';
    if (!email.trim()) return 'Please enter your email.';
    
    const emailOk = /.+@.+\..+/.test(email.trim());
    if (!emailOk) return 'Please enter a valid email.';
    
    if (!phone.trim()) return 'Please enter your phone number.';
    
    
    if (!validatePhone(countryIsoCode, phone)) {
      const selectedCountry = allCountryCodes.find(c => c.isoCode === countryIsoCode);
      const callingCode = selectedCountry ? selectedCountry.code : 'the selected country';
      return `Please enter a valid phone number for ${callingCode}.`;
    }
    
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    
    setError('');
    setIsSubmitting(true);
    
    const selectedCountry = allCountryCodes.find(c => c.isoCode === form.countryIsoCode);
    const callingCode = selectedCountry ? selectedCountry.code : '';

    try {
      const raw = localStorage.getItem('joinListSignups') || '[]';
      const list = JSON.parse(raw);
      const record = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: `${callingCode} ${form.phone.trim()}`,
        notify: !!form.notify,
        submittedAt: new Date().toISOString()
      };
      
      list.push(record);
      localStorage.setItem('joinListSignups', JSON.stringify(list));
      
      setSuccess('Thanks! You have been added to the list.');
      setTimeout(() => {
        setSuccess('');
        onClose && onClose();
      }, 1200);
    } catch (e) {
      console.error('Failed to save signup', e);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 rounded-lg bg-white shadow-xl">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-dark">Join the List</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 pt-5 pb-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-semibold leading-6 text-text-dark">
              Full Name
            </label>
            <div className="mt-2.5">
              <input
                type="text"
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="block w-full rounded-md border-0 px-3.5 py-2 text-text-dark shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-main sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          {/* Email */}
          <div className="mt-4">
            <label htmlFor="email" className="block text-sm font-semibold leading-6 text-text-dark">
              Email
            </label>
            <div className="mt-2.5">
              <input
                type="email"
                id="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="block w-full rounded-md border-0 px-3.5 py-2 text-text-dark shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-main sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          {/* Phone with Country Code */}
          <div className="mt-4">
            <label htmlFor="phone" className="block text-sm font-semibold leading-6 text-text-dark">
              Phone
            </label>
            <div className="mt-2.5 flex">
              <select
                id="countryIsoCode"
                name="countryIsoCode"
                value={form.countryIsoCode}
                onChange={handleChange}
                className="rounded-l-md border-0 bg-gray-100 px-2 py-2 text-sm text-gray-800 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-main"
              >
                {/* Dynamically populate ALL countries */}
                {allCountryCodes.map((c) => (
                  <option key={c.isoCode} value={c.isoCode}>
                    {c.code} ({c.isoCode})
                  </option>
                ))}
              </select>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
                className="flex-1 rounded-r-md border-0 px-3.5 py-2 text-text-dark shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-main sm:text-sm sm:leading-6"
                placeholder={`e.g. ${form.countryIsoCode === 'QA' ? '55551234' : ''}`}
              />
            </div>
          </div>

          {/* Notify Checkbox */}
          <div className="mt-4 flex items-center">
            <input
              id="notify"
              name="notify"
              type="checkbox"
              checked={!!form.notify}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-main focus:ring-main"
            />
            <label htmlFor="notify" className="ml-2 block text-sm text-gray-700">
              Notify me when the app is ready
            </label>
          </div>

          {/* Validation/Error messages */}
          {error && (
            <div className="mt-4 p-3 text-sm text-red-800 bg-red-100 rounded-md">{error}</div>
          )}
          {success && (
            <div className="mt-4 p-3 text-sm text-green-800 bg-green-100 rounded-md">{success}</div>
          )}

          {/* Buttons */}
          <div className="mt-6 flex items-center justify-end gap-x-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main ${
                isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-main hover:bg-main-dark'
              }`}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SignupModal;



