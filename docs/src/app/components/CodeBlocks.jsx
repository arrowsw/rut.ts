/**
 * GitHub Dark Default styled code block for the landing page.
 * Uses CSS variables from globals.css for theme consistency.
 */
export function CodeBlock({ children, ...props }) {
  return (
    <pre
      style={{
        backgroundColor: 'var(--code-bg)',
        color: 'var(--code-text)',
        borderRadius: '8px',
        overflow: 'auto',
        margin: 0,
        lineHeight: '1.5',
        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        fontSize: props.style?.fontSize || '16px',
        padding: '32px',
        border: '1px solid rgba(255,255,255,0.2)',
      }}
    >
      <code {...props}>{children}</code>
    </pre>
  )
}