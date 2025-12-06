import React, { useState, useEffect, useRef } from 'react';
import Header from '../../components/common/Header.jsx';
import { CONTACT_US_GOOGLE_FORM_CONFIG, RATE_LIMIT_CONFIG, validateContactForm } from '../../config/contactUs.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import SignupModal from '../../components/common/SignupModal.jsx';

function LandingPage({ onGetStarted,onGoToAdmin}) {
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [contactUsFeedbackMessage, setContactUsFeedbackMessage] = useState({state: 'none', message: ''});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(null);
  const { isAuthenticated, isAdmin } = useAuth();
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [isAnnual, setIsAnnual] = useState(true);
  const [currentTestimonialSlide, setCurrentTestimonialSlide] = useState(0);
  const [isTestimonialsPaused, setIsTestimonialsPaused] = useState(false);

  const workflowSectionRef = useRef(null);
  const [workflowVisible, setWorkflowVisible] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const [currentFeatureSlide, setCurrentFeatureSlide] = useState(0);
  
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
  const pricingRef = useRef(null); 

// Testimonials data
const testimonials = [
  {
    quote: "To be honest, i liked the idea of merging the keywords, the scope of search into one tool that gives the results in different journals and database which makes it easy to conduct systematic review",
    initials: "SA",
    name: "Mr. S A",
    role: "Master Student",
    color: "blue"
  },
  {
    quote: "It's convenience",
    initials: "OA",
    name: "Mr. O A",
    role: "PharmD Student",
    color: "green"
  },
  {
    quote: "The idea is amazing and has so much potential, the principle of unifying and simplifying a tedious manual workflow all in the same platform is extremely helpful to anyone doing a systematic review, it even cuts the time for brainstorming possible publishable papers since you don't have to do all these steps for each research question you have.",
    initials: "AG",
    name: "Mr. A G",
    role: "Undergraduate Student",
    color: "purple"
  },
  {
    quote: "The concept of the idea is excellent. I watched the video and was very impressed",
    initials: "ZN",
    name: "Dr. Z N",
    role: "Researcher",
    color: "red"
  },
  {
    quote: "simultaneous searches and AI integration to generate keywords",
    initials: "ME",
    name: "Dr. M E",
    role: "Researcher",
    color: "orange"
  },
  {
    quote: "How easy it is to use the website, the fact that the prompts can be added using the help of Ai, and that the number of studies shows for each database",
    initials: "GA",
    name: "Mr. G A",
    role: "PharmD Student",
    color: "teal"
  },
  {
    quote: "it can reduce alot of time, but you can add more things that also reduce screening time by enhancing the specificity of the results",
    initials: "OM",
    name: "Mr. O M",
    role: "Undergraduate Student",
    color: "indigo"
  },
  {
    quote: "the aspect of giving you the keywords is very very useful and it is one of the most bothersome aspect of the traditional methods because you have to account for different databases.",
    initials: "AI",
    name: "Mrs. A I",
    role: "Post-Grad Student",
    color: "pink"
  },
  {
    quote: "Innovative, will save researchers time",
    initials: "HE",
    name: "Prof. H E",
    role: "Researcher",
    color: "yellow"
  },
  {
    quote: "ease of use and also the future impact that prevue holds , the use cases of this application is huge.",
    initials: "AE",
    name: "Dr. A E",
    role: "MD & Post-Grad Student",
    color: "cyan"
  }
];

const testimonialsPerPage = 2;
const totalTestimonialPages = Math.ceil(testimonials.length / testimonialsPerPage);
// Feature carousel features
const features = [
  {
    emoji: '🧠',
    color: 'text-pink-500',
    title: 'AI Concept & Keyword Generator',
    description: 'Automatically extract research concepts and generate optimized keywords using PICO, SPIDER, or CIMO frameworks.'
  },
  {
    emoji: '🔍',
    color: 'text-blue-500',
    title: 'Smart Query Builder',
    description: 'Build multi-database queries (PubMed, Embase, Scopus, Web of Science, Semantic Scholar, CORE) with live count tracking.'
  },
  {
    emoji: '⚙️',
    color: 'text-purple-500',
    title: 'AI Query Refiner',
    description: 'Refine and compare results instantly, adjust fields, and apply negative keywords for better precision.'
  },
  {
    emoji: '⚡',
    color: 'text-yellow-500',
    title: 'One-Click Multi-Database Search',
    description: 'Run your entire literature search across all selected databases simultaneously, saving hours of manual copy-pasting and logins.'
  },
  {
    emoji: '🔁',
    color: 'text-green-500',
    title: 'De-Duplication',
    description: 'Automatically detect and remove duplicate articles from multiple databases.'
  },
  {
    emoji: '🕓',
    color: 'text-indigo-500',
    title: 'Query History & Reproducibility Tracker',
    description: 'Track how your search evolved over time, compare versions, and ensure full transparency and reproducibility in your systematic review workflow.'
  },
  {
  emoji: '📦',
  color: 'text-orange-500',
  title: 'Export & Integration',
  description: 'Export results seamlessly to CSV, RIS, or EndNote.'
}
];

const nextTestimonial = () => {
  setCurrentTestimonialSlide((prev) => (prev + 1) % totalTestimonialPages);
};

const prevTestimonial = () => {
  setCurrentTestimonialSlide((prev) => (prev - 1 + totalTestimonialPages) % totalTestimonialPages);
};

// Group features into pages of 3
const featuresPerPage = 2;
const totalPages = Math.ceil(features.length / featuresPerPage);

const nextSlide = () => {
  setCurrentFeatureSlide((prev) => (prev + 1) % totalPages);
};

const prevSlide = () => {
  setCurrentFeatureSlide((prev) => (prev - 1 + totalPages) % totalPages);
};

const goToSlide = (index) => {
  setCurrentFeatureSlide(index);
};

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
      pricing: pricingRef,
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

  // Auto-advance testimonials carousel
useEffect(() => {
  if (isTestimonialsPaused) return;
  
  const timer = setInterval(() => {
    setCurrentTestimonialSlide((prev) => (prev + 1) % totalTestimonialPages);
  }, 5000);

  return () => clearInterval(timer);
}, [isTestimonialsPaused, totalTestimonialPages]);

  // Auto-advance carousel
useEffect(() => {
  const timer = setInterval(() => {
    setCurrentFeatureSlide((prev) => (prev + 1) % totalPages);
  }, 5000); // Auto-advance every 5 seconds

  return () => clearInterval(timer);
}, []);

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
              onClick={() => onGetStarted(true)}
              className="hidden sm:inline-flex items-center gap-x-2 rounded-md bg-main px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-main-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main"
            >
              Join the Waitlist
            </button>
          </div>
          }
          onGoToAdmin={onGoToAdmin}
        />

