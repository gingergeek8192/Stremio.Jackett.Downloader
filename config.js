import commentJson from 'comment-json'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { states } from './movieDownloader.js'

const defaultConfig = {
    "autoLaunch": false,
    "responseTimeout": 11000,
    "addonPort": 7000,
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
    "tmdbApiKey": '<tmdb-api-key>',
    "jackettApiKey": '<jackett-api-key>',
    "jackett": {
        "host": "http://127.0.0.1:9117/",
        "readTimeout": 10000,
        "openTimeout": 10000
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
