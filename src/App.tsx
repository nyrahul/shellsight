import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Clusters from './pages/Clusters';
import MCPServers from './pages/MCPServers';
import JobDetails from './pages/JobDetails';
import AppLogs from './pages/AppLogs';
import ShellReplayPage from './pages/ShellReplay';
import ExecutionDetails from './pages/ExecutionDetails';
import ResourceUsagePage from './pages/ResourceUsage';
import GeneratedArtifacts from './pages/GeneratedArtifacts';
import OverallUsage from './pages/OverallUsage';
import Users from './pages/Users';
import Integrations from './pages/Integrations';

function App() {
  const [currentPage, setCurrentPage] = useState('clusters');

  const renderPage = () => {
    switch (currentPage) {
      case 'clusters':
        return <Clusters />;
      case 'mcp-servers':
        return <MCPServers />;
      case 'job-details':
        return <JobDetails />;
      case 'app-logs':
        return <AppLogs />;
      case 'shell-replay':
        return <ShellReplayPage />;
      case 'execution-details':
        return <ExecutionDetails />;
      case 'resource-usage':
        return <ResourceUsagePage />;
      case 'generated-artifacts':
        return <GeneratedArtifacts />;
      case 'resource-consumed':
        return <OverallUsage />;
      case 'users':
        return <Users />;
      case 'integrations':
        return <Integrations />;
      default:
        return <Clusters />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      <main className="flex-1 overflow-y-auto">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
