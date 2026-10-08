const axios = require('axios');

// Cache metadata để tránh request lặp lại
const metaCache = new Map();

// Hàm tìm IMDb ID từ tên phim trên Cinemeta
async function findImdbIdByTitle(title, type = 'series') {
  if (!title) return null;
  const cleanTitle = title.replace(/[^\w\s]/gi, ' ').replace(/\s+/g, ' ').trim();
  const searchTypes = type === 'movie' ? ['movie', 'series'] : ['series', 'movie'];

  for (const st of searchTypes) {
    try {
      const url = `https://v3-cinemeta.strem.io/catalog/${st}/top/search=${encodeURIComponent(cleanTitle)}.json`;
      const res = await axios.get(url, { timeout: 3500 });
      if (res.data && Array.isArray(res.data.metas) && res.data.metas.length > 0) {
        for (const meta of res.data.metas) {
          if (meta.id && meta.id.startsWith('tt')) {
            return { imdbId: meta.id, type: st };
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }
  return null;
}

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
    type: type === 'movie' ? 'movie' : 'series'
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

      try {
        const cinemetaType = type === 'movie' ? 'movie' : 'series';
        const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/${cinemetaType}/${result.imdbId}.json`, { timeout: 4000 });
        if (metaRes.data && metaRes.data.meta) {
          result.title = metaRes.data.meta.name;
          result.englishTitle = metaRes.data.meta.name;
          result.romajiTitle = metaRes.data.meta.name;
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
          if (attr.subtype === 'movie') result.type = 'movie';
        }
      } catch (e) {
        console.log(`[Metadata] Kitsu error for ${result.kitsuId}:`, e.message);
      }

      const searchTitle = result.englishTitle || result.romajiTitle || result.title;
      const imdbMatch = await findImdbIdByTitle(searchTitle, result.type);
      if (imdbMatch) {
        result.imdbId = imdbMatch.imdbId;
        result.type = imdbMatch.type;
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
          if (data.type === 'Movie') result.type = 'movie';
        }
      } catch (e) {
        console.log(`[Metadata] Jikan error for ${result.malId}:`, e.message);
      }

      const searchTitle = result.englishTitle || result.romajiTitle || result.title;
      const imdbMatch = await findImdbIdByTitle(searchTitle, result.type);
      if (imdbMatch) {
        result.imdbId = imdbMatch.imdbId;
        result.type = imdbMatch.type;
      }
    }
    // Case 4: AniList ID (anilist:1234 hoặc anilist:1234:1)
    else if (id.startsWith('anilist')) {
      const anilistId = parts[1];
      if (parts.length >= 3) {
        result.episode = parseInt(parts[2], 10) || 1;
      }
      try {
        const gqlQuery = `
          query ($id: Int) {
            Media (id: $id, type: ANIME) {
              format
              title {
                romaji
                english
                native
              }
            }
          }
        `;
        const aniRes = await axios.post('https://graphql.anilist.co', {
          query: gqlQuery,
          variables: { id: parseInt(anilistId, 10) }
        }, { timeout: 4000 });

        if (aniRes.data && aniRes.data.data && aniRes.data.data.Media) {
          const media = aniRes.data.data.Media;
          const t = media.title;
          result.title = t.romaji || t.english || t.native;
          result.romajiTitle = t.romaji || t.english;
          result.englishTitle = t.english || t.romaji;
          if (media.format === 'MOVIE') result.type = 'movie';
        }
      } catch (e) {
        console.log(`[Metadata] AniList error for ${anilistId}:`, e.message);
      }

      const searchTitle = result.englishTitle || result.romajiTitle || result.title;
      const imdbMatch = await findImdbIdByTitle(searchTitle, result.type);
      if (imdbMatch) {
        result.imdbId = imdbMatch.imdbId;
        result.type = imdbMatch.type;
      }
    }

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
