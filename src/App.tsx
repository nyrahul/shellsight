import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Clusters from './pages/Clusters';
import MCPServers from './pages/MCPServers';
import ShellReplayListPage from './pages/ShellReplayList';
import Users from './pages/Users';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';

function App() {
  const [currentPage, setCurrentPage] = useState('shell-replay-list');

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
      <main className="flex-1 overflow-y-auto">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
