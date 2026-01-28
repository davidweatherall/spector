import Link from 'next/link'
import styles from './page.module.css'

// LoL Logo SVG Component
function LoLIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="currentColor">
      <path d="M20 4L6 12v16l14 8 14-8V12L20 4zm0 3.5l10.5 6v12L20 31.5 9.5 25.5v-12L20 7.5z"/>
      <path d="M20 12c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 13c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"/>
      <circle cx="20" cy="20" r="2.5"/>
    </svg>
  )
}

// Valorant Logo SVG Component  
function ValorantIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="currentColor">
      <path d="M8 8v24l12-12L8 8z"/>
      <path d="M20 20l12 12V8L20 20z" opacity="0.7"/>
      <path d="M17 17l6 6V11l-6 6z"/>
    </svg>
  )
}

export default function Home() {
  return (
    <main className={styles.container}>
      {/* League of Legends - Left Half */}
      <Link href="/lol" className={`${styles.panel} ${styles.panelLol}`}>
        <div className={styles.circuitOverlay} />
        <div className={styles.panelContent}>
          <div className={styles.iconContainer}>
            <LoLIcon className={`${styles.gameIcon} ${styles.lolIcon}`} />
          </div>
          <span className={styles.gameTitle}>League of Legends</span>
        </div>
      </Link>

      {/* Valorant - Right Half */}
      <Link href="/val" className={`${styles.panel} ${styles.panelVal}`}>
        <div className={styles.circuitOverlay} />
        <div className={styles.panelContent}>
          <div className={styles.iconContainer}>
            <ValorantIcon className={`${styles.gameIcon} ${styles.valIcon}`} />
          </div>
          <span className={styles.gameTitle}>Valorant</span>
        </div>
      </Link>

      {/* SPECTOR Title - Bottom Center */}
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>SPECTOR</h1>
      </section>
    </main>
  )
}
