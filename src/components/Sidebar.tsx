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
  Eye,
  List,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

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
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const isExpanded = !isCollapsed || isHovered;

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
    const isItemExpanded = expandedItems.has(item.id);
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
              ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
          style={{ paddingLeft: isExpanded ? `${1 + level * 1.5}rem` : '0.75rem' }}
          title={!isExpanded ? item.label : undefined}
        >
          <div className={`flex items-center ${isExpanded ? 'gap-3' : 'justify-center w-full'}`}>
            {item.icon}
            {isExpanded && <span className="whitespace-nowrap">{item.label}</span>}
          </div>
          {hasChildren && isExpanded && (
            <div className="text-gray-400 dark:text-gray-500">
              {isItemExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
          )}
        </button>
        {hasChildren && isItemExpanded && isExpanded && (
          <div>
            {item.children!.map((child) => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`${isExpanded ? 'w-64' : 'w-14'} bg-white border-r border-gray-200 h-screen flex flex-col dark:bg-gray-800 dark:border-gray-700 transition-all duration-300 ease-in-out`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className={`text-xl font-bold text-gray-800 flex items-center gap-2 dark:text-gray-100 ${!isExpanded ? 'justify-center' : ''}`}>
          <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          {isExpanded && <span className="whitespace-nowrap overflow-hidden">ShellSight</span>}
        </h1>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 overflow-x-hidden">
        {menuItems.map((item) => renderMenuItem(item))}
      </nav>
      <div className={`px-2 py-3 border-t border-gray-200 dark:border-gray-700 flex ${isExpanded ? 'justify-between' : 'flex-col gap-2 items-center'}`}>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-400"
          title={isCollapsed ? 'Pin Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-400"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
