'use html';
'use client';
import { useState, useEffect } from 'react';

export default function ReadingList() {
  // Authentication Session States
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [activeToken, setActiveToken] = useState('');
  const [loginError, setLoginError] = useState('');

  // Form states for creating a new media entry
  const [title, setTitle] = useState('');
  const [mediaType, setMediaType] = useState('novel'); 
  const [altTitlesArray, setAltTitlesArray] = useState([]); 
  const [currentAltInput, setCurrentAltInput] = useState(''); 
  const [chapter, setChapter] = useState('0');
  
  // Search, Selection, and Filtering States
  const [media, setMedia] = useState([]);         // Active, filtered view list
  const [allStats, setAllStats] = useState([]);   // 👈 NEW: Unfiltered database baseline for stable metrics
  const [search, setSearch] = useState('');
  const [selectedTab, setSelectedTab] = useState('all'); 
  const [message, setMessage] = useState({ text: '', isError: false });

  // Inline Editing States
  const [editingBookId, setEditingBookId] = useState(null); 
  const [editTitle, setEditTitle] = useState('');
  const [editMediaType, setEditMediaType] = useState('novel');
  const [editAltTitlesArray, setEditAltTitlesArray] = useState([]); 
  const [currentEditAltInput, setCurrentEditAltInput] = useState('');
  const [editChapter, setEditChapter] = useState('0');

  // Load stable inventory metrics (Always fetches everything)
  const fetchGlobalMetrics = async () => {
    try {
      const res = await fetch('/api/media?type=all'); // Bypasses tab filters completely
      const data = await res.json();
      if (res.ok) setAllStats(data);
    } catch (err) {
      console.error("Failed to sync inventory stats", err);
    }
  };

  // Load data for the active library viewport feed
  const fetchMedia = async (searchQuery = '', typeQuery = selectedTab) => {
    try {
      const url = `/api/media?search=${encodeURIComponent(searchQuery)}&type=${typeQuery}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) setMedia(data);
    } catch (err) {
      console.error("Failed to fetch media", err);
    }
  };

  // Run on first load and whenever tabs or search queries change
  useEffect(() => {
    fetchMedia(search, selectedTab);
  }, [search, selectedTab]);

  // Sync metrics baseline on initial mount
  useEffect(() => {
    fetchGlobalMetrics();
    
    const savedKey = localStorage.getItem('omni_session_key');
    if (savedKey) {
      setActiveToken(savedKey);
      setIsLoggedIn(true);
    }
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'X-API-KEY': loginInput }
      });
      
      if (res.ok) {
        localStorage.setItem('omni_session_key', loginInput);
        setActiveToken(loginInput);
        setIsLoggedIn(true);
        setLoginInput('');
        fetchMedia(search, selectedTab); 
      } else {
        setLoginError('❌ Access Denied: Invalid Master API Key.');
      }
    } catch (err) {
      setLoginError('Server verification pipeline error.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('omni_session_key');
    setActiveToken('');
    setIsLoggedIn(false);
    cancelEditing();
  };

  // Tag Array Interceptors
  const handleMainAltKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); 
      const trimmed = currentAltInput.trim();
      if (trimmed && !altTitlesArray.includes(trimmed)) {
        setAltTitlesArray([...altTitlesArray, trimmed]);
        setCurrentAltInput('');
      }
    }
  };

  const handleEditAltKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = currentEditAltInput.trim();
      if (trimmed && !editAltTitlesArray.includes(trimmed)) {
        setEditAltTitlesArray([...editAltTitlesArray, trimmed]);
        setCurrentEditAltInput('');
      }
    }
  };

  // Submit new entry
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: '', isError: false });

    try {
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-API-KEY': activeToken 
        },
        body: JSON.stringify({ title, alternative_titles: altTitlesArray, last_read_chapter: chapter, type: mediaType })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Something went wrong');

      setMessage({ text: '🚀 Entry added securely to database!', isError: false });
      setTitle('');
      setAltTitlesArray([]);
      setCurrentAltInput('');
      setChapter('0');
      
      // Refresh both the view and the stats panel metrics
      fetchMedia(search, selectedTab); 
      fetchGlobalMetrics();
    } catch (err) {
      setMessage({ text: err.message, isError: true });
    }
  };

  // Direct Increment Patch Trigger
  const handleUpdateChapter = async (bookTitle, currentChapter) => {
    const nextChapter = currentChapter + 1;
    try {
      const res = await fetch('/api/media', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'X-API-KEY': activeToken
        },
        body: JSON.stringify({ original_title: bookTitle, last_read_chapter: nextChapter })
      });
      if (res.ok) {
        fetchMedia(search, selectedTab);
        fetchGlobalMetrics(); // Keeps counts perfectly accurate
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEditing = (book) => {
    setEditingBookId(book._id);
    setEditTitle(book.title);
    setEditMediaType(book.type || 'novel');
    setEditAltTitlesArray(book.alternative_titles || []);
    setCurrentEditAltInput('');
    setEditChapter(book.last_read_chapter);
  };

  const cancelEditing = () => {
    setEditingBookId(null);
    setEditTitle('');
    setEditAltTitlesArray([]);
    setCurrentEditAltInput('');
    setEditChapter('0');
  };

  const handleSaveEdit = async (originalTitle) => {
    try {
      const res = await fetch('/api/media', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'X-API-KEY': activeToken
        },
        body: JSON.stringify({
          original_title: originalTitle, 
          title: editTitle,             
          alternative_titles: editAltTitlesArray, 
          last_read_chapter: Number(editChapter),
          type: editMediaType
        })
      });

      if (res.ok) {
        cancelEditing();
        fetchMedia(search, selectedTab); 
        fetchGlobalMetrics();
      } else {
        const data = await res.json();
        alert(`Failed to update: ${data.error}`);
      }
    } catch (err) {
      console.error("Error updating document", err);
    }
  };

  // Helper Function: Returns styling variables based on media format type
  const getTypeBadgeStyles = (type) => {
    switch(type?.toLowerCase()) {
      case 'anime': return { text: 'ANIME', bg: 'rgba(139, 92, 246, 0.15)', color: '#A78BFA', border: 'rgba(139, 92, 246, 0.3)' };
      case 'manga': return { text: 'MANGA', bg: 'rgba(239, 68, 68, 0.15)', color: '#F87171', border: 'rgba(239, 68, 68, 0.3)' };
      case 'manhwa': return { text: 'MANHWA', bg: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', border: 'rgba(59, 130, 246, 0.3)' };
      case 'manhua': return { text: 'MANHUA', bg: 'rgba(234, 179, 8, 0.15)', color: '#FBBF24', border: 'rgba(234, 179, 8, 0.3)' };
      default: return { text: 'NOVEL', bg: 'rgba(16, 185, 129, 0.15)', color: '#34D399', border: 'rgba(16, 185, 129, 0.3)' };
    }
  };

  // 💡 FIXED ENGINE: Calculates totals using the complete allStats array instead of filtered media array
  const countByType = (typeKey) => allStats.filter(b => b.type?.toLowerCase() === typeKey.toLowerCase()).length;

  return (
    <div style={{ backgroundColor: '#0B132B', minHeight: '100vh', width: '100%', color: '#F4F5F6', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '40px 16px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', boxSizing: 'border-box', width: '100%' }}>
        
        {/* TOOLBAR HEADER */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="40" height="40" style={{ flexShrink: 0 }}>
              <rect width="32" height="32" rx="8" fill="#1C2541" />
              <circle cx="16" cy="15" r="10" fill="none" stroke="#3A506B" strokeWidth="1.5" strokeDasharray="3 1"/>
              <path d="M7 22C11 22 13 20 16 18C19 20 21 22 25 22V10C21 10 19 12 16 14C13 12 11 10 7 10V22Z" fill="#0B132B" stroke="#5BC0BE" strokeWidth="2" strokeLinejoin="round"/>
              <polygon points="16,11 17.5,14 20.5,14.5 18,16.5 19,19.5 16,18 13,19.5 14,16.5 11.5,14.5 14.5,14" fill="#FFFFFF"/>
            </svg>

            <div>
              <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px', color: '#FFFFFF' }}>Omni Repository</h1>
              <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '13px' }}>Multi-Media Progress Registry Engine</p>
            </div>
          </div>
          {isLoggedIn ? (
            <button onClick={handleLogout} style={{ padding: '8px 14px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#F87171', border: '1px solid #F87171', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Exit Admin Session 🔒</button>
          ) : (
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="password" value={loginInput} onChange={(e) => setLoginInput(e.target.value)} placeholder="Admin Key..." style={{ backgroundColor: '#1C2541', border: '1px solid #3A506B', borderRadius: '6px', padding: '6px 12px', color: '#FFF', fontSize: '12px', outline: 'none', width: '120px' }} />
              <button type="submit" style={{ padding: '6px 12px', backgroundColor: '#3A506B', color: '#FFF', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Unlock</button>
            </form>
          )}
        </header>

        {/* INTERACTION MATRIX LAYOUT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', boxSizing: 'border-box', width: '100%' }}>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', boxSizing: 'border-box', width: '100%' }}>
            
            {/* ADD COMPONENT FORM */}
            {isLoggedIn && (
              <section style={{ flex: '1 1 400px', backgroundColor: '#1C2541', padding: '24px', borderRadius: '16px', border: '1px solid #3A506B', boxSizing: 'border-box', minWidth: '0' }}>
                <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: '#5BC0BE' }}>Add New Entry</h2>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px' }}>Media Format Type</label>
                    <select value={mediaType} onChange={(e) => setMediaType(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', backgroundColor: '#0B132B', border: '1px solid #3A506B', borderRadius: '8px', color: '#FFF', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                      <option value="novel">📚 Light / Web Novel</option>
                      <option value="manga">💥 Manga (Japanese Comic)</option>
                      <option value="manhwa">⚔️ Manhwa (Korean Webtoon)</option>
                      <option value="manhua">🐉 Manhua (Chinese Comic)</option>
                      <option value="anime">🎬 Anime (Animated Series)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px' }}>Title Name *</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', backgroundColor: '#0B132B', border: '1px solid #3A506B', borderRadius: '8px', color: '#FFF', fontSize: '14px', outline: 'none' }} placeholder="e.g. Solo Leveling"/>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px' }}>Alternative Aliases (Type & press Enter)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', backgroundColor: '#0B132B', border: '1px solid #3A506B', borderRadius: '8px', padding: '6px 8px', minHeight: '42px', boxSizing: 'border-box' }}>
                      {altTitlesArray.map((tag, index) => (
                        <span key={index} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#3A506B', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', color: '#FFF' }}>
                          {tag}
                          <button type="button" onClick={() => setAltTitlesArray(altTitlesArray.filter((_, idx) => idx !== index))} style={{ background: 'none', border: 'none', color: '#5BC0BE', cursor: 'pointer', fontSize: '14px', fontWeight: '700', padding: 0 }}>×</button>
                        </span>
                      ))}
                      <input type="text" value={currentAltInput} onChange={(e) => setCurrentAltInput(e.target.value)} onKeyDown={handleMainAltKeyDown} style={{ flex: '1 1 120px', background: 'none', border: 'none', color: '#FFF', fontSize: '14px', outline: 'none', padding: '4px 0' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px' }}>Current Progress Count (Chapter / Episode)</label>
                    <input type="number" value={chapter} onChange={(e) => setChapter(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', backgroundColor: '#0B132B', border: '1px solid #3A506B', borderRadius: '8px', color: '#FFF', fontSize: '14px', outline: 'none' }} />
                  </div>
                  <button type="submit" style={{ width: '100%', boxSizing: 'border-box', padding: '12px', background: '#5BC0BE', color: '#0B132B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}>Commit Entry to Cloud</button>
                </form>
                {message.text && <p style={{ marginTop: '16px', marginBottom: 0, padding: '10px 14px', borderRadius: '8px', fontSize: '14px', backgroundColor: message.isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(91, 192, 190, 0.15)', color: message.isError ? '#F87171' : '#5BC0BE', border: message.isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(91, 192, 190, 0.3)' }}>{message.text}</p>}
              </section>
            )}

            {/* LIVE DETAILED MEDIA TOTAL STATS BREAKDOWN GRID PANEL */}
            <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '20px', boxSizing: 'border-box', minWidth: '0' }}>
              
              <section style={{ 
                backgroundColor: '#1C2541', 
                padding: '20px 24px', 
                borderRadius: '16px', 
                border: '1px solid #3A506B', 
                boxSizing: 'border-box', 
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <h3 style={{ margin: '0', fontSize: '13px', fontWeight: '700', color: '#94A3B8', letterSpacing: '0.5px', borderBottom: '1px solid #3A506B', paddingBottom: '10px' }}>
                  COLLECTION INVENTORY METRICS
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '14px' }}>
                  <div style={{ backgroundColor: '#0B132B', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#34D399' }}>📚 NOVEL</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '4px', color: '#FFF' }}>{countByType('novel')}</div>
                  </div>
                  <div style={{ backgroundColor: '#0B132B', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#F87171' }}>💥 MANGA</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '4px', color: '#FFF' }}>{countByType('manga')}</div>
                  </div>
                  <div style={{ backgroundColor: '#0B132B', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#60A5FA' }}>⚔️ MANHWA</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '4px', color: '#FFF' }}>{countByType('manhwa')}</div>
                  </div>
                  <div style={{ backgroundColor: '#0B132B', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.15)' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#FBBF24' }}>🐉 MANHUA</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '4px', color: '#FFF' }}>{countByType('manhua')}</div>
                  </div>
                  <div style={{ backgroundColor: '#0B132B', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#A78BFA' }}>🎬 ANIME</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '4px', color: '#FFF' }}>{countByType('anime')}</div>
                  </div>
                  <div style={{ backgroundColor: '#0B132B', padding: '10px 14px', borderRadius: '8px', border: '1px solid #3A506B' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#5BC0BE' }}>🌐 TOTAL</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '4px', color: '#FFF' }}>{allStats.length}</div>
                  </div>
                </div>
              </section>

              {/* SEARCH UTILITY PANEL */}
              <section style={{ backgroundColor: '#1C2541', padding: '24px', borderRadius: '16px', border: '1px solid #3A506B', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box', width: '100%' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: '#94A3B8' }}>Filter Database Collection</h3>
                <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or aliases..." style={{ width: '100%', boxSizing: 'border-box', padding: '14px 14px 14px 42px', backgroundColor: '#0B132B', border: '1px solid #3A506B', borderRadius: '12px', color: '#FFF', fontSize: '15px', outline: 'none' }} />
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#3A506B', fontSize: '18px' }}>🔍</span>
                </div>
              </section>
            </div>

          </div>

          {/* MASTER TAB NAVIGATION SYSTEM */}
          <nav style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(6, 1fr)', 
            gap: '10px', 
            borderBottom: '2px solid #1C2541', 
            paddingBottom: '12px', 
            boxSizing: 'border-box',
            width: '100%',
            maxWidth: '100%'
          }}>
            {['all', 'novel', 'manga', 'manhwa', 'manhua', 'anime'].map((tab) => {
              const active = selectedTab === tab;
              return (
                <button 
                  key={tab} 
                  onClick={() => setSelectedTab(tab)} 
                  style={{ 
                    boxSizing: 'border-box',
                    width: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '44px',
                    padding: '0 4px',
                    margin: '0',
                    borderRadius: '8px', 
                    border: 'none', 
                    textTransform: 'uppercase', 
                    fontSize: '12px', 
                    fontWeight: '700', 
                    cursor: 'pointer', 
                    backgroundColor: active ? '#5BC0BE' : '#1C2541', 
                    color: active ? '#0B132B' : '#94A3B8', 
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {tab === 'all' ? '🌐 All' : tab}
                </button>
              );
            })}
          </nav>

          {/* REGISTRY LIST FEED */}
          <section style={{ boxSizing: 'border-box', width: '100%' }}>
            {media.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#1C2541', borderRadius: '16px', border: '1px dashed #3A506B', color: '#64748B' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>No tracked entries found inside this category.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box', width: '100%' }}>
                {media.map((book) => {
                  const isEditing = editingBookId === book._id;
                  const badge = getTypeBadgeStyles(book.type);

                  return (
                    <div key={book._id} style={{ backgroundColor: '#1C2541', border: isEditing ? '1px solid #5BC0BE' : '1px solid #3A506B', padding: '20px 24px', borderRadius: '16px', position: 'relative', boxSizing: 'border-box', width: '100%' }}>
                      
                      {isEditing && isLoggedIn ? (
                        /* ADMIN EDIT MODAL PANEL */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box', width: '100%' }}>
                          <h4 style={{ margin: '0', color: '#5BC0BE', fontSize: '14px', fontWeight: '700' }}>Modify Manifest Settings</h4>
                          
                          <div>
                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8' }}>Modify Format Category</label>
                            <select value={editMediaType} onChange={(e) => setEditMediaType(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', backgroundColor: '#0B132B', border: '1px solid #3A506B', borderRadius: '6px', color: '#FFF', marginTop: '4px', outline: 'none' }}>
                              <option value="novel">Novel</option>
                              <option value="manga">Manga</option>
                              <option value="manhwa">Manhwa</option>
                              <option value="manhua">Manhua</option>
                              <option value="anime">Anime</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8' }}>Core Title</label>
                            <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', backgroundColor: '#0B132B', border: '1px solid #3A506B', borderRadius: '6px', color: '#FFF', marginTop: '4px', outline: 'none' }} />
                          </div>
                          
                          <div>
                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8' }}>Alternative Keys (Press Enter)</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', backgroundColor: '#0B132B', border: '1px solid #3A506B', borderRadius: '6px', padding: '6px 8px', marginTop: '4px', minHeight: '38px', boxSizing: 'border-box' }}>
                              {editAltTitlesArray.map((tag, i) => (
                                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#3A506B', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', color: '#FFF' }}>
                                  {tag}
                                  <button type="button" onClick={() => setEditAltTitlesArray(editAltTitlesArray.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#5BC0BE', cursor: 'pointer', fontSize: '12px', fontWeight: '700', padding: 0 }}>×</button>
                                </span>
                              ))}
                              <input type="text" value={currentEditAltInput} onChange={(e) => setCurrentEditAltInput(e.target.value)} onKeyDown={handleEditAltKeyDown} style={{ flex: '1 1 100px', background: 'none', border: 'none', color: '#FFF', fontSize: '13px', outline: 'none' }} />
                            </div>
                          </div>

                          <div style={{ maxWidth: '140px' }}>
                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8' }}>Active Counter Progress</label>
                            <input type="number" value={editChapter} onChange={(e) => setEditChapter(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', backgroundColor: '#0B132B', border: '1px solid #3A506B', borderRadius: '6px', color: '#FFF', marginTop: '4px', outline: 'none' }} />
                          </div>

                          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                            <button onClick={() => handleSaveEdit(book.title)} style={{ padding: '8px 16px', background: '#10B981', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}>Commit Updates</button>
                            <button onClick={cancelEditing} style={{ padding: '8px 16px', background: 'transparent', color: '#94A3B8', border: '1px solid #3A506B', borderRadius: '6px', cursor: 'pointer' }}>Dismiss</button>
                          </div>
                        </div>
                      ) : (
                        /* VISUAL CARD ROW LAYOUT DESIGN */
                        <>
                          {isLoggedIn && (
                            <button onClick={() => startEditing(book)} style={{ position: 'absolute', top: '16px', right: '16px', background: '#0B132B', border: '1px solid #3A506B', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', transition: 'background-color 0.2s', zIndex: 10 }}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5BC0BE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                            </button>
                          )}

                          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', paddingRight: isLoggedIn ? '36px' : '0px', boxSizing: 'border-box', width: '100%' }}>
                            
                            {/* TITLE & BADGES AREA */}
                            <div style={{ flex: '1 1 600px', minWidth: '0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                <span style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '800', letterSpacing: '0.5px' }}>
                                  {badge.text}
                                </span>
                                <h3 style={{ margin: '0', fontSize: '18px', fontWeight: '700', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={book.title}>
                                  {book.title}
                                </h3>
                              </div>

                              {book.alternative_titles?.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                                  {book.alternative_titles.map((alt, i) => (
                                    <span key={i} style={{ backgroundColor: '#0B132B', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', color: '#94A3B8', border: '1px solid #1C2541' }}>{alt}</span>
                                  ))}
                                </div>
                              ) : (
                                <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#64748B', fontStyle: 'italic' }}>No tag aliases established.</p>
                              )}
                            </div>
                            
                            {/* INTERACTION ACTION CONTROLS AREA */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: isLoggedIn ? 'space-between' : 'flex-end', gap: '20px', flex: '1 1 auto', maxWidth: '100%', boxSizing: 'border-box', textAlign: isLoggedIn ? 'left' : 'right' }}>
                              <div>
                                <span style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748B', letterSpacing: '0.5px' }}>
                                  {book.type?.toLowerCase() === 'anime' ? 'EPISODE' : 'CHAPTER'} PROGRESS
                                </span>
                                <span style={{ display: 'block', fontSize: '18px', fontWeight: '800', color: '#5BC0BE', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                  {book.type?.toLowerCase() === 'anime' ? 'Ep. ' : 'Ch. '} {book.last_read_chapter}
                                </span>
                              </div>
                              
                              {isLoggedIn && (
                                <button onClick={() => handleUpdateChapter(book.title, book.last_read_chapter)} style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '700', backgroundColor: '#3A506B', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.2s', whiteSpace: 'nowrap' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5BC0BE'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3A506B'}>
                                  ＋ Increment
                                </button>
                              )}
                            </div>

                          </div>
                        </>
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}