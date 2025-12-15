import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, Play, Square, RefreshCw, Download } from 'lucide-react';

interface ScriptFolder {
  name: string;
  displayName: string;
}

const API_URL = `http://${window.location.hostname}:3001`;
const WS_URL = `ws://${window.location.hostname}:3001`;

export default function ShellReplayPage() {
  const [folders, setFolders] = useState<ScriptFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(4);
  const [progress, setProgress] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);
  const progressIntervalRef = useRef<number | null>(null);

  // Fetch available script folders
  const fetchFolders = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/script-folders`);
      const data = await response.json();
      if (data.folders && data.folders.length > 0) {
        setFolders(data.folders);
        setSelectedFolder(data.folders[0].name);
        setError('');
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to connect to server. Make sure the server is running.');
    }
  }, []);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

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

  // Start progress tracking
  const startProgressTracking = (duration: number, speed: number) => {
    setTotalDuration(duration);
    setProgress(0);
    setElapsedTime(0);
    startTimeRef.current = Date.now();

    // Clear any existing interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    // Update progress every 100ms
    const effectiveDuration = duration / speed;
    progressIntervalRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const progressPercent = Math.min((elapsed / effectiveDuration) * 100, 100);
      setElapsedTime(elapsed * speed); // Show elapsed in original time scale
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
            setOutput('');
            setIsPlaying(true);
            if (data.duration && data.speed) {
              startProgressTracking(data.duration, data.speed);
            }
            break;
          case 'output':
            setOutput(prev => prev + data.data);
            // Auto-scroll to bottom
            if (terminalRef.current) {
              terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
            }
            break;
          case 'end':
            setIsPlaying(false);
            stopProgressTracking();
            setProgress(100);
            break;
          case 'stopped':
            setIsPlaying(false);
            stopProgressTracking();
            break;
          case 'error':
            setError(data.message);
            setIsPlaying(false);
            stopProgressTracking();
            break;
        }
      } catch {
        // Handle non-JSON messages
        setOutput(prev => prev + event.data);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsPlaying(false);
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

  // Start replay
  const startReplay = () => {
    if (!selectedFolder || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      if (!isConnected) {
        connectWebSocket();
      }
      return;
    }

    setOutput('');
    wsRef.current.send(JSON.stringify({
      action: 'replay',
      folder: selectedFolder,
      speed: playbackSpeed
    }));
  };

  // Stop replay
  const stopReplay = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'stop' }));
    }
  };

  // Download recording as tgz
  const downloadRecording = () => {
    if (!selectedFolder) return;
    window.open(`${API_URL}/api/script-download/${encodeURIComponent(selectedFolder)}`, '_blank');
  };

  // Convert ANSI escape codes to styled HTML (basic support)
  const formatOutput = (text: string): string => {
    // Remove or convert common ANSI codes for display
    return text
      .replace(/\x1b\[[0-9;]*m/g, '') // Remove color codes
      .replace(/\x1b\[\?[0-9;]*[A-Za-z]/g, '') // Remove private mode sequences (e.g., ?2004h bracketed paste)
      .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '') // Remove other escape sequences
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shell Replay</h1>
          <p className="text-gray-600 mt-1">Replay shell sessions from script recordings</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-500">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <button
            onClick={fetchFolders}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh folder list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <select
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
            disabled={folders.length === 0}
          >
            {folders.length === 0 ? (
              <option value="">No recordings found</option>
            ) : (
              folders.map((folder) => (
                <option key={folder.name} value={folder.name}>
                  {folder.displayName}
                </option>
              ))
            )}
          </select>
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isPlaying}
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
            <option value={6}>6x</option>
            <option value={8}>8x</option>
            <option value={10}>10x</option>
          </select>
          {isPlaying ? (
            <button
              onClick={stopReplay}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          ) : (
            <button
              onClick={startReplay}
              disabled={!selectedFolder || !isConnected}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              Replay
            </button>
          )}
          <button
            onClick={downloadRecording}
            disabled={!selectedFolder}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download recording as .tgz"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 bg-gray-900 rounded-lg overflow-hidden flex flex-col min-h-[500px]">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700">
          <Terminal className="w-5 h-5 text-green-400" />
          <span className="text-green-400 font-mono text-sm">
            {selectedFolder ? `Replay: ${selectedFolder}` : 'Shell Replay Console'}
          </span>
          {isPlaying && (
            <span className="ml-auto flex items-center gap-2 text-yellow-400 text-sm">
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              Playing...
            </span>
          )}
        </div>

        <div
          ref={terminalRef}
          className="flex-1 p-4 font-mono text-sm overflow-auto"
          style={{ backgroundColor: '#1a1a1a' }}
        >
          {output ? (
            <pre className="text-gray-100 whitespace-pre-wrap break-words">
              {formatOutput(output)}
            </pre>
          ) : (
            <div className="text-gray-500 flex flex-col items-center justify-center h-full">
              <Terminal className="w-12 h-12 mb-4 opacity-50" />
              <p>Select a recording and click "Replay" to start</p>
              <p className="text-sm mt-2 opacity-75">
                Recordings are loaded from the SSNREC directory
              </p>
            </div>
          )}
        </div>

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
            <span>user@sandbox:~$</span>
            {isPlaying && <span className="text-green-400 animate-pulse">▊</span>}
          </div>
          <div className="text-gray-500 text-xs">
            {folders.length} recording{folders.length !== 1 ? 's' : ''} available
          </div>
        </div>
      </div>
    </div>
  );
}
