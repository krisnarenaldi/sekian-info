import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import MasonryGrid from './components/layout/MasonryGrid'
import IndonesiaHariIniCard from './components/cards/IndonesiaHariIniCard'
import SportHariIniCard from './components/cards/SportHariIniCard'
import InternationalHariIniCard from './components/cards/InternationalHariIniCard'
import PasarInvestasiCard from './components/cards/PasarInvestasiCard'
import PasarHariIniCard from './components/cards/PasarHariIniCard'
import PasarUSDIDRCard from './components/cards/PasarUSDIDRCard'
import PasarEmasCard from './components/cards/PasarEmasCard'
// import AIHariIniCard from './components/cards/AIHariIniCard'
import SingleNewsCard from './components/cards/SingleNewsCard'
import TrendingCard from './components/cards/TrendingCard'
import InspirasiCard from './components/cards/InspirasiCard'
import JadwalSholatCard from './components/cards/JadwalSholatCard'
import TanggalMerahCard from './components/cards/TanggalMerahCard'
import SaweriaCard from './components/cards/SaweriaCard'
import AboutCard from './components/cards/AboutCard'
// import AnimeCard from './components/cards/AnimeCard'
import { fetchDailyDigest } from '@/lib/fetchers/fetchDailyDigest'
import { fetchSportNews } from '@/lib/fetchers/fetchSportNews'
import { fetchMarketNews } from '@/lib/fetchers/fetchMarketNews'
import { fetchMarketData } from '@/lib/fetchers/fetchMarketData'
import { fetchMarketDataHistory, getDateRange } from '@/lib/fetchers/fetchMarketDataHistory'
import { fetchAINews } from '@/lib/fetchers/fetchAINews'
import { fetchInspirasi } from '@/lib/fetchers/fetchInspirasi'
import { fetchTrending } from '@/lib/fetchers/fetchTrending'
import { fetchInternationalNews } from '@/lib/fetchers/fetchInternationalNews'

export default async function Home() {
  const { startDate, endDate } = getDateRange(30)

  const [digestRes, sportRes, intlRes, marketRes, marketNewsRes, aiRes, inspirasiRes, trendingRes, historyRes] = await Promise.allSettled([
    fetchDailyDigest(),
    fetchSportNews(),
    fetchInternationalNews(),
    fetchMarketData(),
    fetchMarketNews(),
    fetchAINews(),
    fetchInspirasi(),
    fetchTrending(),
    fetchMarketDataHistory(startDate, endDate),
  ])

  const digestData     = digestRes.status     === 'fulfilled' ? digestRes.value     : null
  const sportData      = sportRes.status      === 'fulfilled' ? sportRes.value      : null
  const intlData       = intlRes.status       === 'fulfilled' ? intlRes.value       : null
  const marketData     = marketRes.status     === 'fulfilled' ? marketRes.value     : null
  const marketHistory  = historyRes.status    === 'fulfilled' ? historyRes.value    : []
  const marketNewsData = marketNewsRes.status === 'fulfilled' ? marketNewsRes.value : null
  const aiNewsData     = aiRes.status         === 'fulfilled' ? aiRes.value         : null
  const trendingData   = trendingRes.status   === 'fulfilled' ? trendingRes.value   : null

  const inspirasiState =
    inspirasiRes.status === 'fulfilled'
      ? { error: false as const, data: inspirasiRes.value }
      : { error: true as const,  data: null }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-gray-900">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-2 py-4">
        <MasonryGrid>
          
          <IndonesiaHariIniCard digestItems={digestData} />  
          <PasarEmasCard historyData={marketHistory} />                  
          <SportHariIniCard digestItems={sportData} />
          <PasarUSDIDRCard historyData={marketHistory} />
          <InternationalHariIniCard digestItems={intlData} />
          <SingleNewsCard title="Teknologi"
                        rssUrl="https://www.cnnindonesia.com/teknologi/rss" 
          />
          <PasarInvestasiCard digestItems={marketNewsData} />
          <SingleNewsCard title="Investasi"
                        rssUrl="https://www.cnbcindonesia.com/market/rss" 
          />
          <PasarHariIniCard marketData={marketData} historyData={marketHistory} />          
          
          <SingleNewsCard title="Olah Raga"
                        rssUrl="https://sport.detik.com/rss" 
          />
          {/*<AIHariIniCard aiNews={aiNewsData} /> */}
          <TrendingCard trendingData={trendingData} />          
          {/*<InspirasiCard
            inspirasi={inspirasiState.data}
            hasError={inspirasiState.error}
          />*/}
          
          <TanggalMerahCard />
          <JadwalSholatCard />          
          <AboutCard />
          <SaweriaCard />          
        </MasonryGrid>
      </main>

      <Footer />
    </div>
  )
}
