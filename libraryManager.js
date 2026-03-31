

class LibraryManager {
    constructor(data) {
        Object.assign(this, data)
        this.meta = data.metaStore.find(i => i.imdbId === data.imdbId)
        this.source = data._filePath(data.savePath, data.imdbId)
    }


  async jellyFiles() {
    if (
      !await this._fileExist(this._filePath(this.folder, `${this.type}.nfo`)) 
      && (this.meta !== undefined)
      )  await this.write(this.folder, `${this.type}.nfo`, this.nfo(this.meta), 'utf8')

    for (const [folder, ext] of [['posters', '.jpg'], ['backdrops', '.jpg'], ['logos', '.png']]) {
        const filename = folder.slice(0, -1) 
        if (!await this._fileExist(this._filePath(this.folder, filename + ext )) && (this.meta !== undefined)) {
          const streamImg = this.images([folder, ext])
          const img = streamImg !== null ? streamImg : (this.meta[`${filename}_path`] ? this.meta[`${filename}_path`] : null )
          if (img) await this.getImage(img, this._filePath(this.folder, filename + ext))
        }
    }   
  }


  // TODO: Use /download savePath, source as /ttnumber and the dest path as normal
  async cleanUp() {
    let target;
    const rename = `${this.meta.title} (${this.year}) [imdbid-${this.imdbId}]`
    this.folder = this._filePath(this.config.savePath, rename)
    if (!await this._fileExist(this.folder)) await this.mkdir(this.folder)
    const found = await this.scan(this.source, `video`)
    if (found.length > 1) target = await this.biggest(found)
    else if (found.length > 0) target = found[0]
    else if (await this._fileExist(this.source)) return await this.rm(this.source)
    await this.cpFile(target, this._filePath(this.folder, rename)) // cpfile has catch err, to avoid complex file checking logic 
    await this.rm(this.source)
  }


  async manager() {
    await this.cleanUp()
    await this.jellyFiles()
  }
}

export { LibraryManager }