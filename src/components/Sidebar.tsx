import { useState } from 'react';
import {
  Server,
  Activity,
  Settings,
  ChevronDown,
  ChevronRight,
  Package,
  Database,
  FileText,
  Terminal,
  Cpu,
  BarChart3,
  Users,
  Plug,
  Shield,
  RotateCcw,
  List,
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  children?: MenuItem[];
}

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const menuItems: MenuItem[] = [
  {
    id: 'inventory',
    label: 'Inventory',
    icon: <Package className="w-5 h-5" />,
    children: [
      { id: 'clusters', label: 'Clusters', icon: <Server className="w-4 h-4" /> },
      { id: 'mcp-servers', label: 'MCP Servers', icon: <Database className="w-4 h-4" /> },
    ],
  },
  {
    id: 'monitor',
    label: 'Monitor',
    icon: <Activity className="w-5 h-5" />,
    children: [
      {
        id: 'execution',
        label: 'Execution',
        icon: <Terminal className="w-4 h-4" />,
        children: [
          { id: 'job-details', label: 'Job Details', icon: <FileText className="w-4 h-4" /> },
          { id: 'app-logs', label: 'App Logs', icon: <FileText className="w-4 h-4" /> },
          { id: 'shell-replay', label: 'Shell Replay', icon: <RotateCcw className="w-4 h-4" /> },
          { id: 'shell-replay-list', label: 'Shell Replay List', icon: <List className="w-4 h-4" /> },
          { id: 'execution-details', label: 'Execution Details', icon: <FileText className="w-4 h-4" /> },
          { id: 'resource-usage', label: 'Resource Usage', icon: <Cpu className="w-4 h-4" /> },
          { id: 'generated-artifacts', label: 'Generated Artifacts', icon: <Package className="w-4 h-4" /> },
        ],
      },
      {
        id: 'overall-usage',
        label: 'Overall Usage',
        icon: <BarChart3 className="w-4 h-4" />,
        children: [
          { id: 'resource-consumed', label: 'Resource Usage/Consumed', icon: <Cpu className="w-4 h-4" /> },
        ],
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings className="w-5 h-5" />,
    children: [
      { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
      { id: 'integrations', label: 'Integrations', icon: <Plug className="w-4 h-4" /> },
    ],
  },
];

export default function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['inventory', 'monitor', 'execution']));

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const isActive = currentPage === item.id;

    return (
      <div key={item.id}>
        <button
          onClick={() => {
            if (hasChildren) {
              toggleExpand(item.id);
            } else {
              onPageChange(item.id);
            }
          }}
          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
            level === 0 ? 'font-medium' : ''
          } ${
            isActive
              ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          style={{ paddingLeft: `${1 + level * 1.5}rem` }}
        >
          <div className="flex items-center gap-3">
            {item.icon}
            <span>{item.label}</span>
          </div>
          {hasChildren && (
            <div className="text-gray-400">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
          )}
        </button>
        {hasChildren && isExpanded && (
          <div>
            {item.children!.map((child) => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-600" />
          AI Sandboxing Hub
        </h1>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map((item) => renderMenuItem(item))}
      </nav>
    </div>
  );
}
