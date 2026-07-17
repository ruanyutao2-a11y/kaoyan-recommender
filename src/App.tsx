function App() {
  return (
    <div className="min-h-screen bg-paper text-ink font-body">
      <header className="border-b border-graphite/20 px-6 py-4">
        <h1 className="font-display text-2xl font-bold text-vermilion">
          考研院校推荐
        </h1>
        <p className="text-sm text-graphite mt-1">
          Kaoyan School Recommender
        </p>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-12">
        <section className="text-center">
          <h2 className="font-display text-3xl font-semibold text-ink">
            找到最适合你的院校
          </h2>
          <p className="mt-4 text-graphite">
            Start building your personalized school recommendation.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 rounded bg-vermilion px-6 py-3 text-white transition hover:bg-vermilion/90">
            Get Started
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
