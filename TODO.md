# TODO


## ~~Library Manager~~ ✅

Implemented in `libraryManager.js` and `libraryConfig.js`:
- Renames and moves completed downloads into Jellyfin-compatible folder structure
- Writes `.nfo` metadata files with full TMDB data
- Downloads poster, backdrop, and logo images from TMDB
- Triggered on `torrent.on('done')` via `movieDownloader.js`
- Skips already-downloaded titles by IMDb ID folder check
- Handles multiple video files by picking the largest


## ~~Collection Download~~ ✅

Implemented in `index.js` (`collections()`):
- Fetches full TMDB collection on movie stream request
- Searches Jackett for each part and enqueues for sequential download
- Skips already-downloaded parts via IMDb ID folder check
- Stores TMDB metadata for each part via `libraryConfig.storeMeta()`


## ~~Auto Download~~ ✅

Implemented in `movieDownloader.js`:
- Timer-based download trigger with `downloadAfter` delay
- Resets if user browses away before timer fires
- Filters by `targetRes`, sorts by seeds, tries up to `candidates` torrents
- Stall detection: moves to next candidate if no progress within `waitFor` ms
- Reactive queue via `states._next_movie` edge trigger in `reactive.js`


## Bundled Jackett (first-run download)

Scaffolded in `jackettManager.js` — not yet wired up:
- Detects platform, downloads correct Jackett binary from GitHub Releases on first run
- Extracts to `./bin/`, spawns as child process
- Proxy route to expose Jackett UI on the addon port at `/jackett`


## Local File Streaming

Serve downloaded files directly to Stremio over LAN.

- Mount `savePath` as a static Express route: `addon.use('/files', express.static(config.savePath))`
- On stream request, scan `savePath` for a Jellyfin-named folder matching `imdbId`, return matching video file as a stream object
- Return alongside Jackett torrent results so Stremio shows local copy first (highest priority)
- Stream object:
  ```javascript
  {
      url: `http://[server-ip]:${config.addonPort}/files/${folder}/${filename}`,
      name: 'Local',
      behaviorHints: { notWebReady: true, filename: filename }
  }
  ```


## Local Transcoding (HLS)

For low-powered clients (FireStick, older Macs) that struggle with raw MKV/HEVC.

- Spawn `ffmpeg` child process on stream request, transcode to HLS on the fly
- Serve HLS playlist (`m3u8`) and segments from a temp directory
- Target H.264 video + AAC audio for maximum client compatibility
- Kill ffmpeg process when Stremio stops requesting segments (idle timeout)
- Config options to add:
  - `transcoding` — enable/disable
  - `transcodingRes` — target resolution e.g. `1080`, `720`, `480`
  - `transcodingBitrate` — target bitrate
- Removes need for `notWebReady` flag — HLS plays natively in Stremio
- Only transcode if source is not already H.264/AAC — pass through if compatible


## Series Support

- Extend `movieDownloader.js` to handle `type === 'series'`
- Season/episode filtering for Jackett results
- Library structure for series (Jellyfin naming schema)
