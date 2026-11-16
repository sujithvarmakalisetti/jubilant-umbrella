const pages = document.querySelectorAll('.page')
const pageLinks = document.querySelectorAll('[data-page]')
const modelChoice = document.getElementById('model-choice')
const predictionForm = document.getElementById('prediction-form')
const predictionMessage = document.getElementById('prediction-message')
const predictionResult = document.getElementById('prediction-result')
const artifactWarning = document.getElementById('artifact-warning')
const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
let featureRanges = {}

pageLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault()
    pages.forEach((page) => { page.hidden = page.id !== link.dataset.page })
    if (link.dataset.page === 'analysis-page') loadAnalysis()
  })
})

function money(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function chartSize(elementId) {
  const container = document.getElementById(elementId)
  return { container, width: Math.max(container.clientWidth - 36, 360) }
}

function chartGuides(width, height, bounds, ticks, left = 62, right = 18, top = 14, bottom = 42) {
  const plotHeight = height - top - bottom
  const y = (value) => top + (bounds.maximum - value) / (bounds.maximum - bounds.minimum) * plotHeight
  const guides = ticks.map((tick) => {
    const position = y(tick)
    return `<line x1="${left}" x2="${width - right}" y1="${position}" y2="${position}" stroke="#deded9" stroke-width="1"/><text x="${left - 8}" y="${position + 5}" text-anchor="end" fill="#777a74" font-size="13">$${tick}</text>`
  }).join('')
  return { guides, y, baseline: y(bounds.minimum), plotWidth: width - left - right, plotHeight }
}

function smoothPath(points) {
  if (!points.length) return ''
  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)]
    const start = points[index]
    const end = points[index + 1]
    const next = points[Math.min(points.length - 1, index + 2)]
    const controlOneX = start.x + (end.x - previous.x) / 6
    const controlOneY = start.y + (end.y - previous.y) / 6
    const controlTwoX = end.x - (next.x - start.x) / 6
    const controlTwoY = end.y - (next.y - start.y) / 6
    path += ` C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${end.x} ${end.y}`
  }
  return path
}

function renderAnnualTrend(rows) {
  const { container, width } = chartSize('yearly-chart')
  const height = 385
  const left = 68
  const right = 18
  const top = 14
  const bottom = 45
  const bounds = { minimum: 70, maximum: 180 }
  const { guides, y, baseline, plotWidth } = chartGuides(width, height, bounds, [70, 80, 100, 120, 140, 160, 180], left, right, top, bottom)
  const points = rows.map((row, index) => ({
    x: left + index / Math.max(rows.length - 1, 1) * plotWidth,
    y: y(row.average),
    row,
  }))
  const line = smoothPath(points)
  const first = points[0]
  const last = points[points.length - 1]
  const area = `${line} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`
  const markers = points.map(({ x, y: pointY, row }) =>
    `<circle cx="${x}" cy="${pointY}" r="5" fill="#fff" stroke="#a27b32" stroke-width="2.5"><title>${row.year}: ${money(row.average)}</title></circle><text x="${x}" y="${height - 16}" text-anchor="middle" fill="#696c66" font-size="13">${row.year}</text>`,
  ).join('')

  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img"><text x="20" y="${height / 2}" transform="rotate(-90 20 ${height / 2})" text-anchor="middle" fill="#666a63" font-size="13">Average GLD price (USD)</text>${guides}<path d="${area}" fill="#b68e4c" opacity=".15"/><path d="${line}" fill="none" stroke="#a17a32" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${markers}<text x="${left + plotWidth / 2}" y="${height - 1}" text-anchor="middle" fill="#666a63" font-size="13">Year</text></svg>`
}

