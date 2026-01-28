import Link from 'next/link'
import styles from './page.module.css'

export default function Home() {
  return (
    <main className={styles.container}>
      {/* Game Selection Cards */}
      <div className={styles.tabsContainer}>
        <Link href="/lol" className={`${styles.gameTab} ${styles.lolTab}`}>
          <span className={styles.tabTitle}>League of Legends</span>
        </Link>

        <Link href="/val" className={`${styles.gameTab} ${styles.valTab}`}>
          <span className={styles.tabTitle}>Valorant</span>
        </Link>
      </div>

      {/* Hero Section */}
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>SPECTOR</h1>
      </section>
    </main>
  )
}
