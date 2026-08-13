(() => {
  const $ = (selector) => document.querySelector(selector);
  const map = L.map('map', { scrollWheelZoom: true, attributionControl: false }).setView([52.52, 13.405], 12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20, subdomains: 'abcd' }).addTo(map);
  const routes = L.layerGroup().addTo(map);
  let allRuns = [];
  let allActivities = [];
  let renderedRoutes = [];
  let activeId = null;
  let selectedMonth = null;
  let chartRange = 'all';
  let historySort = 'date-desc';
  map.on('click', () => { if (activeId !== null) { activeId = null; render(); } });

  const formatDistance = (meters) => `${(meters / 1000).toFixed(1)} km`;
  const formatTime = (seconds) => { const hours = Math.floor(seconds / 3600); const minutes = Math.round((seconds % 3600) / 60); return hours ? `${hours}h ${minutes}m` : `${minutes}m`; };
  const formatPace = (secondsPerKm) => Number.isFinite(secondsPerKm) && secondsPerKm > 0 ? `${Math.floor(secondsPerKm / 60)}:${String(Math.round(secondsPerKm % 60)).padStart(2, '0')} /km` : '—';
  const formatDate = (date) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
  const formatStartTime = (time) => { if (!/^\d{2}:\d{2}$/.test(time || '')) return ''; const [hour, minute] = time.split(':').map(Number); return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, hour, minute)); };
  const formatShortDate = (date) => new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' }).format(new Date(`${date}-01T12:00:00`));
  const sum = (items, field) => items.reduce((total, item) => total + (Number(item[field]) || 0), 0);

  function filterForRange(items) {
    if (chartRange === 'all') return items;
    if (/^\d{4}$/.test(chartRange)) return items.filter((run) => run.date.startsWith(chartRange));
    const months = chartRange === 'last-12-months' ? 12 : 24; const latest = allRuns.map((run) => run.date).sort().at(-1); if (!latest) return items;
    const start = new Date(`${latest}T12:00:00`); start.setMonth(start.getMonth() - months + 1); return items.filter((run) => new Date(`${run.date}T12:00:00`) >= start);
  }
  const filteredRuns = () => filterForRange(allRuns);
  function historyRuns(runs) { return selectedMonth ? runs.filter((run) => run.date.startsWith(selectedMonth)) : runs; }
  function sortedRuns(runs) {
    const sort = historySort;
    return [...runs].sort((a, b) => {
      if (sort === 'date-asc') return a.date.localeCompare(b.date);
      if (sort === 'date-desc') return b.date.localeCompare(a.date);
      if (sort === 'pace-asc') return (a.paceSecondsPerKm || Infinity) - (b.paceSecondsPerKm || Infinity);
      if (sort === 'pace-desc') return (b.paceSecondsPerKm || -Infinity) - (a.paceSecondsPerKm || -Infinity);
      if (sort === 'distance-asc') return a.distanceMeters - b.distanceMeters;
      return b.distanceMeters - a.distanceMeters;
    });
  }

  function setStats(runs) {
    const distance = sum(runs, 'distanceMeters'); const duration = sum(runs, 'durationSeconds');
    const heartRateRuns = runs.filter((run) => Number.isFinite(run.averageHeartRate));
    $('#stat-runs').textContent = runs.length;
    $('#stat-distance').textContent = formatDistance(distance);
    $('#stat-time').textContent = formatTime(duration);
    $('#stat-pace').textContent = distance ? formatPace(duration / (distance / 1000)) : '—';
    $('#stat-heart-rate').textContent = heartRateRuns.length ? `${Math.round(heartRateRuns.reduce((total, run) => total + run.averageHeartRate * run.durationSeconds, 0) / sum(heartRateRuns, 'durationSeconds'))} bpm` : '—';
    $('#stat-average-distance').textContent = runs.length ? formatDistance(distance / runs.length) : '—';
    $('#stat-longest').textContent = runs.length ? formatDistance(Math.max(...runs.map((run) => run.distanceMeters))) : '—';
    $('#stat-average-time').textContent = runs.length ? formatTime(duration / runs.length) : '—';
    $('#stat-fastest-pace').textContent = runs.length ? formatPace(Math.min(...runs.map((run) => run.paceSecondsPerKm).filter((pace) => Number.isFinite(pace) && pace > 0))) : '—';
  }

  function monthlyTotals(runs) {
    const grouped = new Map();
    runs.forEach((run) => { const key = run.date.slice(0, 7); const group = grouped.get(key) || { date: key, distanceMeters: 0, count: 0 }; group.distanceMeters += run.distanceMeters; group.count += 1; grouped.set(key, group); });
    const filled = []; const keys = [...grouped.keys()].sort(); if (!keys.length) return filled; const isYear = /^\d{4}$/.test(chartRange); let cursor = new Date(`${isYear ? `${chartRange}-01` : keys[0]}-01T12:00:00`); const end = new Date(`${isYear ? `${chartRange}-12` : keys.at(-1)}-01T12:00:00`);
    while (cursor <= end) { const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`; filled.push(grouped.get(date) || { date, distanceMeters: 0, count: 0 }); cursor.setMonth(cursor.getMonth() + 1); }
    return filled;
  }

  function monthAxis(start, end, x, height, pad) {
    const months = []; const cursor = new Date(`${start.slice(0, 7)}-01T12:00:00`); const finish = new Date(`${end.slice(0, 7)}-01T12:00:00`);
    while (cursor <= finish) { const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`; const firstOfYear = cursor.getMonth() === 0; months.push(`<line class="chart-month-tick" x1="${x(date)}" x2="${x(date)}" y1="${height - pad.bottom}" y2="${height - pad.bottom + (firstOfYear ? 7 : 4)}" />${firstOfYear ? `<text class="chart-label" text-anchor="middle" x="${x(date)}" y="${height - 5}">${cursor.getFullYear()}</text>` : ''}`); cursor.setMonth(cursor.getMonth() + 1); }
    return months.join('');
  }

  function chartBounds(runs) {
    if (/^\d{4}$/.test(chartRange)) return { start: `${chartRange}-01-01`, end: `${chartRange}-12-01` };
    const dates = runs.map((run) => run.date).sort(); return { start: dates[0], end: dates.at(-1) };
  }

  function rollingTrend(runs, value) {
    return [...runs].sort((a, b) => a.date.localeCompare(b.date)).map((run, index, all) => {
      const end = new Date(`${run.date}T12:00:00`).getTime(); const start = end - 29 * 86400000;
      const windowRuns = all.slice(0, index + 1).filter((item) => new Date(`${item.date}T12:00:00`).getTime() >= start && Number.isFinite(item[value]));
      const weight = value === 'paceSecondsPerKm' ? 'distanceMeters' : 'durationSeconds';
      const divisor = sum(windowRuns, weight);
      return { date: run.date, value: divisor ? windowRuns.reduce((total, item) => total + item[value] * item[weight], 0) / divisor : null };
    }).filter((point) => Number.isFinite(point.value));
  }

  function chartShell(target, emptyText) { const node = $(target); node.innerHTML = ''; if (!emptyText) return node; node.innerHTML = `<p class="chart-empty">${emptyText}</p>`; return null; }
  function bindMonthControls(chart) {
    const card = chart.closest('.chart-card'); card?.querySelectorAll('.chart-tooltip').forEach((item) => item.remove()); const tooltip = document.createElement('div'); tooltip.className = 'chart-tooltip'; card?.appendChild(tooltip); chart.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
    chart.querySelectorAll('[data-month]').forEach((item) => {
      const choose = () => { const nextMonth = item.dataset.month; selectedMonth = selectedMonth === nextMonth ? null : nextMonth; render(); if (selectedMonth) document.querySelector('.runs-history').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      const showTooltip = (event) => { if (!card) return; tooltip.textContent = item.dataset.tooltip || ''; tooltip.classList.add('visible'); const rect = card.getBoundingClientRect(); tooltip.style.left = `${Math.max(8, Math.min(event.clientX - rect.left, rect.width - tooltip.offsetWidth - 8))}px`; tooltip.style.top = `${Math.max(8, event.clientY - rect.top - tooltip.offsetHeight - 12)}px`; };
      item.addEventListener('click', choose); item.addEventListener('mouseenter', showTooltip); item.addEventListener('mousemove', showTooltip); item.addEventListener('mouseleave', () => tooltip.classList.remove('visible')); item.addEventListener('focus', (event) => showTooltip({ clientX: event.target.getBoundingClientRect().left, clientY: event.target.getBoundingClientRect().top })); item.addEventListener('blur', () => tooltip.classList.remove('visible')); item.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } });
    });
  }
  function lineChart(target, points, formatter, bounds) {
    if (points.length < 2) return chartShell(target, 'Not enough data yet.');
    const node = chartShell(target); const width = 360; const height = 170; const pad = { top: 14, right: 8, bottom: 26, left: 40 }; const firstDate = new Date(`${bounds.start}T12:00:00`); const lastDate = new Date(`${bounds.end}T12:00:00`); const dateSpan = Math.max(1, lastDate - firstDate);
    const values = points.map((point) => point.value); const min = Math.min(...values); const max = Math.max(...values); const spread = max - min || Math.max(1, max * .05); const low = min - spread * .12; const high = max + spread * .12;
    const x = (date) => pad.left + ((new Date(`${date.length === 7 ? `${date}-01` : date}T12:00:00`) - firstDate) / dateSpan) * (width - pad.left - pad.right); const y = (value) => pad.top + ((high - value) / (high - low)) * (height - pad.top - pad.bottom);
    const labels = [low, (low + high) / 2, high]; const path = points.map((point, index) => `${index ? 'L' : 'M'}${x(point.date).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');
    node.innerHTML = `<svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Training trend from ${formatter(points[0].value)} to ${formatter(points.at(-1).value)}">${labels.map((value) => `<line class="chart-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${y(value)}" y2="${y(value)}" /><text class="chart-label" x="0" y="${y(value) + 3}">${formatter(value)}</text>`).join('')}<path class="chart-line" d="${path}" />${points.map((point) => `<circle class="chart-dot chart-interactive${point.date.startsWith(selectedMonth || 'never') ? ' chart-selected' : ''}" data-month="${point.date.slice(0, 7)}" data-tooltip="${formatDate(point.date)} · ${formatter(point.value)}" cx="${x(point.date)}" cy="${y(point.value)}" r="3.5" tabindex="0" role="button"></circle>`).join('')}${monthAxis(bounds.start, bounds.end, x, height, pad)}</svg>`; bindMonthControls(node);
  }
  function barChart(target, points, field, formatter) {
    if (!points.length) return chartShell(target, 'Not enough data yet.');
    const node = chartShell(target); const width = 360; const height = 170; const pad = { top: 14, right: 8, bottom: 26, left: 36 }; const max = Math.max(...points.map((point) => point[field]), 1);
    const usableWidth = width - pad.left - pad.right; const step = usableWidth / points.length; const barWidth = Math.max(2, step - 2); const x = (date) => pad.left + points.findIndex((point) => point.date === date) * step + step / 2;
    node.innerHTML = `<svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly activity chart"><line class="chart-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${height - pad.bottom}" y2="${height - pad.bottom}" /><text class="chart-label" x="0" y="${pad.top + 4}">${formatter(max)}</text>${points.map((point) => { const barHeight = (point[field] / max) * (height - pad.top - pad.bottom); const barX = x(point.date) - barWidth / 2; const y = height - pad.bottom - barHeight; return `<rect class="chart-bar chart-interactive${point.date === selectedMonth ? ' chart-selected' : ''}" data-month="${point.date}" data-tooltip="${formatShortDate(point.date)} · ${formatter(point[field])}" x="${barX}" y="${y}" width="${barWidth}" height="${barHeight}" rx="1" tabindex="0" role="button"></rect>`; }).join('')}${monthAxis(points[0].date, points.at(-1).date, x, height, pad)}</svg>`; bindMonthControls(node);
  }

  function renderCharts(runs) {
    const bounds = chartBounds(runs); lineChart('#pace-chart', rollingTrend(runs, 'paceSecondsPerKm'), formatPace, bounds);
    lineChart('#heart-rate-chart', rollingTrend(runs.filter((run) => Number.isFinite(run.averageHeartRate)), 'averageHeartRate'), (value) => `${Math.round(value)} bpm`, bounds);
    const months = monthlyTotals(runs); barChart('#distance-chart', months, 'distanceMeters', formatDistance); barChart('#frequency-chart', months, 'count', (value) => `${value} runs`);
  }

  function selectRun(id, zoom = true) { const deselect = activeId === id; activeId = deselect ? null : id; render(); const run = allActivities.find((item) => item.id === id); if (!deselect) requestAnimationFrame(() => document.querySelector(`[data-run-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })); if (!deselect && run && zoom && Array.isArray(run.coordinates) && run.coordinates.length > 1) map.fitBounds(L.latLngBounds(run.coordinates), { padding: [40, 40], maxZoom: 15 }); }
  function highlightRoute(id = null) { renderedRoutes.forEach((item) => item.line.setStyle({ weight: id ? item.id === id ? item.selected ? 5 : 4 : 2.5 : item.selected ? 5 : 2.5, opacity: id ? item.id === id ? 1 : .05 : item.selected ? 1 : .22 })); }
  function highlightHistoryRoute(id) { highlightRoute(); const item = renderedRoutes.find((route) => route.id === id); if (item) item.line.setStyle({ weight: item.selected ? 5 : 4, opacity: 1 }); }
  function renderRoutes(visible) {
    routes.clearLayers();
    renderedRoutes = [];
    const routeColors = { run: '#ff69b4', ride: '#4da3ff', walk: '#ffd84d' }; const selectedColors = { run: '#fff', ride: '#fff', walk: '#fff' };
    visible.forEach((run) => {
      if (!Array.isArray(run.coordinates) || run.coordinates.length < 2) return;
      const selected = run.id === activeId; const type = run.activityType || 'run'; const line = L.polyline(run.coordinates, { color: selected ? selectedColors[type] : routeColors[type], weight: selected ? 5 : 2.5, opacity: selected ? 1 : .22, lineCap: 'round', lineJoin: 'round', tolerance: 12 });
      const heartRate = Number.isFinite(run.averageHeartRate) ? `<br>${Math.round(run.averageHeartRate)} bpm average heart rate` : '';
      line.bindPopup(`<strong>${escapeHtml(run.name)}</strong><br>${formatDate(run.date)} · ${formatDistance(run.distanceMeters)}<br>${formatPace(run.paceSecondsPerKm)}${heartRate}`, { className: 'route-popup' });
      line.on('click', (event) => { L.DomEvent.stopPropagation(event.originalEvent); selectRun(run.id, false); });
      line.on('mouseover', () => highlightRoute(run.id));
      line.on('mouseout', () => highlightRoute());
      line.addTo(routes); renderedRoutes.push({ id: run.id, line, selected });
    });
  }
  function render() {
    const visible = filteredRuns(); const history = historyRuns(filterForRange(allActivities)); renderRoutes(history); setStats(visible); renderCharts(visible); $('#history-filter').hidden = !selectedMonth; $('#history-filter-date').textContent = selectedMonth ? formatShortDate(selectedMonth) : '';
    document.querySelectorAll('.sort-button').forEach((button) => { const active = historySort.startsWith(button.dataset.sortKey); button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); button.textContent = `${button.dataset.sortKey === 'pace' ? 'Speed' : button.dataset.sortKey[0].toUpperCase() + button.dataset.sortKey.slice(1)}${active ? historySort.endsWith('asc') ? ' ↑' : ' ↓' : ''}`; }); const list = $('#runs-list'); list.innerHTML = sortedRuns(history).map((run) => { const hasRoute = Array.isArray(run.coordinates) && run.coordinates.length > 1; const type = run.activityType || 'run'; const typeLabel = !hasRoute && type === 'run' ? 'Treadmill' : type === 'ride' ? 'Ride' : type === 'walk' ? 'Walk' : ''; return `<button class="run-card activity-${type}${run.id === activeId ? ' active' : ''}${hasRoute ? '' : ' no-route'}" data-run-id="${run.id}"${hasRoute ? '' : ' disabled aria-disabled="true"'}><span class="run-card-top"><span>${escapeHtml(run.name)}</span><span>${formatDistance(run.distanceMeters)}</span></span><span class="run-card-meta"><span>${formatDate(run.date)}${formatStartTime(run.startTime) ? ` · ${formatStartTime(run.startTime)}` : ''}</span><span>${formatPace(run.paceSecondsPerKm)}</span>${typeLabel ? `<span class="run-type">${typeLabel}</span>` : ''}</span></button>`; }).join('') || '<p>No activities in this month.</p>';
    list.querySelectorAll('[data-run-id]').forEach((card) => { card.addEventListener('click', () => selectRun(card.dataset.runId)); card.addEventListener('mouseenter', () => highlightHistoryRoute(card.dataset.runId)); card.addEventListener('mouseleave', () => highlightRoute()); });
  }
  function escapeHtml(value) { const el = document.createElement('span'); el.textContent = value; return el.innerHTML; }
  function setupControls() { const range = $('#chart-range'); const sizeRange = () => { const measure = document.createElement('canvas').getContext('2d'); measure.font = getComputedStyle(range).font; range.style.width = `${Math.ceil(measure.measureText(range.selectedOptions[0].textContent).width) + 34}px`; }; [...new Set(allRuns.map((run) => run.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a)).forEach((year) => range.add(new Option(year, year))); sizeRange(); range.addEventListener('change', () => { chartRange = range.value; selectedMonth = null; sizeRange(); render(); }); document.querySelectorAll('.sort-button').forEach((button) => button.addEventListener('click', () => { const key = button.dataset.sortKey; const defaults = { date: 'desc', pace: 'asc', distance: 'desc' }; historySort = historySort.startsWith(key) ? `${key}-${historySort.endsWith('asc') ? 'desc' : 'asc'}` : `${key}-${defaults[key]}`; render(); })); $('#clear-month').addEventListener('click', () => { selectedMonth = null; render(); }); }
  const renderData = (data) => {
    allRuns = Array.isArray(data.runs) ? data.runs : []; allActivities = Array.isArray(data.activities) ? data.activities : allRuns; const updateDate = typeof data.updatedAt === 'string' ? data.updatedAt.slice(0, 10) : null; $('#status-message').textContent = allRuns.length ? `Updated ${updateDate ? formatDate(updateDate) : 'recently'}.` : 'The archive will appear after the first sync.'; setupControls(); render();
  };
  if (window.RUNS_DATA) renderData(window.RUNS_DATA);
  else fetch('./data/runs.json', { cache: 'no-store' }).then((response) => { if (!response.ok) throw new Error('Could not load run data'); return response.json(); }).then(renderData).catch(() => { $('#status-message').textContent = 'The run archive is temporarily unavailable.'; });
})();
