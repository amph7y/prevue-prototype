import React, { useState, useEffect, useRef } from 'react';
import Header from '../../components/common/Header.jsx';
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
  const [isAnnual, setIsAnnual] = useState(true);
  const [currentTestimonialSlide, setCurrentTestimonialSlide] = useState(0);
  const [isTestimonialsPaused, setIsTestimonialsPaused] = useState(false);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(1);


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


  const [demoStep, setDemoStep] = useState(1);
  const [demoExtracted, setDemoExtracted] = useState(false);

  const demoDb = [
    { key: 'pubmed', label: 'PubMed', count: 1240, enabled: true },
    { key: 'scopus', label: 'Scopus', count: 856, enabled: true },
    { key: 'embase', label: 'Embase', count: 1402, enabled: true },
  ];

  const [dbState, setDbState] = useState(() =>
    demoDb.reduce((acc, d) => ({ ...acc, [d.key]: d.enabled }), {})
  );

  const totalDemoCount = Object.entries(dbState).reduce((sum, [k, v]) => {
    if (!v) return sum;
    const item = demoDb.find(x => x.key === k);
    return sum + (item?.count || 0);
  }, 0);

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

      setContactUsFeedbackMessage({ state: 'success', message: '' });
      setContactForm({ name: '', email: '', phone: '', message: '' });
      setTimeout(() => setContactUsFeedbackMessage({ state: 'none', message: '' }), 6000);

    } catch (error) {
      console.error('Form submission error:', error);

      if (error.message.includes('wait') || error.message.includes('limit')) {
        setContactUsFeedbackMessage({ state: 'error', message: error.message });
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
  const avatarBgClass = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    purple: 'bg-purple-100',
    red: 'bg-red-100',
    orange: 'bg-orange-100',
    teal: 'bg-teal-100',
    indigo: 'bg-indigo-100',
    pink: 'bg-pink-100',
    yellow: 'bg-yellow-100',
    cyan: 'bg-cyan-100',
  };

  return (

    <div className="bg-white text-text-dark font-inter">
      <Header
        title="ReVue"
        showNav={true}
        activeSection={activeSection}
        onNavItemClick={scrollToSection}
        onLogoClick={() => scrollToSection('hero')}
        actionButton={
          <div className="flex items-center gap-x-2">
            {isAuthenticated && isAdmin && (
              <button
                onClick={onGoToAdmin}
                className="hidden sm:inline-flex items-center gap-x-2 rounded-md bg-main px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-main-dark"
              >
                Admin Dashboard
              </button>
            )}
            <button
              onClick={() => onGetStarted(true)}
              className="hidden sm:inline-flex items-center gap-x-2 rounded-md bg-main px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-main-dark"
            >
              Try Beta Version
            </button>
          </div>
        }
        onGoToAdmin={onGoToAdmin}
      />

      {/* Hero Section */}
      <main ref={heroRef} data-section="hero" className="relative isolate">
        <div className="hero-bg">
          <div className="mx-auto max-w-7xl px-6 pt-24 pb-16 sm:pt-32 sm:pb-24 lg:pt-36 lg:pb-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

              {/* Left: Text */}
              <div className="text-center lg:text-left">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 shadow-sm mb-6">
                  <span className="w-2 h-2 rounded-full bg-main animate-pulse" />
                  <span className="text-sm font-semibold text-gray-700">Reduce Errors & Save Time</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-text-dark leading-tight">
                  Optimize Your Search Strategy{" "}
                  <span className="text-main">Before You Screen.</span>
                </h1>

                <p className="mt-6 text-lg sm:text-xl text-gray-700 leading-relaxed">
                  ReVue Hub brings together four powerful AI-driven tools to streamline every stage of your research journey, starting with PreVue.
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <button
                    onClick={() => onGetStarted(true)}
                    className="rounded-xl bg-main px-8 py-4 text-base font-bold text-white shadow-xl hover:bg-main-dark transition-transform hover:scale-[1.02]"
                  >
                    Try Beta Version
                  </button>

                  <button
                    onClick={() => scrollToSection('how-it-works')}
                    className="rounded-xl bg-white px-8 py-4 text-base font-bold text-gray-800 border border-gray-200 shadow-sm hover:bg-gray-50"
                  >
                    See Workflow
                  </button>
                </div>
              </div>

              {/* Right: Demo Card */}
              <div className="relative">
                <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
                  {/* Browser header */}
                  <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-400" />
                      <span className="w-3 h-3 rounded-full bg-yellow-400" />
                      <span className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    <div className="mx-auto text-xs text-gray-400 bg-white border border-gray-200 rounded-md px-3 py-1">
                      app.prevue.ai/project/new
                    </div>
                  </div>

                  <div className="p-6">
                    {/* Stepper */}
                    <div className="flex items-center justify-between mb-6">
                      {[1, 2, 3].map(n => (
                        <div key={n} className="flex items-center flex-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${demoStep >= n ? 'bg-main text-white' : 'bg-gray-200 text-gray-500'
                            }`}>
                            {n}
                          </div>
                          {n !== 3 && (
                            <div className="h-0.5 flex-1 bg-gray-200 mx-2">
                              <div className={`h-0.5 bg-main transition-all`} style={{ width: demoStep > n ? '100%' : '0%' }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Step 1 */}
                    {demoStep === 1 && (
                      <div className="space-y-4">
                        <div className="text-center">
                          <h3 className="text-lg font-bold text-gray-900">Define Your Search</h3>
                          <p className="text-sm text-gray-500">Enter your research question. AI extracts PICO elements & keywords.</p>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs font-bold text-gray-400 uppercase">Research Question</div>
                          <div className="mt-1 text-sm font-medium text-gray-800">
                            For researchers, is PreVue better in optimizing pre-screening compared to other tools?
                          </div>
                        </div>

                        {!demoExtracted ? (
                          <button
                            onClick={() => { setDemoExtracted(true); }}
                            className="w-full rounded-lg bg-text-dark text-white py-3 font-bold hover:opacity-95"
                          >
                            Extract Concepts & Keywords
                          </button>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              {[
                                { tag: 'P', title: 'Researchers', desc: 'Academic, Scientist, Student...' },
                                { tag: 'I', title: 'PreVue Tool', desc: 'AI software, platform, validation...' },
                                { tag: 'C', title: 'Other Tools', desc: 'Manual searching, screening software...' },
                                { tag: 'O', title: 'Optimize Pre-Screening', desc: 'Efficiency, accuracy, error reduction...' },
                              ].map((x) => (
                                <div key={x.tag} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center font-bold">
                                      {x.tag}
                                    </span>
                                    <span className="font-bold text-gray-800">{x.title}</span>
                                  </div>
                                  <div className="mt-2 text-gray-600">{x.desc}</div>
                                </div>
                              ))}
                            </div>

                            <button
                              onClick={() => setDemoStep(2)}
                              className="w-full rounded-lg bg-main text-white py-3 font-bold hover:bg-main-dark"
                            >
                              Build Search Queries →
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Step 2 */}
                    {demoStep === 2 && (
                      <div className="space-y-4">
                        <div className="flex items-end justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">Refine Queries</h3>
                            <p className="text-xs text-gray-500">Toggle databases to view query syntax.</p>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-gray-400 font-bold uppercase">Total Matches</div>
                            <div className="text-xl font-extrabold text-main">{totalDemoCount.toLocaleString()}</div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {demoDb.map(db => (
                            <div key={db.key} className="border border-gray-200 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-3 text-sm font-bold text-gray-800">
                                  <input
                                    type="checkbox"
                                    checked={!!dbState[db.key]}
                                    onChange={() => setDbState(s => ({ ...s, [db.key]: !s[db.key] }))}
                                    className="h-4 w-4 accent-teal-600"
                                  />
                                  {db.label}
                                </label>
                                <span className={`text-[10px] px-2 py-1 rounded bg-gray-100 text-gray-700 ${dbState[db.key] ? '' : 'opacity-50'}`}>
                                  {db.count.toLocaleString()} records
                                </span>
                              </div>

                              {dbState[db.key] && (
                                <div className="mt-2 text-[10px] font-mono text-gray-600 bg-gray-50 border border-gray-100 rounded p-2 break-words">
                                  {db.key === 'pubmed' && '("systematic review" OR "search strategy") AND (validation OR syntax)'}
                                  {db.key === 'scopus' && 'TITLE-ABS-KEY(search strategy) AND TITLE-ABS-KEY(validation)'}
                                  {db.key === 'embase' && `'systematic review'/exp AND 'search strategy'/exp AND validation`}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button onClick={() => setDemoStep(1)} className="px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50">
                            Back
                          </button>
                          <button
                            onClick={() => setDemoStep(3)}
                            className="flex-1 px-4 py-3 rounded-lg bg-main text-white font-bold hover:bg-main-dark"
                          >
                            Run Live Search ⚡
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step 3 */}
                    {demoStep === 3 && (
                      <div className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                          <svg className="w-9 h-9 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.285 6.709a1 1 0 010 1.414l-9.192 9.192a1 1 0 01-1.414 0L3.715 11.35a1 1 0 011.414-1.414l4.243 4.243 8.485-8.485a1 1 0 011.428.015z" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-extrabold text-gray-900">Pre-Screening Optimized</h3>
                        <p className="text-sm text-gray-600">Search executed and duplicates removed, ready for screening.</p>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                            <div className="text-[10px] uppercase text-gray-400 font-bold">Total</div>
                            <div className="text-lg font-extrabold">{totalDemoCount.toLocaleString()}</div>
                          </div>
                          <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                            <div className="text-[10px] uppercase text-red-400 font-bold">Duplicates</div>
                            <div className="text-lg font-extrabold text-red-600">-945</div>
                          </div>
                          <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                            <div className="text-[10px] uppercase text-green-600 font-bold">Unique</div>
                            <div className="text-lg font-extrabold text-green-700">{Math.max(0, totalDemoCount - 945).toLocaleString()}</div>
                          </div>
                        </div>

                        <button
                          onClick={() => { setDemoStep(1); setDemoExtracted(false); }}
                          className="w-full rounded-lg bg-text-dark text-white py-3 font-bold hover:opacity-95"
                        >
                          Export Results
                        </button>
                      </div>
                    )}

                  </div>
                </div>

                <p className="mt-3 text-xs text-gray-400 text-center italic">
                  * Sample data for demonstration.
                </p>
              </div>

            </div>
          </div>
        </div>


        {/* Problem / Statistic Hook */}
        <section
          data-section="problem"
          className="py-20 bg-text-dark text-white relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,#ffffff_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="mx-auto max-w-4xl px-6 text-center relative">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-6">
              <svg className="w-8 h-8 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A2 2 0 004.5 20h15a2 2 0 001.71-3.14l-7.5-13a2 2 0 00-3.42 0z" />
              </svg>
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold leading-tight">
              <span className="text-red-500">92.7%</span> of search strategies contain errors.
            </h2>
            <p className="mt-4 text-lg text-white/80 italic">Oliván, J. A. S., Cuenca, G. M., & Avilés, R. A. (2019). Errors in search strategies used in systematic reviews and their effects on information retrieval. Journal of the Medical Library Association, 107(2). https://doi.org/10.5195/jmla.2019.567</p>
            <div className="w-24 h-1 bg-yellow-300 mx-auto my-10" />
            <p className="text-lg sm:text-xl text-white/85 leading-relaxed">
               A <span className="text-red-500 font-semibold">single missed</span> term or incorrect boolean operator can invalidate months of work.
            </p>
            <p className="text-lg sm:text-xl text-white/85 leading-relaxed">
              PreVue validates your strategy
              <span className="text-main font-semibold"> before</span> you screen.
            </p>
          </div>
        </section>

        {/* How it works */}
        <div
          ref={howItWorksRef}
          data-section="how-it-works"
          className="py-20 bg-white"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Heading */}
            <div className="text-center mb-16">
              <h2 className="text-main font-semibold tracking-wide uppercase text-sm mb-2">
                A Radically Simple Workflow
              </h2>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900">
                Define, Refine, and Execute.
              </h3>
            </div>

            {/* Cards wrapper */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Connecting Line (Desktop) */}
              <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-slate-200 -z-10" />

              {/* Step 1 */}
              <button
                type="button"
                onClick={() => setActiveWorkflowStep(1)}
                className={`relative bg-white p-6 text-center rounded-xl border transition-all duration-200 ${activeWorkflowStep === 1
                  ? "border-main shadow-lg"
                  : "border-slate-200 hover:border-main"
                  }`}
              >
                <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-lg">
                  <span className="text-3xl font-bold text-main">1</span>
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">Define</h4>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Input your research question. Our AI deconstructs it into a strategic
                  PICO framework and a rich set of initial keywords.
                </p>
              </button>

              {/* Step 2 */}
              <button
                type="button"
                onClick={() => setActiveWorkflowStep(2)}
                className={`relative bg-white p-6 text-center rounded-xl border transition-all duration-200 ${activeWorkflowStep === 2
                  ? "border-main shadow-lg"
                  : "border-slate-200 hover:border-main"
                  }`}
              >
                <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-lg">
                  <span className="text-3xl font-bold text-main">2</span>
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">Refine</h4>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Refine your strategy in real-time. Toggle keywords and watch as live
                  result counts update instantly across all databases.
                </p>
              </button>

              {/* Step 3 */}
              <button
                type="button"
                onClick={() => setActiveWorkflowStep(3)}
                className={`relative bg-white p-6 text-center rounded-xl border transition-all duration-200 ${activeWorkflowStep === 3
                  ? "border-main shadow-lg"
                  : "border-slate-200 hover:border-main"
                  }`}
              >
                <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-lg">
                  <span className="text-3xl font-bold text-main">3</span>
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">Execute</h4>
                <p className="text-slate-600 leading-relaxed text-sm">
                  With one click, execute your perfected search across every database
                  simultaneously. Find, deduplicate, and export your findings.
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* ReVue Hub Section */}
        <section
          id="hub-ecosystem"
          data-section="hub-ecosystem"
          className="relative py-20 lg:py-24 bg-text-dark text-white overflow-hidden"
        >
          {/* soft glows */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-main/10 blur-3xl" />
            <div className="absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="text-center mb-14 lg:mb-16">
              <h2 className="text-main font-semibold tracking-wide uppercase text-sm mb-3">
                REVUE HUB
              </h2>

              <h3 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
                Academic Research Tool Hub
              </h3>

              <p className="mt-5 max-w-3xl mx-auto text-white/70 text-base md:text-lg leading-relaxed">
                One integrated platform containing all the tools you need for a successful research career.
              </p>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Tool 1: PreVue (LIVE) */}
              <div className="relative rounded-2xl p-7 bg-white/5 border border-main/60 ring-1 ring-main/20 hover:shadow-glow transition-all duration-300">
                <div className="absolute top-0 right-0 bg-main text-text-dark text-xs font-extrabold px-3 py-1 rounded-bl-xl rounded-tr-2xl">
                  LIVE
                </div>

                <div className="mb-6">
                  <div className="h-14 w-14 rounded-xl flex items-center justify-center bg-white/5 border border-white/10">
                    {/* Filter icon */}
                    <svg viewBox="0 0 24 24" className="h-7 w-7 text-main" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18l-7 8v5l-4 2v-7L3 5z" />
                    </svg>
                  </div>
                </div>

                <h4 className="text-xl font-extrabold text-white mb-3">PreVue</h4>
                <p className="text-white/70 text-sm leading-relaxed mb-6">
                  Facilitates pre-screening steps in academic reviews by validating syntax and deduplicating results.
                </p>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 text-white font-bold text-sm hover:text-main transition-colors"
                >
                  Learn more <span aria-hidden>→</span>
                </a>
              </div>

              {/* Tool 2: Academic AI Writer */}
              <div className="relative rounded-2xl p-7 bg-white/5 border border-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/20 transition-all duration-300">
                <div className="mb-6">
                  <div className="h-14 w-14 rounded-xl flex items-center justify-center bg-white/5 border border-white/10">
                    {/* Pen icon */}
                    <svg viewBox="0 0 24 24" className="h-7 w-7 text-sky-400" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4 11.5-11.5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                    </svg>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <h4 className="text-xl font-extrabold text-white">Academic AI Writer</h4>
                  <span className="inline-flex items-center rounded-full bg-white/10 border border-white/10 px-3 py-1 text-[11px] font-semibold text-white/70">
                    Coming Soon
                  </span>
                </div>

                <p className="text-white/65 text-sm leading-relaxed">
                  Assists in the scientific manuscript writing process with citation-aware drafting and editing.
                </p>
              </div>

              {/* Tool 3: Gap Finder */}
              <div className="relative rounded-2xl p-7 bg-white/5 border border-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/20 transition-all duration-300">
                <div className="mb-6">
                  <div className="h-14 w-14 rounded-xl flex items-center justify-center bg-white/5 border border-white/10">
                    {/* Map pin icon */}
                    <svg viewBox="0 0 24 24" className="h-7 w-7 text-purple-400" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-4.35 7-11a7 7 0 10-14 0c0 6.65 7 11 7 11z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10a2 2 0 100-4 2 2 0 000 4z" />
                    </svg>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <h4 className="text-xl font-extrabold text-white">Gap Finder</h4>
                  <span className="inline-flex items-center rounded-full bg-white/10 border border-white/10 px-3 py-1 text-[11px] font-semibold text-white/70">
                    Coming Soon
                  </span>
                </div>

                <p className="text-white/65 text-sm leading-relaxed">
                  Map the understudied areas and future study recommendations in the scientific community.
                </p>
              </div>

              {/* Tool 4: ReApply */}
              <div className="relative rounded-2xl p-7 bg-white/5 border border-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/20 transition-all duration-300">
                <div className="mb-6">
                  <div className="h-14 w-14 rounded-xl flex items-center justify-center bg-white/5 border border-white/10">
                    {/* Paper plane icon */}
                    <svg viewBox="0 0 24 24" className="h-7 w-7 text-orange-400" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <h4 className="text-xl font-extrabold text-white">ReApply</h4>
                  <span className="inline-flex items-center rounded-full bg-white/10 border border-white/10 px-3 py-1 text-[11px] font-semibold text-white/70">
                    Coming Soon
                  </span>
                </div>

                <p className="text-white/65 text-sm leading-relaxed">
                  Streamline applying your manuscript to multiple journals with automated formatting.
                </p>
              </div>
            </div>
          </div>
        </section>
        {/* Key Features */}
        <div
          ref={featuresRef}
          data-section="features"
          className="py-24 bg-slate-50"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Header */}
            <div className="text-center mb-16">
              <h2 className="text-main font-semibold tracking-wide uppercase text-sm mb-2">
                Powerful Features
              </h2>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900">
                Everything you need for a rigorous review
              </h3>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

              {/* Feature 1 */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="text-main text-2xl mb-4">🧠</div>
                <h4 className="font-bold text-lg text-slate-900 mb-2">
                  AI Concept & Keyword Generator
                </h4>
                <p className="text-sm text-slate-600">
                  Your Complete Academic
                  Research Ecosystem
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="text-blue-500 text-2xl mb-4">🧩</div>
                <h4 className="font-bold text-lg text-slate-900 mb-2">
                  Smart Query Builder
                </h4>
                <p className="text-sm text-slate-600">
                  Build multi-database queries (PubMed, Embase, Scopus, Web of Science,
                  Semantic Scholar, CORE) with live count tracking.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="text-indigo-500 text-2xl mb-4">🔍</div>
                <h4 className="font-bold text-lg text-slate-900 mb-2">
                  One-Click Multi-Database Search
                </h4>
                <p className="text-sm text-slate-600">
                  Run your entire literature search across all selected databases
                  simultaneously, saving hours of manual work.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="text-orange-500 text-2xl mb-4">🎚️</div>
                <h4 className="font-bold text-lg text-slate-900 mb-2">
                  AI Query Refiner
                </h4>
                <p className="text-sm text-slate-600">
                  Refine and compare results instantly, adjust fields, and apply negative
                  keywords for better precision.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="text-teal-500 text-2xl mb-4">📄</div>
                <h4 className="font-bold text-lg text-slate-900 mb-2">
                  De-Duplication & Export
                </h4>
                <p className="text-sm text-slate-600">
                  Automatically detect and remove duplicate articles. Export seamlessly
                  to CSV, RIS, or EndNote.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="text-slate-500 text-2xl mb-4">🕘</div>
                <h4 className="font-bold text-lg text-slate-900 mb-2">
                  Query History & Reproducibility
                </h4>
                <p className="text-sm text-slate-600">
                  Track how your search evolved over time, compare versions, and ensure
                  full transparency in your workflow.
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* Pricing Section */}
        <section
          ref={pricingRef}
          data-section="pricing"
          id="pricing"
          className="py-24 bg-white relative overflow-hidden"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-12">
              <h2 className="text-main font-semibold tracking-wide uppercase text-sm mb-2">
                Transparent Pricing
              </h2>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                Choose the plan that fits your research
              </h3>

              {/* Pricing Toggle */}
              <div className="flex items-center justify-center gap-4">
                <span className={`text-sm font-medium ${!isAnnual ? "text-slate-900" : "text-slate-500"}`}>
                  Billed Monthly
                </span>

                <button
                  type="button"
                  onClick={() => setIsAnnual((v) => !v)}
                  className={[
                    "relative inline-flex h-8 w-14 items-center rounded-full transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-main focus:ring-offset-2",
                    isAnnual ? "bg-main" : "bg-slate-200",
                  ].join(" ")}
                  aria-label="Toggle billing"
                >
                  <span
                    className={[
                      "inline-block h-6 w-6 transform rounded-full bg-white transition shadow",
                      isAnnual ? "translate-x-7" : "translate-x-1",
                    ].join(" ")}
                  />
                </button>

                <span className={`text-sm font-bold ${isAnnual ? "text-slate-900" : "text-slate-500"}`}>
                  Billed Annually
                </span>

                <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  SAVE 20%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Free Plan */}
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-lg hover:border-main/40 transition-colors">
                <h4 className="text-2xl font-bold text-slate-900 mb-2">Free Forever</h4>
                <p className="text-slate-500 text-sm mb-6">
                  Perfect for testing and exploring ReVue
                </p>

                <div className="flex items-baseline mb-8">
                  <span className="text-4xl font-extrabold text-slate-900">$0</span>
                  <span className="text-slate-500 ml-1">/month</span>
                </div>

                <ul className="space-y-4 mb-8 text-sm text-slate-600">
                  {[
                    "2 projects",
                    "AI Concept & Keywords Generation",
                    "Multi-DB Query Generation (2 databases)",
                    "Multi-DB Article Search (2 databases)",
                    "Deduplication",
                    "Export (limited to 50% of total count)",
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 text-main">✓</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => onGetStarted(true)}
                  className="block w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-center rounded-lg font-bold transition-colors"
                >
                  Try Beta Version
                </button>
              </div>

              {/* Premium Plan */}
              <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl relative text-white">
                <div className="absolute top-0 right-0 bg-main text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                  POPULAR
                </div>

<h4 className="text-2xl font-bold text-amber-400">Distinguished Researcher</h4>

                <div className="flex items-baseline mb-1">
                  <span className="text-4xl font-extrabold text-white">
                    ${isAnnual ? "11.99" : "14.99"}
                  </span>
                  <span className="text-slate-400 ml-1">/month</span>
                </div>

                <p className="text-xs text-main/90 mb-8 font-semibold">
                  {isAnnual ? "$143.88 billed annually (Save 20%)" : "Billed monthly"}
                </p>

                <ul className="space-y-4 mb-8 text-sm text-slate-300">
                  {[
                    "Unlimited projects",
                    "<span class='text-main font-bold'>Gap Finder</span> - Identify research gaps",
                    "Generate Project with AI",
                    "AI Concept & Keywords Generation",
                    "Multi-DB Query Generation (All databases)",
                    "AI Query Refiner & Live Article Count",
                    "Multi-DB Article Search (All databases)",
                    "Deduplication & Unlimited Export",
                    "7 months early access to new features",
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 text-main">✓</span>
                      <span dangerouslySetInnerHTML={{ __html: t }} />
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => setIsSignupOpen(true)}
                  className="block w-full py-3 bg-main hover:bg-main-dark text-white text-center rounded-lg font-bold transition-colors shadow-lg shadow-main/30"
                >
                  Try Beta Version
                </button>
              </div>
            </div>
          </div>
        </section>


        {/* better Way Section */}
        {/* <div ref={betterWayRef} data-section="better-way" className="bg-fill angled-top-white angled-bottom-fill py-24 sm:py-32">
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
        </div> */}

        {/* Before and After Section */}
        {/* <div ref={beforeAfterRef} data-section="before-after" className="bg-white relative py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl lg:text-center">
              <p className="mt-2 text-3xl font-bold tracking-tight text-text-dark sm:text-4xl">Transform Your Workflow</p>
              <p className="mt-6 text-lg leading-8 text-gray-700">Move from complexity and manual effort to streamlined, automated precision.</p>
            </div>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
=              <div className="rounded-lg border-2 border-dashed border-secondary p-8 bg-white/50">
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
=              <div className="rounded-lg border-2 border-main p-8 bg-white shadow-xl">
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
        </div> */}

        {/* Focus on What Matters Section */}
        {/* <div ref={focusMattersRef} data-section="focus-matters" className="bg-fill angled-top-white angled-bottom-fill py-24 sm:py-32">
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
        </div> */}





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
                              <div className={`h-8 w-8 rounded-full ${avatarBgClass[testimonial.color] || 'bg-gray-100'} flex items-center justify-center`}>
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
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${index === currentTestimonialSlide
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
        <section className="py-20 bg-gradient-to-br from-text-dark to-gray-900 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />

          <div className="mx-auto max-w-4xl px-6 text-center relative">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white">Ready to perfect your search?</h2>
            <p className="mt-4 text-xl text-white/80">Join researchers optimizing their systematic reviews.</p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setIsSignupOpen(true)}
                className="px-8 py-4 rounded-xl bg-main text-white font-bold shadow-xl hover:bg-main-dark"
              >
                Join Waitlist
              </button>
              <button
                onClick={() => scrollToSection('contact')}
                className="px-8 py-4 rounded-xl bg-white text-gray-900 font-bold border border-white/20 hover:bg-gray-50"
              >
                Talk to us
              </button>
            </div>

            <p className="mt-6 text-sm text-white/60">Limited spots available for beta access.</p>
          </div>
        </section>
        {/* Team Section
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
        </div> */}

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
                  className={`block w-full rounded-md px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main transition-colors ${isSubmitting
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