import commentJson from 'comment-json'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { states } from './movieDownloader.js'

const defaultConfig = {
    "autoLaunch": false,
    "responseTimeout": 11000,
    "addonPort": 7001,
    "uiPort": 4242,
    "minimumSeeds": 3,
    "maximumResults": 30,
    "remote": true,
    "subdomain": false,
    "saveTorrent": true,
    "savePath": states.path,
    "waitFor": 30000,
    "targetRes": 1080,
    "candidates": 3,
    "downloadAfter": 0.1,
    "tmdbApiKey": '589ff144d41b0b9bc3c349f148a82d1c',
    "jackettApiKey":  'stremio-add-on-downloader',
    "jackett": {
        "host": "http://127.0.0.1:9117/",
        "readTimeout": 10000,
        "openTimeout": 10000
    }
}

const JackettConfig = {

    indexers: `./indexers`,

    ServerSettings: {
        "Port": 9117,
        "LocalBindAddress": "127.0.0.1",
        "AllowExternal": true,
        "AllowCORS": true,
        "APIKey": "stremio-add-on-downloader",
        "AdminPassword": "stremio-add-on-downloader",
        "InstanceId": "gtg5fvcedggd9l2aejhetvpa6wt7p7k8za39xvszpfojrr425hper7fsw6zh42yp",
        "BlackholeDir": "C:\\Downloads",
        "UpdateDisabled": false,
        "UpdatePrerelease": false,
        "BasePathOverride": "",
        "BaseUrlOverride": "",
        "CacheEnabled": true,
        "CacheTtl": 2100,
        "CacheMaxResultsPerIndexer": 1000,
        "FlareSolverrUrl": "",
        "FlareSolverrMaxTimeout": 55000,
        "OmdbApiKey": "",
        "OmdbApiUrl": "",
        "ProxyType": -1,
        "ProxyUrl": "",
        "ProxyPort": null,
        "ProxyUsername": "",
        "ProxyPassword": "",
        "ProxyIsAnonymous": true
    },

    async jackettWriteout() {
        // stub to write out the indexer dir and ServerConfig.json to Jackett  

    }

}


function readConfig() {
    const configFilePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'config.json')
    if (!fs.existsSync(configFilePath))
        fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig, null, 4))

    let parsed
    try { parsed = commentJson.parse(fs.readFileSync(configFilePath).toString()) }
    catch (e) { return defaultConfig }

    const clean = { ...defaultConfig, ...JSON.parse(JSON.stringify(parsed)) }
    if (parsed.jackett) clean.jackett = { ...defaultConfig.jackett, ...JSON.parse(JSON.stringify(parsed.jackett)) }
    fs.writeFileSync(configFilePath, JSON.stringify(clean, null, 4))
    return clean
}


export default readConfig()
