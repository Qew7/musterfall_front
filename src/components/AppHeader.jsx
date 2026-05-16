export function AppHeader({ apiStatus, metaProgress }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Campaign Autobattler</p>
        <h1>Musterfall</h1>
      </div>

      <div className="topbar-meta">
        <span className={`status-pill status-pill--${apiStatus}`}>API {apiStatus}</span>
        <div className="meta-badge">
          <strong>{metaProgress.experience}</strong>
          <span>meta XP</span>
        </div>
        <div className="meta-badge">
          <strong>{metaProgress.essence}</strong>
          <span>essence</span>
        </div>
        <div className="meta-badge">
          <strong>{metaProgress.crowns}</strong>
          <span>crowns</span>
        </div>
      </div>
    </header>
  )
}