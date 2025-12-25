import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { toast } from '../store/toasts'
import { useAuth } from '../store/auth'
import logo from '../assets/spellwise.png'

export default function StudentConsent() {
  const nav = useNavigate()
  const auth = useAuth()
  const [agreedConsent, setAgreedConsent] = useState(false)
  const [agreedPrivacy, setAgreedPrivacy] = useState(false)
  const [agreedDataStorage, setAgreedDataStorage] = useState(false)
  const username = (auth.email || '').trim()
  const consentKey = username ? `student-consent:${username.toLowerCase()}` : ''

  function handleContinue(forceAll = false) {
    if (!forceAll && (!agreedConsent || !agreedPrivacy || !agreedDataStorage)) {
      toast.error('Please read and agree to all terms before continuing')
      return
    }
    if (!username) {
      toast.error('Please sign in again to continue')
      nav('/student-login')
      return
    }
    api.post('/api/student/consent', { version: 'v1' })
      .then(() => {
        localStorage.setItem(consentKey, 'true')
        localStorage.setItem(`${consentKey}:date`, new Date().toISOString())
        nav('/student')
      })
      .catch(() => toast.error('Could not save consent. Please try again.'))
  }

  function acceptAllAndContinue() {
    setAgreedConsent(true)
    setAgreedPrivacy(true)
    setAgreedDataStorage(true)
    handleContinue(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full">
        <div className="mb-6">
          <img src={logo} alt="SpellWise" className="w-12 h-12 rounded-xl bg-blue-50 p-1 object-contain mb-3" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">SpellWise</h1>
          <p className="text-gray-600">Educational Spelling Experiment Platform</p>
        </div>

        <hr className="mb-6" />

        <div className="mb-6 bg-blue-50 p-4 rounded border border-blue-200">
          <p className="text-sm text-gray-700">Before you can participate, we need your consent to collect and process your data in accordance with GDPR regulations.</p>
        </div>

        <div className="space-y-5">
          <div className="border rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedConsent}
                onChange={(e) => setAgreedConsent(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 rounded"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-800 mb-2">I consent to participate in SpellWise experiments</div>
                <div className="text-sm text-gray-700">
                  <p>I understand that my spelling attempts, responses, and progress will be recorded for research purposes.</p>
                  <p className="text-xs text-gray-600 italic mt-1">Legal basis: Consent (GDPR Article 7)</p>
                </div>
              </div>
            </label>
          </div>

          <div className="border rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedPrivacy}
                onChange={(e) => setAgreedPrivacy(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 rounded"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-800 mb-2">I have read and accept the Privacy Policy</div>
                <div className="text-sm text-gray-700">
                  <p>I understand how my data will be collected, used, stored, and protected.</p>
                  <p className="text-xs text-gray-600 italic mt-1">Legal basis: Transparency (GDPR Articles 13-14)</p>
                </div>
              </div>
            </label>
          </div>

          <div className="border rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedDataStorage}
                onChange={(e) => setAgreedDataStorage(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 rounded"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-800 mb-2">I consent to data storage and processing</div>
                <div className="text-sm text-gray-700">
                  <p>I consent to SpellWise storing my data on secure servers in compliance with German data protection laws.</p>
                  <p className="text-xs text-gray-600 italic mt-1">Legal basis: Explicit Consent (GDPR Article 7, BDSG Section 42)</p>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 p-4 rounded border border-yellow-200">
          <div className="text-xs text-gray-700">
            <p className="font-semibold mb-2">Your GDPR Rights:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Right to Access: Request a copy of your data</li>
              <li>Right to Correction: Request corrections to inaccurate data</li>
              <li>Right to Erasure: Request deletion of your data</li>
              <li>Right to Withdraw: Withdraw consent at any time</li>
              <li>Right to Complaint: File a complaint with the data protection authority</li>
            </ul>
            <p className="mt-2">Contact: privacy@spellwise-education.de</p>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={() => nav('/')}
            className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            Decline & Go Back
          </button>
          <button
            onClick={() => handleContinue()}
            disabled={!agreedConsent || !agreedPrivacy || !agreedDataStorage}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            I Agree & Continue
          </button>
          <button
            onClick={acceptAllAndContinue}
            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
          >
            Accept All & Continue
          </button>
        </div>

        <div className="mt-6 text-xs text-gray-500 text-center border-t pt-4">
          <p>This consent form complies with GDPR (EU Regulation 2016/679) and German data protection laws.</p>
          <p className="mt-2">Last updated: November 2024 | Version 1.0</p>
        </div>
      </div>
    </div>
  )
}
