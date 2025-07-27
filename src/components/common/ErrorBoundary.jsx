import React from 'react';
import toast from 'react-hot-toast';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error: error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo: errorInfo });
        toast.error("An unexpected error occurred! Please refresh the page.");
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 text-red-800 p-8">
                    <h2 className="text-2xl font-bold mb-4">Something went wrong.</h2>
                    <p className="text-lg text-center mb-4">We're sorry, an unexpected error occurred. Please try reloading the page.</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
                    >
                        Reload Page
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;