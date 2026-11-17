const { spawn } = require('node:child_process')
const path = require('node:path')
const express = require('express')

const app = express()
const port = Number(process.env.PORT || 3000)
const modelApiPort = Number(process.env.MODEL_API_PORT || 5001)
const pythonCommand = process.env.PYTHON || 'python3'
const pythonApiUrl = `http://127.0.0.1:${modelApiPort}`
const backend = spawn(pythonCommand, [path.join(__dirname, 'backend', 'server.py')], {
  cwd: __dirname,
  env: { ...process.env, MODEL_API_PORT: String(modelApiPort) },
  stdio: ['ignore', 'inherit', 'inherit'],
})

let server
let shuttingDown = false
let backendError

backend.on('error', (error) => {
  backendError = error
})

backend.on('exit', (code, signal) => {
  if (!shuttingDown) {
    console.error(`Python model service exited unexpectedly (code ${code}, signal ${signal}).`)
    server?.close()
    process.exitCode = 1
  }
})

app.use(express.json({ limit: '16kb' }))
app.use('/api', async (req, res, next) => {
  try {
    const response = await fetch(`${pythonApiUrl}${req.originalUrl}`, {
      method: req.method,
      headers: { 'content-type': 'application/json' },
      body: req.method === 'GET' ? undefined : JSON.stringify(req.body),
    })
    res.status(response.status).type('application/json').send(await response.text())
  } catch (error) {
    next(error)
  }
})
app.use(express.static(path.join(__dirname, 'public')))

app.use((error, req, res, next) => {
  console.error(error)
  if (res.headersSent) return next(error)
  const status = error.status === 400 ? 400 : 502
  res.status(status).json({
    error: status === 400 ? 'The request body must be valid JSON.' : 'The Python model service is unavailable.',
  })
})

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function waitForBackend() {
  const deadline = Date.now() + 60000
  let lastError

  while (Date.now() < deadline) {
    if (backendError) throw backendError
    if (backend.exitCode !== null) {
      throw new Error(`Python model service exited with code ${backend.exitCode}.`)
    }

    try {
      const response = await fetch(`${pythonApiUrl}/api/health`)
      if (response.ok) return
      lastError = new Error(`Python model service returned HTTP ${response.status}.`)
    } catch (error) {
      lastError = error
    }
    await wait(100)
  }

  throw new Error(`Python model service did not become ready: ${lastError?.message || 'startup timed out'}`)
}

function stop(signal) {
  if (shuttingDown) return
  shuttingDown = true
  backend.kill('SIGTERM')
  server?.close()
  backend.once('exit', () => {
    if (signal === 'SIGUSR2') {
      process.kill(process.pid, signal)
    } else {
      process.exit(0)
    }
  })
  setTimeout(() => {
    if (backend.exitCode === null) backend.kill('SIGKILL')
  }, 3000).unref()
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGUSR2']) {
  process.on(signal, () => stop(signal))
}

waitForBackend()
  .then(() => {
    server = app.listen(port, () => {
      console.log(`Gold Price Prediction is available at http://localhost:${port}`)
    })
  })
  .catch((error) => {
    console.error(`Unable to start the application: ${error.message}`)
    shuttingDown = true
    backend.kill('SIGTERM')
    process.exitCode = 1
  })
