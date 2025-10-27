import React, { useState, useEffect, useRef } from 'react';
import Header from '../../components/common/Header.jsx';
import { CONTACT_US_GOOGLE_FORM_CONFIG, RATE_LIMIT_CONFIG, validateContactForm } from '../../config/contactUs.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

function LandingPage({ onGetStarted,onGoToAdmin}) {
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [contactUsFeedbackMessage, setContactUsFeedbackMessage] = useState({state: 'none', message: ''});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(null);
  const { isAuthenticated, isAdmin } = useAuth();

  const workflowSectionRef = useRef(null);
  const [workflowVisible, setWorkflowVisible] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  
  // Section refs for navigation
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const betterWayRef = useRef(null);
  const beforeAfterRef = useRef(null);
  const focusMattersRef = useRef(null);
  const whoIsItForRef = useRef(null);
  const howItWorksRef = useRef(null);
  const testimonialsRef = useRef(null);
  const teamRef = useRef(null);
  const contactRef = useRef(null);


  // Navigation functions
  const scrollToSection = (sectionId) => {
    const sectionRefs = {
      hero: heroRef,
      features: featuresRef,
      'better-way': betterWayRef,
      'before-after': beforeAfterRef,
      'focus-matters': focusMattersRef,
      'who-is-it-for': whoIsItForRef,
      'how-it-works': howItWorksRef,
      testimonials: testimonialsRef,
      team: teamRef,
      contact: contactRef
    };
    
    const targetRef = sectionRefs[sectionId];
    if (targetRef && targetRef.current) {
      targetRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactForm(prev => ({ ...prev, [name]: value }));
  };

  const validateContactUsSubmission = (formData) => {
    const now = Date.now();
    
    const validationErrors = validateContactForm(formData);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors[0]);
    }
    
    if (lastSubmitTime && (now - lastSubmitTime) < RATE_LIMIT_CONFIG.MIN_TIME_BETWEEN_SUBMISSIONS) {
      const remainingTime = Math.ceil((RATE_LIMIT_CONFIG.MIN_TIME_BETWEEN_SUBMISSIONS - (now - lastSubmitTime)) / 1000);
      throw new Error(`Please wait ${remainingTime} seconds before submitting again.`);
    }
    
    const submissionHistory = JSON.parse(localStorage.getItem('contactSubmissions') || '[]');
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentSubmissions = submissionHistory.filter(time => time > oneHourAgo);
    
    if (recentSubmissions.length >= RATE_LIMIT_CONFIG.MAX_SUBMISSIONS_PER_HOUR) {
      throw new Error(`You've reached the limit of ${RATE_LIMIT_CONFIG.MAX_SUBMISSIONS_PER_HOUR} submissions per hour. Please try again later.`);
    }
    
    return { recentSubmissions, now };
  };

  const handleContactUsSubmit = async (e) => {
    e.preventDefault();
    const { name, email, phone, message } = contactForm;
    if (!name.trim() || !email.trim() || !phone.trim() || !message.trim()) return;
    
    if (isSubmitting) return; // Prevent double submission
    
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
        mode: 'no-cors', // Required for Google Forms
      });
      
      const updatedSubmissions = [...recentSubmissions, now];
      localStorage.setItem('contactSubmissions', JSON.stringify(updatedSubmissions));
      setLastSubmitTime(now);
      
      setContactUsFeedbackMessage({state: 'success', message: ''});
      setContactForm({ name: '', email: '', phone: '', message: '' });
      setTimeout(() => setContactUsFeedbackMessage({state: 'none', message: ''}), 6000);
      
    } catch (error) {
      console.error('Form submission error:', error);
      
      if (error.message.includes('wait') || error.message.includes('limit')) {
        setContactUsFeedbackMessage({state: 'error', message: error.message});
        setTimeout(() => setErrorMessage(''), 5000);
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
    // Workflow animation observer
    const workflowObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setWorkflowVisible(true);
            workflowObserver.unobserve(workflowSectionRef.current);
          }
        });
      },
      { threshold: 0.2 }
    );

    if (howItWorksRef.current) {
      workflowObserver.observe(howItWorksRef.current);
    }

    // Scroll spy observer
    const scrollSpyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('data-section');
            if (sectionId) {
              setActiveSection(sectionId);
            }
          }
        });
      },
      { 
        threshold: 0.3,
        rootMargin: '-20% 0px -20% 0px'
      }
    );

    // Observe all sections
    const sections = [
      heroRef, featuresRef, betterWayRef, beforeAfterRef, 
      focusMattersRef, whoIsItForRef, howItWorksRef, 
      testimonialsRef, teamRef, contactRef
    ];

    sections.forEach(ref => {
      if (ref.current) {
        scrollSpyObserver.observe(ref.current);
      }
    });

    return () => {
      workflowObserver.disconnect();
      scrollSpyObserver.disconnect();
    };
  }, []);

  return (
      <div className="bg-white text-text-dark font-inter">
        <Header 
          onLogoClick={() => {}} // No action needed on landing page
          showNav={false}
          actionButton={
          <div className="flex items-center gap-x-2">
              {isAuthenticated && isAdmin && (
                <button
                  onClick={onGoToAdmin}
                  className="hidden sm:inline-flex items-center gap-x-2 rounded-md bg-main px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-main-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main"
                >
                  Admin Dashboard
                </button>
              )}
            <button
              onClick={onGetStarted}
              className="hidden sm:inline-flex items-center gap-x-2 rounded-md bg-main px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-main-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main"
            >
              Test Prototype
            </button>
          </div>
          }
          onGoToAdmin={onGoToAdmin}
        />

        {/* Navigation Menu */}
        <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-8">
                <div className="flex space-x-6">
                  {[
                    { id: 'hero', label: 'Home' },
                    { id: 'features', label: 'Features' },
                    { id: 'better-way', label: 'Better Way' },
                    { id: 'before-after', label: 'Before/After' },
                    { id: 'focus-matters', label: 'Focus' },
                    { id: 'who-is-it-for', label: 'Who Is It For' },
                    { id: 'how-it-works', label: 'How It Works' },
                    { id: 'testimonials', label: 'Testimonials' },
                    { id: 'team', label: 'Team' },
                    { id: 'contact', label: 'Contact' }
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={`text-sm font-medium transition-colors duration-200 ${
                        activeSection === item.id
                          ? 'text-main border-b-2 border-main'
                          : 'text-gray-600 hover:text-main'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <main ref={heroRef} data-section="hero" className="relative isolate">
          <div className="hero-bg">
            <div className="mx-auto max-w-4xl px-6 pt-24 pb-16 sm:pt-32 sm:pb-24 lg:pt-40 lg:pb-28 text-center">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-text-dark">
                <span className="block gradient-text">3 STEPS is all you need…</span>
                <span className="block mt-2 text-3xl sm:text-4xl lg:text-5xl">To Revolutionize how you search & screen literature.</span>
              </h1>
              <p className="mt-6 text-lg sm:text-xl leading-8 text-gray-700">
                PreVue is an AI-powered tool that builds optimized, multi-database queries for systematic reviews — helping you find what matters, faster.
                <strong className="text-secondary"> Save weeks of manual screening</strong> with smart query refinement and relevance filtering.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <button
                  onClick={onGetStarted}
                  className="rounded-md bg-main px-8 py-4 text-lg font-semibold text-white shadow-glow hover:bg-main-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main transition-transform transform hover:scale-105"
                >
                  Launch the Prototype
                </button>
              </div>
              <p className="mt-4 text-sm text-gray-500">You are invited to test an early-stage prototype.</p>
            </div>
          </div>

          {/* Key Features */}
          <div ref={featuresRef} data-section="features" className="bg-fill angled-top-white angled-bottom-fill py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              {/* Header */}
              <div className="max-w-3xl">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl text-left">
                  Key Features
                </h2>
                <p className="mt-4 text-lg leading-8 text-gray-600 text-left">
                  Everything you need for fast, reproducible, and intelligent literature searches.
                </p>
              </div>
              {/* Feature Cards */}
              <div className="mx-auto mt-16 grid max-w-lg grid-cols-1 gap-8 sm:max-w-2xl sm:grid-cols-2 lg:max-w-none lg:grid-cols-3">
                {/* Card 1 */}
                <div className="p-8 rounded-2xl bg-white shadow-md hover:shadow-lg transition-shadow duration-300">
                  <div className="text-pink-500 text-4xl mb-4">🧠</div>
                  <h3 className="text-lg font-semibold leading-7 text-gray-900">
                    AI Concept & Keyword Generator
                  </h3>
                  <p className="mt-2 text-base leading-7 text-gray-600">
                    Automatically extract research concepts and generate optimized keywords
                    using PICO, SPIDER, or CIMO frameworks.
                  </p>
                </div>

                {/* Card 2 */}
                <div className="p-8 rounded-2xl bg-white shadow-md hover:shadow-lg transition-shadow duration-300">
                  <div className="text-blue-500 text-4xl mb-4">🔍</div>
                  <h3 className="text-lg font-semibold leading-7 text-gray-900">
                    Smart Query Builder
                  </h3>
                  <p className="mt-2 text-base leading-7 text-gray-600">
                    Build multi-database queries (PubMed, Embase, Scopus, Web of Science,
                    Semantic Scholar, CORE) with live count tracking.
                  </p>
                </div>

                {/* Card 3 */}
                <div className="p-8 rounded-2xl bg-white shadow-md hover:shadow-lg transition-shadow duration-300">
                  <div className="text-purple-500 text-4xl mb-4">⚙️</div>
                  <h3 className="text-lg font-semibold leading-7 text-gray-900">
                    AI Query Refiner
                  </h3>
                  <p className="mt-2 text-base leading-7 text-gray-600">
                    Refine and compare results instantly, adjust fields, and apply negative
                    keywords for better precision.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div ref={betterWayRef} data-section="better-way" className="bg-white relative py-16 sm:py-24">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
                <div className="lg:text-left">
                  <h2 className="text-base font-semibold leading-7 text-secondary">A BETTER WAY TO SEARCH</h2>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-text-dark sm:text-4xl">Overcome the Bottlenecks of Manual Search</p>
                  <p className="mt-6 text-lg leading-8 text-gray-700">Even for the most seasoned researcher, building a comprehensive search strategy is a meticulous, time-intensive process. PreVue is designed to solve these core challenges.</p>
                </div>
                <div className="space-y-8">
                  <div className="relative pl-12">
                    <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-lg bg-main">
                      <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <dt className="text-base font-semibold leading-7 text-text-dark">
                      How much time do you spend wrestling with the unique <strong className="text-secondary">syntax of each database</strong>?
                    </dt>
                  </div>
                  <div className="relative pl-12">
                    <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-lg bg-main">
                      <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <dt className="text-base font-semibold leading-7 text-text-dark">
                      Can you guarantee your search is perfectly <strong className="text-secondary">reproducible and free of manual errors</strong>?
                    </dt>
                  </div>
                  <div className="relative pl-12">
                    <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-lg bg-main">
                      <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-11.664 0l4.992-4.993m-4.993 0l-3.181 3.183a8.25 8.25 0 000 11.664l3.181 3.183" />
                      </svg>
                    </div>
                    <dt className="text-base font-semibold leading-7 text-text-dark">
                      Is the search process delaying the real work of <strong className="text-secondary">screening and analysis</strong>?
                    </dt>
                  </div>
                </div>
              </div>
              <div className="mt-16 text-center">
                <div className="inline-block bg-gradient-to-r from-main to-teal-400 p-1 rounded-lg shadow-lg">
                  <div className="bg-white px-8 py-4 rounded-md">
                    <p className="text-xl font-bold text-text-dark">Automate the Mechanics. Elevate Your Research.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Before and After Section */}
          <div ref={beforeAfterRef} data-section="before-after" className="bg-fill angled-top-white angled-bottom-fill py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="mx-auto max-w-2xl lg:text-center">
                <p className="mt-2 text-3xl font-bold tracking-tight text-text-dark sm:text-4xl">Transform Your Workflow</p>
                <p className="mt-6 text-lg leading-8 text-gray-700">Move from complexity and manual effort to streamlined, automated precision.</p>
              </div>
              <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                {/* Before */}
                <div className="rounded-lg border-2 border-dashed border-secondary p-8 bg-white/50">
                  <h3 className="text-2xl font-bold text-secondary text-center">Before PreVue</h3>
                  <ul className="mt-6 space-y-4 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-secondary mr-2 font-bold">✗</span>
                      <span><strong className="text-secondary">Weeks</strong> of manual keyword brainstorming.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-secondary mr-2 font-bold">✗</span>
                      <span>Painstakingly <strong className="text-secondary">translating syntax</strong> for each database.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-secondary mr-2 font-bold">✗</span>
                      <span><strong className="text-secondary">Guesswork</strong> on keyword impact.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-secondary mr-2 font-bold">✗</span>
                      <span>Risk of <strong className="text-secondary">missing critical studies</strong>.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-secondary mr-2 font-bold">✗</span>
                      <span>Less time for <strong className="text-secondary">analysis and screening</strong>.</span>
                    </li>
                  </ul>
                </div>
                {/* After */}
                <div className="rounded-lg border-2 border-main p-8 bg-white shadow-xl">
                  <h3 className="text-2xl font-bold text-main text-center">After PreVue</h3>
                  <ul className="mt-6 space-y-4 text-text-dark">
                    <li className="flex items-start">
                      <span className="text-main mr-2 font-bold">✓</span>
                      <span>AI-powered concept expansion in <strong className="text-main">minutes</strong>.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-main mr-2 font-bold">✓</span>
                      <span><strong className="text-main">Instant, optimized queries</strong> for all databases.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-main mr-2 font-bold">✓</span>
                      <span><strong className="text-main">Live result counts</strong> for dynamic calibration.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-main mr-2 font-bold">✓</span>
                      <span><strong className="text-main">Comprehensive coverage</strong>, maximized results.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-main mr-2 font-bold">✓</span>
                      <span>More time to focus on what matters: <strong className="text-main">screening</strong>.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Focus on What Matters Section */}
          <div ref={focusMattersRef} data-section="focus-matters" className="bg-white py-16 sm:py-24">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="text-base font-semibold leading-7 text-main">FOCUS ON WHAT MATTERS</h2>
                <p className="mt-2 text-3xl font-bold tracking-tight text-text-dark sm:text-4xl">From Search Strategy to Evidence Synthesis, Faster.</p>
              </div>
              <div className="mt-12 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                <div className="bg-fill p-6 rounded-lg">
                  <p className="text-lg leading-8 text-gray-700">
                    PreVue <strong className="text-main">automates</strong> the tedious pre-screening search, capturing a greater number of relevant studies with higher precision.
                  </p>
                </div>
                <div className="bg-fill p-6 rounded-lg">
                  <p className="text-lg leading-8 text-gray-700">
                    This <strong className="text-main">frees you</strong> to dedicate your expertise to the most critical phases: <strong className="text-secondary">screening, analysis, and synthesis.</strong>
                  </p>
                </div>
              </div>
              <div className="mt-8 text-center">
                <p className="text-xl font-semibold leading-8 text-text-dark">Let us handle the mechanics, so you can focus on the science.</p>
              </div>
            </div>
          </div>

          {/* Who is it for Section */}
          <div ref={whoIsItForRef} data-section="who-is-it-for" className="bg-fill angled-top-white angled-bottom-fill py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="text-base font-semibold leading-7 text-main">BUILT FOR RESEARCHERS, BY RESEARCHERS</h2>
                <p className="mt-2 text-3xl font-bold tracking-tight text-text-dark sm:text-4xl">An Essential Tool for Every Review</p>
                <p className="mt-6 text-lg leading-8 text-gray-700">
                  Whether you're embarking on your <strong className="text-secondary">first systematic review or your fiftieth</strong>, PreVue provides an <strong className="text-main">intuitive and powerful</strong> platform to ensure your search is as <strong className="text-main">robust</strong> as your research.
                </p>
              </div>
              <div className="mx-auto mt-16 grid max-w-lg grid-cols-1 gap-8 sm:max-w-2xl sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3">
                <div className="text-center p-8 rounded-lg bg-white shadow-md transition-colors">
                  <h3 className="text-lg font-semibold leading-7 tracking-tight text-text-dark">The Student & Early-Career Researcher</h3>
                  <p className="mt-2 text-base leading-7 text-gray-700">
                    Accelerate your literature review and build a rock-solid foundation for your research with a reproducible, comprehensive search strategy.
                  </p>
                </div>
                <div className="text-center p-8 rounded-lg bg-white shadow-md transition-colors">
                  <h3 className="text-lg font-semibold leading-7 tracking-tight text-text-dark">The Experienced Researcher & PI</h3>
                  <p className="mt-2 text-base leading-7 text-gray-700">
                    Maximize your team's efficiency and the impact of your reviews. Free up valuable expert time for high-level analysis and synthesis.
                  </p>
                </div>
                <div className="text-center p-8 rounded-lg bg-white shadow-md transition-colors">
                  <h3 className="text-lg font-semibold leading-7 tracking-tight text-text-dark">The Research Team & Librarian</h3>
                  <p className="mt-2 text-base leading-7 text-gray-700">
                    Empower your collaborators with a tool that standardizes the search process, ensuring quality and consistency across all projects you support.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div ref={howItWorksRef} data-section="how-it-works" className="bg-white py-16 sm:py-24">
            <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-text-dark sm:text-4xl">A Radically Simple Workflow</h2>
              <p className="mt-4 text-lg text-gray-700">A streamlined process for superior results.</p>
              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                {/* Step 1 */}
                <div className={`p-6 bg-fill rounded-lg shadow-md transition-all duration-700 ${workflowVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                  <div className="text-3xl font-bold text-main">1</div>
                  <h3 className="mt-2 text-lg font-semibold text-text-dark">Define</h3>
                  <p className="mt-2 text-gray-700">Input your research question. Our AI deconstructs it into a strategic PICO framework and a rich set of initial keywords.</p>
                </div>
                {/* Step 2 */}
                <div className={`p-6 bg-fill rounded-lg shadow-md transition-all duration-700 delay-200 ${workflowVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                  <div className="text-3xl font-bold text-main">2</div>
                  <h3 className="mt-2 text-lg font-semibold text-text-dark">Refine</h3>
                  <p className="mt-2 text-gray-700">Refine your strategy in real-time. Toggle keywords and watch as live result counts update instantly across all databases.</p>
                </div>
                {/* Step 3 */}
                <div className={`p-6 bg-fill rounded-lg shadow-md transition-all duration-700 delay-400 ${workflowVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                  <div className="text-3xl font-bold text-main">3</div>
                  <h3 className="mt-2 text-lg font-semibold text-text-dark">Execute</h3>
                  <p className="mt-2 text-gray-700">With one click, execute your perfected search across every database simultaneously. Find, deduplicate, and export your findings.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Testimonials Section */}
          <div ref={testimonialsRef} data-section="testimonials" className="bg-fill angled-top-white py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="mx-auto max-w-xl text-center">
                <h2 className="text-lg font-semibold leading-8 tracking-tight text-main">Testimonials</h2>
                <p className="mt-2 text-3xl font-bold tracking-tight text-text-dark sm:text-4xl">What Researchers Say is the best about PreVue:</p>
              </div>
              <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 lg:max-w-none lg:grid-cols-2 xl:grid-cols-3 gap-8">
                {/* Testimonial 1 */}
                <figure className="rounded-2xl bg-white p-6 text-sm leading-6 shadow-lg">
                  <blockquote className="text-gray-900">
                    <p>"To be honest, i liked the idea of merging the keywords, the scope of search into one tool that gives the results in different journals and database which makes it easy to conduct systematic review"</p>
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-x-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold text-xs">SA</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">Mr. S A</div>
                      <div className="text-gray-600 text-xs">Master Student</div>
                    </div>
                  </figcaption>
                </figure>

                {/* Testimonial 2 */}
                <figure className="rounded-2xl bg-white p-6 text-sm leading-6 shadow-lg">
                  <blockquote className="text-gray-900">
                    <p>"It's convenience"</p>
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-x-3">
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold text-xs">OA</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">Mr. O A</div>
                      <div className="text-gray-600 text-xs">PharmD Student</div>
                    </div>
                  </figcaption>
                </figure>

                {/* Testimonial 3 */}
                <figure className="rounded-2xl bg-white p-6 text-sm leading-6 shadow-lg">
                  <blockquote className="text-gray-900">
                    <p>"The idea is amazing and has so much potential, the principle of unifying and simplifying a tedious manual workflow all in the same platform is extremely helpful to anyone doing a systematic review, it even cuts the time for brainstorming possible publishable papers since you don't have to do all these steps for each research question you have."</p>
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-x-3">
                    <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold text-xs">AG</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">Mr. A G</div>
                      <div className="text-gray-600 text-xs">Undergraduate Student</div>
                    </div>
                  </figcaption>
                </figure>

                {/* Testimonial 4 */}
                <figure className="rounded-2xl bg-white p-6 text-sm leading-6 shadow-lg">
                  <blockquote className="text-gray-900">
                    <p>"The concept of the idea is excellent. I watched the video and was very impressed"</p>
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-x-3">
                    <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold text-xs">ZN</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">Dr. Z N</div>
                      <div className="text-gray-600 text-xs">Researcher</div>
                    </div>
                  </figcaption>
                </figure>

                {/* Testimonial 5 */}
                <figure className="rounded-2xl bg-white p-6 text-sm leading-6 shadow-lg">
                  <blockquote className="text-gray-900">
                    <p>"simultaneous searches and AI integration to generate keywords"</p>
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-x-3">
                    <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold text-xs">ME</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">Dr. M E</div>
                      <div className="text-gray-600 text-xs">Researcher</div>
                    </div>
                  </figcaption>
                </figure>

                {/* Testimonial 6 */}
                <figure className="rounded-2xl bg-white p-6 text-sm leading-6 shadow-lg">
                  <blockquote className="text-gray-900">
                    <p>"How easy it is to use the website, the fact that the prompts can be added using the help of Ai, and that the number of studies shows for each database"</p>
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-x-3">
                    <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold text-xs">GA</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">Mr. G A</div>
                      <div className="text-gray-600 text-xs">PharmD Student</div>
                    </div>
                  </figcaption>
                </figure>

                {/* Testimonial 7 */}
                <figure className="rounded-2xl bg-white p-6 text-sm leading-6 shadow-lg">
                  <blockquote className="text-gray-900">
                    <p>"it can reduce alot of time, but you can add more things that also reduce screening time by enhancing the specificity of the results"</p>
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-x-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold text-xs">OM</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">Mr. O M</div>
                      <div className="text-gray-600 text-xs">Undergraduate Student</div>
                    </div>
                  </figcaption>
                </figure>

                {/* Testimonial 8 */}
                <figure className="rounded-2xl bg-white p-6 text-sm leading-6 shadow-lg">
                  <blockquote className="text-gray-900">
                    <p>"the aspect of giving you the keywords is very very useful and it is one of the most bothersome aspect of the traditional methods because you have to account for different databases."</p>
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-x-3">
                    <div className="h-8 w-8 rounded-full bg-pink-100 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold text-xs">AI</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">Mrs. A I</div>
                      <div className="text-gray-600 text-xs">Post-Grad Student</div>
                  </div>
                  </figcaption>
                </figure>

                {/* Testimonial 9 */}
                <figure className="rounded-2xl bg-white p-6 text-sm leading-6 shadow-lg">
                  <blockquote className="text-gray-900">
                    <p>"Innovative, will save researchers time"</p>
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-x-3">
                    <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold text-xs">HE</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">Prof. H E</div>
                      <div className="text-gray-600 text-xs">Researcher</div>
                    </div>
                  </figcaption>
                </figure>

                {/* Testimonial 10 */}
                <figure className="rounded-2xl bg-white p-6 text-sm leading-6 shadow-lg">
                  <blockquote className="text-gray-900">
                    <p>"ease of use and also the future impact that prevue holds , the use cases of this application is huge."</p>
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-x-3">
                    <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold text-xs">AE</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">Dr. A E</div>
                      <div className="text-gray-600 text-xs">MD & Post-Grad Student</div>
                    </div>
                  </figcaption>
                </figure>

                {/* Testimonial 11 - Previous */}
                <figure className="rounded-2xl bg-white p-6 text-sm leading-6 shadow-lg">
                  <blockquote className="text-gray-900">
                    <p>"PreVue saved me at least a week on my last systematic review. The time I got back for actual analysis was invaluable. It's a game-changer for building a comprehensive and reproducible search."</p>
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-x-3">
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold text-xs">R</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">Researcher</div>
                      <div className="text-gray-600 text-xs">Leading University</div>
                  </div>
                  </figcaption>
                </figure>

                {/* Testimonial 12 - Previous */}
                <figure className="rounded-2xl bg-white p-6 text-sm leading-6 shadow-lg">
                  <blockquote className="text-gray-900">
                    <p>"The ability to see live result counts as I refine my keywords is incredible. It removes all the guesswork and gives me complete confidence in my search strategy before I even begin screening."</p>
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-x-3">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold text-xs">IS</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">Information Specialist</div>
                      <div className="text-gray-600 text-xs">Medical Library</div>
                    </div>
                  </figcaption>
                </figure>
              </div>
            </div>
          </div>

          {/* Final CTA Section */}
          <div className="bg-text-dark">
            <div className="mx-auto max-w-4xl py-16 px-6 text-center sm:py-24 lg:px-8">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                <span className="block">Ready to Revolutionize Your Research?</span>
              </h2>
              <p className="mt-4 text-xl leading-8 text-white">
                Be Among the<strong className="text-main"> FIRST</strong> to Explore <strong className="text-main">PreVue</strong>
              </p>
              <button
                onClick={onGetStarted}
                className="mt-8 inline-block rounded-md bg-main px-8 py-4 text-lg font-semibold text-white shadow-glow hover:bg-main-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main transition-transform transform hover:scale-105"
              >
                Launch the Prototype
              </button>
            </div>
          </div>

          {/* Team Section */}
          <div ref={teamRef} data-section="team" className="bg-fill angled-top-white py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="mx-auto max-w-2xl lg:text-center">
                <h2 className="text-3xl font-bold tracking-tight text-text-dark sm:text-4xl">Meet the Innovators</h2>
                <p className="mt-4 text-lg leading-8 text-gray-700">The minds behind the mission to revolutionize research.</p>
              </div>
              <div className="mx-auto mt-16 grid max-w-lg grid-cols-1 gap-x-8 gap-y-16 sm:max-w-2xl sm:grid-cols-2 lg:mx-0 lg:max-w-none">
                <div className="text-center">
                  <div className="mx-auto h-48 w-48 rounded-full bg-gradient-to-br from-teal-100 to-teal-50 flex items-center justify-center">
                    <span className="text-6xl font-bold text-teal-600">HM</span>
                  </div>
                  <h3 className="mt-6 text-base font-semibold leading-7 tracking-tight text-text-dark">Hassan Mohammadian</h3>
                  <p className="text-sm leading-6 text-main">Founder</p>
                </div>
                <div className="text-center">
                  <div className="mx-auto h-48 w-48 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
                    <span className="text-6xl font-bold text-orange-600">MA</span>
                  </div>
                  <h3 className="mt-6 text-base font-semibold leading-7 tracking-tight text-text-dark">Mohammed Alsahal</h3>
                  <p className="text-sm leading-6 text-accent">Co-Founder</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Us Section */}
          <div ref={contactRef} data-section="contact" className="bg-white py-16 sm:py-24">
            <div className="mx-auto max-w-2xl px-6 lg:px-8 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-text-dark sm:text-4xl">Get in Touch</h2>
              <p className="mt-4 text-base leading-8 text-gray-700">Have questions, feedback, or want to collaborate? We'd love to hear from you.</p>
              
              <div className="mt-8 flex flex-col sm:flex-row sm:justify-center sm:gap-x-12 gap-y-6 text-base leading-7 text-gray-700">
                <div className="flex items-center justify-center gap-x-3">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M1.5 4.5a3 3 0 013-3h15a3 3 0 013 3v15a3 3 0 01-3 3h-15a3 3 0 01-3-3V4.5zM6.25 6.375a1.125 1.125 0 100 2.25h11.5a1.125 1.125 0 100-2.25H6.25zM6.25 10.875a1.125 1.125 0 100 2.25h11.5a1.125 1.125 0 100-2.25H6.25zM6.25 15.375a1.125 1.125 0 100 2.25h11.5a1.125 1.125 0 100-2.25H6.25z" />
                  </svg>
                  <span>Doha, Qatar</span>
                </div>
                <div className="flex items-center justify-center gap-x-3">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M1.5 4.5a3 3 0 013-3h15a3 3 0 013 3v15a3 3 0 01-3 3h-15a3 3 0 01-3-3V4.5zM6.25 6.375a1.125 1.125 0 100 2.25h11.5a1.125 1.125 0 100-2.25H6.25zM6.25 10.875a1.125 1.125 0 100 2.25h11.5a1.125 1.125 0 100-2.25H6.25zM6.25 15.375a1.125 1.125 0 100 2.25h11.5a1.125 1.125 0 100-2.25H6.25z" />
                  </svg>
                  <span>66442210</span>
                </div>
                <div className="flex items-center justify-center gap-x-3">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M1.5 4.5a3 3 0 013-3h15a3 3 0 013 3v15a3 3 0 01-3 3h-15a3 3 0 01-3-3V4.5zM6.25 6.375a1.125 1.125 0 100 2.25h11.5a1.125 1.125 0 100-2.25H6.25zM6.25 10.875a1.125 1.125 0 100 2.25h11.5a1.125 1.125 0 100-2.25H6.25zM6.25 15.375a1.125 1.125 0 100 2.25h11.5a1.125 1.125 0 100-2.25H6.25z" />
                  </svg>
                  <span>prevue.ai@gmail.com</span>
                </div>
              </div>

              <form
                onSubmit={handleContactUsSubmit}
                className="mt-8 mx-auto max-w-xl text-left"
              >
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold leading-6 text-text-dark">Full Name</label>
                  <div className="mt-2.5">
                    <input
                      type="text"
                      name="name"
                      id="name"
                      value={contactForm.name}
                      onChange={handleContactChange}
                      autoComplete="name"
                      required
                      className="block w-full rounded-md border-0 px-3.5 py-2 text-text-dark shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-main sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label htmlFor="email" className="block text-sm font-semibold leading-6 text-text-dark">Email</label>
                  <div className="mt-2.5">
                    <input
                      type="email"
                      name="email"
                      id="email"
                      value={contactForm.email}
                      onChange={handleContactChange}
                      autoComplete="email"
                      required
                      className="block w-full rounded-md border-0 px-3.5 py-2 text-text-dark shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-main sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label htmlFor="phone" className="block text-sm font-semibold leading-6 text-text-dark">Phone</label>
                  <div className="mt-2.5">
                    <input
                      type="tel"
                      name="phone"
                      id="phone"
                      value={contactForm.phone}
                      onChange={handleContactChange}
                      autoComplete="tel"
                      required
                      className="block w-full rounded-md border-0 px-3.5 py-2 text-text-dark shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-main sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label htmlFor="message" className="block text-sm font-semibold leading-6 text-text-dark">Message</label>
                  <div className="mt-2.5">
                    <textarea
                      name="message"
                      id="message"
                      rows={4}
                      value={contactForm.message}
                      onChange={handleContactChange}
                      required
                      className="block w-full rounded-md border-0 px-3.5 py-2 text-text-dark shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-main sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>
                
                {/* Honeypot field - hidden from users, bots might fill it */}
                <div style={{ display: 'none' }}>
                  <input
                    type="text"
                    name={RATE_LIMIT_CONFIG.HONEYPOT_FIELD}
                    value={contactForm[RATE_LIMIT_CONFIG.HONEYPOT_FIELD] || ''}
                    onChange={handleContactChange}
                    tabIndex="-1"
                    autoComplete="off"
                  />
                </div>
                
                <div className="mt-8">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`block w-full rounded-md px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main transition-colors ${
                      isSubmitting 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-main hover:bg-main-dark'
                    }`}
                  >
                    {isSubmitting ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </form>
              
              {contactUsFeedbackMessage && contactUsFeedbackMessage.state === 'success' && (
                <div className="mt-4 p-4 text-center text-sm text-green-800 bg-green-100 rounded-md">
                  Thank you for your message! We'll get back to you soon.
                </div>
              )}
              
              {contactUsFeedbackMessage && contactUsFeedbackMessage.state === 'error' && (
                <div className="mt-4 p-4 text-center text-sm text-red-800 bg-red-100 rounded-md">
                  {contactUsFeedbackMessage.message}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-text-dark">
          <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
            <div className="mt-8 border-t border-white/10 pt-8 text-center">
              <p className="text-sm leading-5 text-gray-400">&copy; 2024 PreVue Prototype. For research and testing purposes only.</p>
            </div>
          </div>
        </footer>
      </div>
  );
}

export default LandingPage;