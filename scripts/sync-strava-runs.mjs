import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const apiUrl = 'https://www.strava.com/api/v3';
const outputPath = resolve('movement/data/runs.json');
const tokenPath = resolve('movement/data/.strava-refresh-token.enc');
const configuredTrim = Number(process.env.STRAVA_ROUTE_TRIM_METERS);
const trimMeters = Number.isFinite(configuredTrim) && configuredTrim >= 0 ? configuredTrim : 300;
const includePrivate = process.env.STRAVA_INCLUDE_PRIVATE === 'true';
const activityType = new Map([['Run', 'run'], ['TrailRun', 'run'], ['VirtualRun', 'run'], ['Ride', 'ride'], ['VirtualRide', 'ride'], ['EBikeRide', 'ride'], ['Walk', 'walk']]);
const excludedActivityIds = new Set(['3334516591']);

for (const key of ['STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET', 'STRAVA_TOKEN_STORE_KEY']) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const tokenKey = Buffer.from(process.env.STRAVA_TOKEN_STORE_KEY, 'base64');
if (tokenKey.length !== 32) throw new Error('STRAVA_TOKEN_STORE_KEY must be a base64-encoded 32-byte key');

async function loadRefreshToken() {
  try {
    const payload = JSON.parse(await readFile(tokenPath, 'utf8'));
    const decipher = createDecipheriv('aes-256-gcm', tokenKey, Buffer.from(payload.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]).toString('utf8');
  } catch (error) {
    if (error.code === 'ENOENT' && process.env.STRAVA_REFRESH_TOKEN) return process.env.STRAVA_REFRESH_TOKEN;
    throw error;
  }
}

async function saveRefreshToken(refreshToken) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', tokenKey, iv);
  const data = Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()]);
  await writeFile(tokenPath, `${JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') })}\n`);
}

async function refreshAccessToken() {
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: await loadRefreshToken() }),
  });
  if (!response.ok) throw new Error(`Could not refresh Strava token: ${await response.text()}`);
  return response.json();
}

async function listActivities(accessToken) {
  const activities = [];
  for (let page = 1; ; page += 1) {
    const response = await fetch(`${apiUrl}/athlete/activities?per_page=200&page=${page}`, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`Could not fetch activities: ${await response.text()}`);
    const batch = await response.json();
    activities.push(...batch);
    if (batch.length < 200) return activities;
  }
}

function decodePolyline(encoded = '') {
  const coordinates = []; let index = 0; let lat = 0; let lng = 0;
  while (index < encoded.length) {
    let shift = 0; let result = 0; let byte;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([lat / 1e5, lng / 1e5]);
  }
  return coordinates;
}

function distanceMeters([lat1, lng1], [lat2, lng2]) {
  const rad = Math.PI / 180; const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lng2 - lng1) * rad / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function trimRoute(points, meters) {
  if (!meters || points.length < 3) return points;
  let start = 0; let distance = 0;
  while (start < points.length - 1 && distance < meters) distance += distanceMeters(points[start], points[++start]);
  let end = points.length - 1; distance = 0;
  while (end > start && distance < meters) distance += distanceMeters(points[end], points[--end]);
  return end - start > 1 ? points.slice(start, end + 1) : [];
}

function locationFor(activity) {
  return [activity.location_city, activity.location_country].filter(Boolean).join(', ') || 'Other';
}

await mkdir(resolve('movement/data'), { recursive: true });
const token = await refreshAccessToken();
await saveRefreshToken(token.refresh_token);
const activities = await listActivities(token.access_token);
const trackedActivities = activities
  .filter((activity) => activityType.has(activity.type))
  .filter((activity) => includePrivate || activity.visibility === 'everyone')
  .map((activity) => {
    const coordinates = trimRoute(decodePolyline(activity.map?.summary_polyline), trimMeters);
    const averageHeartRate = typeof activity.average_heartrate === 'number' ? activity.average_heartrate : Number.NaN;
    const type = activityType.get(activity.type);
    return { id: String(activity.id), activityType: type, name: activity.name || type[0].toUpperCase() + type.slice(1), date: activity.start_date_local.slice(0, 10), startTime: activity.start_date_local.slice(11, 16), location: locationFor(activity), distanceMeters: Math.round(activity.distance), durationSeconds: Math.round(activity.moving_time), paceSecondsPerKm: activity.distance ? Math.round(activity.moving_time / (activity.distance / 1000)) : 0, averageHeartRate: Number.isFinite(averageHeartRate) ? Math.round(averageHeartRate) : null, coordinates };
  })
  .filter((activity) => !excludedActivityIds.has(activity.id))
  .sort((a, b) => b.date.localeCompare(a.date));

const runs = trackedActivities.filter((activity) => activity.activityType === 'run');
const data = { updatedAt: new Date().toISOString(), runs, activities: trackedActivities };
await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
await writeFile(resolve('movement/data/runs-data.js'), `window.RUNS_DATA = ${JSON.stringify(data)};\n`);
console.log(`Wrote ${runs.length} runs and ${trackedActivities.length - runs.length} rides/walks to ${outputPath}`);
