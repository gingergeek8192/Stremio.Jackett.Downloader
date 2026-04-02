import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const parseTorrent = require('parse-torrent')
const { version } = require('./package.json')
import os from 'os'
import axios from 'axios'
import getPort from 'get-port'
import express from 'express'
import jackettApi from './jackett.js'
import helper from './helpers.js'
import config from './config.js'
import { collections } from './collections.js'


const exprs = {

    server: express(),

    respondStremHeaders(res, data) {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Headers', '*')
        res.setHeader('Content-Type', 'application/json')
        res.send(data)
    },

    async streamFromMagnet(tor, uri, type) {
        const toStream = (parsed) => {
            const infoHash = parsed.infoHash.toLowerCase()
            return {
                name: tor.from,
                type: type,
                infoHash: infoHash,
                sources: (parsed.announce || []).map(x => 'tracker:' + x).concat(['dht:' + infoHash]),
                title: parsed.name += (parsed.name.indexOf('\n') > -1 ? '\r\n' : '\r\n\r\n') + 'Seeds: ' + tor.seeders + ' / Peers: ' + tor.peers
            }
        }
        if (uri.startsWith('magnet:?')) return toStream(parseTorrent(uri))
        const parsed = await parseTorrent.remote(uri).catch(() => null)
        return parsed ? toStream(parsed) : null
    },

    async respondStreams(res, req) {
        const type = req.params.type
        const idParts = req.params.id.split(':')
        const imdbId = idParts[0]
        const results = [];
        const { data: body } = await axios.get(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`)
            .catch(() => ({ data: null }))

        if (!body?.meta?.year) return this.respondStremHeaders(res, { streams: [] })
       // const searchQuery = { name: imdbId, year: body.meta.year, type: type }
            
           for (const title of [body.meta.name, imdbId]) {
            const searchQuery = { name: title, year: body.meta.year, type: type }
            if (idParts.length == 3) { searchQuery.season = idParts[1]; searchQuery.episode = idParts[2] }
            results.push(...(await jackettApi.search(config.jackettApiKey, searchQuery) ?? []))
           }

            /*
        if (!body?.meta?.year) return this.respondStremHeaders(res, { streams: [] })
       // const searchQuery = { name: imdbId, year: body.meta.year, type: type }
            const searchQuery = { name: imdbId, year: body.meta.year, type: type }
        if (idParts.length == 3) { searchQuery.season = idParts[1]; searchQuery.episode = idParts[2] }

        const results = await jackettApi.search(config.jackettApiKey, searchQuery)

        if (!results?.length) return this.respondStremHeaders(res, { streams: [] })
            */

        if (!results?.length) return this.respondStremHeaders(res, { streams: [] })

        let filtered = results
            .filter(el => el.seeders && el.seeders >= (config.minimumSeeds ?? 3))
            .sort((a, b) => b.seeders - a.seeders)
            .slice(0, (Math.max(config.maximumResults || 20, 20)))

        const streams = (await Promise.all(
            filtered
                .filter(task => task?.magneturl || task?.link)
                .map(async task => {
                    const url = await helper.followRedirect(task.magneturl || task.link)
                    return this.streamFromMagnet(task, url, type)
                })
        )).filter(Boolean)

        if (!res.headersSent) this.respondStremHeaders(res, { streams })
        type === 'movie' && (/^[a-f0-9]{32}$|^[a-zA-Z0-9_.-]{100,}$/.test(config.tmdbApiKey)) && setTimeout(() => collections(type, imdbId, body.meta.name, body?.meta?.year, filtered), 2000)
        !(/^[a-f0-9]{32}$|^[a-zA-Z0-9_.-]{100,}$/.test(config.tmdbApiKey)) && config.saveTorrent && console.log("Invalid TMDB Key. Set Correct Key or saveTorrent: false")
    },

    async start() {
        config.addonPort = await getPort({ port: config.addonPort })

        this.server.get('/:jackettKey/manifest.json', (req, res) => {

            return this.respondStremHeaders(res, {
                "id": "local.stremio.downloader",
                "version": '1.0.6',
                "name": "Stremio WTDL",
                "description": "Stremio Add-on download and add to JellyFin library",
                "icon": "https://raw.githubusercontent.com/gingergeek8192/Stremio.Jackett.Downloader/main/icon.png",
                "resources": ["stream"],
                "types": ["movie", "series"],
                "idPrefixes": ["tt"],
                "catalogs": []
            })
        })

        this.server.get('/:jackettKey/stream/:type/:id.json', (req, res) => {
            if (!req.params.id) return this.respondStremHeaders(res, { streams: [] })
            if (config.responseTimeout) setTimeout(() => { if (!res.headersSent) this.respondStremHeaders(res, { streams: [] }) }, config.responseTimeout)
            this.respondStreams(res, req)
                .catch(() => this.respondStremHeaders(res, { streams: [] }))
        })
        this.server.listen(config.addonPort)
        console.log('Local (this machine) Add-on URL: http://127.0.0.1:'+config.addonPort+'/'+config.jackettApiKey+'/manifest.json')
        const localIp = Object.values(os.networkInterfaces()).flat().find(i => i.family === 'IPv4' && !i.internal)?.address ?? 'localhost'
        console.log('Remote (other devices) Add-on URL: http://'+localIp+':'+config.addonPort+'/'+config.jackettApiKey+'/manifest.json')
        console.log(' ')
        console.log('NOTE FOR REMOTE USE:')
        console.log('         macOS: Stremio-App is Unrestricted. Just Works')
        console.log('         Windows: Use Stremio-Web on Chrome Allow Insecure Content for Stremio.')
    },


}

exprs.start()