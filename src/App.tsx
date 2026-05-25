import { useState } from 'react'
import reactLogo from './assets/icons/react.svg'
import viteLogo from './assets/icons/vite.svg'
import heroImg from './assets/images/hero.png'

function App() {
  const [count, setCount] = useState(0)

  return (
      <>
        <section
            id="center"
            className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center"
        >
          <div className="relative h-[220px] w-[260px]">
            <img
                src={heroImg}
                className="absolute left-1/2 top-1/2 h-[179px] w-[170px] -translate-x-1/2 -translate-y-1/2"
                width="170"
                height="179"
                alt=""
            />

            <img
                src={reactLogo}
                className="absolute left-2 top-6 h-20 w-20 animate-spin [animation-duration:20s]"
                alt="React logo"
            />

            <img
                src={viteLogo}
                className="absolute bottom-6 right-4 h-20 w-20 transition duration-300 hover:scale-110"
                alt="Vite logo"
            />
          </div>

          <div>
            <h1 className="my-8 font-heading text-4xl font-medium tracking-[-1.08px] text-app-heading lg:text-[56px] lg:tracking-[-1.68px]">
              Get started
            </h1>

            <p className="text-app-text">
              Edit{' '}
              <code className="inline-flex rounded bg-app-code-bg px-2 py-1 font-mono text-[15px] leading-[135%] text-app-heading">
                src/App.tsx
              </code>{' '}
              and save to test{' '}
              <code className="inline-flex rounded bg-app-code-bg px-2 py-1 font-mono text-[15px] leading-[135%] text-app-heading">
                HMR
              </code>
            </p>
          </div>

          <button
              type="button"
              className="mt-8 inline-flex rounded-xl border border-app-accent-border bg-app-accent-bg px-5 py-3 font-mono text-app-accent shadow-app transition hover:scale-105 hover:border-app-accent active:scale-95"
              onClick={() => setCount((count) => count + 1)}
          >
            Count is {count}
          </button>
        </section>

        <div className="h-px w-full bg-app-border" />

        <section
            id="next-steps"
            className="grid gap-0 border-b border-app-border md:grid-cols-2"
        >
          <div
              id="docs"
              className="border-b border-app-border p-8 text-left md:border-b-0 md:border-r"
          >
            <svg
                className="mb-6 h-10 w-10 text-app-accent"
                role="presentation"
                aria-hidden="true"
            >
              <use href="/icons.svg#documentation-icon"></use>
            </svg>

            <h2 className="mb-2 font-heading text-xl font-medium leading-[118%] tracking-[-0.2px] text-app-heading lg:text-2xl lg:tracking-[-0.24px]">
              Documentation
            </h2>

            <p className="text-app-text">Your questions, answered</p>

            <ul className="mt-6 grid gap-3">
              <li>
                <a
                    href="https://vite.dev/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-app-border bg-app-social-bg px-4 py-3 text-app-heading shadow-app transition hover:border-app-accent-border hover:bg-app-accent-bg"
                >
                  <img className="h-5 w-5" src={viteLogo} alt="" />
                  Explore Vite
                </a>
              </li>

              <li>
                <a
                    href="https://react.dev/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-app-border bg-app-social-bg px-4 py-3 text-app-heading shadow-app transition hover:border-app-accent-border hover:bg-app-accent-bg"
                >
                  <img className="button-icon h-5 w-5" src={reactLogo} alt="" />
                  Learn more
                </a>
              </li>
            </ul>
          </div>

          <div id="social" className="p-8 text-left">
            <svg
                className="mb-6 h-10 w-10 text-app-accent"
                role="presentation"
                aria-hidden="true"
            >
              <use href="/icons.svg#social-icon"></use>
            </svg>

            <h2 className="mb-2 font-heading text-xl font-medium leading-[118%] tracking-[-0.2px] text-app-heading lg:text-2xl lg:tracking-[-0.24px]">
              Connect with us
            </h2>

            <p className="text-app-text">Join the Vite community</p>

            <ul className="mt-6 grid gap-3">
              <li>
                <a
                    href="https://github.com/vitejs/vite"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-app-border bg-app-social-bg px-4 py-3 text-app-heading shadow-app transition hover:border-app-accent-border hover:bg-app-accent-bg"
                >
                  <svg
                      className="button-icon h-5 w-5"
                      role="presentation"
                      aria-hidden="true"
                  >
                    <use href="/icons.svg#github-icon"></use>
                  </svg>
                  GitHub
                </a>
              </li>

              <li>
                <a
                    href="https://chat.vite.dev/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-app-border bg-app-social-bg px-4 py-3 text-app-heading shadow-app transition hover:border-app-accent-border hover:bg-app-accent-bg"
                >
                  <svg
                      className="button-icon h-5 w-5"
                      role="presentation"
                      aria-hidden="true"
                  >
                    <use href="/icons.svg#discord-icon"></use>
                  </svg>
                  Discord
                </a>
              </li>

              <li>
                <a
                    href="https://x.com/vite_js"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-app-border bg-app-social-bg px-4 py-3 text-app-heading shadow-app transition hover:border-app-accent-border hover:bg-app-accent-bg"
                >
                  <svg
                      className="button-icon h-5 w-5"
                      role="presentation"
                      aria-hidden="true"
                  >
                    <use href="/icons.svg#x-icon"></use>
                  </svg>
                  X.com
                </a>
              </li>

              <li>
                <a
                    href="https://bsky.app/profile/vite.dev"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-app-border bg-app-social-bg px-4 py-3 text-app-heading shadow-app transition hover:border-app-accent-border hover:bg-app-accent-bg"
                >
                  <svg
                      className="button-icon h-5 w-5"
                      role="presentation"
                      aria-hidden="true"
                  >
                    <use href="/icons.svg#bluesky-icon"></use>
                  </svg>
                  Bluesky
                </a>
              </li>
            </ul>
          </div>
        </section>

        <div className="h-px w-full bg-app-border" />

        <section id="spacer" className="h-16" />
      </>
  )
}

export default App