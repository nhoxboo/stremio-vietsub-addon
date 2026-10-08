const axios = require('axios');

async function getAnimeSubSubtitles(type, id, userConfig = {}) {
  const subtitles = [];
  const token = userConfig.animeSubToken || 'u_262HEMoxsFK1Vbg6Oj7fVA';
  const baseUrl = `https://animesub.duckdns.org/${token}`;

  try {
    // AnimeSub+ hỗ trợ endpoint /subtitles/:type/:id.json
    const url = `${baseUrl}/subtitles/${type}/${id}.json`;
    const res = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (res.data && Array.isArray(res.data.subtitles)) {
      for (const sub of res.data.subtitles) {
        subtitles.push({
          id: `animesub_${sub.id || Math.random().toString(36).substring(7)}`,
          url: sub.url,
          lang: sub.lang || 'vie',
          label: sub.label || (sub.lang === 'vie' ? '🇻🇳 AnimeSub+ [Việt]' : `🌐 AnimeSub+ [${sub.lang}]`)
        });
      }
    }
  } catch (err) {
    // Bỏ qua lỗi kết nối tới server AnimeSub+
  }

  return subtitles;
}

module.exports = {
  getAnimeSubSubtitles
};
