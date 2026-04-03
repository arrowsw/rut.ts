'use client'

import { useState } from 'react'

const CopyIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
)

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export function CopyButton({ code }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      disabled={!code}
      className="copy-button"
      style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        padding: '6px 8px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '6px',
        cursor: code ? 'pointer' : 'not-allowed',
        transition: 'all 0.15s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '12px',
        color:'rgba(255,255,255,0.5)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        zIndex: 10,
      }}
      onMouseEnter={(e) => {
        if (code && !copied) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
          e.currentTarget.style.color = '#fff'
        }
      }}
      onMouseLeave={(e) => {
        if (!copied) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
          e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
        }
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  )
}
