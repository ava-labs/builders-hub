export function ChartSkeletonLoader() {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <div className="h-8 w-64 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 dark:from-slate-600 dark:via-slate-700 dark:to-slate-600 rounded-md animate-pulse" />
        <div className="h-4 w-96 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 dark:from-slate-600 dark:via-slate-700 dark:to-slate-600 rounded-md animate-pulse" />
      </div>

      <div className="border border-slate-200 dark:border-slate-700 bg-white/30 dark:bg-slate-900/30 rounded-lg p-6 space-y-4 shadow-sm">
        <div className="flex space-x-6 justify-center">
          <div className="flex items-center space-x-2">
            <div className="h-3 w-3 rounded-full bg-blue-400 dark:bg-blue-500 animate-pulse" />
            <div className="h-4 w-16 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 dark:from-slate-600 dark:via-slate-700 dark:to-slate-600 rounded animate-pulse" />
          </div>
          <div className="flex items-center space-x-2">
            <div className="h-3 w-3 rounded-full bg-green-400 dark:bg-green-500 animate-pulse" />
            <div className="h-4 w-20 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 dark:from-slate-600 dark:via-slate-700 dark:to-slate-600 rounded animate-pulse" />
          </div>
          <div className="flex items-center space-x-2">
            <div className="h-3 w-3 rounded-full bg-purple-400 dark:bg-purple-500 animate-pulse" />
            <div className="h-4 w-18 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 dark:from-slate-600 dark:via-slate-700 dark:to-slate-600 rounded animate-pulse" />
          </div>
        </div>

        <div className="relative h-80 flex items-end justify-between px-4 py-4 bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded">
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between py-4">
            <div className="h-3 w-8 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 dark:from-slate-600 dark:via-slate-700 dark:to-slate-600 rounded animate-pulse" />
            <div className="h-3 w-6 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 dark:from-slate-600 dark:via-slate-700 dark:to-slate-600 rounded animate-pulse" />
            <div className="h-3 w-8 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 dark:from-slate-600 dark:via-slate-700 dark:to-slate-600 rounded animate-pulse" />
            <div className="h-3 w-6 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 dark:from-slate-600 dark:via-slate-700 dark:to-slate-600 rounded animate-pulse" />
            <div className="h-3 w-4 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 dark:from-slate-600 dark:via-slate-700 dark:to-slate-600 rounded animate-pulse" />
          </div>

          <div className="flex items-end space-x-3 ml-12 flex-1 h-full">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center space-y-2"
              >
                <div className="w-full flex flex-col items-end space-y-1">
                  <div
                    className="w-full bg-gradient-to-t from-blue-500 to-blue-400 dark:from-blue-600 dark:to-blue-500 rounded-sm animate-pulse"
                    style={{
                      height: `${Math.random() * 60 + 20}%`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                  <div
                    className="w-full bg-gradient-to-t from-green-500 to-green-400 dark:from-green-600 dark:to-green-500 rounded-sm animate-pulse opacity-70"
                    style={{
                      height: `${Math.random() * 40 + 10}%`,
                      animationDelay: `${i * 0.1 + 0.05}s`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between px-12">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-3 w-8 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 dark:from-slate-600 dark:via-slate-700 dark:to-slate-600 rounded animate-pulse"
              style={{ animationDelay: `${i * 0.05}s` }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3"
          >
            <div
              className="h-4 w-24 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 dark:from-slate-600 dark:via-slate-700 dark:to-slate-600 rounded animate-pulse"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
            <div
              className="h-8 w-16 bg-gradient-to-r from-blue-400 via-blue-300 to-blue-400 dark:from-blue-600 dark:via-blue-500 dark:to-blue-600 rounded animate-pulse"
              style={{ animationDelay: `${i * 0.1 + 0.05}s` }}
            />
            <div
              className="h-3 w-20 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 dark:from-slate-600 dark:via-slate-700 dark:to-slate-600 rounded animate-pulse"
              style={{ animationDelay: `${i * 0.1 + 0.1}s` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
