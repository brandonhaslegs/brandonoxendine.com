#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = process.cwd();
const SWARM_DIR = path.join(ROOT, "Swarm Checkin Data");
const PLACES_FILE = path.join(ROOT, "places-data.js");
const OUTPUT_FILE = path.join(ROOT, "swarm-place-stats.js");

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizePlaceName(name) {
  return normalizeText(String(name || "").replace(/^\d+\.\s*/, ""));
}

function compactName(name) {
  return normalizePlaceName(name).replace(/[^a-z0-9]/g, "");
}

function placeNameParts(name) {
  return String(name || "")
    .split(/\||\/|&| - /g)
    .map((p) => normalizePlaceName(p))
    .filter(Boolean);
}

const GENERIC_TOKENS = new Set([
  "bar",
  "cafe",
  "club",
  "hotel",
  "restaurant",
  "shop",
  "store",
  "market",
  "venue",
  "house",
  "mitte",
  "neukolln",
  "the",
]);

function significantTokens(normName) {
  return new Set(
    String(normName || "")
      .split(" ")
      .map((t) => t.trim())
      .filter((t) => t && t.length >= 4 && !GENERIC_TOKENS.has(t)),
  );
}

function acronymTokens(normName) {
  return new Set(
    String(normName || "")
      .split(" ")
      .map((t) => t.trim())
      .filter((t) => t && t.length === 3 && !GENERIC_TOKENS.has(t)),
  );
}

function placeKey(city, name, lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const latPart = Number.isFinite(latNum) ? latNum.toFixed(5) : "";
  const lngPart = Number.isFinite(lngNum) ? lngNum.toFixed(5) : "";
  return `${normalizeText(city)}|${normalizePlaceName(name)}|${latPart},${lngPart}`;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function tokenOverlapScore(aNorm, bNorm) {
  if (!aNorm || !bNorm) return 0;
  if (aNorm === bNorm) return 4;
  const aTokens = new Set(aNorm.split(" ").filter(Boolean));
  const bTokens = new Set(bNorm.split(" ").filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  for (const t of aTokens) {
    if (bTokens.has(t)) overlap += 1;
  }
  const ratio = overlap / Math.max(aTokens.size, bTokens.size);
  if (ratio >= 0.8) return 2;
  if (ratio >= 0.6) return 1.5;
  if (ratio >= 0.45) return 1;
  return 0;
}

function loadPlaces() {
  const code = fs.readFileSync(PLACES_FILE, "utf8");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: "places-data.js" });
  const places = context.window?.PLACES_DATA?.places;
  if (!Array.isArray(places)) {
    throw new Error("Could not load places array from places-data.js");
  }
  return places;
}

function loadSwarmItems() {
  const files = fs
    .readdirSync(SWARM_DIR)
    .filter((f) => /^checkins\d+\.json$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const all = [];
  for (const file of files) {
    const fullPath = path.join(SWARM_DIR, file);
    const raw = fs.readFileSync(fullPath, "utf8").trim();
    if (!raw) continue;
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(items)) continue;
    all.push(...items);
  }
  return all;
}

function buildVenueStats(items) {
  const byVenue = new Map();
  for (const item of items) {
    const venue = item?.venue;
    if (!venue) continue;
    const id = String(venue.id || "").trim();
    if (!id) continue;
    const name = String(venue.name || "").trim();
    const createdAt = String(item.createdAt || "").trim();
    const lat = Number(item.lat);
    const lng = Number(item.lng);
    let agg = byVenue.get(id);
    if (!agg) {
      agg = {
        id,
        name,
        normName: normalizePlaceName(name),
        compactName: compactName(name),
        count: 0,
        firstVisit: null,
        lastVisit: null,
        latSum: 0,
        lngSum: 0,
        coordCount: 0,
      };
      byVenue.set(id, agg);
    }
    agg.count += 1;
    if (createdAt) {
      if (!agg.firstVisit || createdAt < agg.firstVisit) agg.firstVisit = createdAt;
      if (!agg.lastVisit || createdAt > agg.lastVisit) agg.lastVisit = createdAt;
    }
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      agg.latSum += lat;
      agg.lngSum += lng;
      agg.coordCount += 1;
    }
  }
  const venues = [];
  for (const agg of byVenue.values()) {
    if (!agg.coordCount) continue;
    venues.push({
      ...agg,
      lat: agg.latSum / agg.coordCount,
      lng: agg.lngSum / agg.coordCount,
    });
  }
  return venues;
}

