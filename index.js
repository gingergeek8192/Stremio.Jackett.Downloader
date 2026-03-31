import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const parseTorrent = require('parse-torrent')
const { version } = require('./package.json')
import os from 'os'
import axios from 'axios'
import getPort from 'get-port'
import { states, downloadTimer } from './movieDownloader.js'
import express from 'express'
import jackettApi from './jackett.js'
import helper from './helpers.js'
import config from './config.js'
import { libraryConfig } from './libraryConfig.js'

const addon = express()

const respond = (res, data) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Content-Type', 'application/json')
    res.send(data)
}

const manifest = {
    "id": "org.stremio.jackett",
    "version": version,
    "name": "Stremio Jackett Addon",
    "description": "Stremio Add-on to get torrent results from Jackett",
    "icon": "https://static1.squarespace.com/static/55c17e7ae4b08ccd27be814e/t/599b81c32994ca8ff6c1cd37/1508813048508/Jackett-logo-2.jpg",
    "resources": ["stream"],
    "types": ["movie", "series"],
    "idPrefixes": ["tt"],
    "catalogs": []
}

addon.get('/:jackettKey/manifest.json', (req, res) => respond(res, manifest))

async function streamFromMagnet(tor, uri, type) {
    const toStream = (parsed) => {
        const infoHash = parsed.infoHash.toLowerCase()
        let title = parsed.name
        title += (title.indexOf('\n') > -1 ? '\r\n' : '\r\n\r\n') + 'Seeds: ' + tor.seeders + ' / Peers: ' + tor.peers
        return {
            name: tor.from,
            type: type,
            infoHash: infoHash,
            sources: (parsed.announce || []).map(x => 'tracker:' + x).concat(['dht:' + infoHash]),
            title: title
        }
    }
    if (uri.startsWith('magnet:?')) return toStream(parseTorrent(uri))
    const parsed = await parseTorrent.remote(uri).catch(() => null)
    return parsed ? toStream(parsed) : null
}


 async function collections(type, id, title, year, filtered) {
    if (downloadTimer) clearTimeout(downloadTimer)
    let capture = {}
    let meta = { imdbId: id, parts: [] };

    const fetch = async(path, id, append = ``) => {
       const res = await axios.get(`https://api.themoviedb.org/3/${path}/${id}?${append}api_key=${config.tmdbApiKey}`)
       return res.data?.status_code ? false : res.data
    } 

    let data = await fetch(`movie`, id, `append_to_response=logos,images&`)
    if (!data) return console.log("Invalid TMDB Response - Is the TMDB Key Valid?")

    meta.title = data.title ?? ``
    meta.id = data.id ?? null
    meta.collection = data.belongs_to_collection?.id ?? false

    capture = { ...data, year: year, imdbId: id, collection: !!meta.collection }

    if (!meta.collection)  libraryConfig.storeMeta(capture)
    else 
    {
        libraryConfig.storeMeta(capture)

        data = await fetch(`collection`, meta.collection)
        const type = data.parts[0].media_type
        
        if (data?.parts.length > 1) { // Because a tmdb 'collection' can be 1!
            for (const part of data.parts.filter(p => p.id !== meta.id)) {
                const response = await fetch(`movie`, part.id, `append_to_response=external_ids,logos,images&`)
                const { external_ids, release_date, ...data } = response
                const year = release_date.slice(0, 4)

                libraryConfig.storeMeta({ ...data, imdbId: external_ids.imdb_id, collection: true })

                states.createDownloader(
                    { 
                        type: `movie`,
                        imdbId: external_ids.imdb_id, 
                        title: response.title,
                        year: year,
                        results: await jackettApi.search(config.jackettApiKey, { name: external_ids.imdb_id, year: year, type: type }), 
                        config, 
                        isCollectionPart: true 
                    }
                )
            }
        }
    }   

    return states.createDownloader({ type: type, imdbId: id, title: title, year: year, results: filtered, config, isCollectionPart: true })
}


async function respondStreams(res, req) {
    const type = req.params.type
    const idParts = req.params.id.split(':')
    const imdbId = idParts[0]

    const { data: body } = await axios.get(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`)
        .catch(() => ({ data: null }))

    if (!body?.meta?.year) return respond(res, { streams: [] })
        
    const searchQuery = { name: imdbId, year: body.meta.year, type: type }
    if (idParts.length == 3) { searchQuery.season = idParts[1]; searchQuery.episode = idParts[2] }

    const results = await jackettApi.search(config.jackettApiKey, searchQuery)
    if (!results?.length) return respond(res, { streams: [] })

    let filtered = results
    .filter(el => el.seeders && el.seeders >= (config.minimumSeeds ?? 3))
    .sort((a, b) => b.seeders - a.seeders)
    .slice(0, (Math.max(config.maximumResults || 20, 20)))

    const streams = []
    
    for (const task of filtered) {
        if (task?.magneturl || task?.link) {
            const url = await helper.followRedirect(task.magneturl || task.link)
            const stream = await streamFromMagnet(task, url, type)
            if (stream) streams.push(stream)
        }
    }

    if (!res.headersSent) respond(res, { streams })
    //MovieDownloader Hooked if TMDB key exists - and correct
    type === 'movie' && (/^[a-f0-9]{32}$|^[a-zA-Z0-9_.-]{100,}$/.test(config.tmdbApiKey)) && setTimeout(() => collections(type, imdbId, body.meta.name, body?.meta?.year, filtered), 2000)
    !(/^[a-f0-9]{32}$|^[a-zA-Z0-9_.-]{100,}$/.test(config.tmdbApiKey)) && config.saveTorrent && console.log("Invalid TMDB Key. Set Correct Key or saveTorrent: false")
}

addon.get('/:jackettKey/stream/:type/:id.json', (req, res) => {
    if (!req.params.id) return respond(res, { streams: [] })
    if (config.responseTimeout) setTimeout(() => { if (!res.headersSent) respond(res, { streams: [] }) }, config.responseTimeout)
    respondStreams(res, req)
        .catch(() => respond(res, { streams: [] }))
})

    
async function runAddon() {
    config.addonPort = await getPort({ port: config.addonPort })
    addon.listen(config.addonPort, () => {
        console.log('Local (this machine) Add-on URL: http://127.0.0.1:'+config.addonPort+'/'+config.jackettApiKey+'/manifest.json')
        const localIp = Object.values(os.networkInterfaces()).flat().find(i => i.family === 'IPv4' && !i.internal)?.address ?? 'localhost'
        console.log('Remote (other devices) Add-on URL: http://'+localIp+':'+config.addonPort+'/'+config.jackettApiKey+'/manifest.json')
        console.log(' ')
        console.log('NOTE FOR REMOTE USE:')
        console.log('         macOS: Stremio-App is Unrestricted. Just Works')
        console.log('         Windows: Use Stremio-Web on Chrome Allow Insecure Content for Stremio.')
    })
}

runAddon()  
