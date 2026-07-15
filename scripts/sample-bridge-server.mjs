import { createServer } from 'http';
import { createReadStream, existsSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import { createGunzip } from 'zlib';

const PORT = Number(process.env.PORT || 3010);
const TARGET = process.env.SAMPLE_BRIDGE_TARGET || 'http://127.0.0.1:3001';
const SAMPLE_DIR = process.env.ZIWEI_SAMPLE_DIR || '/opt/ziwei-samples-v3';
const SAMPLE_CYCLE_START_YEAR = 1924;
const sampleCache = new Map();

createServer(async (req, res) => {
  try {
    const targetUrl = new URL(req.url || '/', TARGET);
    const body = await readBody(req);
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: proxyHeaders(req.headers),
      body: body.length && req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
    });
    const contentType = upstream.headers.get('content-type') || '';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    if (!contentType.includes('application/json')) {
      writeProxyResponse(res, upstream, buffer);
      return;
    }

    let payload;
    try {
      payload = JSON.parse(buffer.toString('utf8'));
    } catch {
      writeProxyResponse(res, upstream, buffer);
      return;
    }

    const enhanced = await enrichPayload(payload);
    const out = Buffer.from(JSON.stringify(enhanced));
    res.writeHead(upstream.status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(out.length),
    });
    res.end(out);
  } catch (error) {
    const out = Buffer.from(JSON.stringify({
      error: error instanceof Error ? error.message : 'sample bridge failed',
    }));
    res.writeHead(502, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(out.length),
    });
    res.end(out);
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`ziwei sample bridge listening on 127.0.0.1:${PORT}`);
});

async function enrichPayload(payload) {
  if (!payload || typeof payload !== 'object' || !payload.audit) {
    return payload;
  }

  const chart = payload.chart || (
    payload.birthInfo && payload.lunarInfo && Array.isArray(payload.palaces)
      ? payload
      : null
  );
  if (!chart) return payload;

  const sampleData = await inspectSampleData(chart);
  payload.audit.sampleData = sampleData;
  payload.audit.steps = updateSampleStep(payload.audit.steps, sampleData);
  payload.audit.warnings = updateWarnings(payload.audit.warnings, sampleData);
  if ('sampleData' in payload) payload.sampleData = sampleData;
  return payload;
}

function updateSampleStep(steps, sampleData) {
  const status = sampleData.status === 'candidate-found'
    ? 'pass'
    : sampleData.status === 'candidate-mismatch'
      ? 'fail'
      : 'warn';
  const sampleStep = {
    name: '样本数据参照',
    status,
    details: sampleData,
  };

  if (!Array.isArray(steps)) return [sampleStep];
  const index = steps.findIndex(step => step && step.name === '样本数据参照');
  if (index === -1) return [...steps, sampleStep];
  const next = steps.slice();
  next[index] = sampleStep;
  return next;
}

function updateWarnings(warnings, sampleData) {
  const next = Array.isArray(warnings)
    ? warnings.filter(item => typeof item !== 'string' || !item.includes('样本'))
    : [];
  if (sampleData.status !== 'candidate-found') next.push(sampleData.note);
  return next;
}

