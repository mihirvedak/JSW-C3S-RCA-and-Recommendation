/**
 * C3S Quality Intelligence dashboard.
 *
 * Three views over one production line, chosen in the header:
 *   - Executive View: distribution, trend, compliance and the last shifts,
 *   - C3S Analysis: the 48-hour classification timeline, the trend beside RCA and
 *     recommendations, laboratory quality and process monitoring,
 *   - Trend Analysis: the process and laboratory data around the selected RCA event.
 *
 * The plant and line select the devices and RCA insight every load reads. The time picker
 * drives the ranged views; the selected RCA event is shared by all three.
 */

import { lazy, Suspense, useMemo, useState } from 'react'
import './App.css'

import { Header } from './components/Header'
import { ScopeBar } from './components/ScopeBar'
import { DataSources, DataSourcesToggle } from './components/DataSources'
import { ExecutiveView } from './components/ExecutiveView'
import { C3SAnalysisView } from './components/C3SAnalysisView'
import { LoadingState } from './components/primitives'

import { useAuth, LoginGate } from './auth/LoginGate'
import { clearStoredToken } from './auth/tokenStore'
import { useDashboardData } from './hooks/useDashboardData'
import type { TimeSelection } from './hooks/useDashboardData'
import { useEventTrends } from './hooks/useEventTrends'
import { useTimeline48 } from './hooks/useTimeline48'
import { useEventContext } from './hooks/useEventContext'
import { PROCESS_MAX_SPAN_MS } from './hooks/useDashboardData'
import { contextWindow } from './lib/eventTrends'
import { applyDataEnd, clampEnd } from './config/dataWindow'
import { DAY_MS, MINUTE_MS, formatAge } from './lib/time'
import { useNow } from './hooks/useNow'
import { loadLineSelection, resolveLine, saveLineSelection } from './config/plants'
import type { LineSelection } from './config/plants'
import { LineProvider } from './config/LineContext'
import type { RcaFinding } from './services/rcaService'
import { formatFull } from './lib/time'

const TrendAnalysis = lazy(() =>
  import('./components/TrendAnalysis').then((m) => ({ default: m.TrendAnalysis })),
)

type DashboardTab = 'executive' | 'analysis' | 'trend'

