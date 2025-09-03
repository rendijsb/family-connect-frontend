import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private isNative = Capacitor.isNativePlatform();

  async setItem(key: string, value: string): Promise<void> {
    if (this.isNative) {
      await Preferences.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  }

  async getItem(key: string): Promise<string | null> {
    if (this.isNative) {
      const { value } = await Preferences.get({ key });
      return value;
    } else {
      return localStorage.getItem(key);
    }
  }

  async removeItem(key: string): Promise<void> {
    if (this.isNative) {
      await Preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  }

  async clear(): Promise<void> {
    if (this.isNative) {
      await Preferences.clear();
    } else {
      localStorage.clear();
    }
  }
}
