import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-900 to-black" />
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, rgba(120, 0, 0, 0.15) 0%, transparent 50%),
                           radial-gradient(circle at 75% 75%, rgba(0, 50, 100, 0.1) 0%, transparent 50%)`
        }} />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-900 to-red-700 rounded flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight">
            ELITE <span className="text-red-600">RECOVERY</span>
          </span>
        </div>
        <a
          href="mailto:doug@eliterecoveryla.com"
          className="hidden sm:flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          doug@eliterecoveryla.com
        </a>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-red-950/50 border border-red-900/50 rounded-full px-4 py-2 mb-8">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-400 text-sm font-medium tracking-wide uppercase">Licensed Fugitive Recovery</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight mb-6 max-w-4xl leading-[1.1]">
          We Find Those Who
          <br />
          <span className="bg-gradient-to-r from-red-500 via-red-600 to-red-700 bg-clip-text text-transparent">
            Don't Want To Be Found
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mb-4 leading-relaxed">
          Elite Recovery of Louisiana combines <span className="text-white font-medium">human intelligence</span> with
          <span className="text-white font-medium"> cutting-edge artificial intelligence</span> to locate and recover
          fugitives. Our network of sources, advanced skip-tracing tools, and AI-powered analysis
          delivers results when others fail.
        </p>

        <p className="text-zinc-500 text-sm mb-12 max-w-xl">
          Serving bail bond agencies throughout Louisiana with professional, discreet, and effective recovery services.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <a
            href="tel:+19852649519"
            className="group flex items-center justify-center gap-3 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-bold px-8 py-4 rounded-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-red-900/30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>985-264-9519</span>
          </a>
          <a
            href="mailto:doug@eliterecoveryla.com"
            className="flex items-center justify-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-medium px-8 py-4 rounded-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>Contact Us</span>
          </a>
        </div>

        {/* Features */}
        <div className="grid sm:grid-cols-3 gap-6 max-w-4xl w-full">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm">
            <div className="w-12 h-12 bg-red-950/50 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-white font-bold mb-2">Human Intelligence</h3>
            <p className="text-zinc-500 text-sm">Experienced investigators with deep local networks and street-level contacts throughout Louisiana.</p>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm">
            <div className="w-12 h-12 bg-red-950/50 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-white font-bold mb-2">AI-Powered Analysis</h3>
            <p className="text-zinc-500 text-sm">Advanced artificial intelligence processes data patterns to predict locations and identify connections.</p>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm">
            <div className="w-12 h-12 bg-red-950/50 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-white font-bold mb-2">Licensed & Insured</h3>
            <p className="text-zinc-500 text-sm">Fully licensed Louisiana bail enforcement agents operating with complete legal authority.</p>
          </div>
        </div>
      </main>

      {/* Agent Tools Section */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Recovery Agent <span className="text-red-500">Tools</span>
          </h2>
          <p className="text-zinc-400 mb-8">
            Licensed agents can access our proprietary case management system.
          </p>
          <Link
            href="/software"
            className="inline-flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-red-900/50 text-white font-medium px-8 py-4 rounded-lg transition-all group"
          >
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Access Recovery Software</span>
            <svg className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-900 py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <span className="font-bold text-white">ELITE RECOVERY</span>
            <span>of Louisiana</span>
          </div>
          <div className="flex items-center gap-6 text-zinc-500 text-sm">
            <span>Licensed Bail Enforcement</span>
            <a href="mailto:doug@eliterecoveryla.com" className="hover:text-white transition-colors">
              doug@eliterecoveryla.com
            </a>
          </div>
        </div>
        <div className="max-w-4xl mx-auto mt-4 pt-4 border-t border-zinc-900 text-center text-zinc-600 text-xs">
          © {new Date().getFullYear()} Elite Recovery of Louisiana. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
