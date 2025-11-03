import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="container py-12">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">Welcome to Spell Wise</h1>
        <p className="text-gray-600 mt-2 max-w-2xl mx-auto">Teacher and Student experiences for focused spelling practice.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="section p-6 text-center">
          <h2 className="text-lg font-semibold mb-2">Teacher</h2>
          <p className="text-sm text-gray-600 mb-4">Create experiments, generate stories and audio, launch sessions.</p>
          <Link to="/login" className="btn primary w-full">Teacher Login</Link>
        </div>
        <div className="section p-6 text-center">
          <h2 className="text-lg font-semibold mb-2">Student</h2>
          <p className="text-sm text-gray-600 mb-4">Join with a code from your teacher to start.</p>
          <Link to="/login" className="btn w-full">Student Login</Link>
        </div>
        <div className="section p-6 text-center">
          <h2 className="text-lg font-semibold mb-2">Try Demo</h2>
          <p className="text-sm text-gray-600 mb-4">Explore a demo session without signing up.</p>
          <Link to="/demo-login" className="btn w-full">Start Demo</Link>
        </div>
      </div>
    </div>
  )
}


