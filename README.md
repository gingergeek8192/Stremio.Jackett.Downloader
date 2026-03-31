# Stremio → Jackett → Jellyfin

A Stremio add-on that does more than search — it **automatically downloads movies to your machine** and organises them straight into your [Jellyfin](https://jellyfin.org/) library, ready to stream locally.

Browse Stremio as normal. Settle on a movie. The add-on handles the rest.

**Requires Stremio v4.4.10+**


## What makes this different

Most Jackett add-ons stop at surfacing torrent links in Stremio. This one goes further:

- **Auto-download** — linger on a movie long enough and it downloads automatically. Browse away and the timer resets. Only what you actually want gets downloaded.
- **Franchise collection download** — watch one film in a series and the rest of the collection queues up automatically.
- **Jellyfin-ready library** — completed downloads are renamed, moved, and decorated with metadata (NFO, poster, backdrop, logo) in the exact structure Jellyfin expects. No manual sorting.
- **Smart candidate selection** — filters by your preferred resolution, sorts by seeds, and falls back through candidates automatically if one stalls.


## Auto-Download

Powered by [WebTorrent](https://webtorrent.io/). When you browse to a movie in Stremio, the add-on waits `downloadAfter` minutes before downloading the best matching torrent to `savePath`. Browse away before the timer fires and it resets — so only the title you actually settle on gets downloaded.

Candidates are filtered to your preferred `targetRes`, sorted by seeds, and tried in order up to `candidates`. If a torrent stalls (no progress within `waitFor` ms) it moves on to the next automatically.

Note: Currently only movies are auto-downloaded. Series support is planned.


## Franchise Collection Download

When you stream a movie that belongs to a TMDB collection (e.g. a franchise), the add-on fetches the full collection via the TMDB API, searches Jackett for each other part, and enqueues them for sequential download. Already-downloaded titles are skipped automatically by IMDb ID.

Requires a valid `tmdbApiKey` in `config.json`. Collection downloads are queued behind any active download and processed one at a time.


## Jellyfin Library Manager

On download completion, files are automatically:

- Renamed to Jellyfin naming schema: `Movie Title (Year) [imdbid-ttXXXXXXX]`
- Moved to your `savePath` in a clean folder structure
- Decorated with an NFO metadata file, poster, backdrop, and logo fetched from TMDB

Point Jellyfin at your `savePath` and your library updates itself.


## Planned Features

- Local file streaming — serve downloaded files directly to Stremio over LAN, with local copy shown first
- HLS transcoding — on-the-fly ffmpeg transcoding for low-powered clients (FireStick etc.)
- Series support


## Configuration Reference

After first run, edit `config.json` in the project root.

| Key | Default | Description |
|-----|---------|-------------|
| `autoLaunch` | `false` | Run the add-on on system start-up |
| `responseTimeout` | `11000` | Stremio add-on response timeout in milliseconds; responds with partial results if reached. `0` = no timeout |
| `addonPort` | `7000` | Port for the Stremio add-on |
| `minimumSeeds` | `3` | Remove torrents with fewer than X seeds |
| `maximumResults` | `30` | Maximum number of torrents to return. `0` = no limit |
| `remote` | `true` | Make the add-on available remotely via LAN and the Internet |
| `subdomain` | `false` | Preferred subdomain (if available); only applies when `remote` is `true` |
| `saveTorrent` | `true` | Save the selected torrent file to the folder specified by `savePath` |
| `savePath` | `~/Downloads` | Download movies to this folder |
| `waitFor` | `30000` | Milliseconds to wait before checking if a download has started and trying the next candidate |
| `targetRes` | `1080` | Preferred resolution; the add-on picks the closest match when `saveTorrent` is `true` |
| `candidates` | `3` | Total number of matching torrent candidates to try |
| `downloadAfter` | `3` | Minutes to wait before downloading; resets if the user browses to another title — defaults to 20 seconds if set to `0` |
| `jackett.host` | `"http://127.0.0.1:9117/"` | Jackett server URL |
| `jackett.readTimeout` | `10000` | Read timeout in milliseconds for Jackett HTTP requests. `0` = no timeout |
| `jackett.openTimeout` | `10000` | Open/connect timeout in milliseconds for Jackett HTTP requests. `0` = no timeout |
| `tmdbApiKey` | `""` | TMDB API key; required for collection download |


## Install and Usage


### Install Jackett

- [Install Jackett on Windows](https://github.com/Jackett/Jackett#installation-on-windows)
- [Install Jackett on OSX](https://github.com/Jackett/Jackett#installation-on-macos)
- [Install Jackett on Linux](https://github.com/Jackett/Jackett#installation-on-linux)


### Setup Jackett

Open your browser, go on [http://127.0.0.1:9117/](http://127.0.0.1:9117/). Press "+ Add Indexer", add as many indexers as you want.

Copy the API key from the top-right of the Jackett UI — you'll need it below.


### Run the Add-on from Source

```bash
git clone https://github.com/BoredLama/stremio-jackett-addon.git
cd stremio-jackett-addon
pnpm install
pnpm start
```

On first run, `config.json` is created in the project root. Open it and set:

- `jackettApiKey` — your Jackett API key
- `tmdbApiKey` — your [TMDB API key](https://www.themoviedb.org/settings/api) (required for collection download)

Then restart with `pnpm start`.


### Add the Add-on to Stremio

When the add-on starts with a valid `config.json`, it prints your ready-to-use URLs:

```
Local (this machine) Add-on URL:  http://127.0.0.1:7000/<jackett-api-key>/manifest.json
Remote (other devices) Add-on URL: http://192.168.1.x:7000/<jackett-api-key>/manifest.json
```

Copy the appropriate URL and paste it into Stremio's Add-on URL field.

![addlink](https://user-images.githubusercontent.com/1777923/43146711-65a33ccc-8f6a-11e8-978e-4c69640e63e3.png)

Note: The add-on process must be running (along with Jackett) for the add-on to work in Stremio.

Note: Setting `autoLaunch` to `true` in `config.json` will make the add-on auto launch on system start-up.


### Using the Add-on Over LAN

Use the Remote URL printed on startup to add the add-on from any device on your network.

- macOS Stremio app: paste the Remote URL directly — works out of the box.
- Windows: use Stremio Web on Chrome. In Chrome's site settings go to `Settings → Site settings → Insecure content`, add `app.stremio.com`, then paste the Remote URL.

The server needs `remote` set to `true` in `config.json` so it binds to all interfaces rather than just localhost.
