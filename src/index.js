const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { resolveMetadata } = require('./metadata');
const { getAnimeSubSubtitles } = require('./providers/animesub');
const { getAnimeToshoSubtitles } = require('./providers/animetosho');
const { getOpenSubtitles } = require('./providers/opensubtitles');
const { getOrTranslateSubtitle } = require('./translator');

const app = express();
const PORT = process.env.PORT || 7000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const MANIFEST = {
  id: 'community.animesub.vietnam.auto',
  version: '1.0.0',
  name: 'Anime Vietsub Auto (All-in-One)',
  description: 'Addon tự động cung cấp phụ đề Tiếng Việt cho 100% phim Anime và Series trên Stremio. Tích hợp nguồn AnimeSub+, AnimeTosho, OpenSubtitles và bộ Auto-Translate thông minh.',
  logo: 'https://i.imgur.com/8Qe2BkW.png',
  background: 'https://i.imgur.com/vHkWq1a.jpeg',
  resources: [
    {
      name: 'subtitles',
      types: ['anime', 'series', 'movie'],
      idPrefixes: ['tt', 'kitsu', 'mal', 'anilist']
    }
  ],
  types: ['anime', 'series', 'movie'],
  idPrefixes: ['tt', 'kitsu', 'mal', 'anilist'],
  catalogs: [],
  behaviorHints: {
    configurable: true,
    configurationRequired: false
  }
};

// 1. Manifest Endpoint
app.get('/manifest.json', (req, res) => {
  res.json(MANIFEST);
});

app.get('/:config/manifest.json', (req, res) => {
  res.json(MANIFEST);
});

// 2. Subtitles Endpoint
app.get('/subtitles/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  const host = req.get('host');
  const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}`;

  try {
    console.log(`[Subtitles Request] Type: ${type}, ID: ${id}`);
    
    // Resolve metadata (title, season, episode, cross-ids)
    const meta = await resolveMetadata(type, id);

    // Chạy song song tìm kiếm từ các nguồn
    const [animeSubResults, animeToshoResults, openSubResults] = await Promise.allSettled([
      getAnimeSubSubtitles(type, id),
      getAnimeToshoSubtitles(meta),
      getOpenSubtitles(meta)
    ]);

    const finalSubtitles = [];

    // 1. Đưa các phụ đề Tiếng Việt có sẵn lên đầu
    if (animeSubResults.status === 'fulfilled') {
      for (const sub of animeSubResults.value) {
        if (sub.lang === 'vie') {
          finalSubtitles.push(sub);
        }
      }
    }

    if (openSubResults.status === 'fulfilled') {
      for (const sub of openSubResults.value) {
        if (sub.lang === 'vie') {
          finalSubtitles.push(sub);
        }
      }
    }

    if (animeToshoResults.status === 'fulfilled') {
      for (const sub of animeToshoResults.value) {
        if (sub.lang === 'vie') {
          finalSubtitles.push(sub);
        }
      }
    }

    // 2. Thêm các bản dịch Tự động (Auto-Translate sang Tiếng Việt từ Engsub)
    // Đảm bảo 100% phim gì cũng có Vietsub
    if (animeToshoResults.status === 'fulfilled') {
      for (const sub of animeToshoResults.value) {
        if (sub.lang !== 'vie') {
          const encodedUrl = Buffer.from(sub.url).toString('base64url');
          finalSubtitles.push({
            id: `auto_vi_${sub.id}`,
            url: `${baseUrl}/sub/translate/${encodedUrl}.srt`,
            lang: 'vie',
            label: `⚡ [Auto Vietsub] ${sub.filename || sub.sourceTitle || 'AnimeTosho'}`
          });
        }
      }
    }

    if (openSubResults.status === 'fulfilled') {
      for (const sub of openSubResults.value) {
        if (sub.lang === 'eng') {
          const encodedUrl = Buffer.from(sub.url).toString('base64url');
          finalSubtitles.push({
            id: `auto_vi_${sub.id}`,
            url: `${baseUrl}/sub/translate/${encodedUrl}.srt`,
            lang: 'vie',
            label: `⚡ [Auto Vietsub] OpenSubtitles (Dịch tự động)`
          });
        }
      }
    }

    // Giới hạn số lượng subtitle trả về tối đa 15 sub tốt nhất
    res.json({
      subtitles: finalSubtitles.slice(0, 15),
      cacheMaxAge: 3600 // Cache 1 tiếng
    });
  } catch (err) {
    console.error(`[Error] Subtitles handler error:`, err.message);
    res.json({ subtitles: [] });
  }
});

// 3. Endpoint Stream phụ đề dịch tự động
app.get('/sub/translate/:encodedUrl.srt', async (req, res) => {
  const { encodedUrl } = req.params;
  try {
    const targetUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8');
    const subId = `sub_${encodedUrl.substring(0, 16)}`;
    
    console.log(`[Translate Sub] Downloading & translating from: ${targetUrl}`);
    const srtContent = await getOrTranslateSubtitle(targetUrl, subId);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="sub_vietsub.srt"');
    res.send(srtContent);
  } catch (err) {
    console.error(`[Translate Sub Error]:`, err.message);
    res.status(500).send('Error generating translated subtitle');
  }
});

// 4. Trang Configure giao diện Web Trắng-Xanh hiện đại
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/configure', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Stremio Vietsub Addon running at http://localhost:${PORT}`);
    console.log(`📌 Manifest URL: http://localhost:${PORT}/manifest.json`);
  });
}

module.exports = app;