async function inspectSampleData(chart) {
  const sampleRoot = resolveSampleRoot(SAMPLE_DIR);
  const sampleYear = cycleSampleYear(chart.lunarInfo?.lunarYear);
  const candidateFiles = sampleMonthFiles(
    sampleRoot || path.join(SAMPLE_DIR, 'samples-out'),
    sampleYear,
    chart.birthInfo?.month
  );
  const sampleKey = buildSampleKey(chart);

  if (!sampleRoot) {
    return {
      configured: false,
      status: 'not-installed',
      root: SAMPLE_DIR,
      sampleYear,
      sampleKey,
      candidateFiles,
      note: '51.8 万样本数据未安装到本地；服务仍按源码算法、四化规则、格局规则和古籍原文复核。可设置 ZIWEI_SAMPLE_DIR 指向 Releases v3.0-samples 解压目录。',
    };
  }

  const existingFiles = candidateFiles.filter(file => existsSync(file));
  if (existingFiles.length === 0) {
    return {
      configured: true,
      status: safeHasAnyFile(sampleRoot) ? 'candidate-missing' : 'directory-found',
      root: SAMPLE_DIR,
      sampleRoot,
      sampleYear,
      sampleKey,
      candidateFiles,
      note: `已检测到样本库，但缺少 ${sampleYear} 年周期样本文件，无法复核当前命盘样本。`,
    };
  }

  const sample = await findSample(sampleRoot, sampleYear, sampleKey, existingFiles);
  if (!sample) {
    return {
      configured: true,
      status: 'candidate-missing',
      root: SAMPLE_DIR,
      sampleRoot,
      sampleYear,
      sampleKey,
      candidateFiles,
      note: `已读取 ${sampleYear} 年周期样本文件，但未命中当前命盘样本键：${sampleKey}。`,
    };
  }

  const comparison = compareChartToSample(chart, sample);
  const passed = comparison.mismatches.length === 0;
  return {
    configured: true,
    status: passed ? 'candidate-found' : 'candidate-mismatch',
    root: SAMPLE_DIR,
    sampleRoot,
    sampleFile: sample.sampleFile,
    sampleYear,
    sampleKey,
    candidateFiles,
    comparison: {
      passed,
      checkedFields: comparison.checkedFields,
      mismatches: comparison.mismatches,
      topicKeys: sample.topics,
    },
    note: passed
      ? `已命中 51.8 万样本库：${sample.sampleFile}，样本键 ${sampleKey}，命盘结构复核一致。`
      : `已命中 51.8 万样本库：${sample.sampleFile}，但发现 ${comparison.mismatches.length} 项结构差异，需复核算法或样本版本。`,
  };
}

function resolveSampleRoot(root) {
  const candidates = [
    root,
    path.join(root, 'samples-out'),
    path.join(root, 'ziwei-samples-toolkit', 'samples-out'),
  ];
  return candidates.find(candidate =>
    existsSync(candidate) &&
    statSync(candidate).isDirectory() &&
    looksLikeSampleRoot(candidate)
  );
}

function looksLikeSampleRoot(root) {
  try {
    return readdirSync(root).some(name => /^year-\d{4}$/.test(name));
  } catch {
    return false;
  }
}

function cycleSampleYear(lunarYear) {
  const year = Number(lunarYear);
  if (!Number.isFinite(year)) return SAMPLE_CYCLE_START_YEAR;
  const offset = ((year - SAMPLE_CYCLE_START_YEAR) % 60 + 60) % 60;
  return SAMPLE_CYCLE_START_YEAR + offset;
}

function sampleMonthFiles(sampleRoot, sampleYear, preferredMonth) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const preferred = Number(preferredMonth);
  const ordered = Number.isInteger(preferred) && preferred >= 1 && preferred <= 12
    ? [preferred, ...months.filter(month => month !== preferred)]
    : months;
  return ordered.map(value => {
    const month = String(value).padStart(2, '0');
    return path.join(sampleRoot, `year-${sampleYear}`, `${sampleYear}-${month}.jsonl.gz`);
  });
}

function buildSampleKey(chart) {
  const lunar = chart.lunarInfo || {};
  return [
    lunar.yearStem,
    lunar.yearBranch,
    lunar.lunarMonth,
    lunar.lunarDay,
    lunar.isLeapMonth ? 1 : 0,
    chart.birthInfo?.hour,
    chart.birthInfo?.gender,
  ].join('|');
}

async function findSample(sampleRoot, sampleYear, sampleKey, files) {
  const cacheKey = `${sampleRoot}::${sampleYear}::${sampleKey}`;
  if (sampleCache.has(cacheKey)) return sampleCache.get(cacheKey);

  for (const file of files) {
    const sample = await findSampleInFile(file, sampleKey);
    if (sample) {
      sampleCache.set(cacheKey, sample);
      trimCache();
      return sample;
    }
  }
  return null;
}

