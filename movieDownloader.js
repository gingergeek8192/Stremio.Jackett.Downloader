
import WebTorrent from 'webtorrent'
import helper from './helpers.js'
import fs from 'fs'
import os from 'os'
import { LibraryManager } from './libraryManager.js'
import { libraryConfig } from './libraryConfig.js'

let downloadTimer = null

let states = {
    _next_movie: false,
    enqueued: [],
    currentCandidates: [],
    path: libraryConfig._filePath(os.homedir(), 'Downloads'),
    waiting: () => states.enqueued.length > 0,
    idle: () => !states.currentCandidates.length && !client.torrents.length,
    enqueue: (data) => states.enqueued.push(data),
    dequeue: () => states.enqueued.shift(),

    createDownloader({ type, imdbId, title, year, results, config, isCollectionPart } = data) {
        downloadTimer = setTimeout(() => {
            if (states.idle()) 
                void new MoviesDownloader({ type: type, imdbId: imdbId, title: title, year: year, results: results, config: config, isCollectionPart: isCollectionPart })
                .handleResults()
                .catch(err => console.error('MoviesDownloader error:', err.message))
            else  states.enqueue({ type: type, imdbId: imdbId, title: title, year: year, results: results, config: config, isCollectionPart: isCollectionPart })
        }, config.downloadAfter > 0 ? config.downloadAfter * 60000 : 10000 )

    }
}


const client = new WebTorrent({ maxConns: 55 })
client.on('error', err => console.error('WebTorrent error:', err.message))
process.on('SIGINT', () => client.destroy(() => process.exit()))

class MoviesDownloader {
    constructor(data) {
        Object.assign(this, data)
        this.downloading = false
        this.lastProgress = 0
        this.progress = 0
        this.currentThrottle = -1
    }

    // TODO: Create a progress bar for downloading progress and logging
    report(torrent) {
        if (torrent.downloadSpeed > 0 && torrent.progress < 100)
            console.log(
            `Progress ${torrent.name} | ${this.progress.toFixed(1)}% 
             MB/s ${(torrent.downloadSpeed / 1024 / 1024).toFixed(2)}  
             Peers ${torrent.numPeers}`
            )
    }

    // resets if torrent complete or does not download
    async reset(interval, torrent, done=false) {
        if (interval) clearInterval(interval)
        this.downloading = false
        this.progress = 0
        await client.remove(torrent)
        client.throttleDownload(-1)
        if (done) {
            states.currentCandidates = []
            if (states.idle())
                 await new LibraryManager(
                    { 
                        type: this.type, 
                        savePath: this.config.savePath && fs.existsSync(this.config.savePath) ? this.config.savePath : states.path, 
                        year: this.year, 
                        imdbId: this.imdbId, 
                        config: this.config, 
                        ...libraryConfig 
                    }
                ).manager()
            if (states.idle() && states.waiting()) states._next_movie = true // Edge trigger
        }
    }

    // Mitigate ENOBUFS 
    regulate(doi, goHard) {
        let target = -1
        if (goHard) target = 1024 * 1024
        else if (doi) target = 2097152

        if (this.currentThrottle !== target) client.throttleDownload(target)
        this.currentThrottle = target
    }

    
    async handlePath(remove=false) {
        this.savePath = libraryConfig._filePath(`${this.config.savePath}`, `${this.imdbId}`)
        if (remove) await fs.promises.rm(this.savePath, { recursive: true, force: true })
        else {
            const entries = await fs.promises.readdir((this.config.savePath && fs.existsSync(this.config.savePath)) ? this.config.savePath : states.path)
            if (entries.some(e => e.includes(this.imdbId))) return false
            await fs.promises.mkdir(this.savePath, { recursive: true })
            return true
        }
    }


    // Process metadata 
    async handleResults() {
        if (!this.results || !this.results.length) return

        this.candidateDownloads = this.results
            .filter(el => el.title && el.title.toLowerCase().includes(String(this.config.targetRes)))
            .sort((a, b) => b.seeders - a.seeders)
            .slice(0, this.config.candidates) || [] // user defined slice

        this.initial = this.candidateDownloads.length
        states.currentCandidates = await Promise.all(
            this.candidateDownloads
                .filter(c => c.magneturl || c.link)
                .map(c => helper.followRedirect(c.magneturl || c.link)))

        for (const magnet of states.currentCandidates) {
            if (this.downloading) return // Additionally handle path will block next downloading with imdbId if the last was a success 
            if (await this.handlePath()) await this.tryTorrent(magnet)
            else 
            { 
            states.currentCandidates = []
            break;
            }
        }
    }


    async tryTorrent(magnet) {

        const torrent = client.add(magnet, { path: this.savePath })
        console.log(`Trying ${this.initial - this.config.candidates + 1} of ${this.initial} candidates`)

        const interval = setInterval( async() => {
            if (this.lastProgress === this.progress || !this.downloading) {
                console.log('Timeout - no progress')
                await this.handlePath(true)
                await this.reset(interval, torrent, states.currentCandidates.length == 0)
            } 
            this.lastProgress = this.progress
        }, this.config.waitFor > 10000 ? this.config.waitFor : 10000)

        torrent.on('download', async() => {
            this.progress = (torrent.progress * 100)
            this.downloading = true
            this.report(torrent)
            this.regulate(this.progress >= 90, this.progress > 97)
        })

        torrent.on('done', async () => {
            await this.reset(interval, torrent, true)
            console.log("done")
        })

        torrent.on('error', async () => {
            try {
                await this.handlePath(true) // Remove the failed downloading and allow handlePath to setup for the next
                await this.reset(interval, torrent, states.currentCandidates.length == 0)
            } catch (err) { console.error('Error handling torrent error:', err.message)  } // Stop bubble up
        })
    }

}

// Reactive trigger dequeue
let  _next_movie = false
Object.defineProperty(states, '_next_movie', {
    get() { return _next_movie },
    set(value) {
        // - DO NOT! change this to  _next_movie = value
        if (value && states.waiting() && states.enqueued.length > 0) {
            console.log('Trying next torrent')
            void new MoviesDownloader(states.dequeue()).handleResults()
        }
    }
})
export { MoviesDownloader, downloadTimer, states }