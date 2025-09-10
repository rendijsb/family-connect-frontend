import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  FamilyTradition,
  TraditionFilters,
  CreateTraditionRequest,
  UpdateTraditionRequest,
  PaginatedResponse
} from '../../../models/memories/memory.models';

@Injectable({
  providedIn: 'root'
})
export class TraditionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api`;

  // Get traditions for a family
  getTraditions(familySlug: string, page = 1, filters?: TraditionFilters): Observable<PaginatedResponse<FamilyTradition>> {
    let params = new HttpParams().set('page', page.toString());
    
    if (filters) {
      if (filters.frequency?.length) params = params.set('frequency', filters.frequency.join(','));
      if (filters.isActive !== undefined) params = params.set('is_active', filters.isActive.toString());
      if (filters.search) params = params.set('search', filters.search);
      if (filters.participants?.length) params = params.set('participants', filters.participants.join(','));
      if (filters.hasRecipes !== undefined) params = params.set('has_recipes', filters.hasRecipes.toString());
      if (filters.hasActivities !== undefined) params = params.set('has_activities', filters.hasActivities.toString());
      if (filters.sortBy) params = params.set('sort_by', filters.sortBy);
      if (filters.sortDirection) params = params.set('sort_direction', filters.sortDirection);
    }

    return this.http.get<PaginatedResponse<FamilyTradition>>(
      `${this.baseUrl}/families/${familySlug}/memories/traditions`,
      { params }
    );
  }

  // Get active traditions
  getActiveTraditions(familySlug: string): Observable<FamilyTradition[]> {
    return this.http.get<FamilyTradition[]>(
      `${this.baseUrl}/families/${familySlug}/memories/traditions/active`
    );
  }

  // Get single tradition
  getTradition(familySlug: string, traditionId: string): Observable<FamilyTradition> {
    return this.http.get<FamilyTradition>(
      `${this.baseUrl}/families/${familySlug}/memories/traditions/${traditionId}`
    );
  }

  // Create tradition
  createTradition(familySlug: string, traditionData: CreateTraditionRequest): Observable<FamilyTradition> {
    const formData = new FormData();
    
    formData.append('name', traditionData.name);
    formData.append('description', traditionData.description);
    formData.append('frequency', traditionData.frequency);
    
    if (traditionData.scheduleDetails) formData.append('schedule_details', JSON.stringify(traditionData.scheduleDetails));
    if (traditionData.startedDate) formData.append('started_date', traditionData.startedDate);
    if (traditionData.participants?.length) formData.append('participants', JSON.stringify(traditionData.participants));
    if (traditionData.activities?.length) formData.append('activities', JSON.stringify(traditionData.activities));
    if (traditionData.recipes?.length) formData.append('recipes', JSON.stringify(traditionData.recipes));
    if (traditionData.songsGames?.length) formData.append('songs_games', JSON.stringify(traditionData.songsGames));
    
    // Handle media files
    if (traditionData.media && Array.isArray(traditionData.media)) {
      traditionData.media.forEach((file, index) => {
        if (file instanceof File) {
          formData.append(`media[${index}]`, file);
        }
      });
    }

    return this.http.post<FamilyTradition>(
      `${this.baseUrl}/families/${familySlug}/memories/traditions`,
      formData
    );
  }

  // Update tradition
  updateTradition(familySlug: string, traditionId: string, updateData: UpdateTraditionRequest): Observable<FamilyTradition> {
    return this.http.put<FamilyTradition>(
      `${this.baseUrl}/families/${familySlug}/memories/traditions/${traditionId}`,
      updateData
    );
  }

  // Delete tradition
  deleteTradition(familySlug: string, traditionId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/families/${familySlug}/memories/traditions/${traditionId}`
    );
  }

  // Celebrate tradition
  celebrateTradition(familySlug: string, traditionId: string, celebrationData?: any): Observable<FamilyTradition> {
    return this.http.post<FamilyTradition>(
      `${this.baseUrl}/families/${familySlug}/memories/traditions/${traditionId}/celebrate`,
      celebrationData || {}
    );
  }

  // Activate tradition
  activateTradition(familySlug: string, traditionId: string): Observable<FamilyTradition> {
    return this.http.post<FamilyTradition>(
      `${this.baseUrl}/families/${familySlug}/memories/traditions/${traditionId}/activate`,
      {}
    );
  }

  // Deactivate tradition
  deactivateTradition(familySlug: string, traditionId: string): Observable<FamilyTradition> {
    return this.http.post<FamilyTradition>(
      `${this.baseUrl}/families/${familySlug}/memories/traditions/${traditionId}/deactivate`,
      {}
    );
  }

  // Get tradition calendar (traditions by date)
  getTraditionCalendar(familySlug: string, year?: number, month?: number): Observable<any[]> {
    let params = new HttpParams();
    if (year) params = params.set('year', year.toString());
    if (month) params = params.set('month', month.toString());
    
    return this.http.get<any[]>(
      `${this.baseUrl}/families/${familySlug}/memories/traditions/calendar`,
      { params }
    );
  }

  // Calculate next celebration date
  getNextCelebrationDate(tradition: FamilyTradition): Date | null {
    if (!tradition.isActive) return null;
    
    const lastCelebrated = tradition.lastCelebratedAt ? new Date(tradition.lastCelebratedAt) : new Date();
    const now = new Date();
    
    switch (tradition.frequency) {
      case 'daily':
        return new Date(lastCelebrated.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(lastCelebrated.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        const nextMonth = new Date(lastCelebrated);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;
      case 'yearly':
        const nextYear = new Date(lastCelebrated);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        return nextYear;
      case 'seasonal':
        // Logic for seasonal traditions (spring, summer, fall, winter)
        return this.getNextSeasonalDate(lastCelebrated, tradition.scheduleDetails);
      case 'holiday':
        // Logic for holiday traditions
        return this.getNextHolidayDate(tradition.scheduleDetails);
      default:
        return null;
    }
  }

  // Check if tradition needs celebration
  needsCelebration(tradition: FamilyTradition): boolean {
    if (!tradition.isActive) return false;
    
    const nextCelebration = this.getNextCelebrationDate(tradition);
    if (!nextCelebration) return false;
    
    const now = new Date();
    return nextCelebration <= now;
  }

  // Get days since last celebration
  getDaysSinceLastCelebration(tradition: FamilyTradition): number {
    if (!tradition.lastCelebratedAt) return 0;
    
    const lastCelebrated = new Date(tradition.lastCelebratedAt);
    const now = new Date();
    const diffTime = now.getTime() - lastCelebrated.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  // Get tradition streak (consecutive celebrations)
  getTraditionStreak(tradition: FamilyTradition): number {
    // This would typically be calculated on the backend
    // For now, return times celebrated as a simple metric
    return tradition.timesCelebrated;
  }

  // Generate tradition reminder
  generateReminder(tradition: FamilyTradition): string {
    const nextDate = this.getNextCelebrationDate(tradition);
    if (!nextDate) return '';
    
    const daysUntil = Math.ceil((nextDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil <= 0) {
      return `🎉 It's time for ${tradition.name}!`;
    } else if (daysUntil === 1) {
      return `📅 ${tradition.name} is tomorrow!`;
    } else if (daysUntil <= 7) {
      return `📅 ${tradition.name} is in ${daysUntil} days`;
    }
    
    return '';
  }

  // Get tradition templates/suggestions
  getTraditionTemplates(frequency?: string, type?: string): Observable<any[]> {
    let params = new HttpParams();
    if (frequency) params = params.set('frequency', frequency);
    if (type) params = params.set('type', type);
    
    return this.http.get<any[]>(
      `${this.baseUrl}/traditions/templates`,
      { params }
    );
  }

  // Format tradition for sharing
  formatTraditionForShare(tradition: FamilyTradition): string {
    const frequency = this.formatFrequency(tradition.frequency);
    return `🎭 Our Family Tradition: ${tradition.name}\n📅 ${frequency}\n✨ ${tradition.description}`;
  }

  // Helper methods
  private getNextSeasonalDate(lastDate: Date, scheduleDetails?: any): Date | null {
    // Implementation for seasonal dates (Spring: Mar 20, Summer: Jun 21, etc.)
    const seasons = [
      { name: 'spring', month: 3, day: 20 },
      { name: 'summer', month: 6, day: 21 },
      { name: 'fall', month: 9, day: 23 },
      { name: 'winter', month: 12, day: 21 }
    ];
    
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Find next seasonal date after last celebrated
    for (const season of seasons) {
      const seasonDate = new Date(currentYear, season.month - 1, season.day);
      if (seasonDate > lastDate) {
        return seasonDate;
      }
    }
    
    // If no season found in current year, return first season of next year
    return new Date(currentYear + 1, seasons[0].month - 1, seasons[0].day);
  }

  private getNextHolidayDate(scheduleDetails?: any): Date | null {
    // Implementation for holiday dates
    // This would typically involve a holiday calendar API
    return null;
  }

  private formatFrequency(frequency: string): string {
    const frequencyMap: Record<string, string> = {
      'daily': 'Every day',
      'weekly': 'Every week',
      'monthly': 'Every month',
      'yearly': 'Every year',
      'seasonal': 'Every season',
      'holiday': 'On holidays',
      'special': 'Special occasions'
    };
    
    return frequencyMap[frequency] || frequency;
  }
}