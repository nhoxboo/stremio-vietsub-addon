const axios = require('axios');

async function getOpenSubtitles(meta) {
  const subtitles = [];
  const query = meta.englishTitle || meta.title || meta.romajiTitle;
  if (!query && !meta.imdbId) return subtitles;

  try {
    let url = `https://opensubtitles-v3.strem.io/subtitles/${meta.type}/${meta.imdbId || query}`;
    if (meta.season && meta.episode) {
      url += `:${meta.season}:${meta.episode}`;
    }
    url += '.json';

    const res = await axios.get(url, { timeout: 4000 });
    if (res.data && Array.isArray(res.data.subtitles)) {
      for (const sub of res.data.subtitles) {
        if (sub.lang === 'vie' || sub.lang === 'eng') {
          subtitles.push({
            id: `opensub_${sub.id || Math.random().toString(36).substring(7)}`,
            url: sub.url,
            lang: sub.lang,
            label: sub.lang === 'vie' ? '🇻🇳 OpenSubtitles [Việt]' : '🇬🇧 OpenSubtitles [English]'
          });
        }
      }
    }
  } catch (err) {
    // ignore
  }

  return subtitles;
}

module.exports = {
  getOpenSubtitles
};
