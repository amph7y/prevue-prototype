import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { CONTACT_US_GOOGLE_FORM_CONFIG, RATE_LIMIT_CONFIG, validateContactForm } from '../../config/contactUs.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import SignupModal from '../../components/common/SignupModal.jsx';

function LandingPage({ onGetStarted, onGoToAdmin }) {
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [contactUsFeedbackMessage, setContactUsFeedbackMessage] = useState({ state: 'none', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(null);
  const { isAuthenticated, isAdmin } = useAuth();
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');

  const heroRef = useRef(null);
  const problemRef = useRef(null);
  const featuresRef = useRef(null);
  const howItWorksRef = useRef(null);
  const testimonialsRef = useRef(null);
  const teamRef = useRef(null);
  const contactRef = useRef(null);

  const scrollToSection = (sectionId) => {
    const sectionRefs = {
      hero: heroRef,
      problem: problemRef,
      features: featuresRef,
      'how-it-works': howItWorksRef,
      testimonials: testimonialsRef,
      team: teamRef,
      contact: contactRef,
    };

    const targetRef = sectionRefs[sectionId];
    if (targetRef?.current) {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsMobileMenuOpen(false);
    }
  };

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactForm((prev) => ({ ...prev, [name]: value }));
  };

  const validateContactUsSubmission = (formData) => {
    const now = Date.now();

    const validationErrors = validateContactForm(formData);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors[0]);
    }

    if (lastSubmitTime && now - lastSubmitTime < RATE_LIMIT_CONFIG.MIN_TIME_BETWEEN_SUBMISSIONS) {
      const remainingTime = Math.ceil((RATE_LIMIT_CONFIG.MIN_TIME_BETWEEN_SUBMISSIONS - (now - lastSubmitTime)) / 1000);
      throw new Error(`Please wait ${remainingTime} seconds before submitting again.`);
    }

    const submissionHistory = JSON.parse(localStorage.getItem('contactSubmissions') || '[]');
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentSubmissions = submissionHistory.filter((time) => time > oneHourAgo);

    if (recentSubmissions.length >= RATE_LIMIT_CONFIG.MAX_SUBMISSIONS_PER_HOUR) {
      throw new Error(`You've reached the limit of ${RATE_LIMIT_CONFIG.MAX_SUBMISSIONS_PER_HOUR} submissions per hour. Please try again later.`);
    }

    return { recentSubmissions, now };
  };

  const handleContactUsSubmit = async (e) => {
    e.preventDefault();
    const { name, email, phone, message } = contactForm;
    if (!name.trim() || !email.trim() || !phone.trim() || !message.trim()) return;
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      const { recentSubmissions, now } = validateContactUsSubmission(contactForm);

      const formData = new FormData();
      formData.append(CONTACT_US_GOOGLE_FORM_CONFIG.ENTRY_IDS.NAME, name);
      formData.append(CONTACT_US_GOOGLE_FORM_CONFIG.ENTRY_IDS.EMAIL, email);
      formData.append(CONTACT_US_GOOGLE_FORM_CONFIG.ENTRY_IDS.PHONE, phone);
      formData.append(CONTACT_US_GOOGLE_FORM_CONFIG.ENTRY_IDS.MESSAGE, message);

      await fetch(CONTACT_US_GOOGLE_FORM_CONFIG.ACTION_URL, {
        method: 'POST',
        body: formData,
        mode: 'no-cors',
      });

      const updatedSubmissions = [...recentSubmissions, now];
      localStorage.setItem('contactSubmissions', JSON.stringify(updatedSubmissions));
      setLastSubmitTime(now);

      setContactUsFeedbackMessage({ state: 'success', message: '' });
      setContactForm({ name: '', email: '', phone: '', message: '' });
      setTimeout(() => setContactUsFeedbackMessage({ state: 'none', message: '' }), 6000);
    } catch (error) {
      console.error('Form submission error:', error);

      if (error.message.includes('wait') || error.message.includes('limit')) {
        setContactUsFeedbackMessage({ state: 'error', message: error.message });
        setTimeout(() => setContactUsFeedbackMessage({ state: 'none', message: '' }), 5000);
      } else {
        const subject = encodeURIComponent(`PreVue Contact - ${name}`);
        const body = encodeURIComponent(`${message}\n\nFrom: ${name}\nEmail: ${email}\nPhone: ${phone}`);
        window.location.href = `mailto:prevue.ai@gmail.com?subject=${subject}&body=${body}`;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const sectionRefs = [
      { id: 'hero', ref: heroRef },
      { id: 'problem', ref: problemRef },
      { id: 'features', ref: featuresRef },
      { id: 'how-it-works', ref: howItWorksRef },
      { id: 'testimonials', ref: testimonialsRef },
      { id: 'team', ref: teamRef },
      { id: 'contact', ref: contactRef },
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('data-section');
            if (sectionId) {
              setActiveSection(sectionId);
            }
          }
        });
      },
      { threshold: 0.4 }
    );

    sectionRefs.forEach(({ ref }) => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => observer.disconnect();
  }, []);

  const chipColorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
  };

  const featureWrapperClasses = {
    blue: 'bg-blue-50',
    teal: 'bg-teal-50',
    indigo: 'bg-indigo-50',
  };

  const featureIconClasses = {
    blue: 'text-blue-600',
    teal: 'text-teal-600',
    indigo: 'text-indigo-600',
  };

  return (
    <div className="bg-white text-slate-800">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => scrollToSection('hero')} className="flex items-center gap-2 hover:opacity-80">
                <img src="/PreVue Logo.png" alt="PreVue" className="h-10 w-auto" />
              </button>
              <div className="hidden sm:flex items-center text-sm text-slate-500">
                Precision Search Strategy Builder
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              {[
                { id: 'features', label: 'Features' },
                { id: 'problem', label: 'Why ReVue?' },
                { id: 'how-it-works', label: 'How It Works' },
                { id: 'team', label: 'Team' },
                { id: 'contact', label: 'Contact' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`transition-colors ${
                    activeSection === item.id ? 'text-brand-600' : 'text-slate-600 hover:text-brand-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated && isAdmin && (
                <button
                  onClick={onGoToAdmin}
                  className="px-4 py-2 rounded-full text-sm font-semibold bg-white border border-brand-200 text-brand-700 shadow-sm hover:border-brand-400"
                >
                  Admin
                </button>
              )}
              <button
                onClick={() => setIsSignupOpen(true)}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-white border border-slate-200 text-slate-700 shadow-sm hover:border-brand-300"
              >
                Join Waitlist
              </button>
              <button
                onClick={onGetStarted}
                className="px-5 py-2.5 rounded-full text-sm font-semibold bg-brand-900 text-white shadow-md hover:bg-brand-800"
              >
                Start Free Trial
              </button>
            </div>

            <button
              className="md:hidden text-slate-600 hover:text-brand-700"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation"
            >
              <span className="sr-only">Toggle menu</span>
              {isMobileMenuOpen ? <i className="fa-solid fa-xmark text-2xl" /> : <i className="fa-solid fa-bars text-2xl" />}
            </button>
          </div>

          {isMobileMenuOpen && (
            <div className="mt-4 border-t border-slate-200 pt-4 flex flex-col gap-3 md:hidden">
              {[
                { id: 'features', label: 'Features' },
                { id: 'problem', label: 'Why ReVue?' },
                { id: 'how-it-works', label: 'How It Works' },
                { id: 'team', label: 'Team' },
                { id: 'contact', label: 'Contact' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`text-left text-sm font-semibold ${
                    activeSection === item.id ? 'text-brand-700' : 'text-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                {isAuthenticated && isAdmin && (
                  <button
                    onClick={() => {
                      onGoToAdmin();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-brand-200 text-brand-700 shadow-sm"
                  >
                    Admin
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsSignupOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-slate-200 text-slate-700 shadow-sm"
                >
                  Join Waitlist
                </button>
                <button
                  onClick={() => {
                    onGetStarted();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold bg-brand-900 text-white shadow-md"
                >
                  Start Free Trial
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="pt-28">
        <section
          ref={heroRef}
          data-section="hero"
          className="relative overflow-hidden bg-white"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-800 text-sm font-semibold border border-brand-100">
                <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                <span>Pre-screening optimization tool</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold leading-tight text-slate-900">
                The Perfect Strategy <span className="gradient-text">Before You Screen.</span>
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed">
                ReVue is the essential first step for your systematic review. Build error-free search strategies, validate them across databases, and deduplicate records—all before you open your screening tool.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={onGetStarted}
                  className="px-6 py-3 bg-brand-900 text-white rounded-lg font-semibold shadow-md hover:bg-brand-800 flex items-center justify-center gap-2"
                >
                  Build Your Strategy <i className="fa-solid fa-arrow-right" />
                </button>
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-lg font-semibold shadow-sm hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-play text-brand-600" /> See Workflow
                </button>
              </div>
              <p className="text-sm text-slate-500">
                <i className="fa-solid fa-check text-emerald-500 mr-1" /> Compatible with Rayyan, Covidence, & EndNote
              </p>
            </div>

            <div className="relative">
              <div className="absolute -top-10 -right-10 w-64 h-64 bg-brand-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
              <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
              <div className="relative bg-white/90 backdrop-blur-md border border-slate-100 rounded-2xl shadow-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Live preview • Strategy builder demo
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-sm text-slate-700 mb-2 font-semibold">Example PICO question</p>
                  <p className="text-slate-600 text-sm">In adults with polypharmacy, does bisoprolol reduce blood pressure compared to placebo?</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { title: 'Population', chips: ['Adults', 'Polypharmacy', 'Elderly'], color: 'blue' },
                    { title: 'Intervention', chips: ['Bisoprolol', 'Beta-blockers', 'Cardioselective'], color: 'emerald' },
                    { title: 'Comparison', chips: ['Placebo', 'Control', 'Standard Care'], color: 'amber' },
                    { title: 'Outcome', chips: ['Blood Pressure', 'Hypertension', 'Systolic BP'], color: 'purple' },
                  ].map((group) => (
                    <div key={group.title}>
                      <p className="text-[11px] font-bold uppercase text-brand-900 tracking-wide">{group.title}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {group.chips.map((chip) => (
                          <span
                            key={chip}
                            className={`px-2 py-1 rounded text-[11px] border ${chipColorClasses[group.color] || chipColorClasses.blue}`}
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="p-3 rounded-lg border border-slate-200">
                    <p className="text-[11px] uppercase text-slate-500 font-bold">PubMed</p>
                    <p className="font-semibold text-slate-900">1,240 results</p>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200">
                    <p className="text-[11px] uppercase text-slate-500 font-bold">Scopus</p>
                    <p className="font-semibold text-slate-900">856 results</p>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200">
                    <p className="text-[11px] uppercase text-slate-500 font-bold">Embase</p>
                    <p className="font-semibold text-slate-900">1,402 results</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="problem"
          ref={problemRef}
          data-section="problem"
          className="py-20 bg-brand-900 text-white relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
          <div className="max-w-4xl mx-auto px-4 text-center relative z-10 space-y-6">
            <div className="inline-block mb-4">
              <i className="fa-solid fa-triangle-exclamation text-5xl text-yellow-400" />
            </div>
            <h2 className="text-3xl md:text-5xl font-bold leading-tight">
              92.7% of search strategies contain errors.
            </h2>
            <p className="text-xl text-brand-100 italic">— Journal of Clinical Epidemiology</p>
            <div className="w-24 h-1 bg-yellow-400 mx-auto" />
            <p className="text-lg text-brand-50 leading-relaxed">
              A single missed term or incorrect boolean operator can invalidate months of work. ReVue validates your strategy before you screen, preventing costly retractions and wasted time.
            </p>
          </div>
        </section>

        <section
          id="features"
          ref={featuresRef}
          data-section="features"
          className="py-24 bg-slate-50"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-brand-600 font-semibold tracking-wide uppercase text-sm mb-2">Comprehensive Toolkit</h2>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900">Everything you need for PRISMA compliance</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: 'fa-wand-magic-sparkles',
                  title: 'Automated Strategy Builder',
                  description:
                    'Convert PICO questions into error-free search strings for PubMed, Scopus, and Web of Science instantly. We handle the syntax differences.',
                  color: 'blue',
                },
                {
                  icon: 'fa-filter',
                  title: 'Smart Deduplication',
                  description:
                    'Identify duplicates with 99.9% accuracy and flag potential matches for manual review so you never lose unique data.',
                  color: 'teal',
                },
                {
                  icon: 'fa-bolt',
                  title: 'Live Database Search',
                  description:
                    'Run searches directly from ReVue. View result counts in real-time and refine your strategy before exporting.',
                  color: 'indigo',
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow"
                >
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 ${featureWrapperClasses[feature.color] || 'bg-slate-100'}`}>
                    <i className={`fa-solid ${feature.icon} text-2xl ${featureIconClasses[feature.color] || 'text-slate-700'}`} />
                  </div>
                  <h4 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h4>
                  <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="testimonials"
          ref={testimonialsRef}
          data-section="testimonials"
          className="py-24 bg-brand-900 text-white"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-brand-500 font-semibold tracking-wide uppercase text-sm mb-2">What Our Researchers Say</h2>
              <h3 className="text-3xl md:text-4xl font-bold text-white">Hear from Academics Who Trust ReVue</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  quote:
                    'ReVue has transformed how we conduct systematic reviews. The automated deduplication and collaborative screening features save us countless hours and ensure unparalleled accuracy.',
                  name: 'Dr. Anya Sharma',
                  role: 'Professor of Epidemiology, University of Toronto',
                  stars: 5,
                },
                {
                  quote:
                    'The search strategy builder is a game-changer. I no longer worry about syntax errors across different databases. ReVue makes the initial steps of a review feel genuinely stress-free.',
                  name: 'Mark Johnson',
                  role: 'PhD Candidate, University of Manchester',
                  stars: 4,
                },
                {
                  quote:
                    'Before ReVue, managing a team of screeners was a logistical nightmare. Now, everything is centralized, conflicts are highlighted, and our PRISMA flow diagram generates automatically. Indispensable!',
                  name: 'Dr. Sarah Chen',
                  role: 'Lead Researcher, National Health Institute',
                  stars: 4.5,
                },
              ].map((testimonial) => (
                <div key={testimonial.name} className="bg-white p-8 rounded-2xl shadow-lg text-slate-800 flex flex-col justify-between">
                  <div>
                    <i className="fa-solid fa-quote-left text-brand-500 text-3xl mb-4" />
                    <p className="text-lg mb-6 leading-relaxed italic">{testimonial.quote}</p>
                    <div className="flex items-center mb-4 text-yellow-400">
                      {Array.from({ length: 5 }).map((_, starIndex) => {
                        const threshold = starIndex + 1;
                        if (testimonial.stars >= threshold) {
                          return <i key={starIndex} className="fa-solid fa-star" />;
                        }
                        if (testimonial.stars > starIndex && testimonial.stars < threshold) {
                          return <i key={starIndex} className="fa-solid fa-star-half-stroke" />;
                        }
                        return <i key={starIndex} className="fa-regular fa-star" />;
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{testimonial.name}</p>
                    <p className="text-sm text-slate-500">{testimonial.role}</p>
                    <i className="fa-solid fa-quote-right text-brand-500 text-3xl mt-4 float-right" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          ref={howItWorksRef}
          data-section="how-it-works"
          className="py-24 bg-white"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-12">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Precision before the screening.</h2>
                <p className="text-lg text-slate-600">
                  ReVue handles the complex Step 0 of systematic reviews, ensuring your data is clean and comprehensive before you start screening.
                </p>
              </div>

              {[
                {
                  step: '1',
                  title: 'Concept Extraction',
                  description:
                    'Enter your research question (PICO). ReVue uses AI and existing relevant articles to extract key concepts and generate robust keywords automatically.',
                },
                {
                  step: '2',
                  title: 'Query Building & Validation',
                  description:
                    'Automatically generate correct syntax for PubMed, Scopus, Embase, and WoS. View live result counts and refine queries instantly.',
                },
                {
                  step: '3',
                  title: 'Live Search & Deduplication',
                  description:
                    'Execute the search across all databases in one click. We fetch the articles, remove duplicates, and give you a clean file to export.',
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-6">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-lg">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h4>
                    <p className="text-slate-600">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 relative flex items-center justify-center">
              <img
                src="https://cdni.iconscout.com/illustration/premium/thumb/data-analysis-illustration-download-in-svg-png-gif-file-formats--analytics-statistics-growth-business-and-finance-pack-illustrations-3670692.png?f=webp"
                alt="Data Analysis"
                className="w-full max-w-md mix-blend-multiply opacity-90"
              />
            </div>
          </div>
        </section>

        <section className="py-16 border-t border-slate-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-slate-500 mb-8 font-medium">Trusted by researchers at leading institutions</p>
            <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-70 grayscale">
              <div className="flex items-center gap-2 text-2xl font-serif font-bold text-slate-800">
                <i className="fa-solid fa-building-columns" /> Stanford
              </div>
              <div className="flex items-center gap-2 text-2xl font-serif font-bold text-slate-800">
                <i className="fa-solid fa-graduation-cap" /> Oxford
              </div>
              <div className="flex items-center gap-2 text-2xl font-serif font-bold text-slate-800">
                <i className="fa-solid fa-book-open" /> MIT
              </div>
              <div className="flex items-center gap-2 text-2xl font-serif font-bold text-slate-800">
                <i className="fa-solid fa-flask" /> Cambridge
              </div>
            </div>
          </div>
        </section>

        <section
          id="team"
          ref={teamRef}
          data-section="team"
          className="py-24 bg-slate-50"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Meet the Team</h2>
              <p className="mt-3 text-lg text-slate-600">Librarians, researchers, and engineers building the perfect systematic review companion.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  name: 'Alex Rivera',
                  role: 'Lead Research Librarian',
                  description: 'Guides best practices for PICO framing and database translation.',
                  avatar: 'https://ui-avatars.com/api/?name=Alex+Rivera&background=38d0c3&color=fff',
                },
                {
                  name: 'Priya Desai',
                  role: 'Data Scientist',
                  description: 'Designs the AI pipelines that extract concepts and deduplicate records.',
                  avatar: 'https://ui-avatars.com/api/?name=Priya+Desai&background=1e3b5d&color=fff',
                },
                {
                  name: 'Marcus Lee',
                  role: 'Product Engineer',
                  description: 'Builds the live query builder and integrations with screening tools.',
                  avatar: 'https://ui-avatars.com/api/?name=Marcus+Lee&background=0f172a&color=fff',
                },
              ].map((member) => (
                <div key={member.name} className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 flex flex-col items-center text-center">
                  <img src={member.avatar} alt={member.name} className="h-20 w-20 rounded-full mb-4 border-4 border-white shadow" />
                  <h3 className="text-xl font-bold text-slate-900">{member.name}</h3>
                  <p className="text-sm text-brand-700 font-semibold">{member.role}</p>
                  <p className="mt-3 text-slate-600 text-sm leading-relaxed">{member.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="contact"
          ref={contactRef}
          data-section="contact"
          className="py-24 bg-white"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-slate-900">Contact Us</h2>
              <p className="text-lg text-slate-600">Questions about pilots, pricing, or integrations? We would love to hear from you.</p>
              <div className="space-y-3 text-slate-700">
                <p className="flex items-center gap-3"><i className="fa-solid fa-envelope text-brand-600" /> prevue.ai@gmail.com</p>
                <p className="flex items-center gap-3"><i className="fa-solid fa-phone text-brand-600" /> +1 (555) 123-4567</p>
                <p className="flex items-center gap-3"><i className="fa-solid fa-location-dot text-brand-600" /> Remote-first, global team</p>
              </div>
            </div>

            <form onSubmit={handleContactUsSubmit} className="bg-slate-50 rounded-2xl p-8 border border-slate-100 shadow-sm space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={contactForm.name}
                    onChange={handleContactChange}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-500 focus:ring-brand-500"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={contactForm.email}
                    onChange={handleContactChange}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-500 focus:ring-brand-500"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={contactForm.phone}
                  onChange={handleContactChange}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-500 focus:ring-brand-500"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">How can we help?</label>
                <textarea
                  name="message"
                  value={contactForm.message}
                  onChange={handleContactChange}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 focus:border-brand-500 focus:ring-brand-500"
                  rows={4}
                  placeholder="Tell us about your project"
                />
              </div>
              {contactUsFeedbackMessage.state !== 'none' && (
                <div
                  className={`rounded-lg px-4 py-3 text-sm ${
                    contactUsFeedbackMessage.state === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-amber-50 text-amber-700 border border-amber-100'
                  }`}
                >
                  {contactUsFeedbackMessage.state === 'success'
                    ? 'Thanks for reaching out! We will respond shortly.'
                    : contactUsFeedbackMessage.message || 'Please wait before submitting again.'}
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-brand-900 text-white rounded-lg font-semibold hover:bg-brand-800 shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </section>

        <section className="py-20 bg-gradient-to-br from-brand-900 to-brand-800 relative overflow-hidden text-center text-white">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full translate-x-1/3 translate-y-1/3" />
          <div className="max-w-4xl mx-auto px-4 relative z-10 space-y-6">
            <h2 className="text-3xl md:text-5xl font-bold">Ready to perfect your search?</h2>
            <p className="text-xl text-brand-100">Join thousands of academics conducting error-free systematic reviews.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={onGetStarted}
                className="px-8 py-4 bg-white text-brand-900 rounded-lg font-bold text-lg shadow-xl hover:bg-brand-50"
              >
                Start Free Trial
              </button>
              <button
                onClick={() => scrollToSection('contact')}
                className="px-8 py-4 bg-transparent border border-white text-white rounded-lg font-bold text-lg hover:bg-white/10"
              >
                Contact Sales
              </button>
            </div>
            <p className="text-sm text-brand-200 opacity-80">No installation required. Works in your browser.</p>
          </div>
        </section>
      </main>

      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center text-white text-xl font-bold mb-4">
                <div className="w-8 h-8 bg-brand-600 rounded-md flex items-center justify-center text-white text-sm font-bold mr-2">R</div>
                ReVue
              </div>
              <p className="text-sm text-slate-400">The all-in-one platform for systematic reviews and meta-analyses.</p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-brand-400">Features</button></li>
                <li><button onClick={() => scrollToSection('how-it-works')} className="hover:text-brand-400">Workflow</button></li>
                <li><button onClick={() => scrollToSection('contact')} className="hover:text-brand-400">Support</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => scrollToSection('team')} className="hover:text-brand-400">Team</button></li>
                <li><button onClick={() => setIsSignupOpen(true)} className="hover:text-brand-400">Join Waitlist</button></li>
                <li><button onClick={() => scrollToSection('contact')} className="hover:text-brand-400">Contact</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Stay Connected</h4>
              <div className="flex space-x-4">
                <a href="https://twitter.com" className="text-slate-400 hover:text-white" aria-label="Twitter">
                  <i className="fa-brands fa-twitter" />
                </a>
                <a href="https://www.linkedin.com" className="text-slate-400 hover:text-white" aria-label="LinkedIn">
                  <i className="fa-brands fa-linkedin" />
                </a>
                <a href="https://github.com" className="text-slate-400 hover:text-white" aria-label="GitHub">
                  <i className="fa-brands fa-github" />
                </a>
              </div>
              <div className="mt-4 text-sm text-slate-400">prevue.ai@gmail.com</div>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 text-sm text-slate-500 flex flex-col md:flex-row justify-between items-center gap-3">
            <p>© {new Date().getFullYear()} ReVue Software Inc. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-brand-400">Privacy Policy</a>
              <a href="#" className="hover:text-brand-400">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>

      <SignupModal open={isSignupOpen} onClose={() => setIsSignupOpen(false)} />
    </div>
  );
}

LandingPage.propTypes = {
  onGetStarted: PropTypes.func.isRequired,
  onGoToAdmin: PropTypes.func,
};

export default LandingPage;
