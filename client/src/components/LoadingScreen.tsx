interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingScreen({
  message = 'Loading...',
  fullScreen = true
}: LoadingScreenProps) {
  const containerClass = fullScreen
    ? 'fixed inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 z-50'
    : 'flex items-center justify-center py-12';

  return (
    <div className={containerClass}>
      <div className="text-center">
        <div className="relative inline-block mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center text-white text-5xl font-bold shadow-2xl animate-pulse">
            S
          </div>
          <div className="absolute inset-0">
            <div className="absolute top-0 left-1/2 w-3 h-3 bg-blue-500 rounded-full animate-orbit-1" />
            <div className="absolute top-0 left-1/2 w-3 h-3 bg-purple-500 rounded-full animate-orbit-2" />
            <div className="absolute top-0 left-1/2 w-3 h-3 bg-pink-500 rounded-full animate-orbit-3" />
          </div>
        </div>

        <h3 className="text-xl font-bold text-gray-800 mb-2">{message}</h3>
        <p className="text-gray-600 text-sm">Please wait...</p>

        <div className="flex items-center justify-center gap-2 mt-6">
          <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
