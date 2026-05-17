export function TabBar({ tabs, activeId, onChange, ariaLabel = 'Tabs', className = '' }) {
  return (
    <div className={`tab-bar ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeId

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`tab-bar__item ${isActive ? 'tab-bar__item--active' : ''}`}
            onClick={() => onChange(tab.id)}
            disabled={Boolean(tab.disabled)}
          >
            <strong>{tab.label}</strong>
            {tab.meta && <small>{tab.meta}</small>}
          </button>
        )
      })}
    </div>
  )
}
