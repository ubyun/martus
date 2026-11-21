// 사진 폴더(photos/1 ~ photos/7)를 읽어 웹용 사진·썸네일과 photos.json을 만듭니다.
// 사용법: node tools/build-photos.mjs [출력폴더, 기본값 _site]
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'photos');
const OUT = path.join(ROOT, process.argv[2] || '_site');
const IMG = /\.(jpe?g|png|webp|tiff?|avif|gif)$/i;
const FULL = 2200, THUMB = 720;

const HEAD = {
  '파일': 'file', '파일명': 'file', '파일 이름': 'file', file: 'file', filename: 'file',
  '제목': 'title', title: 'title',
  '작가': 'by', '사진': 'by', '찍은 사람': 'by', by: 'by', photographer: 'by',
  '촬영 시기': 'when', '시기': 'when', '날짜': 'when', when: 'when', date: 'when',
  '장소': 'place', '행사': 'place', place: 'place',
  '설명': 'text', text: 'text', caption: 'text',
  '말씀': 'verse', verse: 'verse',
  '말씀 출처': 'ref', '출처': 'ref', ref: 'ref',
  '순서': 'order', order: 'order'
};

function decode(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
  catch { return new TextDecoder('euc-kr').decode(buf); } // 엑셀 기본 저장(CP949)도 읽기
}

function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell); if (row.some(v => v.trim() !== '')) rows.push(row);
  return rows;
}

async function readCaptions(dir) {
  let buf;
  try { buf = await fs.readFile(path.join(dir, 'captions.csv')); } catch { return {}; }
  const rows = parseCSV(decode(buf));
  if (!rows.length) return {};
  const keys = rows[0].map(h => HEAD[h.trim().toLowerCase()] || HEAD[h.trim()] || null);
  const out = {};
  for (const r of rows.slice(1)) {
    const o = {};
    keys.forEach((k, i) => { if (k && r[i] != null) o[k] = r[i].trim(); });
    if (!o.file) continue;
    out[o.file] = o; out[o.file.replace(/\.[^.]+$/, '')] = o;
  }
  return out;
}

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });
  for (const f of ['index.html', 'config.json']) {
    try { await fs.copyFile(path.join(ROOT, f), path.join(OUT, f)); }
    catch { console.warn(`! ${f} 파일이 없어요`); }
  }
  const sections = Array.from({ length: 7 }, () => ({ photos: [] }));
  let dirs = [];
  try { dirs = await fs.readdir(SRC, { withFileTypes: true }); } catch { console.warn('! photos 폴더가 없어요'); }
  let total = 0, skipped = 0;
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const m = d.name.match(/^([1-7])(?:\D|$)/);
    if (!m) continue;
    const si = Number(m[1]) - 1, dir = path.join(SRC, d.name);
    const caps = await readCaptions(dir);
    const files = (await fs.readdir(dir)).filter(f => IMG.test(f)).sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));
    await fs.mkdir(path.join(OUT, 'photos', String(si + 1)), { recursive: true });
    await fs.mkdir(path.join(OUT, 'thumbs', String(si + 1)), { recursive: true });
    for (const f of files) {
      const n = String(sections[si].photos.length + 1).padStart(3, '0');
      const full = `photos/${si + 1}/${n}.jpg`, thumb = `thumbs/${si + 1}/${n}.jpg`;
      try {
        const info = await sharp(path.join(dir, f)).rotate().resize({ width: FULL, height: FULL, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(OUT, full));
        await sharp(path.join(dir, f)).rotate().resize({ width: THUMB, height: THUMB, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(OUT, thumb));
        const c = caps[f] || caps[f.replace(/\.[^.]+$/, '')] || {};
        sections[si].photos.push({
          src: full, thumb, w: info.width, h: info.height,
          title: clip(c.title, 40) || clip(f.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), 40),
          by: clip(c.by, 30), when: clip(c.when, 30), place: clip(c.place, 40),
          text: clip(c.text, 400), verse: clip(c.verse, 200), ref: clip(c.ref, 40),
          order: Number(c.order) || 0
        });
        total++;
      } catch (e) { skipped++; console.warn(`! ${d.name}/${f} 를 읽지 못했어요: ${e.message}`); }
    }
    sections[si].photos.sort((a, b) => (a.order || 1e9) - (b.order || 1e9));
  }
  await fs.writeFile(path.join(OUT, 'photos.json'), JSON.stringify({ generated: new Date().toISOString(), sections }, null, 1));
  console.log(`사진 ${total}장 정리 완료` + (skipped ? ` (${skipped}장은 건너뜀)` : '') + ' → ' + sections.map((s, i) => `${i + 1}전시실 ${s.photos.length}장`).join(', '));
}

main().catch(e => { console.error(e); process.exit(1); });
