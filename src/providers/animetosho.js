const axios = require('axios');

async function getAnimeToshoSubtitles(meta) {
  const subtitles = [];
  const searchQuery = meta.romajiTitle || meta.title || meta.englishTitle;
  if (!searchQuery) return subtitles;

  try {
    // Tìm kiếm torrent/tập tương ứng trên AnimeTosho API
    // AnimeTosho cung cấp API JSON cho search
    const epStr = String(meta.episode).padStart(2, '0');
    const query = `${searchQuery} ${epStr}`;
    const url = `https://feed.animetosho.org/json?q=${encodeURIComponent(query)}&only_tor=1`;

    const res = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (Array.isArray(res.data)) {
      for (const item of res.data.slice(0, 5)) {
        // Kiểm tra xem item có file attachments (subtitles) không
        if (Array.isArray(item.attachments)) {
          for (const att of item.attachments) {
            const filename = (att.filename || '').toLowerCase();
            if (filename.endsWith('.srt') || filename.endsWith('.vtt') || filename.endsWith('.ass')) {
              const isVie = filename.includes('vi') || filename.includes('vie') || filename.includes('viet');
              subtitles.push({
                id: `animetosho_${att.id || Math.random().toString(36).substring(7)}`,
                url: att.url,
                filename: att.filename,
                lang: isVie ? 'vie' : 'eng',
                format: filename.split('.').pop(),
                sourceTitle: item.title,
                label: isVie ? `🇻🇳 AnimeTosho [${att.filename}]` : `🇬🇧 AnimeTosho [${att.filename}]`
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.log(`[AnimeTosho] Error fetching for ${searchQuery}:`, err.message);
  }

  return subtitles;
}

module.exports = {
  getAnimeToshoSubtitles
};
