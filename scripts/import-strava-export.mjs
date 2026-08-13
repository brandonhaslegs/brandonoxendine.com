import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import FitParser from 'fit-file-parser';

const exec = promisify(execFile);
const archive = process.argv[2];
if (!archive) throw new Error('Usage: node scripts/import-strava-export.mjs /path/to/strava-export.zip');
const excludedActivityIds = new Set(['3334516591']);

function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) { const char = text[i]; if (char === '"') { if (quoted && text[i + 1] === '"') { field += char; i += 1; } else quoted = !quoted; } else if (char === ',' && !quoted) { row.push(field); field = ''; } else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[i + 1] === '\n') i += 1; row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = ''; } else field += char; }
  if (field || row.length) { row.push(field); rows.push(row); } return rows;
}
function values(row, headers, name) { return headers.reduce((all, header, index) => header === name ? [...all, row[index]] : all, []); }
function number(value) { if (typeof value !== 'string' || !value.trim()) return null; const result = Number(value); return Number.isFinite(result) ? result : null; }
function berlinDateTime(value) { const match = value.match(/([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)/i); const month = match ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(match[1]) : -1; if (!match || month < 0) return { date: null, startTime: null }; let hour = Number(match[4]); if (match[7].toUpperCase() === 'PM' && hour !== 12) hour += 12; if (match[7].toUpperCase() === 'AM' && hour === 12) hour = 0; const utc = new Date(Date.UTC(Number(match[3]), month, Number(match[2]), hour, Number(match[5]), Number(match[6]))); const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(utc).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])); return { date: `${parts.year}-${parts.month}-${parts.day}`, startTime: `${parts.hour}:${parts.minute}` }; }
function distanceMeters(a, b) { const rad = Math.PI / 180; const h = Math.sin((b[0] - a[0]) * rad / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin((b[1] - a[1]) * rad / 2) ** 2; return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); }
function trimRoute(points, meters = 300) { let start = 0; let distance = 0; while (start < points.length - 1 && distance < meters) distance += distanceMeters(points[start], points[++start]); let end = points.length - 1; distance = 0; while (end > start && distance < meters) distance += distanceMeters(points[end], points[--end]); const trimmed = points.slice(start, end + 1); const interval = Math.max(1, Math.ceil(trimmed.length / 500)); return trimmed.length > 1 ? trimmed.filter((_, index) => index === 0 || index === trimmed.length - 1 || index % interval === 0) : []; }
function pointsFromGpx(xml) { return [...xml.matchAll(/<trkpt\s+[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"/g)].map(([, lat, lng]) => [Number(lat), Number(lng)]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)); }
function fitValue(buffer, offset, size, type, littleEndian) {
  const unsigned = [0x02, 0x84, 0x86, 0x0a, 0x8b, 0x8c].includes(type); const signed = [0x01, 0x83, 0x85].includes(type);
  if (size === 1) return signed ? buffer.readInt8(offset) : buffer.readUInt8(offset);
  if (size === 2) return unsigned ? (littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset)) : (littleEndian ? buffer.readInt16LE(offset) : buffer.readInt16BE(offset));
  if (size === 4) return unsigned ? (littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset)) : (littleEndian ? buffer.readInt32LE(offset) : buffer.readInt32BE(offset));
  return null;
}
async function pointsFromFit(gzipBuffer) {
  const data = await new FitParser({ mode: 'list' }).parseAsync(gunzipSync(gzipBuffer));
  return (data.records || []).filter((record) => Number.isFinite(record.position_lat) && Number.isFinite(record.position_long)).map((record) => [record.position_lat, record.position_long]);
}

const { stdout } = await exec('unzip', ['-p', archive, 'activities.csv'], { maxBuffer: 10 * 1024 * 1024 });
const [headers, ...rows] = parseCsv(stdout);
const activities = [];
function activityType(value = '') { if (/run/i.test(value)) return 'run'; if (/ride|bike/i.test(value)) return 'ride'; if (/walk/i.test(value)) return 'walk'; return null; }
for (const row of rows.filter((entry) => activityType(values(entry, headers, 'Activity Type')[0]))) {
  const filename = values(row, headers, 'Filename')[0] || ''; const distance = number(values(row, headers, 'Distance')[1]) ?? (number(values(row, headers, 'Distance')[0]) || 0) * 1000; const duration = number(values(row, headers, 'Moving Time')[0]) ?? number(values(row, headers, 'Elapsed Time')[1]) ?? 0; let coordinates = [];
  try {
    if (filename.endsWith('.gpx')) { const result = await exec('unzip', ['-p', archive, filename], { maxBuffer: 20 * 1024 * 1024 }); coordinates = trimRoute(pointsFromGpx(result.stdout)); }
    if (filename.endsWith('.fit.gz')) { const result = await exec('unzip', ['-p', archive, filename], { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 }); coordinates = trimRoute(await pointsFromFit(result.stdout)); }
  } catch { /* Keep the analytical activity if its route cannot be read. */ }
  const activityDate = berlinDateTime(values(row, headers, 'Activity Date')[0] || '');
  const type = activityType(values(row, headers, 'Activity Type')[0]);
  activities.push({ id: values(row, headers, 'Activity ID')[0], activityType: type, name: values(row, headers, 'Activity Name')[0] || type[0].toUpperCase() + type.slice(1), date: activityDate.date, startTime: activityDate.startTime, location: 'All locations', distanceMeters: Math.round(distance), durationSeconds: Math.round(duration), paceSecondsPerKm: distance ? Math.round(duration / (distance / 1000)) : null, averageHeartRate: number(values(row, headers, 'Average Heart Rate')[0]), coordinates });
}
const validActivities = activities.filter((activity) => !excludedActivityIds.has(activity.id) && activity.date && activity.distanceMeters > 0 && activity.durationSeconds > 0).sort((a, b) => b.date.localeCompare(a.date));
const validRuns = validActivities.filter((activity) => activity.activityType === 'run');
const data = { updatedAt: new Date().toISOString(), importedFrom: 'Strava export', runs: validRuns, activities: validActivities };
await writeFile(resolve('movement/data/movement.json'), `${JSON.stringify(data, null, 2)}\n`);
await writeFile(resolve('movement/data/movement-data.js'), `window.MOVEMENT_DATA = ${JSON.stringify(data)};\n`);
console.log(`Imported ${validRuns.length} runs and ${validActivities.length - validRuns.length} rides/walks.`);
