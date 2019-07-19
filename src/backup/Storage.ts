export interface Storage {
  persist(filePath: string): Promise<void>;
}
