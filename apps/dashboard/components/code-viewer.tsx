'use client';

import { useState } from 'react';

interface CodeViewerProps {
  content: string;
  filename: string;
  language: string;
}

export function CodeViewer({ content, filename, language }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const lines = content.split('\n');
  const isBinary = content === '[Binary file - cannot display]';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {filename}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              {isBinary ? 'Binary file' : `${lines.length} lines · ${language}`}
            </p>
          </div>
          {!isBinary && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {copied ? (
                <>
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          )}
        </div>
      </div>
      {isBinary ? (
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <svg
              className="mx-auto h-16 w-16 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-4 font-medium text-zinc-900 dark:text-zinc-50">
              Binary file
            </p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              This file cannot be displayed in the browser
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="w-16 select-none border-r border-zinc-200 bg-zinc-50 px-4 py-0.5 text-right font-mono text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
                    {index + 1}
                  </td>
                  <td className="px-4 py-0.5">
                    <pre className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                      {line || ' '}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
