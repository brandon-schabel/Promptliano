import { createWriteStream } from 'node:fs'
import type archiver from 'archiver'
import archiverFactory from 'archiver'

export async function createZip(outputPath: string, configure: (archive: archiver.Archiver) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath)
    const archive = archiverFactory('zip', {
      zlib: { level: 9 }
    })

    output.on('close', () => {
      resolve()
    })

    archive.on('error', (err) => {
      reject(err)
    })

    archive.pipe(output)
    configure(archive)

    void archive.finalize()
  })
}

export function zipDirectory(sourceDir: string, outputPath: string): Promise<void> {
  return createZip(outputPath, (archive) => {
    archive.directory(sourceDir, false)
  })
}
