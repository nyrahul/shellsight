import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal as TerminalIcon, Play, Square, RefreshCw, Download, List, Maximize2, Minimize2, PanelRightOpen, PanelRightClose, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown, Search, X } from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useAuth } from '../context/AuthContext';

interface ScriptRecording {
  name: string;
  workloadName: string;
  timestamp: number;
  displayTime: string;
  duration: number;
  displayDuration: string;
}

// Use current origin in production (Docker), fallback to port 3001 for development
const API_URL = import.meta.env.VITE_API_URL ?? (window.location.port === '5173' ? `http://${window.location.hostname}:3001` : '');
const WS_URL = window.location.port === '5173'
  ? `ws://${window.location.hostname}:3001`
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

const SPEED_OPTIONS = [1, 2, 4, 6, 8, 10, 12];

type SortColumn = 'timestamp' | 'workloadName' | 'duration';
type SortDirection = 'asc' | 'desc';

export default function ShellReplayListPage() {
  const { user, token } = useAuth();
  const [recordings, setRecordings] = useState<ScriptRecording[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingRecording, setPlayingRecording] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2);
  const [progress, setProgress] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [workloadFilter, setWorkloadFilter] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const wsRef = useRef<WebSocket | null>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const startTimeRef = useRef<number>(0);
  const progressIntervalRef = useRef<number | null>(null);

  // Format duration in seconds to human readable string
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins < 60) {
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  };

  // Parse folder name to extract workload name and timestamp
  const parseRecording = (folderName: string, duration: number = 0): ScriptRecording => {
    const match = folderName.match(/^(.+)_(\d{10,})$/);

    if (match) {
      const workloadName = match[1];
      const timestamp = parseInt(match[2], 10);
      const date = new Date(timestamp * 1000);
      const displayTime = date.toLocaleString();

      return {
        name: folderName,
        workloadName,
        timestamp,
        displayTime,
        duration,
        displayDuration: formatDuration(duration)
      };
    }

    return {
      name: folderName,
      workloadName: folderName,
      timestamp: 0,
      displayTime: 'Unknown',
      duration,
      displayDuration: formatDuration(duration)
    };
  };

  // Handle column sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Get sort icon for column header
  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3" />
      : <ArrowDown className="w-3 h-3" />;
  };

  // Filter and sort recordings
  const filteredAndSortedRecordings = recordings
    .filter(r => !workloadFilter || r.workloadName.toLowerCase().includes(workloadFilter.toLowerCase()))
    .sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'timestamp':
          comparison = a.timestamp - b.timestamp;
          break;
        case 'workloadName':
          comparison = a.workloadName.localeCompare(b.workloadName);
          break;
        case 'duration':
          comparison = a.duration - b.duration;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  // Initialize xterm.js terminal
  useEffect(() => {
    if (!terminalContainerRef.current || terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: false,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1a1a',
        foreground: '#f0f0f0',
        cursor: '#f0f0f0',
        selectionBackground: '#444444',
      },
      scrollback: 10000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalContainerRef.current);

    // Fit terminal to container
    setTimeout(() => {
      fitAddon.fit();
    }, 0);

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Fetch available script folders
  const fetchRecordings = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/script-folders`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      const data = await response.json();
      if (data.folders && data.folders.length > 0) {
        const parsed = data.folders
          .map((folder: { name: string; duration?: number }) => parseRecording(folder.name, folder.duration || 0))
          .sort((a: ScriptRecording, b: ScriptRecording) => b.timestamp - a.timestamp);
        setRecordings(parsed);
        setError('');
      } else if (data.error) {
        setError(data.error);
      } else {
        setRecordings([]);
      }
    } catch (err) {
      setError('Failed to connect to server. Make sure the server is running.');
    }
  }, [token]);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  // Start progress tracking
  const startProgressTracking = (duration: number, speed: number) => {
    setTotalDuration(duration);
    setProgress(0);
    setElapsedTime(0);
    startTimeRef.current = Date.now();

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    const effectiveDuration = duration / speed;
    progressIntervalRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const progressPercent = Math.min((elapsed / effectiveDuration) * 100, 100);
      setElapsedTime(elapsed * speed);
      setProgress(progressPercent);
    }, 100);
  };

  // Stop progress tracking
  const stopProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopProgressTracking();
    };
  }, []);

  // Refit terminal when maximized, minimized, or playing state changes
  useEffect(() => {
    if (fitAddonRef.current && !isMinimized) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 100);
    }
  }, [isMaximized, isMinimized, isPlaying]);

  // Toggle maximize
  const toggleMaximize = () => {
    setIsMinimized(false);
    setIsMaximized(prev => !prev);
  };

  // Toggle minimize
  const toggleMinimize = () => {
    setIsMaximized(false);
    setIsMinimized(prev => !prev);
  };

  // Handle keyboard shortcuts for speed control
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys when not in an input field and not playing
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || isPlaying) {
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPlaybackSpeed(prev => {
          const currentIndex = SPEED_OPTIONS.indexOf(prev);
          if (currentIndex < SPEED_OPTIONS.length - 1) {
            return SPEED_OPTIONS[currentIndex + 1];
          }
          return prev;
        });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPlaybackSpeed(prev => {
          const currentIndex = SPEED_OPTIONS.indexOf(prev);
          if (currentIndex > 0) {
            return SPEED_OPTIONS[currentIndex - 1];
          }
          return prev;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setIsConnected(true);
      setError('');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'start':
            // Clear terminal for new replay
            if (terminalRef.current) {
              terminalRef.current.clear();
            }
            setIsPlaying(true);
            if (data.duration && data.speed) {
              startProgressTracking(data.duration, data.speed);
            }
            break;
          case 'output':
            // Write directly to xterm.js terminal
            if (terminalRef.current) {
              terminalRef.current.write(data.data);
            }
            break;
          case 'end':
            setIsPlaying(false);
            setPlayingRecording('');
            stopProgressTracking();
            setProgress(100);
            break;
          case 'stopped':
            setIsPlaying(false);
            setPlayingRecording('');
            stopProgressTracking();
            break;
          case 'error':
            setError(data.message);
            setIsPlaying(false);
            setPlayingRecording('');
            stopProgressTracking();
            break;
        }
      } catch {
        // Write raw data to terminal
        if (terminalRef.current) {
          terminalRef.current.write(event.data);
        }
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsPlaying(false);
      setPlayingRecording('');
      stopProgressTracking();
    };

    ws.onerror = () => {
      setError('WebSocket connection failed');
      setIsConnected(false);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  // Start replay for a specific recording
  const startReplay = (recordingName: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      if (!isConnected) {
        connectWebSocket();
      }
      return;
    }

    // Clear terminal before starting
    if (terminalRef.current) {
      terminalRef.current.clear();
    }
    setPlayingRecording(recordingName);
    wsRef.current.send(JSON.stringify({
      action: 'replay',
      folder: recordingName,
      speed: playbackSpeed,
      userEmail: user?.email
    }));
  };

  // Stop replay
  const stopReplay = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'stop' }));
    }
  };

  // Restart replay from beginning
  const restartReplay = () => {
    if (playingRecording) {
      stopReplay();
      // Small delay to ensure stop is processed before starting again
      setTimeout(() => {
        startReplay(playingRecording);
      }, 100);
    }
  };

  // Download recording as tgz
  const downloadRecording = (recordingName: string) => {
    window.open(`${API_URL}/api/script-download/${encodeURIComponent(recordingName)}`, '_blank');
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Shell Replay List</h1>
          <p className="text-gray-600 mt-1 dark:text-gray-400">Browse and replay shell session recordings</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <button
            onClick={fetchRecordings}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-400 dark:hover:bg-gray-700"
            title="Refresh recording list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={workloadFilter}
              onChange={(e) => setWorkloadFilter(e.target.value)}
              placeholder="Filter workloads..."
              className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400 w-48"
            />
            {workloadFilter && (
              <button
                onClick={() => setWorkloadFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            disabled={isPlaying}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
            <option value={6}>6x</option>
            <option value={8}>8x</option>
            <option value={10}>10x</option>
            <option value={12}>12x</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div className={`flex gap-6 flex-1 min-h-0 ${isMaximized ? 'fixed inset-0 z-50 p-6 bg-gray-100 dark:bg-gray-900' : ''}`}>
        {/* Recording List */}
        <div className={`bg-white rounded-lg border border-gray-200 flex flex-col dark:bg-gray-800 dark:border-gray-700 ${isMaximized ? 'hidden' : isMinimized ? 'flex-1' : 'w-1/2'}`}>
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200 rounded-t-lg dark:bg-gray-700 dark:border-gray-600">
            <List className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="font-medium text-gray-700 dark:text-gray-200">Recordings</span>
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              {workloadFilter
                ? `${filteredAndSortedRecordings.length} of ${recordings.length}`
                : `${recordings.length} recording${recordings.length !== 1 ? 's' : ''}`
              }
            </span>
            {isMinimized && (
              <button
                onClick={toggleMinimize}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-600"
                title="Show Console"
              >
                <PanelRightOpen className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {recordings.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-8">
                <TerminalIcon className="w-12 h-12 mb-4 opacity-50" />
                <p>No recordings found</p>
                <p className="text-sm mt-2 opacity-75">
                  Recordings are loaded from the SSNREC directory
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0 dark:bg-gray-700">
                  <tr>
                    <th
                      onClick={() => handleSort('timestamp')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    >
                      <div className="flex items-center gap-1">
                        Time
                        {getSortIcon('timestamp')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('workloadName')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    >
                      <div className="flex items-center gap-1">
                        Workload
                        {getSortIcon('workloadName')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('duration')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    >
                      <div className="flex items-center gap-1">
                        Duration
                        {getSortIcon('duration')}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredAndSortedRecordings.map((recording) => (
                    <tr
                      key={recording.name}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${playingRecording === recording.name ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap dark:text-gray-400">
                        {recording.displayTime}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium dark:text-gray-200">
                        {recording.workloadName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap dark:text-gray-400">
                        {recording.displayDuration}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isPlaying && playingRecording === recording.name ? (
                            <button
                              onClick={stopReplay}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:hover:bg-red-900/30"
                              title="Stop replay"
                            >
                              <Square className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => startReplay(recording.name)}
                              disabled={!isConnected || isPlaying}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-green-900/30"
                              title="Play replay"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => downloadRecording(recording.name)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors dark:hover:bg-blue-900/30"
                            title="Download as .tgz"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Terminal Output */}
        <div className={`bg-gray-900 rounded-lg overflow-hidden flex flex-col ${isMaximized ? 'flex-1' : 'w-1/2'} ${isMinimized ? 'hidden' : ''}`}>
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700">
            <TerminalIcon className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-mono text-sm">
              {playingRecording ? `Replay: ${playingRecording}` : 'Shell Replay Console'}
            </span>
            {isPlaying && (
              <span className="ml-auto flex items-center gap-2 text-yellow-400 text-sm">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                Playing...
              </span>
            )}
            <div className={`${isPlaying ? '' : 'ml-auto'} flex items-center gap-1`}>
              {playingRecording && (
                <button
                  onClick={restartReplay}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                  title="Restart Replay"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={toggleMinimize}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title="Hide Console"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
              <button
                onClick={toggleMaximize}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* xterm.js terminal container */}
          <div
            ref={terminalContainerRef}
            className="flex-1 p-2"
            style={{ backgroundColor: '#1a1a1a', minHeight: '300px' }}
          />

          {/* Progress Bar */}
          {(isPlaying || progress > 0) && (
            <div className="px-4 py-2 bg-gray-800 border-t border-gray-700">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-100"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-gray-400 text-xs whitespace-nowrap min-w-[100px] text-right">
                  {formatDuration(elapsedTime)} / {formatDuration(totalDuration)}
                </div>
                <div className="text-gray-500 text-xs whitespace-nowrap">
                  {Math.round(progress)}%
                </div>
              </div>
            </div>
          )}

          <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              <span className="text-blue-400">{recordings.find(r => r.name === playingRecording)?.workloadName || 'No recording selected'}</span>
              {isPlaying && <span className="text-green-400 animate-pulse">▊</span>}
            </div>
            <div className="flex items-center gap-4 text-gray-500 text-xs">
              <span>Speed: {playbackSpeed}x</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
