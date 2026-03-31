import { spawn } from 'child_process'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { fileURLToPath } from 'url'
import axios from 'axios'
import path from 'path'
import fs from 'fs'
import os from 'os'

const JACKETT_HOST = 'http://127.0.0.1:9117'
const RELEASES_URL = 'https://api.github.com/repos/Jackett/Jackett/releases/latest'
const BIN_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bin')

const ASSET_MAP = {
    'darwin-arm64': 'Jackett.Binaries.macOSARM64.tar.gz',
    'darwin-x64':   'Jackett.Binaries.macOS.tar.gz',
    'linux-x64':    'Jackett.Binaries.LinuxAMDx64.tar.gz',
    'linux-arm64':  'Jackett.Binaries.LinuxARM64.tar.gz',
    'win32-x64':    'Jackett.Binaries.Windows.zip',
}

const BINARY_NAME = process.platform === 'win32' ? 'JackettConsole.exe' : 'JackettConsole'

function getPlatformKey() {
    return `${process.platform}-${os.arch()}`
}

function getBinaryPath() {
    return path.join(BIN_DIR, BINARY_NAME)
}

async function downloadJackett() {
    const key = getPlatformKey()
    const assetName = ASSET_MAP[key]
    if (!assetName) throw new Error(`Unsupported platform: ${key}`)

    console.log('Fetching latest Jackett release...')
    const { data: release } = await axios.get(RELEASES_URL, { headers: { 'User-Agent': 'stremio-jackett-addon' } })
    const asset = release.assets.find(a => a.name === assetName)
    if (!asset) throw new Error(`No Jackett asset found for ${key}`)

    console.log(`Downloading ${asset.name} (${(asset.size / 1024 / 1024).toFixed(1)} MB)...`)
    const dest = path.join(BIN_DIR, asset.name)
    await fs.promises.mkdir(BIN_DIR, { recursive: true })

    const { data: stream } = await axios.get(asset.browser_download_url, { responseType: 'stream' })
    await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(dest)
        stream.pipe(writer)
        writer.on('finish', resolve)
        writer.on('error', reject)
    })

    console.log('Extracting...')
    await extract(dest, BIN_DIR)
    await fs.promises.rm(dest)
    await fs.promises.chmod(getBinaryPath(), 0o755)
    console.log('Jackett ready.')
}

async function extract(filePath, destDir) {
    const { execa } = await import('execa').catch(() => null) // optional, falls back to child_process
    if (filePath.endsWith('.tar.gz')) {
        await new Promise((resolve, reject) => {
            const proc = spawn('tar', ['-xzf', filePath, '-C', destDir, '--strip-components=1'], { stdio: 'inherit' })
            proc.on('close', code => code === 0 ? resolve() : reject(new Error(`tar exited ${code}`)))
        })
    } else if (filePath.endsWith('.zip')) {
        const AdmZip = (await import('adm-zip')).default
        const zip = new AdmZip(filePath)
        zip.extractAllTo(destDir, true)
    }
}

function spawnJackett() {
    const bin = getBinaryPath()
    if (!fs.existsSync(bin)) throw new Error('Jackett binary not found. Run ensureJackett() first.')
    console.log('Starting Jackett...')
    const proc = spawn(bin, ['--NoUpdates', '--NoRestart'], { stdio: 'ignore', detached: false })
    proc.on('error', err => console.error('Jackett process error:', err.message))
    proc.on('exit', code => console.log(`Jackett exited with code ${code}`))
    process.on('exit', () => proc.kill())
    return proc
}

// Call before runAddon() — downloads Jackett if missing, then spawns it
async function ensureJackett() {
    if (!fs.existsSync(getBinaryPath())) await downloadJackett()
    return spawnJackett()
}

// Mount on your express app: app.use('/jackett', jackettProxy())
function jackettProxy() {
    return createProxyMiddleware({
        target: JACKETT_HOST,
        changeOrigin: true,
        pathRewrite: { '^/jackett': '' }
    })
}

export { ensureJackett, jackettProxy }
