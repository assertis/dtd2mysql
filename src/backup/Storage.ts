export interface Storage {
  persist(filePath: string): Promise<void>;
  download(filePath: string, filename: string): Promise<string[]>
  doesBucketExists(name: string): Promise<boolean>
  doesFileExists(filePath: string): Promise<boolean>
}
