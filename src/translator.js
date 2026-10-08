const axios = require('axios');
const { parseSync, stringifySync } = require('subtitle');

// Cache phụ đề đã dịch trong bộ nhớ
const translationCache = new Map();

// Làm sạch text phụ đề
function cleanSubtitleText(text) {
  if (!text) return '';
  return text
    .replace(/\{[^\}]+\}/g, '') // xóa tag style ASS
    .replace(/\\N/g, '\n')      // chuyển new line của ASS
    .trim();
}

// Dịch một khối văn bản lớn qua Google Translate POST API
async function translateTextBlock(textBlock) {
  if (!textBlock || !textBlock.trim()) return textBlock;

  try {
    const params = new URLSearchParams();
    params.append('client', 'gtx');
    params.append('sl', 'auto');
    params.append('tl', 'vi');
    params.append('dt', 't');
    params.append('q', textBlock);

    const res = await axios.post(
      'https://translate.googleapis.com/translate_a/single',
      params.toString(),
      {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'AndroidTranslate/5.3.0.RC02.130475354-53000263 5.1 phone TRANSLATE_OPM5_TEST_1'
        }
      }
    );

    if (res.data && Array.isArray(res.data[0])) {
      return res.data[0].map(item => item[0]).join('');
    }
  } catch (err) {
    console.log(`[Translator] Error translating text block:`, err.message);
  }

  return textBlock;
}

// Dịch danh sách các câu phụ đề theo batch
async function translateCues(cues) {
  const BATCH_SIZE = 80;

  for (let i = 0; i < cues.length; i += BATCH_SIZE) {
    const batch = cues.slice(i, i + BATCH_SIZE);
    
    // Gắn prefix số thứ tự dạng [[0]] [[1]] để Google không dịch nhầm dấu phân cách
    const rawTexts = batch.map((c, idx) => `[[${idx}]] ${cleanSubtitleText(c.data.text) || '...'}`);
    const combinedText = rawTexts.join('\n');

    const translatedCombined = await translateTextBlock(combinedText);
    
    // Tách theo định dạng [[index]]
    for (let j = 0; j < batch.length; j++) {
      const regex = new RegExp(`\\[\\[${j}\\]\\]\\s*([\\s\\S]*?)(?=\\[\\[\\d+\\]\\]|$)`, 'i');
      const match = translatedCombined.match(regex);
      if (match && match[1]) {
        batch[j].data.text = match[1].trim();
      }
    }
  }
}

// Tải và dịch toàn bộ file phụ đề (hỗ trợ format 'WebVTT' hoặc 'SRT')
async function getOrTranslateSubtitle(sourceUrl, subId, format = 'WebVTT') {
  const cacheKey = `${subId}_${format}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    const res = await axios.get(sourceUrl, {
      timeout: 10000,
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    let rawContent = res.data;
    if (!rawContent || typeof rawContent !== 'string') {
      throw new Error('Empty subtitle content');
    }

    let nodes = [];
    try {
      nodes = parseSync(rawContent);
    } catch (e) {
      const lines = rawContent.split('\n');
      for (const line of lines) {
        if (line.startsWith('Dialogue:')) {
          const parts = line.split(',');
          if (parts.length >= 10) {
            const startStr = parts[1];
            const endStr = parts[2];
            const textStr = cleanSubtitleText(parts.slice(9).join(','));
            
            const toMs = (t) => {
              const [h, m, s] = t.split(':');
              return (parseInt(h)*3600 + parseInt(m)*60 + parseFloat(s)) * 1000;
            };

            nodes.push({
              type: 'cue',
              data: {
                start: toMs(startStr),
                end: toMs(endStr),
                text: textStr
              }
            });
          }
        }
      }
    }

    const cues = nodes.filter(n => n.type === 'cue' && n.data && n.data.text);
    if (cues.length === 0) {
      return rawContent;
    }

    await translateCues(cues);

    const output = stringifySync(nodes, { format: format === 'SRT' ? 'SRT' : 'WebVTT' });
    translationCache.set(cacheKey, output);
    return output;
  } catch (err) {
    console.error(`[Translator] Error translating sub ${subId}:`, err.message);
    throw err;
  }
}

module.exports = {
  getOrTranslateSubtitle
};