{/* Navigation Menu */}
        <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="flex items-center justify-center h-16">
              <div className="flex space-x-6">
                {[
                  { id: 'hero', label: 'Home' },
                  { id: 'features', label: 'Features' },
                  { id: 'pricing', label: 'Pricing' },
                  { id: 'how-it-works', label: 'How It Works' },
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
        </nav>

        {/* Hero Section */}
        <main ref={heroRef} data-section="hero" className="relative isolate">
          <div className="hero-bg">
            <div className="mx-auto max-w-4xl px-6 pt-24 pb-16 sm:pt-32 sm:pb-24 lg:pt-40 lg:pb-28 text-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-secondary/15 to-secondary/5 border-2 border-secondary/30 mb-6 shadow-sm">
                <svg className="w-5 h-5 text-secondary animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-sm font-bold text-secondary tracking-wide">Save Weeks of Screening Time</span>
              </div>
              
              {/* Main Heading */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-text-dark leading-tight">
                <span className="block text-main">3 STEPS</span>
                <span className="block mt-2">is all you need…</span>
              </h1>
              
              {/* Subheading */}
              <p className="mt-6 text-2xl sm:text-3xl lg:text-4xl font-bold text-text-dark whitespace-nowrap">
                To Revolutionize how you search & screen literature
              </p>
              
              {/* Description */}
              <p className="mt-6 text-lg sm:text-xl leading-8 text-gray-700">
                AI-powered systematic review tool that builds optimized queries and filters results.
              </p>
              
              {/* CTA Button */}
              <div className="mt-10 flex flex-col items-center justify-center gap-4">
                <button
                  onClick={() => setIsSignupOpen(true)}
                  className="group relative rounded-xl bg-main px-10 py-5 text-lg font-bold text-white shadow-xl hover:shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main transition-all duration-300 hover:scale-105 hover:bg-main-dark overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Join the Waitlist
                    <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                </button>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  You are invited to test an early-stage prototype
                </p>
              </div>
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
              
              {/* Feature Carousel */}
              <div className="mx-auto mt-16 relative">
                <div className="overflow-hidden">
                  <div 
                    className="flex transition-transform duration-500 ease-in-out"
                    style={{ transform: `translateX(-${currentFeatureSlide * 100}%)` }}
                  >
                    {Array.from({ length: totalPages }).map((_, pageIndex) => (
                      <div key={pageIndex} className="w-full flex-shrink-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
                          {features.slice(pageIndex * featuresPerPage, (pageIndex + 1) * featuresPerPage).map((feature, index) => (
                            <div key={index} className="p-8 rounded-2xl bg-white shadow-md hover:shadow-lg transition-shadow duration-300">
                              <div className={`${feature.color} text-4xl mb-4`}>{feature.emoji}</div>
                              <h3 className="text-lg font-semibold leading-7 text-gray-900 mb-3">
                                {feature.title}
                              </h3>
                              <p className="text-base leading-7 text-gray-600">
                                {feature.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Navigation Arrows */}
                <button
                  onClick={prevSlide}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-white rounded-full p-3 shadow-lg hover:bg-gray-100 transition-colors z-10"
                  aria-label="Previous features"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <button
                  onClick={nextSlide}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-white rounded-full p-3 shadow-lg hover:bg-gray-100 transition-colors z-10"
                  aria-label="Next features"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Dots Navigation */}
                <div className="flex justify-center gap-2 mt-8">
                  {Array.from({ length: totalPages }).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToSlide(index)}
                      className={`w-3 h-3 rounded-full transition-all duration-300 ${
                        index === currentFeatureSlide 
                          ? 'bg-main w-8' 
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                      aria-label={`Go to page ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Pricing Section */}
          <div ref={pricingRef} data-section="pricing" className="bg-white py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight text-text-dark sm:text-4xl">Simple Plans, Real Value</h2>
                <p className="mt-4 text-lg leading-8 text-gray-600">
                  Choose the plan that fits your research needs
                </p>
                <div className="mt-8 flex items-center justify-center gap-3">
                  <span className={`text-sm font-semibold ${!isAnnual ? 'text-text-dark' : 'text-gray-500'}`}>
                    Monthly
                  </span>
                  <button
                    onClick={() => setIsAnnual(!isAnnual)}
                    className="relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-main focus:ring-offset-2"
                    style={{ backgroundColor: isAnnual ? '#14b8a6' : '#d1d5db' }}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        isAnnual ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className={`text-sm font-semibold ${isAnnual ? 'text-text-dark' : 'text-gray-500'}`}>
                    Annual
                  </span>
                  {isAnnual && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                      Save 20%
                    </span>
                  )}
                </div>
              </div>
              
              <div className="mt-16 flex justify-center">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12 max-w-5xl w-full">
                  {/* Free Plan */}
                  <div className="relative rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-lg transition-shadow">
                    <h3 className="text-2xl font-bold text-text-dark">Free</h3>
                    <p className="mt-4 flex items-baseline gap-x-2">
                      <span className="text-5xl font-bold tracking-tight text-text-dark">$0</span>
                      <span className="text-base font-semibold leading-7 tracking-wide text-gray-600">/month</span>
                    </p>
                    <p className="mt-6 text-base leading-7 text-gray-600">Perfect for testing and exploring PreVue</p>
                    <ul className="mt-8 space-y-3 text-sm leading-6 text-gray-600">
                      <li className="flex gap-x-3">
                        <svg className="h-6 w-5 flex-none text-main" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span><strong>2</strong> projects</span>
                      </li>
                      <li className="flex gap-x-3">
                        <svg className="h-6 w-5 flex-none text-main" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span>AI Concept & Keywords Generation</span>
                      </li>
                      <li className="flex gap-x-3">
                        <svg className="h-6 w-5 flex-none text-main" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span>Multi-DB Query Generation (<strong>2 databases</strong>)</span>
                      </li>
                      <li className="flex gap-x-3">
                        <svg className="h-6 w-5 flex-none text-main" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span>Multi-DB Article Search (<strong>2 databases</strong>)</span>
                      </li>
                      <li className="flex gap-x-3">
                        <svg className="h-6 w-5 flex-none text-main" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span>Deduplication</span>
                      </li>
                      <li className="flex gap-x-3">
                        <svg className="h-6 w-5 flex-none text-main" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span>Export (limited to 50% of total count)</span>
                      </li>
                    </ul>
                    <button
                      onClick={() => setIsSignupOpen(true)}
                      className="mt-8 block w-full rounded-md bg-gray-600 px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
                    >
                      Get Started Free
                    </button>
                  </div>

                  {/* Premium Plan */}
                  <div className="relative rounded-2xl border-2 border-main bg-white p-8 shadow-xl">
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                      <span className="inline-flex rounded-full bg-main px-4 py-1 text-sm font-semibold text-white">
                        Most Popular
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-text-dark">Premium</h3>
                    <p className="mt-4 flex items-baseline gap-x-2">
                      <span className="text-5xl font-bold tracking-tight text-text-dark">
                        ${isAnnual ? '11.99' : '14.99'}
                      </span>
                      <span className="text-base font-semibold leading-7 tracking-wide text-gray-600">/month</span>
                    </p>
                    {isAnnual && (
                      <p className="text-sm text-gray-500">$119.90/year (Save 20%)</p>
                    )}
                    <p className="mt-6 text-base leading-7 text-gray-600">For all research-producing individuals</p>
                    <ul className="mt-8 space-y-3 text-sm leading-6 text-gray-600">
                      <li className="flex gap-x-3">
                        <svg className="h-6 w-5 flex-none text-main" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span><strong>Unlimited</strong> projects</span>
                      </li>
                      <li className="flex gap-x-3">
                        <svg className="h-6 w-5 flex-none text-main" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span><strong>Gap Finder</strong> - Identify research gaps</span>
                      </li>
                      <li className="flex gap-x-3">
                        <svg className="h-6 w-5 flex-none text-main" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span><strong>Generate Project with AI</strong></span>
                      </li>
                      <li className="flex gap-x-3">
                        <svg className="h-6 w-5 flex-none text-main" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span>AI Concept & Keywords Generation</span>
                      </li>
                      <li className="flex gap-x-3">
                        <svg className="h-6 w-5 flex-none text-main" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span>Multi-DB Query Generation (<strong>All databases</strong>)</span>
                      </li>
                      <li className="flex gap-x-3">
                        <svg className="h-6 w-5 flex-none text-main" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span><strong>AI Query Refiner</strong></span>
                      </li>
                      <li className="flex gap-x-3">
                        <svg className="h-6 w-5 flex-none text-main" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span><strong>Live Article Count</strong></span>
                      </li>
                      <li className="flex gap-x-3">
                        <svg className="h-6 w-5 flex-none text-main" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span>Multi-DB Article Search (<strong>All databases</strong>)</span>
                      </li>
                      <li className="flex gap-x-3">
                        <svg className="h-6 w-5 flex-none text-main" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span>Deduplication</span>
                      </li>
                      <li className="flex gap-x-3">
                        <svg className="h-6 w-5 flex-none text-main" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span><strong>Unlimited Export</strong></span>
                      </li>
                      <li className="flex gap-x-3">
                        <svg className="h-6 w-5 flex-none text-main" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span><strong>7 months early access</strong> to new features</span>
                      </li>
                    </ul>
                    <button
                      onClick={() => setIsSignupOpen(true)}
                      className="mt-8 block w-full rounded-md bg-main px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-main-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main"
                    >
                      Upgrade to Premium
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-12 text-center">
                <p className="text-sm text-gray-600">
                    {isAnnual ? (
                      <>All prices shown are monthly rates when billed annually</>
                    ) : (
                      <>Switch to annual billing and save 20%</>
                    )}
                  </p>
              </div>
            </div>
          </div>
          
           {/* better Way Section */}
          <div ref={betterWayRef} data-section="better-way" className="bg-fill angled-top-white angled-bottom-fill py-24 sm:py-32">
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
          <div ref={beforeAfterRef} data-section="before-after" className="bg-white relative py-16 sm:py-24">
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
          <div ref={focusMattersRef} data-section="focus-matters" className="bg-fill angled-top-white angled-bottom-fill py-24 sm:py-32">
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
          <div ref={whoIsItForRef} data-section="who-is-it-for" className="bg-white relative py-16 sm:py-24">
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
          <div ref={howItWorksRef} data-section="how-it-works" className="bg-fill angled-top-white angled-bottom-fill py-24 sm:py-32">
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
          <div ref={testimonialsRef} data-section="testimonials" className="bg-white relative py-16 sm:py-24">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="mx-auto max-w-xl text-center">
                <h2 className="text-lg font-semibold leading-8 tracking-tight text-main">Testimonials</h2>
                <p className="mt-2 text-3xl font-bold tracking-tight text-text-dark sm:text-4xl">What Researchers Say is the best about PreVue:</p>
              </div>
              
              {/* Testimonials Carousel */}
              <div className="mx-auto mt-16 max-w-4xl relative">
                <div 
                  className="overflow-hidden"
                  onMouseEnter={() => setIsTestimonialsPaused(true)}
                  onMouseLeave={() => setIsTestimonialsPaused(false)}
                >
                  <div 
                    className="flex transition-transform duration-500 ease-in-out"
                    style={{ transform: `translateX(-${currentTestimonialSlide * 100}%)` }}
                  >
                    {Array.from({ length: totalTestimonialPages }).map((_, pageIndex) => (
                      <div key={pageIndex} className="w-full flex-shrink-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
                          {testimonials.slice(pageIndex * testimonialsPerPage, (pageIndex + 1) * testimonialsPerPage).map((testimonial, index) => (
                            <figure key={index} className="rounded-2xl bg-white p-6 text-sm leading-6 shadow-lg">
                              <blockquote className="text-gray-900">
                                <p>"{testimonial.quote}"</p>
                              </blockquote>
                              <figcaption className="mt-4 flex items-center gap-x-3">
                                <div className={`h-8 w-8 rounded-full bg-${testimonial.color}-100 flex items-center justify-center`}>
                                  <span className="text-gray-600 font-semibold text-xs">{testimonial.initials}</span>
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900 text-sm">{testimonial.name}</div>
                                  <div className="text-gray-600 text-xs">{testimonial.role}</div>
                                </div>
                              </figcaption>
                            </figure>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Navigation Arrows */}
                <button
                  onClick={prevTestimonial}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 bg-white rounded-full p-3 shadow-lg hover:bg-gray-100 transition-colors z-10"
                  aria-label="Previous testimonials"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <button
                  onClick={nextTestimonial}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 bg-white rounded-full p-3 shadow-lg hover:bg-gray-100 transition-colors z-10"
                  aria-label="Next testimonials"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Dots Navigation */}
                <div className="flex justify-center gap-2 mt-8">
                  {Array.from({ length: totalTestimonialPages }).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentTestimonialSlide(index)}
                      className={`w-3 h-3 rounded-full transition-all duration-300 ${
                        index === currentTestimonialSlide 
                          ? 'bg-main w-8' 
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                      aria-label={`Go to testimonial page ${index + 1}`}
                    />
                  ))}
                </div>
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
                onClick={() => setIsSignupOpen(true)}
                className="mt-8 inline-block rounded-md bg-main px-8 py-4 text-lg font-semibold text-white shadow-glow hover:bg-main-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main transition-transform transform hover:scale-105"
              >
                Join the Waitlist
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

      {/* Signup Modal */}
      {isSignupOpen && (
        <SignupModal onClose={() => setIsSignupOpen(false)} />)
      }

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