"use client";

import { useEffect, useRef } from "react";

interface Props {
  serverId: string;
  onClose: () => void;
}

export default function ConsoleModal({ serverId, onClose }: Props) {
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let active = true;

    async function fetchConsole() {
      try {
        const res = await fetch(`/api/servers/${serverId}/console?lines=100`);
        const data = await res.json();
        if (active && outputRef.current) {
          outputRef.current.textContent =
            data.output || "No console output available";
          outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
      } catch {
        // ignore fetch errors while modal is open
      }
    }

    fetchConsole();
    const interval = setInterval(fetchConsole, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [serverId]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col gap-3 p-5">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">
            Console: {serverId}
          </h2>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition"
          >
            Close
          </button>
        </div>
        <pre
          ref={outputRef}
          className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono h-96 overflow-y-auto whitespace-pre-wrap"
        >
          Loading…
        </pre>
      </div>
    </div>
  );
}
