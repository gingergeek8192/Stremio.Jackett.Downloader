import axios from 'axios'
import { states, downloadTimer } from './movieDownloader.js'
import jackettApi from './jackett.js'
import config from './config.js'
import { libraryConfig } from './libraryConfig.js'


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

    return void states.createDownloader({ type: type, imdbId: id, title: title, year: year, results: filtered, config, isCollectionPart: true })
}

export { collections  } 