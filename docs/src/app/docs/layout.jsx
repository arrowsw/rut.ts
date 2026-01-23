/* eslint-env node */
import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Banner } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'

export default async function DocsLayout({ children }) {
  const navbar = (
    <Navbar
      logo={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '24px' }}>🇨🇱</span>
          <b>Rut.ts</b>
        </div>
      }
      projectLink="https://github.com/arrowsoftwarehq/rut.ts"
    />
  )
  const pageMap = await getPageMap()

  return (
    <Layout
      banner={
        <Banner storageKey="rut-ts-3.4.0-release">
          🎉 Rut.ts 3.4.0 is released! Check out Safe Mode and improved API.
        </Banner>
      }
      navbar={navbar}
      footer={
        <Footer>
          <span>
            MIT {new Date().getFullYear()} © Rut.ts - by{' '}
            <a href="https://github.com/arrowsw" target="_blank" rel="noopener noreferrer">
              Arrow Software
            </a>
          </span>
        </Footer>
      }
      editLink="Edit this page on GitHub"
      docsRepositoryBase="https://github.com/arrowsoftwarehq/rut.ts/tree/main/docs"
      sidebar={{ defaultMenuCollapseLevel: 1 }}
      pageMap={pageMap}
    >
      {children}
    </Layout>
  )
}
