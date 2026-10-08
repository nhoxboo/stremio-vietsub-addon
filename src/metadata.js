const axios = require('axios');

// Cache metadata để tránh request lặp lại
const metaCache = new Map();

async function resolveMetadata(type, id) {
  const cacheKey = `${type}:${id}`;
  if (metaCache.has(cacheKey)) {
    return metaCache.get(cacheKey);
  }

  let result = {
    imdbId: null,
    kitsuId: null,
    malId: null,
    title: '',
    romajiTitle: '',
    englishTitle: '',
    season: 1,
    episode: 1,
    type: type // 'series', 'movie', 'anime'
  };

  try {
    let parts = id.split(':');
    
    // Case 1: IMDb ID (tt1234567 hoặc tt1234567:1:1)
    if (id.startsWith('tt')) {
      result.imdbId = parts[0];
      if (parts.length >= 3) {
        result.season = parseInt(parts[1], 10) || 1;
        result.episode = parseInt(parts[2], 10) || 1;
      } else if (parts.length === 2) {
        result.episode = parseInt(parts[1], 10) || 1;
      }

      // Fetch title from Cinemeta
      try {
        const cinemetaType = type === 'movie' ? 'movie' : 'series';
        const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/${cinemetaType}/${result.imdbId}.json`, { timeout: 4000 });
        if (metaRes.data && metaRes.data.meta) {
          result.title = metaRes.data.meta.name;
          result.englishTitle = metaRes.data.meta.name;
        }
      } catch (e) {
        console.log(`[Metadata] Cinemeta error for ${result.imdbId}:`, e.message);
      }
    } 
    // Case 2: Kitsu ID (kitsu:1234 hoặc kitsu:1234:1)
    else if (id.startsWith('kitsu')) {
      result.kitsuId = parts[1];
      if (parts.length >= 3) {
        result.episode = parseInt(parts[2], 10) || 1;
      }

      try {
        const kitsuRes = await axios.get(`https://kitsu.io/api/edge/anime/${result.kitsuId}`, { timeout: 4000 });
        if (kitsuRes.data && kitsuRes.data.data && kitsuRes.data.data.attributes) {
          const attr = kitsuRes.data.data.attributes;
          result.title = attr.canonicalTitle || attr.titles.en_jp || attr.titles.en;
          result.romajiTitle = attr.titles.en_jp || attr.canonicalTitle;
          result.englishTitle = attr.titles.en || attr.canonicalTitle;
        }
      } catch (e) {
        console.log(`[Metadata] Kitsu error for ${result.kitsuId}:`, e.message);
      }
    }
    // Case 3: MAL ID (mal:1234 hoặc mal:1234:1)
    else if (id.startsWith('mal')) {
      result.malId = parts[1];
      if (parts.length >= 3) {
        result.episode = parseInt(parts[2], 10) || 1;
      }

      try {
        const jikanRes = await axios.get(`https://api.jikan.moe/v4/anime/${result.malId}`, { timeout: 4000 });
        if (jikanRes.data && jikanRes.data.data) {
          const data = jikanRes.data.data;
          result.title = data.title;
          result.romajiTitle = data.title;
          result.englishTitle = data.title_english || data.title;
        }
      } catch (e) {
        console.log(`[Metadata] Jikan error for ${result.malId}:`, e.message);
      }
    }

    // Nếu có tiêu đề tiếng Nhật/Anh, query Kitsu để tìm cross-reference nếu thiếu
    if (result.title && !result.romajiTitle) {
      result.romajiTitle = result.title;
    }

    metaCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error(`[Metadata] Resolution error for ${id}:`, err.message);
    return result;
  }
}

module.exports = {
  resolveMetadata
};
