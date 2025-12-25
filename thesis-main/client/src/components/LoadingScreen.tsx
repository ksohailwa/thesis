interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingScreen({
  message = 'Loading...',
  fullScreen = true
}: LoadingScreenProps) {
  const containerClass = fullScreen
    ? 'fixed inset-0 flex items-center justify-center bg-neutral-50 z-50'
    : 'flex items-center justify-center py-12';

  return (
    <div className={containerClass}>
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm px-8 py-6 w-full max-w-sm text-center">
        <h3 className="text-lg font-semibold text-neutral-800 mb-4">{message}</h3>
        <div className="space-y-3">
          <div className="h-3 w-3/4 mx-auto bg-neutral-100 rounded-full animate-pulse" />
          <div className="h-3 w-2/3 mx-auto bg-neutral-100 rounded-full animate-pulse" />
          <div className="h-3 w-1/2 mx-auto bg-neutral-100 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}
