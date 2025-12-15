import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, Play, Square, RefreshCw, Download, List } from 'lucide-react';

interface ScriptRecording {
  name: string;
  workloadName: string;
  timestamp: number;
  displayTime: string;
  duration: number;
  displayDuration: string;
}

const API_URL = `http://${window.location.hostname}:3001`;
const WS_URL = `ws://${window.location.hostname}:3001`;

export default function ShellReplayListPage() {
  const [recordings, setRecordings] = useState<ScriptRecording[]>([]);
  const [output, setOutput] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingRecording, setPlayingRecording] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2);
  const [progress, setProgress] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
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
    // Match pattern: name_TIMESTAMP where TIMESTAMP is epoch seconds
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

    // Fallback if pattern doesn't match
    return {
      name: folderName,
      workloadName: folderName,
      timestamp: 0,
      displayTime: 'Unknown',
      duration,
      displayDuration: formatDuration(duration)
    };
  };

  // Fetch available script folders
  const fetchRecordings = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/script-folders`);
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
  }, []);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

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
            if (terminalRef.current) {
              terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
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
        setOutput(prev => prev + event.data);
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

    setOutput('');
    setPlayingRecording(recordingName);
    wsRef.current.send(JSON.stringify({
      action: 'replay',
      folder: recordingName,
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
  const downloadRecording = (recordingName: string) => {
    window.open(`${API_URL}/api/script-download/${encodeURIComponent(recordingName)}`, '_blank');
  };

  // Format output - remove ANSI escape codes
  const formatOutput = (text: string): string => {
    return text
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/\x1b\[\?[0-9;]*[A-Za-z]/g, '')
      .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shell Replay List</h1>
          <p className="text-gray-600 mt-1">Browse and replay shell session recordings</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-500">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <button
            onClick={fetchRecordings}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh recording list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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
            <option value={12}>12x</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Recording List */}
        <div className="w-1/2 bg-white rounded-lg border border-gray-200 flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200 rounded-t-lg">
            <List className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-700">Recordings</span>
            <span className="ml-auto text-sm text-gray-500">
              {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex-1 overflow-auto">
            {recordings.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
                <Terminal className="w-12 h-12 mb-4 opacity-50" />
                <p>No recordings found</p>
                <p className="text-sm mt-2 opacity-75">
                  Recordings are loaded from the SSNREC directory
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Workload
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recordings.map((recording) => (
                    <tr
                      key={recording.name}
                      className={`hover:bg-gray-50 ${playingRecording === recording.name ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {recording.displayTime}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {recording.workloadName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {recording.displayDuration}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isPlaying && playingRecording === recording.name ? (
                            <button
                              onClick={stopReplay}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Stop replay"
                            >
                              <Square className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => startReplay(recording.name)}
                              disabled={!isConnected || isPlaying}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Play replay"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => downloadRecording(recording.name)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
        <div className="w-1/2 bg-gray-900 rounded-lg overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700">
            <Terminal className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-mono text-sm">
              {playingRecording ? `Replay: ${playingRecording}` : 'Shell Replay Console'}
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
                <p>Click play on a recording to start</p>
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
              Speed: {playbackSpeed}x
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
