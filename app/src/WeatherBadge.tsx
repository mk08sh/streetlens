import type { ReactElement } from 'react'
import type { WeatherIcon } from './data'

const paths: Record<WeatherIcon, ReactElement> = {
  sun: <g><circle cx={12} cy={12} r={4.5} /><g className="rays">{[0, 45, 90, 135, 180, 225, 270, 315].map(a => <line key={a} x1={12} y1={2.5} x2={12} y2={5} transform={`rotate(${a} 12 12)`} />)}</g></g>,
  heat: <g><circle cx={12} cy={12} r={5.5} /><g className="rays">{[0, 45, 90, 135, 180, 225, 270, 315].map(a => <line key={a} x1={12} y1={1.5} x2={12} y2={4.5} transform={`rotate(${a} 12 12)`} />)}</g></g>,
  cloud: <path d="M7 17.5h9.5a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 7.4 9.6 4 4 0 0 0 7 17.5z" />,
  rain: <g><path d="M7 14h9.5a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 7.4 6.1 4 4 0 0 0 7 14z" /><g className="drops"><line x1={9} y1={16.5} x2={8} y2={19.5} /><line x1={12.5} y1={16.5} x2={11.5} y2={19.5} /><line x1={16} y1={16.5} x2={15} y2={19.5} /></g></g>,
  snow: <g className="flake">{[0, 60, 120].map(a => <line key={a} x1={12} y1={4} x2={12} y2={20} transform={`rotate(${a} 12 12)`} />)}{[0, 60, 120, 180, 240, 300].map(a => <path key={'b' + a} d="M12 5 l-2 2 M12 5 l2 2" transform={`rotate(${a} 12 12)`} />)}</g>,
  freezing: <g><path d="M7 13h9.5a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 7.4 5.1 4 4 0 0 0 7 13z" /><g className="drops"><line x1={9} y1={15.5} x2={8} y2={18.5} /><circle cx={12.5} cy={17.5} r={1.2} /><line x1={16} y1={15.5} x2={15} y2={18.5} /></g></g>,
  fog: <g className="fog"><line x1={5} y1={9} x2={19} y2={9} /><line x1={4} y1={12.5} x2={18} y2={12.5} /><line x1={6} y1={16} x2={20} y2={16} /></g>,
}
const label: Record<WeatherIcon, string> = { sun: 'mostly dry', heat: 'hot days', cloud: 'some rain', rain: 'rainy month', snow: 'snow', freezing: 'snow and freezing rain', fog: 'foggy' }

export function WeatherBadge({ icon, temp }: { icon: WeatherIcon | null; temp: number | null }) {
  if (!icon) return <div className="weatherbadge muted">no weather archived</div>
  return (
    <div className="weatherbadge" title={label[icon]}>
      <svg viewBox="0 0 24 24" className={`wicon ${icon}`}>{paths[icon]}</svg>
      <span className="temp">{temp == null ? '—' : `${Math.round(temp)}°`}</span>
    </div>
  )
}
