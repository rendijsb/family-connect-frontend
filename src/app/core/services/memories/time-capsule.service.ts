import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  FamilyTimeCapsule,
  TimeCapsuleFilters,
  CreateTimeCapsuleRequest,
  UpdateTimeCapsuleRequest,
  AddTimeCapsuleContentRequest,
  PaginatedResponse
} from '../../../models/memories/memory.models';

@Injectable({
  providedIn: 'root'
})
export class TimeCapsuleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api`;

  // Get time capsules for a family
  getTimeCapsules(familySlug: string, page = 1, filters?: TimeCapsuleFilters): Observable<PaginatedResponse<FamilyTimeCapsule>> {
    let params = new HttpParams().set('page', page.toString());
    
    if (filters) {
      if (filters.isOpened !== undefined) params = params.set('is_opened', filters.isOpened.toString());
      if (filters.openingSoon !== undefined) params = params.set('opening_soon', filters.openingSoon.toString());
      if (filters.createdBy) params = params.set('created_by', filters.createdBy.toString());
      if (filters.sortBy) params = params.set('sort_by', filters.sortBy);
      if (filters.sortDirection) params = params.set('sort_direction', filters.sortDirection);
    }

    return this.http.get<PaginatedResponse<FamilyTimeCapsule>>(
      `${this.baseUrl}/families/${familySlug}/memories/time-capsules`,
      { params }
    );
  }

  // Get sealed time capsules
  getSealedTimeCapsules(familySlug: string): Observable<FamilyTimeCapsule[]> {
    return this.http.get<FamilyTimeCapsule[]>(
      `${this.baseUrl}/families/${familySlug}/memories/time-capsules/sealed`
    );
  }

  // Get time capsules ready to open
  getReadyToOpenTimeCapsules(familySlug: string): Observable<FamilyTimeCapsule[]> {
    return this.http.get<FamilyTimeCapsule[]>(
      `${this.baseUrl}/families/${familySlug}/memories/time-capsules/ready-to-open`
    );
  }

  // Get single time capsule
  getTimeCapsule(familySlug: string, capsuleId: string): Observable<FamilyTimeCapsule> {
    return this.http.get<FamilyTimeCapsule>(
      `${this.baseUrl}/families/${familySlug}/memories/time-capsules/${capsuleId}`
    );
  }

  // Create time capsule
  createTimeCapsule(familySlug: string, capsuleData: CreateTimeCapsuleRequest): Observable<FamilyTimeCapsule> {
    const formData = new FormData();
    
    formData.append('title', capsuleData.title);
    formData.append('opens_at', capsuleData.opensAt);
    formData.append('sealed_at', new Date().toISOString());
    
    if (capsuleData.description) formData.append('description', capsuleData.description);
    if (capsuleData.openingConditions?.length) formData.append('opening_conditions', JSON.stringify(capsuleData.openingConditions));
    if (capsuleData.initialContents?.length) formData.append('initial_contents', JSON.stringify(capsuleData.initialContents));

    return this.http.post<FamilyTimeCapsule>(
      `${this.baseUrl}/families/${familySlug}/memories/time-capsules`,
      formData
    );
  }

  // Update time capsule (only if not opened)
  updateTimeCapsule(familySlug: string, capsuleId: string, updateData: UpdateTimeCapsuleRequest): Observable<FamilyTimeCapsule> {
    return this.http.put<FamilyTimeCapsule>(
      `${this.baseUrl}/families/${familySlug}/memories/time-capsules/${capsuleId}`,
      updateData
    );
  }

  // Delete time capsule
  deleteTimeCapsule(familySlug: string, capsuleId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/families/${familySlug}/memories/time-capsules/${capsuleId}`
    );
  }

  // Add content to time capsule
  addContent(familySlug: string, capsuleId: string, contentData: AddTimeCapsuleContentRequest): Observable<FamilyTimeCapsule> {
    const formData = new FormData();
    
    formData.append('type', contentData.type);
    
    if (contentData.content instanceof File) {
      formData.append('content_file', contentData.content);
    } else {
      formData.append('content', contentData.content);
    }

    return this.http.post<FamilyTimeCapsule>(
      `${this.baseUrl}/families/${familySlug}/memories/time-capsules/${capsuleId}/contribute`,
      formData
    );
  }

  // Open time capsule
  openTimeCapsule(familySlug: string, capsuleId: string): Observable<FamilyTimeCapsule> {
    return this.http.post<FamilyTimeCapsule>(
      `${this.baseUrl}/families/${familySlug}/memories/time-capsules/${capsuleId}/open`,
      {}
    );
  }

  // Calculate days until opening
  getDaysUntilOpening(capsule: FamilyTimeCapsule): number {
    if (capsule.isOpened) return 0;
    
    const opensAt = new Date(capsule.opensAt);
    const now = new Date();
    const diffTime = opensAt.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // Check if capsule can be opened
  canBeOpened(capsule: FamilyTimeCapsule): boolean {
    if (capsule.isOpened) return false;
    
    const opensAt = new Date(capsule.opensAt);
    const now = new Date();
    
    // Check if opening date has passed
    if (opensAt > now) return false;
    
    // Check custom opening conditions
    if (capsule.openingConditions && capsule.openingConditions.length > 0) {
      return this.checkOpeningConditions(capsule.openingConditions);
    }
    
    return true;
  }

  // Check if capsule is opening soon
  isOpeningSoon(capsule: FamilyTimeCapsule, daysThreshold = 7): boolean {
    if (capsule.isOpened) return false;
    
    const daysUntil = this.getDaysUntilOpening(capsule);
    return daysUntil > 0 && daysUntil <= daysThreshold;
  }

  // Get opening ceremony data
  getOpeningCeremony(familySlug: string, capsuleId: string): Observable<any> {
    return this.http.get<any>(
      `${this.baseUrl}/families/${familySlug}/memories/time-capsules/${capsuleId}/ceremony`
    );
  }

  // Generate opening notification
  generateOpeningNotification(capsule: FamilyTimeCapsule): string {
    const daysUntil = this.getDaysUntilOpening(capsule);
    
    if (daysUntil === 0) {
      return `🎉 Time to open "${capsule.title}"! The waiting is over!`;
    } else if (daysUntil === 1) {
      return `⏰ "${capsule.title}" opens tomorrow! Get ready for the big reveal!`;
    } else if (daysUntil <= 7) {
      return `📅 "${capsule.title}" opens in ${daysUntil} days!`;
    } else if (daysUntil <= 30) {
      return `🗓️ "${capsule.title}" opens in ${daysUntil} days!`;
    }
    
    const opensAt = new Date(capsule.opensAt);
    return `🔒 "${capsule.title}" opens on ${opensAt.toLocaleDateString()}`;
  }

  // Get time capsule statistics
  getTimeCapsuleStats(familySlug: string): Observable<any> {
    return this.http.get<any>(
      `${this.baseUrl}/families/${familySlug}/memories/time-capsules/stats`
    );
  }

  // Create time capsule wizard steps
  getWizardSteps(): any[] {
    return [
      {
        id: 'basic-info',
        title: 'Basic Information',
        description: 'Set title, description, and opening date',
        icon: 'information-circle'
      },
      {
        id: 'conditions',
        title: 'Opening Conditions',
        description: 'Set special conditions for opening (optional)',
        icon: 'lock-closed'
      },
      {
        id: 'initial-content',
        title: 'Initial Content',
        description: 'Add your first messages and media',
        icon: 'document-text'
      },
      {
        id: 'seal',
        title: 'Seal Capsule',
        description: 'Review and seal your time capsule',
        icon: 'check-circle'
      }
    ];
  }

  // Get suggested opening dates
  getSuggestedOpeningDates(): any[] {
    const now = new Date();
    const suggestions = [];
    
    // 1 year from now
    const oneYear = new Date(now);
    oneYear.setFullYear(oneYear.getFullYear() + 1);
    suggestions.push({
      date: oneYear.toISOString().split('T')[0],
      label: '1 Year from now',
      description: 'Perfect for annual reflections'
    });
    
    // 5 years from now
    const fiveYears = new Date(now);
    fiveYears.setFullYear(fiveYears.getFullYear() + 5);
    suggestions.push({
      date: fiveYears.toISOString().split('T')[0],
      label: '5 Years from now',
      description: 'See how much has changed'
    });
    
    // 10 years from now
    const tenYears = new Date(now);
    tenYears.setFullYear(tenYears.getFullYear() + 10);
    suggestions.push({
      date: tenYears.toISOString().split('T')[0],
      label: '10 Years from now',
      description: 'A long journey into the future'
    });
    
    // Next milestone birthday
    const nextMilestone = this.getNextMilestoneBirthday();
    if (nextMilestone) {
      suggestions.push({
        date: nextMilestone.toISOString().split('T')[0],
        label: 'Next milestone birthday',
        description: 'Open on a special birthday'
      });
    }
    
    return suggestions;
  }

  // Format time until opening
  formatTimeUntilOpening(capsule: FamilyTimeCapsule): string {
    if (capsule.isOpened) return 'Opened';
    
    const daysUntil = this.getDaysUntilOpening(capsule);
    
    if (daysUntil === 0) return 'Ready to open!';
    if (daysUntil === 1) return '1 day left';
    if (daysUntil < 30) return `${daysUntil} days left`;
    
    const months = Math.floor(daysUntil / 30);
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} left`;
    
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    
    let result = `${years} year${years > 1 ? 's' : ''}`;
    if (remainingMonths > 0) {
      result += `, ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
    }
    return result + ' left';
  }

  // Private helper methods
  private checkOpeningConditions(conditions: any[]): boolean {
    // Implementation for checking custom opening conditions
    // This would involve evaluating each condition type
    return conditions.every(condition => condition.isMet);
  }

  private getNextMilestoneBirthday(): Date | null {
    // Logic to find next milestone birthday (30, 40, 50, etc.)
    // This would typically involve user data
    return null;
  }
}