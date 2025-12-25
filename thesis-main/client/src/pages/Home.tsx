/**
 * @deprecated Use Landing.tsx instead. This file is kept for reference only.
 * All homepage traffic should route to Landing.tsx.
 */

import { Navigate } from 'react-router-dom'

export default function Home() {
  return <Navigate to="/" replace />
}
