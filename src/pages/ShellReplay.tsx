import { useState, useEffect } from 'react';
import { Terminal, Play } from 'lucide-react';
import type { ShellReplay } from '../types';

export default function ShellReplayPage() {
  const [replays, setReplays] = useState<ShellReplay[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<string>('1');

  useEffect(() => {
    const mockReplays: ShellReplay[] = [
      {
        id: '1',
        execution_id: '1',
        sequence: 1,
        command: 'python --version',
        output: 'Python 3.11.5',
        timestamp: new Date(Date.now() - 10000).toISOString(),
      },
      {
        id: '2',
        execution_id: '1',
        sequence: 2,
        command: 'pip list',
        output: 'numpy==1.24.3\npandas==2.0.3\nrequests==2.31.0',
        timestamp: new Date(Date.now() - 9000).toISOString(),
      },
      {
        id: '3',
        execution_id: '1',
        sequence: 3,
        command: 'python main.py',
        output: 'Hello World\nExecution completed successfully',
        timestamp: new Date(Date.now() - 8000).toISOString(),
      },
    ];
    setReplays(mockReplays);
  }, []);

  const filteredReplays = replays.filter((replay) => replay.execution_id === selectedExecution);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shell Replay</h1>
          <p className="text-gray-600 mt-1">Replay shell commands from executions</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedExecution}
            onChange={(e) => setSelectedExecution(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1">JOB-2024-001</option>
            <option value="2">JOB-2024-002</option>
            <option value="3">JOB-2024-003</option>
          </select>
          <button className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
            <Play className="w-4 h-4" />
            Replay
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg p-6 font-mono text-sm">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700">
          <Terminal className="w-5 h-5 text-green-400" />
          <span className="text-green-400">user@execution-sandbox:~$</span>
        </div>

        <div className="space-y-4">
          {filteredReplays.map((replay) => (
            <div key={replay.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-green-400">$</span>
                <span className="text-white">{replay.command}</span>
              </div>
              {replay.output && (
                <pre className="text-gray-300 pl-4 whitespace-pre-wrap">{replay.output}</pre>
              )}
              <div className="text-xs text-gray-500 pl-4">
                Executed at {new Date(replay.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2">
          <span className="text-green-400 animate-pulse">▊</span>
          <span className="text-gray-500 text-xs">Ready for next command</span>
        </div>
      </div>
    </div>
  );
}
