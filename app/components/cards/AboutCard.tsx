export default function AboutCard() {
  return (
    <section
      aria-labelledby="about-card-heading"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-[#c27aff]">
        <h2
          id="about-card-heading"
          className="text-sm font-bold text-gray-800 dark:text-gray-100"
        >
          Tentang Sekian Info
        </h2>
      </div>

      <div className="p-5">
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          <b>Sekian Info</b> adalah <i>AI-powered news aggregator</i> yang mengelompokkan berita
          dari berbagai media dan merangkumnya menjadi topik yang mudah dipahami.
          Alih-alih membaca berita yang sama dari berbagai sumber, fokus melihat inti dari setiap peristiwa.
        </p>
      </div>
    </section>
  )
}