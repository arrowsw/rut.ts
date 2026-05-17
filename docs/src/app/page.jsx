import Link from 'next/link'
import { CodeBlock } from './components/CodeBlocks'
import { CopyButton } from './components/CopyButton'
import { exampleCode, installCode } from './constants/hero-page'

export default function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #000, #111, #000)',
      color: 'white',
      padding: '80px 24px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        {/* Hero */}
        <div style={{ marginBottom: '60px' }}>
          <div style={{
            display: 'inline-block',
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
            marginBottom: '32px',
            fontSize: '14px'
          }}>
            <span style={{ color: '#10b981' }}>●</span> v4.0.0 — Production identity hardening
          </div>

          <h1 style={{
            fontSize: '96px',
            fontWeight: 'bold',
            marginBottom: '24px',
            background: 'linear-gradient(to right, #fff, #aaa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            rut<span style={{ color: '#666' }}>.ts</span>
          </h1>

          <p style={{
            fontSize: '32px',
            color: '#999',
            marginBottom: '48px',
            maxWidth: '800px',
            margin: '0 auto 48px'
          }}>
            Handle Chilean RUT values with ease
          </p>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '60px' }}>
            <Link
              href="/docs"
              style={{
                padding: '16px 32px',
                background: '#fff',
                color: '#000',
                borderRadius: '12px',
                fontWeight: '600',
                textDecoration: 'none',
                display: 'inline-block'
              }}
            >
              Get Started →
            </Link>
            <a
              href="https://github.com/arrowsoftwarehq/rut.ts"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '16px 32px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                borderRadius: '12px',
                fontWeight: '600',
                textDecoration: 'none',
                display: 'inline-block'
              }}
            >
              View on GitHub
            </a>
          </div>

          {/* Code Example */}
          <div style={{
            maxWidth: '700px',
            margin: '0 auto',
            background: 'var(--code-bg)',
            borderRadius: '16px',
            textAlign: 'left',
            position: 'relative',
          }}>     
            <CodeBlock>
              <CopyButton code={exampleCode}/>
              <span style={{ color: 'var(--code-keyword)' }}>import</span> {'{ '}
              <span style={{ color: 'var(--code-identifier)' }}>validate</span>,{' '}
              <span style={{ color: 'var(--code-identifier)' }}>format</span>
              {' }'} <span style={{ color: 'var(--code-keyword)' }}>from</span>{' '}
              <span style={{ color: 'var(--code-string)' }}>'rut.ts'</span>
              {'\n\n'}
              <span style={{ color: 'var(--code-gray)' }}>// Validate any RUT format</span>
              {'\n'}
              <span style={{ color: 'var(--code-function)' }}>validate</span>(
              <span style={{ color: 'var(--code-string)' }}>'12.345.678-5'</span>){' '}
              <span style={{ color: 'var(--code-comment)' }}>// → true</span>
              {'\n\n'}
              <span style={{ color: 'var(--code-gray)' }}>// Format with dots and hyphen</span>
              {'\n'}
              <span style={{ color: 'var(--code-function)' }}>format</span>(
              <span style={{ color: 'var(--code-string)' }}>'123456785'</span>){' '}
              <span style={{ color: 'var(--code-gray)' }}>// → '12.345.678-5'</span>
              {'\n\n'}
              <span style={{ color: 'var(--code-gray)' }}>// Incremental formatting</span>
              {'\n'}
              <span style={{ color: 'var(--code-function)' }}>format</span>(
              <span style={{ color: 'var(--code-string)' }}>'1234'</span>, {'{ '}
              <span style={{ color: 'var(--code-identifier)' }}>incremental</span>:{' '}
              <span style={{ color: 'var(--code-boolean)' }}>true</span>
              {' }'}){'\n'}
              <span style={{ color: 'var(--code-gray)' }}>// → '1.234'</span>
            </CodeBlock>
          </div>
        </div>

        {/* Features */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '24px',
          marginTop: '80px'
        }}>
          {[
            { icon: '⚡', title: 'Lightning Fast', stat: '<1ms', label: 'execution time' },
            { icon: '📦', title: 'Ultra Lightweight', stat: '~3KB', label: 'minified + gzipped' },
            { icon: '🔧', title: '9 Core Functions', stat: '166', label: 'test cases' },
            { icon: '🛡️', title: 'Type Safe', stat: '100%', label: 'type coverage' }
          ].map((feature, i) => (
            <div key={i} style={{
              padding: '32px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '24px' }}>{feature.icon}</div>
              <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px' }}>{feature.stat}</div>
              <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', marginBottom: '16px' }}>
                {feature.label}
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px' }}>{feature.title}</h3>
            </div>
          ))}
        </div>

        {/* Installation */}
        <div style={{ marginTop: '120px' }}>
          <h2 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '32px' }}>
            Ready to get started?
          </h2>
          <div style={{
            background: 'var(--code-bg)',
            borderRadius: '16px',
            marginBottom: '32px',
            position: 'relative',
          }}>
            
            <CodeBlock><CopyButton code={installCode}/><span style={{ color: 'var(--code-function)', fontSize: '24px' }}>npm</span><span style={{ color: 'var(--code-string)', fontSize: '24px' }}> install rut.ts</span></CodeBlock>
          </div>
          <Link
            href="/docs"
            style={{
              padding: '16px 32px',
              background: '#fff',
              color: '#000',
              borderRadius: '12px',
              fontWeight: '600',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            Read the Documentation →
          </Link>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '120px',
          paddingTop: '40px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          color: '#666'
        }}>
          MIT © {new Date().getFullYear()} rut.ts by{' '}
          <a
            href="https://github.com/arrowsw"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#fff', textDecoration: 'none' }}
          >
            Arrow Software
          </a>
        </div>
      </div>
    </div>
  )
}
