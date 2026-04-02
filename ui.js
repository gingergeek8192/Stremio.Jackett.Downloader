import express from 'express'

const UI = {
    app: express(),
    clients: [],
    history: [],

    queueMessage({ type = 'info', text }) {
        const msg = JSON.stringify({ type, text, time: new Date().toLocaleTimeString() })
        this.history.push(msg)
        this.clients.forEach(c => c.write(`data: ${msg}\n\n`))
    },

    start() {
        this.app.get('/', (req, res) => res.send(this._page()))

        this.app.get('/log', (req, res) => {
            res.setHeader('Content-Type', 'text/event-stream')
            res.setHeader('Cache-Control', 'no-cache')
            res.setHeader('Connection', 'keep-alive')
            this.history.forEach(msg => res.write(`data: ${msg}\n\n`))
            this.clients.push(res)
            req.on('close', () => { this.clients = this.clients.filter(c => c !== res) })
        })

        this.app.listen(4242)
    },

    _page() {
        return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Stremio Jackett Add-On</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0f0f0f; color: #e0e0e0; font-family: 'Segoe UI', sans-serif; height: 100vh; display: flex; flex-direction: column; }
    header { padding: 18px 24px; background: #1a1a2e; border-bottom: 1px solid #2a2a4a; display: flex; align-items: center; gap: 12px; }
    header h1 { font-size: 1.1rem; font-weight: 600; color: #a78bfa; letter-spacing: 0.05em; }
    #status { font-size: 0.75rem; color: #555; }
    #log { flex: 1; overflow-y: auto; padding: 16px 24px; display: flex; flex-direction: column; gap: 6px; }
    .msg { display: flex; gap: 12px; align-items: baseline; font-size: 0.85rem; padding: 6px 10px; border-radius: 6px; background: #1a1a1a; }
    .msg .time { color: #444; font-size: 0.75rem; white-space: nowrap; }
    .msg .text { flex: 1; line-height: 1.5; }
    .msg.info .text { color: #c4b5fd; }
    .msg.success .text { color: #4ade80; }
    .msg.warn .text { color: #facc15; }
    .msg.error .text { color: #f87171; }
    .msg.download .text { color: #38bdf8; }
    footer { padding: 10px 24px; background: #1a1a2e; border-top: 1px solid #2a2a4a; font-size: 0.7rem; color: #333; }
    ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #111; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
</style>
</head>
<body>
<header>
    <h1>⬡ Stremio Jackett Add-On</h1>
    <span id="status">connecting...</span>
</header>
<div id="log"></div>
<footer>SSE live feed · port 4242</footer>
<script>
    const log = document.getElementById('log')
    const status = document.getElementById('status')
    const es = new EventSource('/log')

    es.onopen = () => { status.textContent = 'live'; status.style.color = '#4ade80' }
    es.onerror = () => { status.textContent = 'disconnected'; status.style.color = '#f87171' }

    es.onmessage = e => {
        const { type, text, time } = JSON.parse(e.data)
        const el = document.createElement('div')
        el.className = 'msg ' + type
        el.innerHTML = '<span class="time">' + time + '</span><span class="text">' + text + '</span>'
        log.appendChild(el)
        log.scrollTop = log.scrollHeight
    }
</script>
</body>
</html>`
    }
}



export { UI }
