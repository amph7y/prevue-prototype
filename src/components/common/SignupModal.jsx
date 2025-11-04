import React, { useState } from 'react';

function SignupModal({ onClose }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    countryCode: '+974', // default
    phone: '',
    notify: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Common country codes
  const countryCodes = [
    { code: '+1', label: 'USA/Canada' },
    { code: '+44', label: 'UK' },
    { code: '+20', label: 'Egypt' },
    { code: '+961', label: 'Lebanon' },
    { code: '+971', label: 'UAE' },
    { code: '+974', label: 'Qatar' },
    { code: '+91', label: 'India' },
    { code: '+61', label: 'Australia' },
    { code: '+33', label: 'France' },
    { code: '+49', label: 'Germany' }
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const validatePhone = (countryCode, phone) => {
    // Remove spaces/dashes
    const cleanPhone = phone.replace(/[\s-]/g, '');
    const regexByCountry = {
      '+1': /^[2-9]\d{9}$/, // US/Canada - 10 digits, cannot start with 0 or 1
      '+44': /^7\d{9}$/, // UK - usually starts with 7 and 10 digits total (mobile)
      '+20': /^1[0-9]{9}$/, // Egypt - mobile numbers start with 1 and have 10 digits
      '+961': /^\d{7,8}$/, // Lebanon - 7 or 8 digits
      '+971': /^5\d{8}$/, // UAE - mobile starts with 5 and has 9 digits total
      '+974': /^\d{8}$/, // Qatar - 8 digits
      '+91': /^[6-9]\d{9}$/, // India - 10 digits, starts 6-9
      '+61': /^4\d{8}$/, // Australia - starts with 4 (mobile)
      '+33': /^[67]\d{8}$/, // France - starts with 6 or 7
      '+49': /^1\d{9,10}$/ // Germany - starts with 1, 10–11 digits
    };

    const regex = regexByCountry[countryCode];
    return regex ? regex.test(cleanPhone) : /^\d{7,15}$/.test(cleanPhone);
  };

  const validate = () => {
    if (!form.name.trim()) return 'Please enter your full name.';
    if (!form.email.trim()) return 'Please enter your email.';
    const emailOk = /.+@.+\..+/.test(form.email.trim());
    if (!emailOk) return 'Please enter a valid email.';
    if (!form.phone.trim()) return 'Please enter your phone number.';
    if (!validatePhone(form.countryCode, form.phone))
      return `Please enter a valid phone number for ${form.countryCode}.`;
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
    try {
      const raw = localStorage.getItem('joinListSignups') || '[]';
      const list = JSON.parse(raw);
      const record = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: `${form.countryCode} ${form.phone.trim()}`,
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
                id="countryCode"
                name="countryCode"
                value={form.countryCode}
                onChange={handleChange}
                className="rounded-l-md border-0 bg-gray-100 px-2 py-2 text-sm text-gray-800 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-main"
              >
                {countryCodes.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.label})
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
