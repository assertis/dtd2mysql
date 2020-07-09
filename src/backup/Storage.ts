export interface Storage {
  persist(filePath: string): Promise<void>;
  download(filePath: string, filename: string): Promise<string[]>
}
