import fs from 'fs/promises'
import f from 'fs'
import path from 'path'
import axios from 'axios'


const libraryConfig = {

    metaStore: [],
    meta: [],
    TMDB_IMAGE: 'https://image.tmdb.org/t/p/original',

    ext: {
        video: [ ".mp4", ".mkv", ".webm", ".avi", ".mov", ".wmv", ".m4v", ".mpg", ".mpeg", ".flv", ".ts", ".m2ts", ".vob", ".ogv", ".asf", ".divx", ".f4v", ".3gp", ".3g2" ],
        subs: [ ".srt", ".ass", ".ssa", ".vtt", ".sub", ".idx", ".pgs", ".sup", ".smi" ],
        audio: [ ".mp3", ".flac", ".m4a", ".aac", ".wav", ".ogg", ".opus", ".wma", ".aiff", ".alac", ".ape", ".dsf", ".dff", ".mka", ".ac3", ".dts" ],
        images: [ ".jpg", ".jpeg", ".png", ".webp", ".tbn", ".gif" ],
        metadata: [ ".nfo", ".xml", ".opf" ],
    },


    nfo: (data) => 
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <movie>
        <title>${data.title}</title>
        <originaltitle>${data.original_title}</originaltitle>
        <sorttitle>${data.title}</sorttitle>
        <year>${data.year}</year>
        <premiered>${data.release_date}</premiered>
        <releasedate>${data.release_date}</releasedate>
        <runtime>${data.runtime}</runtime>
        <tagline>${data.tagline}</tagline>
        <plot>${data.overview}</plot>
        <outline>${data.overview}</outline>
        <rating>${data.vote_average}</rating>
        <votes>${data.vote_count}</votes>
        <tmdbid>${data.id}</tmdbid>
        <id>${data.imdbId}</id>
        <uniqueid type="imdb" default="true">${data.imdbId}</uniqueid>
        <uniqueid type="tmdb">${data.id}</uniqueid>
        <status>${data.status}</status>
        ${data.genres?.map(g => `<genre>${g.name}</genre>`).join('\n    ')}
        ${data.production_countries?.map(c => `<country>${c.name}</country>`).join('\n    ')}
        ${data.spoken_languages?.map(l => `<language>${l.english_name}</language>`).join('\n    ')}
        ${data.production_companies?.map(s => `<studio>${s.name}</studio>`).join('\n    ')}${data.collection ? `
        <set>
            <name>${data.belongs_to_collection.name}</name>
            <uniqueid type="tmdb">${data.belongs_to_collection.id}</uniqueid>
        </set>` : ''}
    </movie>`.trim(),


    storeMeta(data) { 
        this.metaStore.push(data)
    },

    images(type, ext) {
        const arr = ext ? this.meta.images[type].filter(i => i.file_path.endsWith(ext)) : this.meta.images[type]
        return arr?.length ? arr.reduce((a, b) => b.vote_count > a.vote_count ? b : a).file_path : null
    },

    _filePath(dir, f) {
        return path.join(dir, f)
    },

    async _fileExist(file_path) {
        return fs.access(file_path).then(() => true, () => false)
    },

    async write(PATH, filename, content, type) {
        fs.writeFile(this._filePath(PATH, filename), content, type)
    },

    async mkdir(dir) {
        return await fs.mkdir(dir, { recursive: true }).then(() => true, () => false)
    },

    async scan(dir, target) {
        const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true }).catch(() => [])
        return entries
            .filter(e => !e.isDirectory())
            .map(e => path.join(e.parentPath, e.name))
            .filter(f => this.ext[target].includes(path.extname(f).toLowerCase()))
    },


    async cpFile(target, newPath) {
        const newPathNewName = `${newPath}${path.extname(target)}`
        await fs.rename(target, newPathNewName).catch(() => {})
    },

    async rm(PATH) {
        console.log('rm')
        if (await this._fileExist(PATH))
        await fs.rm(PATH, { recursive: true, force: true })
    },

    async getImage(endPoint, PATH) {
        const res = await axios.get(`${this.TMDB_IMAGE}${endPoint}`, { responseType: 'stream' }).catch(() => null)
        res.data.pipe(f.createWriteStream(PATH))
    },

    async biggest(found) {
        const sizes = await Promise.all(found.map(f => fs.stat(f).then(s => ({ f, size: s.size }))))
        return sizes.reduce((a, b) => a.size > b.size ? a : b).f
    }

}

 export { libraryConfig }