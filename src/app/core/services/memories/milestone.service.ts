import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  FamilyMilestone,
  MilestoneFilters,
  CreateMilestoneRequest,
  UpdateMilestoneRequest,
  PaginatedResponse
} from '../../../models/memories/memory.models';

@Injectable({
  providedIn: 'root'
})
export class MilestoneService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api`;

  // Get milestones for a family
  getMilestones(familySlug: string, page = 1, filters?: MilestoneFilters): Observable<PaginatedResponse<FamilyMilestone>> {
    let params = new HttpParams().set('page', page.toString());
    
    if (filters) {
      if (filters.type?.length) params = params.set('type', filters.type.join(','));
      if (filters.userId) params = params.set('user_id', filters.userId.toString());
      if (filters.dateFrom) params = params.set('date_from', filters.dateFrom);
      if (filters.dateTo) params = params.set('date_to', filters.dateTo);
      if (filters.isUpcoming !== undefined) params = params.set('is_upcoming', filters.isUpcoming.toString());
      if (filters.isRecurring !== undefined) params = params.set('is_recurring', filters.isRecurring.toString());
      if (filters.sortBy) params = params.set('sort_by', filters.sortBy);
      if (filters.sortDirection) params = params.set('sort_direction', filters.sortDirection);
    }

    return this.http.get<PaginatedResponse<FamilyMilestone>>(
      `${this.baseUrl}/families/${familySlug}/memories/milestones`,
      { params }
    );
  }

  // Get upcoming milestones
  getUpcomingMilestones(familySlug: string, days = 30): Observable<FamilyMilestone[]> {
    const params = new HttpParams().set('days', days.toString());
    
    return this.http.get<FamilyMilestone[]>(
      `${this.baseUrl}/families/${familySlug}/memories/milestones/upcoming`,
      { params }
    );
  }

  // Get single milestone
  getMilestone(familySlug: string, milestoneId: string): Observable<FamilyMilestone> {
    return this.http.get<FamilyMilestone>(
      `${this.baseUrl}/families/${familySlug}/memories/milestones/${milestoneId}`
    );
  }

  // Create milestone
  createMilestone(familySlug: string, milestoneData: CreateMilestoneRequest): Observable<FamilyMilestone> {
    const formData = new FormData();
    
    formData.append('type', milestoneData.type);
    formData.append('title', milestoneData.title);
    formData.append('milestone_date', milestoneData.milestoneDate);
    
    if (milestoneData.userId) formData.append('user_id', milestoneData.userId.toString());
    if (milestoneData.description) formData.append('description', milestoneData.description);
    if (milestoneData.metadata) formData.append('metadata', JSON.stringify(milestoneData.metadata));
    if (milestoneData.isRecurring) formData.append('is_recurring', milestoneData.isRecurring.toString());
    if (milestoneData.recurrencePattern) formData.append('recurrence_pattern', milestoneData.recurrencePattern);
    if (milestoneData.notifyFamily !== undefined) formData.append('notify_family', milestoneData.notifyFamily.toString());
    
    // Handle media files
    if (milestoneData.media && Array.isArray(milestoneData.media)) {
      milestoneData.media.forEach((file, index) => {
        if (file instanceof File) {
          formData.append(`media[${index}]`, file);
        }
      });
    }

    return this.http.post<FamilyMilestone>(
      `${this.baseUrl}/families/${familySlug}/memories/milestones`,
      formData
    );
  }

  // Update milestone
  updateMilestone(familySlug: string, milestoneId: string, updateData: UpdateMilestoneRequest): Observable<FamilyMilestone> {
    return this.http.put<FamilyMilestone>(
      `${this.baseUrl}/families/${familySlug}/memories/milestones/${milestoneId}`,
      updateData
    );
  }

  // Delete milestone
  deleteMilestone(familySlug: string, milestoneId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/families/${familySlug}/memories/milestones/${milestoneId}`
    );
  }

  // Get milestone templates/suggestions
  getMilestoneTemplates(type?: string): Observable<any[]> {
    let params = new HttpParams();
    if (type) params = params.set('type', type);
    
    return this.http.get<any[]>(
      `${this.baseUrl}/milestones/templates`,
      { params }
    );
  }

  // Get milestones by user across all families
  getMilestonesByUser(userId: string, page = 1): Observable<PaginatedResponse<FamilyMilestone>> {
    const params = new HttpParams().set('page', page.toString());
    
    return this.http.get<PaginatedResponse<FamilyMilestone>>(
      `${this.baseUrl}/users/${userId}/milestones`,
      { params }
    );
  }

  // Calculate milestone anniversary dates
  getAnniversaryDates(milestoneDate: string, years = 10): Date[] {
    const baseDate = new Date(milestoneDate);
    const anniversaries: Date[] = [];
    
    for (let i = 1; i <= years; i++) {
      const anniversary = new Date(baseDate);
      anniversary.setFullYear(anniversary.getFullYear() + i);
      anniversaries.push(anniversary);
    }
    
    return anniversaries;
  }

  // Check if milestone is approaching
  isMilestoneApproaching(milestoneDate: string, daysThreshold = 7): boolean {
    const milestone = new Date(milestoneDate);
    const now = new Date();
    const diffTime = milestone.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays >= 0 && diffDays <= daysThreshold;
  }

  // Get days until milestone
  getDaysUntilMilestone(milestoneDate: string): number {
    const milestone = new Date(milestoneDate);
    const now = new Date();
    const diffTime = milestone.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Generate milestone badge/achievement
  generateMilestoneBadge(milestone: FamilyMilestone): any {
    const badgeMap: Record<string, any> = {
      'first_steps': { icon: '👶', color: '#4CAF50', title: 'First Steps' },
      'first_words': { icon: '🗣️', color: '#2196F3', title: 'First Words' },
      'graduation': { icon: '🎓', color: '#9C27B0', title: 'Graduate' },
      'wedding': { icon: '💒', color: '#E91E63', title: 'Newlywed' },
      'birth': { icon: '👶', color: '#FF9800', title: 'New Arrival' },
      'achievement': { icon: '🏆', color: '#FFC107', title: 'Achievement' }
    };
    
    return badgeMap[milestone.type] || { 
      icon: '⭐', 
      color: '#607D8B', 
      title: 'Milestone' 
    };
  }

  // Format milestone for sharing
  formatMilestoneForShare(milestone: FamilyMilestone): string {
    const date = new Date(milestone.milestoneDate).toLocaleDateString();
    return `🎉 ${milestone.title} - ${date}\n${milestone.description || ''}`;
  }
}