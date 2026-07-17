export default function LoadingSpinner({ message = '正在分析...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative w-16 h-16 mb-6">
        <div className="absolute inset-0 border-4 border-gray-100 rounded-full" />
        <div className="absolute inset-0 border-4 border-transparent border-t-vermilion rounded-full animate-spin" />
      </div>
      <p className="text-graphite text-lg animate-pulse">{message}</p>
      <p className="text-graphite/60 text-sm mt-2">AI 正在综合评估你的背景信息</p>
    </div>
  )
}
