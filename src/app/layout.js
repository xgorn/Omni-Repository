export const metadata = {
  title: 'Omni Repository - Multi-Media Progress Archive',
  description: 'Track my favorite novel/anime/manga/manhwa/manhua and reading progress seamlessly.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" style={{ margin: 0, padding: 0, backgroundColor: '#0B132B' }}>
      <body style={{ 
        margin: 0, 
        padding: 0, 
        backgroundColor: '#0B132B', 
        minHeight: '100vh',
        width: '100%',
        overflowX: 'hidden' // Prevents accidental horizontal scrolling gaps
      }}>
        {children}
      </body>
    </html>
  );
}