function renderMonthlyTrend(rows) {
  const { container, width } = chartSize('monthly-chart')
  const height = 385
  const left = 68
  const right = 18
  const top = 14
  const bottom = 45
  const bounds = { minimum: 70, maximum: 180 }
  const { guides, y, baseline, plotWidth } = chartGuides(width, height, bounds, [70, 80, 100, 120, 140, 160, 180], left, right, top, bottom)
  const points = rows.map((row, index) => ({
    x: left + index / Math.max(rows.length - 1, 1) * plotWidth,
    y: y(row.average),
    row,
  }))
  const line = smoothPath(points)
  const first = points[0]
  const last = points[points.length - 1]
  const area = `${line} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`
  const markers = points.map(({ x, y: pointY, row }) =>
    `<circle cx="${x}" cy="${pointY}" r="2.3" fill="#397f79"><title>${row.period}: ${money(row.average)}</title></circle>`,
  ).join('')
  const yearLabels = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.period.endsWith('-01'))
    .map(({ row, index }) => {
      const x = left + index / Math.max(rows.length - 1, 1) * plotWidth
      return `<text x="${x}" y="${height - 16}" text-anchor="middle" fill="#696c66" font-size="12">Jan ${row.period.slice(0, 4)}</text>`
    }).join('')

  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img"><text x="20" y="${height / 2}" transform="rotate(-90 20 ${height / 2})" text-anchor="middle" fill="#666a63" font-size="13">Average GLD price (USD)</text>${guides}<path d="${area}" fill="#4a8f88" opacity=".13"/><path d="${line}" fill="none" stroke="#397f79" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${markers}${yearLabels}<text x="${left + plotWidth / 2}" y="${height - 1}" text-anchor="middle" fill="#666a63" font-size="13">Month</text></svg>`
}

function renderCalendarMonths(rows) {
  const { container, width } = chartSize('calendar-chart')
  const height = 360
  const left = 62
  const right = 18
  const top = 14
  const bottom = 43
  const bounds = { minimum: 70, maximum: 180 }
  const { guides, y, baseline, plotWidth } = chartGuides(width, height, bounds, [70, 80, 100, 120, 140, 160, 180], left, right, top, bottom)
  const gap = Math.max(5, plotWidth / rows.length * .22)
  const barWidth = (plotWidth - gap * (rows.length - 1)) / rows.length
  const palette = ['#ac792c', '#bd8b3c', '#c4964f', '#d2ad71', '#7fa8a1', '#73a19a', '#63958e', '#4b8881', '#397f79', '#689789', '#829d78', '#99a86e']
  const bars = rows.map((row, index) => {
    const x = left + index * (barWidth + gap)
    const topY = y(row.average)
    const heightValue = baseline - topY
    const label = monthLabels[row.month - 1]
    return `<rect x="${x}" y="${topY}" width="${barWidth}" height="${heightValue}" rx="3" fill="${palette[index]}"><title>${label}: ${money(row.average)}</title></rect><text x="${x + barWidth / 2}" y="${height - 16}" text-anchor="middle" fill="#696c66" font-size="13">${label}</text>`
  }).join('')

  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img">${guides}${bars}<text x="${left + plotWidth / 2}" y="${height - 1}" text-anchor="middle" fill="#666a63" font-size="13">Calendar month</text></svg>`
}

function renderHeatmap(rows) {
  const container = document.getElementById('heatmap-chart')
  const values = rows.map((row) => row.average)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const byCell = new Map(rows.map((row) => [`${row.year}-${row.month}`, row.average]))
  const years = [...new Set(rows.map((row) => row.year))]
  const headings = `<span></span>${monthLabels.map((month) => `<span>${month}</span>`).join('')}`
  const cells = years.map((year) => {
    const months = monthLabels.map((month, index) => {
      const monthNumber = index + 1
      const value = byCell.get(`${year}-${monthNumber}`)
      if (value === undefined) return '<span class="heat-cell" aria-label="No data"></span>'
      const intensity = (value - minimum) / (maximum - minimum || 1)
      const lightness = Math.round(92 - intensity * 42)
      return `<span class="heat-cell" style="background:hsl(18 52% ${lightness}%)" title="${year} ${month}: ${money(value)}">${value.toFixed(1)}</span>`
    }).join('')
    return `<span>${year}</span>${months}`
  }).join('')
  container.innerHTML = `<div class="heatmap">${headings}${cells}</div>`
}