const TABS: ReadonlyArray<{ id: DashboardTab; label: string }> = [
  { id: 'executive', label: 'Executive View' },
  { id: 'analysis', label: 'C3S Analysis' },
  { id: 'trend', label: 'Trend Analysis' },
]

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [lineSel, setLineSel] = useState<LineSelection>(() => {
    const { plant, line } = resolveLine(loadLineSelection())
    return { plantId: plant.id, lineId: line.id }
  })
  const { plant, line } = resolveLine(lineSel)
  // The plant's data cut-off is in force before any load below starts: applied during render, ahead
  // of the hooks' effects and state initialisers. Idempotent, so re-renders are harmless.
  applyDataEnd(plant.dataEnd)

  // The dashboard opens on the last 7 days (plant request, 2026-10-28).
  const [selection, setSelectionState] = useState<TimeSelection>({ kind: 'preset', rangeId: '7d' })
  const [tab, setTabState] = useState<DashboardTab>('executive')
  // The 48-hour timeline loads the first time its tab is opened, not on the landing view.
  const [analysisOpened, setAnalysisOpened] = useState(false)
  const [pickedId, setPickedId] = useState<string | null>(null)
  // The event Trend Analysis is opened on. Set only by opening one (the RCA panel's "View process
  // trends", or the tab's own picker); opening the tab itself shows the selected range alone.
  const [trendEventId, setTrendEventId] = useState<string | null>(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)

  const d = useDashboardData(selection, line)
  const now = useNow()

  const setTab = (t: DashboardTab) => {
    setTabState(t)
    if (t === 'analysis') setAnalysisOpened(true)
  }
  // From the tab bar, Trend Analysis opens on the selected range with no event.
  const openTabFromBar = (t: DashboardTab) => {
    if (t === 'trend') setTrendEventId(null)
    setTab(t)
  }
  // An event opened on Trend Analysis becomes the dashboard's selection too.
  const openTrendEvent = (id: string | null) => {
    setTrendEventId(id)
    if (id != null) setPickedId(id)
  }
  // A new range or line drops the pick, so no view keeps an event from another scope.
  const setSelection = (s: TimeSelection) => {
    setSelectionState(s)
    setPickedId(null)
    setTrendEventId(null)
  }
  const changeLine = (sel: LineSelection) => {
    setLineSel(sel)
    saveLineSelection(sel)
    setPickedId(null)
    setTrendEventId(null)
  }

  // Derived during render: a pick is any event the insight holds (the 48-hour timeline can
  // reach outside the selected range); with no pick, the newest event in the range.
  const selected: RcaFinding | null = useMemo(
    () => (pickedId != null ? d.rcaAll.find((f) => f.id === pickedId) : undefined) ?? d.rca[0] ?? null,
    [d.rca, d.rcaAll, pickedId],
  )

  const trendEvent: RcaFinding | null = useMemo(
    () => (trendEventId != null ? (d.rcaAll.find((f) => f.id === trendEventId) ?? null) : null),
    [d.rcaAll, trendEventId],
  )

  // The insight's targets: the event's own, else the newest result that has them.
  const focus = tab === 'trend' ? trendEvent : selected
  const zoneTargets = useMemo(
    () => focus?.targets ?? d.rcaAll.find((f) => f.targets != null)?.targets ?? null,
    [focus, d.rcaAll],
  )

  // Minute data around an event: Trend Analysis charts it around the event it is opened on, and
  // the RCA panel reads the named parameters' values at the selected event from it. Each event's
  // data is kept once fetched.
  const trends = useEventTrends(
    tab === 'trend' ? (trendEvent?.eventTime ?? null) : tab === 'analysis' ? (selected?.eventTime ?? null) : null,
    line,
  )
  const timeline = useTimeline48(analysisOpened ? d.anchorMs : null, line, d.refreshKey)

  // A range longer than 7 days loads only its newest 7 days of process data (as fetchRangeChunked
  // cuts it, from the data cut-off back). An event opened on Trend Analysis further back than that
  // gets its own 7 days of the range.
  const rangeEnd = d.windowEnd == null ? null : clampEnd(d.windowEnd)
  const loadedStart =
    d.windowStart == null || rangeEnd == null
      ? null
      : rangeEnd - d.windowStart > PROCESS_MAX_SPAN_MS + MINUTE_MS
        ? rangeEnd - PROCESS_MAX_SPAN_MS
        : d.windowStart
  const trendEventMs = tab === 'trend' ? (trendEvent?.eventTime ?? null) : null
  const contextW = useMemo(
    () =>
      trendEventMs != null &&
      d.windowStart != null &&
      rangeEnd != null &&
      loadedStart != null &&
      trendEventMs >= d.windowStart &&
      trendEventMs < loadedStart
        ? contextWindow(trendEventMs, { start: d.windowStart, end: rangeEnd }, PROCESS_MAX_SPAN_MS)
        : null,
    [trendEventMs, d.windowStart, rangeEnd, loadedStart],
  )
  const context = useEventContext(contextW, line)

  const isStale = d.anchorMs != null && now - d.anchorMs > d.staleAfterMs

  // Laboratory devices whose newest reading on the platform is more than a day before the end of the
  // window: their parameters cannot appear in it. Named here, with their last date, so an empty
  // "actual C3S" is explained where it is seen (seen live on JSW: the clinker laboratory stopped
  // 16 Oct 2026 while the model and the DCS went on).
  const labBehind = useMemo(() => {
    const end = d.windowEnd
    if (end == null) return []
    return d.sources
      .filter((s) => s.kind === 'lab' && s.newestEver != null && end - s.newestEver > DAY_MS)
      .map((s) => {
        const carries = (['actualC3S', 'freeLime', 'predictedC3S'] as const)
          .filter((r) => line.role(r)?.startsWith(`${s.devID}:`))
          .map((r) => (r === 'actualC3S' ? 'laboratory C3S' : r === 'freeLime' ? 'free lime' : 'predicted C3S'))
        return { ...s, carries }
      })
      .sort((a, b) => (b.carries.length - a.carries.length) || (a.newestEver! - b.newestEver!))
  }, [d.sources, d.windowEnd, line])

  const header = (loading: boolean) => (
    <Header
      anchorMs={d.anchorMs}
      lastRefreshed={d.lastRefreshed}
      isStale={isStale}
      onRefresh={d.refresh}
      loading={loading}
      onSignOut={onSignOut}
      now={now}
    />
  )

  // Nothing can be drawn until the window is known (a preset needs the newest sample).
  if (d.windowStart == null) {
    return (
      <LineProvider line={line}>
        <div className="app">
          {header(true)}
          <main className="app__main">
            <LoadingState message="Loading plant data…" />
          </main>
        </div>
      </LineProvider>
    )
  }

  const loadingAny = d.labLoading || d.rcaLoading || d.processLoading

  return (
    <LineProvider line={line}>
    <div className="app">
      {header(loadingAny)}

      <main className="app__main">
        <div className="tabs" role="tablist" aria-label="Dashboard views">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              className={`tabs__tab ${tab === t.id ? 'is-active' : ''}`}
              onClick={() => openTabFromBar(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isStale && d.anchorMs && selection.kind === 'preset' ? (
          <div className="notice notice--warn" role="status">
            <strong>Feed is behind.</strong> The newest laboratory sample is{' '}
            {formatFull(d.anchorMs)}. The range below is anchored to that sample rather than
            to the current time, so the charts show real data instead of an empty range.
          </div>
        ) : null}

        {labBehind.length > 0 ? (
          <div className="notice notice--warn" role="status" data-testid="lab-behind">
            <strong>
              {labBehind.length === 1 ? 'A laboratory feed is behind.' : `${labBehind.length} laboratory feeds are behind.`}
            </strong>{' '}
            {labBehind.slice(0, 3).map((s, i) => (
              <span key={s.devID}>
                {i > 0 ? ' · ' : ''}
                <code>{s.devID}</code> ({s.label}
                {s.carries.length ? `; carries the ${s.carries.join(' and ')}` : ''}) last reported{' '}
                <strong>{formatFull(s.newestEver)}</strong> ({formatAge(s.newestEver, now)})
              </span>
            ))}
            {labBehind.length > 3 ? (
              <span title={labBehind.slice(3).map((s) => `${s.devID}: ${formatFull(s.newestEver)}`).join('\n')}>
                {' '}· and {labBehind.length - 3} more (see Data sources)
              </span>
            ) : null}
            . Their parameters cannot appear in a range that ends after that.{' '}
            <button
              type="button"
              className="btn btn--sm notice__action"
              onClick={() => {
                // The 7 days up to the newest laboratory reading, as a custom range: every laboratory
                // parameter that was being sent then appears, and the stop is on the right edge.
                const end = labBehind[0].newestEver! + MINUTE_MS
                setSelection({ kind: 'custom', start: end - 7 * DAY_MS, end, label: `Week up to the last ${labBehind[0].label.toLowerCase()} sample` })
              }}
            >
              Show the week up to {formatFull(labBehind[0].newestEver)}
            </button>{' '}
            Raise the stopped feed with the plant&rsquo;s laboratory integration.
          </div>
        ) : null}

        {d.dataError ? (
          <div className="notice notice--error" role="alert">
            <strong>Plant data unavailable.</strong> {d.dataError.message}
            {d.dataError.isAuth ? ' Sign in again to continue.' : ''}
          </div>
        ) : null}

        {/* Directly above each view, so the scope reads as the view's own header. */}
        <ScopeBar
          line={lineSel}
          onLineChange={changeLine}
          selection={selection}
          onSelectionChange={setSelection}
          windowStart={d.windowStart}
          windowEnd={d.windowEnd}
          anchorMs={d.anchorMs}
          trailing={
            <DataSourcesToggle sources={d.sources} windowStart={d.windowStart} open={sourcesOpen} onToggle={() => setSourcesOpen((o) => !o)} />
          }
        />

        {/* What each device holds and returned: the first stop when a panel says "no data". */}
        {sourcesOpen ? <DataSources sources={d.sources} windowStart={d.windowStart} windowEnd={d.windowEnd} now={now} /> : null}

        {tab === 'executive' ? (
          <div role="tabpanel" id="panel-executive" aria-labelledby="tab-executive">
            <ExecutiveView d={d} now={now} targets={zoneTargets} />
          </div>
        ) : tab === 'trend' ? (
          <div role="tabpanel" id="panel-trend" aria-labelledby="tab-trend">
            <Suspense fallback={<LoadingState message="Loading trend analysis…" />}>
              <TrendAnalysis
                findings={trendEvent && !d.rca.includes(trendEvent) ? [trendEvent, ...d.rca] : d.rca}
                event={trendEvent}
                onSelect={openTrendEvent}
                range={{
                  start: d.windowStart,
                  end: d.windowEnd ?? d.windowStart,
                  rows: d.processRows,
                  loading: d.processLoading,
                  error: d.processError,
                  thinned: !d.processFull,
                  fetchedStart: loadedStart != null && loadedStart !== d.windowStart ? loadedStart : null,
                  reload: d.refresh,
                }}
                rangeLab={{ rows: d.labRows, loading: d.labLoading, error: d.labError, reload: d.refresh }}
                trends={trends}
                context={context}
                zoneTargets={zoneTargets}
                rcaLoading={d.rcaLoading}
                rcaError={d.rcaError}
              />
            </Suspense>
          </div>
        ) : (
          <div role="tabpanel" id="panel-analysis" aria-labelledby="tab-analysis">
            <C3SAnalysisView
              d={d}
              now={now}
              selected={selected}
              onSelectId={setPickedId}
              targets={zoneTargets}
              timeline={timeline}
              eventProcess={{ rows: trends.processRows, loading: trends.processLoading, error: trends.processError }}
              onOpenTrends={() => {
                // Trend Analysis opens on this event: the range's trends with its RCA analysis.
                setTrendEventId(selected?.id ?? null)
                setTab('trend')
                window.scrollTo({ top: 0 })
              }}
            />
          </div>
        )}

        <footer className="app__footer">
          <p>
            Predicted C3S is a model output; actual C3S is the laboratory result. Root cause
            findings come from the platform&rsquo;s C3S RCA insight ({line.insightId}). Every value is read live
            from the platform; none is sample or demonstration data.
          </p>
        </footer>
      </main>
    </div>
    </LineProvider>
  )
}

export default function App() {
  const { token, exchanging, error, signIn, signOut } = useAuth()

  if (!token) {
    return <LoginGate exchanging={exchanging} error={error} onSignIn={signIn} />
  }

  return (
    <Dashboard
      onSignOut={() => {
        clearStoredToken()
        signOut()
      }}
    />
  )
}
