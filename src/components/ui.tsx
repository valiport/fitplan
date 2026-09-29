// Liquid-Glass-UI-Primitives: Fenster, Titelleisten, Buttons, Panels.
// API bleibt kompatibel zur bisherigen XP-Datei (gleiche Namen/Props).

import type { ButtonHTMLAttributes, ReactNode } from 'react'

export const XP_OUTER = 'glass-panel'
export const XP_INSET = 'glass-inset'

export function XpTitleBar({ title, icon, actions }: { title: string; icon?: string; actions?: ReactNode }) {
  return (
    <div className="glass-titlebar">
      <span className="glass-title">
        {icon ? <span aria-hidden>{icon}</span> : null}
        <span className="truncate">{title}</span>
      </span>
      <span className="glass-titlebar-actions">{actions}</span>
    </div>
  )
}

export function XpTitleButton({ label, onClick, danger }: {
  label: string
  onClick?: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={'glass-titlebtn' + (danger ? ' glass-titlebtn-danger' : '')}
    >
      {danger ? '✕' : '—'}
    </button>
  )
}

export function XpWindow({ title, icon, children, actions, className = '' }: {
  title: string
  icon?: string
  children: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={'glass-panel w-full max-w-md ' + className}>
      <XpTitleBar title={title} icon={icon} actions={actions} />
      <div className="p-3">{children}</div>
    </div>
  )
}

export function XpGroupBox({ title, children, className = '' }: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <fieldset className={'glass-groupbox ' + className}>
      {title ? <legend>{title}</legend> : null}
      {children}
    </fieldset>
  )
}

type XpButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'danger'
  className?: string
}

export function XpButton({ variant = 'default', className = '', ...rest }: XpButtonProps) {
  const look =
    variant === 'primary'
      ? 'glass-btn glass-btn-primary'
      : variant === 'danger'
        ? 'glass-btn glass-btn-danger'
        : 'glass-btn'
  return (
    <button
      {...rest}
      className={look + ' ' + className}
    />
  )
}

export function XpStatusBox({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={'glass-inset text-[12px] ' + className}>{children}</div>
}

export function XpProgress({ percent, label }: { percent: number; label?: string }) {
  const p = Math.max(0, Math.min(100, percent))
  return (
    <div className="w-full">
      {label ? <div className="mb-0.5 text-[11px] text-[#8bada7]">{label}</div> : null}
      <div
        className="glass-progress"
        role="progressbar"
        aria-valuenow={Math.round(p)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="glass-progress-fill" style={{ width: p + '%' }} />
      </div>
    </div>
  )
}