function updateAnalysis(data) {
  const { summary, evaluation } = data
  document.getElementById('stat-records').textContent = Number(summary.records).toLocaleString('en-US')
  document.getElementById('stat-dates').textContent = `Daily records, ${summary.startDate.slice(0, 4)}-${summary.endDate.slice(0, 4)}`
  document.getElementById('stat-mean').textContent = money(summary.mean)
  document.getElementById('stat-range').textContent = `${money(summary.minimum)}–${money(summary.maximum)}`
  document.getElementById('stat-r2').textContent = Number(evaluation.r2).toFixed(2)
  document.getElementById('metric-mse').textContent = Number(evaluation.mse).toFixed(2)
  document.getElementById('metric-r2').textContent = Number(evaluation.r2).toFixed(2)
  document.getElementById('metric-rmse').textContent = `${Number(evaluation.rmse).toFixed(2)} USD`

  const notice = document.getElementById('dataset-notice')
  notice.hidden = data.datasetAvailable
  notice.textContent = data.datasetMessage
  renderAnnualTrend(data.yearlyAverages)
  renderHeatmap(data.heatmap)
  renderMonthlyTrend(data.monthlyTrend)
  renderCalendarMonths(data.calendarMonths)
}

let analysisLoaded = false
async function loadAnalysis() {
  if (analysisLoaded) return
  const notice = document.getElementById('dataset-notice')
  notice.hidden = false
  notice.textContent = 'Loading historical analysis…'
  try {
    const response = await fetch('/api/analysis')
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Unable to load analysis.')
    updateAnalysis(data)
    analysisLoaded = true
  } catch (error) {
    notice.hidden = false
    notice.textContent = error.message
  }
}

async function loadModels() {
  const response = await fetch('/api/health')
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Unable to load prediction models.')
  featureRanges = data.featureRanges || {}

  const modelLabels = {
    model: 'Linear Regression',
    model2: 'Decision Tree Regressor',
  }
  modelChoice.replaceChildren(...data.models.map((model) => {
    const option = document.createElement('option')
    option.value = model.id
    option.textContent = modelLabels[model.id] || model.file
    return option
  }))

  const first = data.models.find((model) => model.file === 'model.sav')
  const second = data.models.find((model) => model.file === 'model2.sav')
  if (first?.type !== 'LinearRegression' || second?.type !== 'DecisionTreeRegressor') {
    artifactWarning.hidden = false
    artifactWarning.textContent = `Expected model.sav to be LinearRegression and model2.sav to be DecisionTreeRegressor. The supplied files contain ${first?.type || 'an unknown type'} and ${second?.type || 'an unknown type'}; predictions use the actual serialized models.`
  }
}

predictionForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  predictionMessage.textContent = ''
  predictionResult.hidden = true
  const button = document.getElementById('predict-button')
  button.disabled = true
  button.textContent = 'Calculating…'

  const features = {
    SPX: Number(document.getElementById('spx').value),
    USO: Number(document.getElementById('uso').value),
    SLV: Number(document.getElementById('slv').value),
    'EUR/USD': Number(document.getElementById('eurusd').value),
  }

  try {
    const response = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: modelChoice.value, features }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Prediction failed.')
    document.getElementById('result-usd').textContent = `$ ${result.goldUsd}`
    document.getElementById('result-inr').textContent = String(result.goldInr)
    document.getElementById('result-model').textContent = `Model: ${result.modelType} · USD to INR rate: ${result.exchangeRate}`
    const outsideRange = Object.entries(features)
      .filter(([feature, value]) => {
        const range = featureRanges[feature]
        return range && (value < range.minimum || value > range.maximum)
      })
      .map(([feature, value]) => `${feature}=${value} (training range ${featureRanges[feature].minimum.toFixed(2)}–${featureRanges[feature].maximum.toFixed(2)})`)
    const resultWarning = document.getElementById('result-warning')
    resultWarning.hidden = outsideRange.length === 0
    resultWarning.textContent = outsideRange.length
      ? `Outside training ranges: ${outsideRange.join('; ')}. ${result.modelType === 'DecisionTreeRegressor' ? 'A decision tree returns a learned leaf estimate, so out-of-range inputs can produce the same result.' : 'The linear model is extrapolating beyond its training data.'}`
      : ''
    predictionResult.hidden = false
  } catch (error) {
    predictionMessage.textContent = error.message
  } finally {
    button.disabled = false
    button.textContent = 'Predict Gold Price'
  }
})

loadModels().catch((error) => {
  predictionMessage.textContent = error.message
  document.getElementById('predict-button').disabled = true
})
