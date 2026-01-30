'use client'

import Link from 'next/link'
import styles from '../components/GamePageLayout.module.css'
import TournamentSelector from '../components/TournamentSelector'

export default function ValorantPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          SPECTOR
        </Link>
        <h1 className={`${styles.pageTitle} ${styles.pageTitleVal}`}>
          VALORANT
        </h1>
        <Link 
          href="/lol" 
          className={`${styles.switchButton} ${styles.switchButtonLol}`}
        >
          Switch to League of Legends
        </Link>
      </header>

      <div className={`${styles.accentBar} ${styles.accentBarVal}`} />

      <main className={styles.main}>
        <div className={styles.contentSection}>
          <TournamentSelector game="valorant" />
        </div>
      </main>
    </div>
  )
}
