/**
 * The selected line, for components. Hooks take the model as an argument (so their fetch keys
 * are explicit); leaf components read it from here rather than having it threaded through every
 * prop list.
 */

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { LineModel } from './lineModel'

const LineContext = createContext<LineModel | null>(null)

export function LineProvider({ line, children }: { line: LineModel; children: ReactNode }) {
  return <LineContext.Provider value={line}>{children}</LineContext.Provider>
}

export function useLine(): LineModel {
  const line = useContext(LineContext)
  if (!line) throw new Error('useLine() outside a LineProvider')
  return line
}
