declare module 'anki-apkg-export' {
  interface AnkiExportTemplate {
    questionFormat?: string;
    answerFormat?: string;
    css?: string;
  }

  interface AnkiExportCardOptions {
    tags?: string[];
  }

  class AnkiExport {
    constructor(deckName: string, template?: AnkiExportTemplate);
    addCard(front: string, back: string, options?: AnkiExportCardOptions): void;
    addMedia(filename: string, data: Buffer | Uint8Array): void;
    save(): Promise<Buffer>;
  }

  const _default: typeof AnkiExport;
  export default _default;
  export { AnkiExport as Exporter };
}
