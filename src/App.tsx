import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Clusters from './pages/Clusters';
import MCPServers from './pages/MCPServers';
import ShellReplayListPage from './pages/ShellReplayList';
import Users from './pages/Users';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LogOut, User } from 'lucide-react';

function AppContent() {
  const [currentPage, setCurrentPage] = useState('shell-replay-list');
  const { user, isAuthenticated, isLoading, authDisabled, logout } = useAuth();

  // Handle auth callback route
  if (window.location.pathname === '/auth/callback') {
    return (
      <AuthCallback
        onComplete={() => {
          window.history.replaceState({}, '', '/');
          window.location.reload();
        }}
      />
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'clusters':
        return <Clusters />;
      case 'mcp-servers':
        return <MCPServers />;
      case 'shell-replay-list':
        return <ShellReplayListPage />;
      case 'users':
        return <Users />;
      case 'integrations':
        return <Integrations />;
      case 'storage':
        return <Settings />;
      default:
        return <ShellReplayListPage />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-end gap-4">
          {authDisabled && (
            <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
              Auth Disabled
            </span>
          )}
          <div className="flex items-center gap-3">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
            )}
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user?.email}
              </p>
            </div>
          </div>
          {!authDisabled && (
            <button
              onClick={logout}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </header>
        <main className="flex-1 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