function chooseBestVenue(place, venues, byNormName) {
  const placeLat = Number(place.lat);
  const placeLng = Number(place.lng);
  if (!Number.isFinite(placeLat) || !Number.isFinite(placeLng)) return null;

  const placeNormName = normalizePlaceName(place.name);
  const placeCompact = compactName(place.name);
  const placeSig = significantTokens(placeNormName);
  const placeAcronyms = acronymTokens(placeNormName);
  const cityTokens = normalizeText(place.city).split(" ").filter(Boolean);
  for (const t of cityTokens) placeSig.delete(t);
  for (const t of cityTokens) placeAcronyms.delete(t);
  const isGenericPlaceName = placeSig.size === 0 && placeAcronyms.size === 0;
  const partSet = new Set(placeNameParts(place.name));
  const candidates = [];

  for (const venue of venues) {
    const venueCompact = venue.compactName;
    const exactCompact = venueCompact && placeCompact && venueCompact === placeCompact;
    const venueSig = significantTokens(venue.normName);
    const venueAcronyms = acronymTokens(venue.normName);
    const sigOverlap = [...venueSig].filter((t) => placeSig.has(t)).length;
    const acronymOverlap = [...venueAcronyms].filter((t) => placeAcronyms.has(t)).length;
    const overlapScore = tokenOverlapScore(placeNormName, venue.normName);
    const fuzzyName = overlapScore >= (isGenericPlaceName ? 4 : 2);
    const exactPartName = partSet.has(venue.normName);
    if (exactCompact || fuzzyName || sigOverlap > 0 || acronymOverlap > 0 || exactPartName) {
      candidates.push(venue);
    }
  }

  if (!candidates.length) return null;

  let best = null;
  let bestScore = -Infinity;
  let bestNameScore = 0;
  let bestAcronymOverlap = 0;
  let bestDist = Infinity;
  const accepted = [];
  const seen = new Set();
  for (const venue of candidates) {
    if (seen.has(venue.id)) continue;
    seen.add(venue.id);
    const dist = haversineMeters(placeLat, placeLng, venue.lat, venue.lng);
    const nameScore = tokenOverlapScore(placeNormName, venue.normName);
    const venueSig = significantTokens(venue.normName);
    const venueAcronyms = acronymTokens(venue.normName);
    const sigOverlap = [...venueSig].filter((t) => placeSig.has(t)).length;
    const acronymOverlap = [...venueAcronyms].filter((t) => placeAcronyms.has(t)).length;
    const exactPartName = partSet.has(venue.normName);
    const exactCompact =
      venue.compactName && placeCompact && venue.compactName === placeCompact;
    const acceptable =
      exactCompact ||
      exactPartName ||
      nameScore >= 4 ||
      (!isGenericPlaceName && acronymOverlap > 0 && dist <= 2500) ||
      (!isGenericPlaceName && sigOverlap > 0 && dist <= 2500) ||
      (!isGenericPlaceName && nameScore >= 2.5 && dist <= 2500) ||
      (!isGenericPlaceName && nameScore >= 2 && dist <= 1200) ||
      false;
    if (!acceptable) continue;
    accepted.push({ venue, dist, nameScore, exactCompact, sigOverlap, acronymOverlap });
    const score =
      (exactCompact ? 2000 : 0) + nameScore * 1000 - dist + Math.log(venue.count + 1) * 20;
    if (score > bestScore) {
      bestScore = score;
      best = venue;
      bestNameScore = nameScore;
      bestAcronymOverlap = acronymOverlap;
      bestDist = dist;
    }
  }
  if (!best) return null;
  if (bestNameScore < 2 && bestAcronymOverlap === 0 && bestDist > 1200) return null;
  const toAggregate = accepted.filter(
    ({ venue, dist, nameScore, exactCompact, sigOverlap, acronymOverlap }) => {
    const exactPartName = partSet.has(venue.normName);
    if (exactCompact) return true;
    if (exactPartName) return true;
    if (acronymOverlap > 0 && dist <= 800) return true;
    if (sigOverlap > 0 && dist <= 500) return true;
    if (nameScore >= 2.5 && dist <= 220) return true;
    return false;
    },
  );
  let chosen = toAggregate.length ? toAggregate : accepted.filter((x) => x.venue.id === best.id);
  if (chosen.length > 1) {
    const allExactCompact = chosen.every((x) => x.exactCompact);
    if (!allExactCompact) {
      const sortedByCount = [...chosen].sort((a, b) => b.venue.count - a.venue.count);
      const top = sortedByCount[0];
      const second = sortedByCount[1];
      if (top && second && top.venue.count >= second.venue.count * 3) {
        chosen = [top];
      }
    }
  }
  let count = 0;
  let firstVisit = null;
  let lastVisit = null;
  for (const { venue } of chosen) {
    count += venue.count;
    if (!firstVisit || (venue.firstVisit && venue.firstVisit < firstVisit)) {
      firstVisit = venue.firstVisit;
    }
    if (!lastVisit || (venue.lastVisit && venue.lastVisit > lastVisit)) {
      lastVisit = venue.lastVisit;
    }
  }
  return { count, firstVisit, lastVisit };
}

function main() {
  const places = loadPlaces();
  const checkins = loadSwarmItems();
  const venues = buildVenueStats(checkins);
  const byNormName = new Map();
  for (const venue of venues) {
    const key = venue.normName;
    if (!key) continue;
    if (!byNormName.has(key)) byNormName.set(key, []);
    byNormName.get(key).push(venue);
  }

  const out = {};
  let matched = 0;
  for (const place of places) {
    const best = chooseBestVenue(place, venues, byNormName);
    if (!best || !best.firstVisit) continue;
    const key = placeKey(place.city, place.name, place.lat, place.lng);
    out[key] = {
      count: best.count,
      firstVisit: best.firstVisit.slice(0, 10),
      lastVisit: best.lastVisit ? best.lastVisit.slice(0, 10) : best.firstVisit.slice(0, 10),
    };
    matched += 1;
  }

  const payload = `window.SWARM_PLACE_STATS = ${JSON.stringify(out, null, 2)};\n`;
  fs.writeFileSync(OUTPUT_FILE, payload, "utf8");

  console.log(`Checkins parsed: ${checkins.length}`);
  console.log(`Venue aggregates: ${venues.length}`);
  console.log(`Places matched: ${matched} / ${places.length}`);
  console.log(`Wrote ${path.basename(OUTPUT_FILE)}`);
}

main();
