import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../store/toasts'
import { Check } from 'lucide-react'

export default function StudentConsent() {
  const nav = useNavigate()
  const [agreedConsent, setAgreedConsent] = useState(false)
  const [agreedPrivacy, setAgreedPrivacy] = useState(false)
  const [agreedDataStorage, setAgreedDataStorage] = useState(false)

  function handleContinue() {
    if (!agreedConsent || !agreedPrivacy || !agreedDataStorage) {
      toast.error('Please read and agree to all terms before continuing')
      return
    }
    sessionStorage.setItem('gdpr-consent-accepted', 'true')
    sessionStorage.setItem('gdpr-consent-date', new Date().toISOString())
    nav('/student/login')
  }

  const sections = [
    {
      id: 'consent',
      label: 'I consent to participate in SpellWise experiments',
      state: agreedConsent,
      setState: setAgreedConsent,
      body: [
        'I understand that I will be participating in an educational spelling experiment. My spelling attempts, responses to questions, and learning progress will be recorded for research purposes.',
        'Legal basis: Consent (GDPR Article 7)',
      ],
    },
    {
      id: 'privacy',
      label: 'I have read and accept the Privacy Policy',
      state: agreedPrivacy,
      setState: setAgreedPrivacy,
      list: [
        'What personal data will be collected (username, responses, progress)',
        'How the data will be used (research and educational purposes only)',
        'Who will have access to the data (researchers and educators only)',
        'How long the data will be retained (12 months unless consent extended)',
        'Your rights to access, correct, or delete your data',
      ],
      body: ['Legal basis: Transparency (GDPR Articles 13-14)'],
    },
    {
      id: 'data',
      label: 'I consent to data storage and processing',
      state: agreedDataStorage,
      setState: setAgreedDataStorage,
      list: [
        'Data is encrypted and stored securely',
        'Data will not be shared with third parties without additional consent',
        'I can request deletion of my data at any time',
        'Data processing complies with German data protection laws (BDSG, Sec. 42)',
      ],
      body: ['Legal basis: Explicit Consent (GDPR Article 7, BDSG Sec. 42)'],
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">SpellWise</h1>
          <p className="text-gray-600">Educational Spelling Experiment Platform</p>
        </div>

        <hr className="mb-6" />

        <div className="mb-6 bg-blue-50 p-4 rounded border border-blue-200">
          <p className="text-sm text-gray-700">
            Before you can participate in SpellWise experiments, we need your consent to collect and process your data in accordance with GDPR regulations.
          </p>
        </div>

        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.id} className="border rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={section.state}
                  onChange={(e) => section.setState(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600 rounded"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <Check size={16} className="text-blue-600" />
                    <span>{section.label}</span>
                  </div>
                  <div className="text-sm text-gray-700 space-y-2">
                    {section.list && (
                      <ul className="list-disc list-inside space-y-1 text-xs text-gray-700">
                        {section.list.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                    {section.body &&
                      section.body.map((text) => (
                        <p key={text} className={text.startsWith('Legal basis') ? 'text-xs text-gray-600 italic' : ''}>
                          {text}
                        </p>
                      ))}
                  </div>
                </div>
              </label>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-yellow-50 p-4 rounded border border-yellow-200">
          <div className="text-xs text-gray-700 space-y-2">
            <p className="font-semibold">Your GDPR Rights:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Right to Access:</strong> Request a copy of your data
              </li>
              <li>
                <strong>Right to Correction:</strong> Request corrections to inaccurate data
              </li>
              <li>
                <strong>Right to Erasure:</strong> Request deletion of your data ("Right to be Forgotten")
              </li>
              <li>
                <strong>Right to Withdraw:</strong> Withdraw consent at any time
              </li>
              <li>
                <strong>Right to Complaint:</strong> File a complaint with the data protection authority
              </li>
            </ul>
            <p className="mt-2">
              Contact: <strong>privacy@spellwise-education.de</strong>
            </p>
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
            onClick={handleContinue}
            disabled={!agreedConsent || !agreedPrivacy || !agreedDataStorage}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            I Agree & Continue
          </button>
        </div>

        <div className="mt-6 text-xs text-gray-500 text-center border-t pt-4">
          <p>
            This consent form complies with GDPR (EU Regulation 2016/679) and German Federal Data Protection Act
            (Bundesdatenschutzgesetz - BDSG).
          </p>
          <p className="mt-2">Last updated: November 2024 | Version 1.0</p>
        </div>
      </div>
    </div>
  )
}
