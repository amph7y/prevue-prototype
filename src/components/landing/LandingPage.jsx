import React from 'react';
import { ArrowRightIcon, MagnifyingGlassIcon, SparklesIcon, DocumentTextIcon, ChartBarIcon, AcademicCapIcon } from '../../components/common/Icons.jsx';
import Header from '../../components/common/Header.jsx';

function LandingPage({ onGetStarted }) {
  const [contactForm, setContactForm] = React.useState({ name: '', email: '', message: '' });

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactForm(prev => ({ ...prev, [name]: value }));
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    const { name, email, message } = contactForm;
    if (!name.trim() || !email.trim() || !message.trim()) return;
    const subject = encodeURIComponent(`Prevue Contact - ${name}`);
    const body = encodeURIComponent(`${message}\n\nFrom: ${name}\nEmail: ${email}`);
    window.location.href = `mailto:prevue.ai@gmail.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Navigation */}
      <Header title="Prevue" showNav={true} />

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Find the Research Papers
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600"> You Need</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Master the first step of systematic reviews by translating your research question into optimized search queries using PICO, SPIDER, and other frameworks with AI-powered keyword suggestions. Find the research papers you need faster and more accurately.
            </p>
            <div className="flex justify-center">
              <button
                onClick={onGetStarted}
                className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200 shadow-lg hover:shadow-xl"
              >
                Get Started Free
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Hero Image/Illustration */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-96 h-96 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full opacity-20"></div>
            </div>
            <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl">
                  <MagnifyingGlassIcon className="h-12 w-12 text-indigo-600 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Research Frameworks</h3>
                  <p className="text-gray-600">Use PICO, SPIDER, and other frameworks to structure your research question</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl">
                  <SparklesIcon className="h-12 w-12 text-purple-600 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Keywords</h3>
                  <p className="text-gray-600">Get AI-suggested keywords and MeSH terms for comprehensive searches</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl">
                  <DocumentTextIcon className="h-12 w-12 text-green-600 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Find Your Papers</h3>
                  <p className="text-gray-600">Get the research papers you need with optimized search queries</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Find the research papers you need
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From research question to relevant papers, streamline every step of your literature search.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-8 rounded-xl">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-6">
                <MagnifyingGlassIcon className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Question Translation</h3>
              <p className="text-gray-600 mb-4">
                Transform your research question into structured formats using PICO, SPIDER, and other systematic review frameworks.
              </p>
              <ul className="text-sm text-gray-500 space-y-2">
                <li>• Multiple framework support</li>
                <li>• AI-guided breakdown</li>
                <li>• Systematic review standards</li>
              </ul>
            </div>

            <div className="bg-gray-50 p-8 rounded-xl">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
                <SparklesIcon className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Smart Paper Discovery</h3>
              <p className="text-gray-600 mb-4">
                Find relevant research papers with AI-powered search optimization and intelligent result ranking.
              </p>
              <ul className="text-sm text-gray-500 space-y-2">
                <li>• Optimized search queries</li>
                <li>• Intelligent result ranking</li>
                <li>• Comprehensive coverage</li>
              </ul>
            </div>

            <div className="bg-gray-50 p-8 rounded-xl">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-6">
                <DocumentTextIcon className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Paper Organization</h3>
              <p className="text-gray-600 mb-4">
                Organize and manage the research papers you find with comprehensive tracking and export tools.
              </p>
              <ul className="text-sm text-gray-500 space-y-2">
                <li>• Paper collection</li>
                <li>• Literature tracking</li>
                <li>• Export capabilities</li>
              </ul>
            </div>

            <div className="bg-gray-50 p-8 rounded-xl">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-6">
                <DocumentTextIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Export & Share</h3>
              <p className="text-gray-600 mb-4">
                Export your research findings in multiple formats and share with colleagues or supervisors.
              </p>
              <ul className="text-sm text-gray-500 space-y-2">
                <li>• Multiple export formats</li>
                <li>• Citation management</li>
                <li>• Easy sharing</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-gradient-to-r from-indigo-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to transform your research process?
          </h2>
          <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
            Join researchers worldwide who are already using Prevue to accelerate their literature reviews and discover groundbreaking insights.
          </p>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-lg text-indigo-600 bg-white hover:bg-gray-50 transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            Start Your Free Trial
            <ArrowRightIcon className="ml-2 h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Contact Us */}
      <div id="contact" className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">Contact Us</h2>
          <p className="text-gray-600 text-center mb-8">Have questions or feedback? Send us a message and we'll get back to you.</p>
          <form onSubmit={handleContactSubmit} className="bg-gray-50 rounded-xl shadow p-6 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
              <input id="name" name="name" value={contactForm.name} onChange={handleContactChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <input id="email" name="email" type="email" value={contactForm.email} onChange={handleContactChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700">Message</label>
              <textarea id="message" name="message" rows={5} value={contactForm.message} onChange={handleContactChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
            </div>
            <div className="flex justify-end">
              <button type="submit" className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700">
                Send Message
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Prevue</h3>
              <p className="text-gray-400">
                Empowering researchers with AI-driven insights and comprehensive literature review tools.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Resources</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Tutorials</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Prevue. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage; 