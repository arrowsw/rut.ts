export default {
  logo: <img src={'/rut-ts.png'} style={{ width: 'auto', height: 40 }} alt="Rut.ts logo"></img>,
  project: { link: 'https://github.com/arrowsoftwarehq/rut.ts' },
  useNextSeoProps() {
    return { titleTemplate: '%s – Rut.ts' }
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" />
    </>
  ),
  banner: {
    key: '2.1-release',
    text: <p>🎉 Rut.ts 2.1.0 is released!</p>,
  },
  footer: {
    text: (
      <span>
        MIT {new Date().getFullYear()} © <p style={{ display: 'inline' }}>Rut.ts</p>.
      </span>
    ),
  },
}
