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

// Cấu hình CORS mở hoàn toàn cho Stremio & Nuvio Player (Web, Mobile, Smart TV)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const MANIFEST = {
  id: 'community.animesub.vietnam.auto',
  version: '1.0.2',
  name: 'Anime Vietsub Auto (All-in-One)',
  description: 'Addon tự động cung cấp phụ đề Tiếng Việt cho 100% phim Anime và Series trên Stremio & Nuvio. Tích hợp AnimeSub+, AnimeTosho, OpenSubtitles và Auto-Translate.',
  logo: 'https://i.imgur.com/8Qe2BkW.png',
  background: 'https://i.imgur.com/vHkWq1a.jpeg',
  resources: ['subtitles'],
  types: ['anime', 'series', 'movie', 'other'],
  idPrefixes: ['tt', 'kitsu', 'mal', 'anilist'],
  catalogs: [],
  behaviorHints: {
    configurable: true,
    configurationRequired: false
  }
};

// 1. Manifest Endpoint (Hỗ trợ root, config prefix cho Nuvio và Stremio)
app.get('/manifest.json', (req, res) => {
  res.json(MANIFEST);
});

app.get('/:config/manifest.json', (req, res) => {
  res.json(MANIFEST);
});

// Xử lý logic Subtitle chung
async function handleSubtitlesRequest(req, res) {
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
        if (sub.lang === 'vie' || sub.lang === 'vi') {
          finalSubtitles.push({
            id: sub.id,
            url: sub.url,
            lang: 'vie',
            label: sub.label || '🇻🇳 AnimeSub+ [Tiếng Việt]'
          });
        }
      }
    }

    if (openSubResults.status === 'fulfilled') {
      for (const sub of openSubResults.value) {
        if (sub.lang === 'vie' || sub.lang === 'vi') {
          finalSubtitles.push({
            id: sub.id,
            url: sub.url,
            lang: 'vie',
            label: sub.label || '🇻🇳 OpenSubtitles [Tiếng Việt]'
          });
        }
      }
    }

    if (animeToshoResults.status === 'fulfilled') {
      for (const sub of animeToshoResults.value) {
        if (sub.lang === 'vie' || sub.lang === 'vi') {
          finalSubtitles.push({
            id: sub.id,
            url: sub.url,
            lang: 'vie',
            label: sub.label || `🇻🇳 AnimeTosho [${sub.filename || 'Tiếng Việt'}]`
          });
        }
      }
    }

    // 2. Thêm các bản dịch Tự động (Auto-Translate sang Tiếng Việt từ Engsub)
    // Đảm bảo 100% phim gì cũng có Vietsub
    if (animeToshoResults.status === 'fulfilled') {
      for (const sub of animeToshoResults.value) {
        if (sub.lang !== 'vie' && sub.lang !== 'vi') {
          const encodedUrl = Buffer.from(sub.url).toString('base64url');
          finalSubtitles.push({
            id: `auto_vi_${sub.id}`,
            url: `${baseUrl}/sub/translate/${encodedUrl}.vtt`,
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
            url: `${baseUrl}/sub/translate/${encodedUrl}.vtt`,
            lang: 'vie',
            label: `⚡ [Auto Vietsub] OpenSubtitles (Dịch tự động)`
          });
        }
      }
    }

    // Giới hạn tối đa 20 sub chất lượng nhất
    res.json({
      subtitles: finalSubtitles.slice(0, 20),
      cacheMaxAge: 3600
    });
  } catch (err) {
    console.error(`[Error] Subtitles handler error:`, err.message);
    res.json({ subtitles: [] });
  }
}

// 2. Subtitles Endpoints (Hỗ trợ mọi biến thể route từ Nuvio và Stremio)
app.get('/subtitles/:type/:id.json', handleSubtitlesRequest);
app.get('/subtitles/:type/:id/:extra.json', handleSubtitlesRequest);
app.get('/:config/subtitles/:type/:id.json', handleSubtitlesRequest);
app.get('/:config/subtitles/:type/:id/:extra.json', handleSubtitlesRequest);

// 3. Endpoint Stream phụ đề dịch tự động (.vtt và .srt)
app.get('/sub/translate/:filename', async (req, res) => {
  const { filename } = req.params;
  const isVtt = filename.endsWith('.vtt');
  const encodedUrl = filename.replace(/\.(vtt|srt)$/, '');

  try {
    const targetUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8');
    const subId = `sub_${encodedUrl.substring(0, 16)}`;
    const format = isVtt ? 'WebVTT' : 'SRT';
    
    console.log(`[Translate Sub] Downloading & translating (${format}) from: ${targetUrl}`);
    const content = await getOrTranslateSubtitle(targetUrl, subId, format);

    res.setHeader('Content-Type', isVtt ? 'text/vtt; charset=utf-8' : 'text/plain; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(content);
  } catch (err) {
    console.error(`[Translate Sub Error]:`, err.message);
    res.status(500).send('Error generating translated subtitle');
  }
});

// 4. Trang Configure giao diện Web Trắng-Xanh
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/configure', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Stremio & Nuvio Vietsub Addon running at http://localhost:${PORT}`);
    console.log(`📌 Manifest URL: http://localhost:${PORT}/manifest.json`);
  });
}

module.exports = app;
