'use client'

import Link from 'next/link'
import styles from '../components/GamePageLayout.module.css'
import TournamentSelector from '../components/TournamentSelector'

export default function LeagueOfLegendsPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          SPECTOR
        </Link>
        <Link 
          href="/val" 
          className={`${styles.switchButton} ${styles.switchButtonVal}`}
        >
          Switch to Valorant
        </Link>
      </header>

      <div className={`${styles.accentBar} ${styles.accentBarLol}`} />

      <main className={styles.main}>
        <h1 className={`${styles.pageTitle} ${styles.pageTitleLol}`}>
          LEAGUE OF LEGENDS
        </h1>
        
        <div className={styles.contentSection}>
          <TournamentSelector game="lol" />
        </div>
      </main>
    </div>
  )
}