async function findSampleInFile(file, sampleKey) {
  const input = createReadStream(file);
  const gunzip = createGunzip();
  const lines = createInterface({ input: input.pipe(gunzip), crlfDelay: Infinity });

  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      try {
        const raw = JSON.parse(line);
        if (buildSampleKey(raw.chart) !== sampleKey) continue;
        lines.close();
        input.destroy();
        gunzip.destroy();
        return {
          birthInfo: raw.birthInfo,
          chart: raw.chart,
          topics: raw.topics ? Object.keys(raw.topics) : [],
          sampleFile: file,
        };
      } catch {
        continue;
      }
    }
  } finally {
    input.destroy();
    gunzip.destroy();
  }
  return null;
}

function trimCache() {
  while (sampleCache.size > 500) {
    sampleCache.delete(sampleCache.keys().next().value);
  }
}

function compareChartToSample(chart, sample) {
  const checkedFields = [];
  const mismatches = [];
  const check = (field, actual, expected) => {
    checkedFields.push(field);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      mismatches.push(`${field}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    }
  };

  check('lunarInfo.yearStem', chart.lunarInfo?.yearStem, sample.chart.lunarInfo?.yearStem);
  check('lunarInfo.yearBranch', chart.lunarInfo?.yearBranch, sample.chart.lunarInfo?.yearBranch);
  check('lunarInfo.lunarMonth', chart.lunarInfo?.lunarMonth, sample.chart.lunarInfo?.lunarMonth);
  check('lunarInfo.lunarDay', chart.lunarInfo?.lunarDay, sample.chart.lunarInfo?.lunarDay);
  check('lunarInfo.isLeapMonth', chart.lunarInfo?.isLeapMonth, sample.chart.lunarInfo?.isLeapMonth);
  check('mingGongBranch', chart.mingGongBranch, sample.chart.mingGongBranch);
  check('shenGongBranch', chart.shenGongBranch, sample.chart.shenGongBranch);
  check('wuxingJu', chart.wuxingJu, sample.chart.wuxingJu);
  check('wuxingJuName', chart.wuxingJuName, sample.chart.wuxingJuName);
  check('ziweiPos', chart.ziweiPos, sample.chart.ziweiPos);
  check('palaces', summarizePalaces(chart.palaces || []), summarizePalaces(sample.chart.palaces || []));
  check('daXians', summarizeDaXians(chart.daXians || []), summarizeDaXians(sample.chart.daXians || []));

  return { checkedFields, mismatches };
}

function summarizePalaces(palaces) {
  return palaces.map(palace => ({
    branch: palace.branch,
    stem: palace.stem,
    name: palace.name,
    stars: (palace.stars || []).map(star => ({
      name: star.name,
      type: star.type,
      brightness: star.brightness ?? '',
      siHua: star.siHua ?? '',
    })),
    daXianAge: palace.daXianAge ?? null,
    isMingGong: Boolean(palace.isMingGong),
    isShenGong: Boolean(palace.isShenGong),
  }));
}

function summarizeDaXians(daXians) {
  return daXians.map(daXian => ({
    startAge: daXian.startAge,
    endAge: daXian.endAge,
    palaceBranch: daXian.palaceBranch,
    palaceName: daXian.palaceName,
    stemIndex: daXian.stemIndex ?? null,
    stemName: daXian.stemName ?? '',
  }));
}

function safeHasAnyFile(root) {
  try {
    return readdirSync(root).length > 0;
  } catch {
    return false;
  }
}

function proxyHeaders(headers) {
  const next = { ...headers };
  delete next.host;
  delete next['content-length'];
  delete next['accept-encoding'];
  return next;
}

function writeProxyResponse(res, upstream, buffer) {
  const headers = {};
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'content-length') headers[key] = value;
  });
  headers['content-length'] = String(buffer.length);
  res.writeHead(upstream.status, headers);
  res.end(buffer);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
