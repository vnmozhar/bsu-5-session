declare module 'pdfmake/build/pdfmake' {
  import type { TCreatedPdf, TDocumentDefinitions } from 'pdfmake/interfaces'

  const pdfMake: {
    addVirtualFileSystem(virtualFileSystem: Record<string, string>): void
    createPdf(document: TDocumentDefinitions): TCreatedPdf
  }

  export default pdfMake
}

declare module 'pdfmake/build/vfs_fonts' {
  const virtualFileSystem: Record<string, string>
  export default virtualFileSystem
}
