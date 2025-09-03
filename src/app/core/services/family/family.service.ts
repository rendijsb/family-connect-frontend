import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {Observable, BehaviorSubject, tap, finalize} from 'rxjs';
import { LoadingController } from '@ionic/angular';
import { ApiUrlService } from '../api.service';
import {
  Family,
  CreateFamilyRequest,
  UpdateFamilyRequest,
  JoinFamilyRequest,
  FamilyRoleEnum,
  getFamilyRolePermissions
} from '../../../models/families/family.models';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FamilyService {
  private readonly http = inject(HttpClient);
  private readonly apiUrlService = inject(ApiUrlService);
  private readonly loadingController = inject(LoadingController);

  private readonly _families = new BehaviorSubject<Family[]>([]);
  private readonly _currentFamily = new BehaviorSubject<Family | null>(null);
  private readonly _isLoading = signal<boolean>(false);

  readonly families$ = this._families.asObservable();
  readonly currentFamily$ = this._currentFamily.asObservable();
  readonly isLoading = this._isLoading.asReadonly();

  constructor() {}

  getMyFamilies(): Observable<ApiResponse<Family[]>> {
    this._isLoading.set(true);

    return this.http.get<ApiResponse<Family[]>>(
      this.apiUrlService.getUrl('families/my-families')
    ).pipe(
      tap(response => {
        const families = response.data.map(family => this.normalizeFamilyData(family));
        this._families.next(families);
        this._isLoading.set(false);
      }),
      finalize(() => this._isLoading.set(false)),
    );
  }

  getFamilyBySlug(slug: string): Observable<ApiResponse<Family>> {
    this._isLoading.set(true);

    return this.http.get<ApiResponse<Family>>(
      this.apiUrlService.getUrl(`families/${slug}`)
    ).pipe(
      tap(response => {
        const family = this.normalizeFamilyData(response.data);
        this._currentFamily.next(family);
        this._isLoading.set(false);
      }),
      finalize(() => this._isLoading.set(false)),
    );
  }

  createFamily(familyData: CreateFamilyRequest): Observable<ApiResponse<Family>> {
    this._isLoading.set(true);

    return this.http.post<ApiResponse<Family>>(
      this.apiUrlService.getUrl('families'),
      familyData
    ).pipe(
      tap(async response => {
        const family = this.normalizeFamilyData(response.data);

        const currentFamilies = this._families.value;
        this._families.next([...currentFamilies, family]);

        this._currentFamily.next(family);

        this._isLoading.set(false);
      }),
      finalize(() => this._isLoading.set(false)),
    );
  }

  updateFamily(slug: string, familyData: UpdateFamilyRequest): Observable<ApiResponse<Family>> {
    this._isLoading.set(true);

    return this.http.put<ApiResponse<Family>>(
      this.apiUrlService.getUrl(`families/${slug}`),
      familyData
    ).pipe(
      tap(async response => {
        const family = this.normalizeFamilyData(response.data);

        const currentFamilies = this._families.value;
        const updatedFamilies = currentFamilies.map(f =>
          f.slug === slug ? family : f
        );
        this._families.next(updatedFamilies);

        if (this._currentFamily.value?.slug === slug) {
          this._currentFamily.next(family);
        }

        this._isLoading.set(false);
      }),
      finalize(() => this._isLoading.set(false)),
    );
  }

  deleteFamily(slug: string): Observable<ApiResponse<void>> {
    this._isLoading.set(true);

    return this.http.delete<ApiResponse<void>>(
      this.apiUrlService.getUrl(`families/${slug}`)
    ).pipe(
      tap(async () => {
        const currentFamilies = this._families.value;
        const filteredFamilies = currentFamilies.filter(family => family.slug !== slug);
        this._families.next(filteredFamilies);

        if (this._currentFamily.value?.slug === slug) {
          this._currentFamily.next(null);
        }

        this._isLoading.set(false);
      }),
      finalize(() => this._isLoading.set(false)),
    );
  }

  joinFamilyByCode(joinData: JoinFamilyRequest): Observable<ApiResponse<Family>> {
    this._isLoading.set(true);

    return this.http.post<ApiResponse<Family>>(
      this.apiUrlService.getUrl('families/join'),
      joinData
    ).pipe(
      tap(async response => {
        const family = this.normalizeFamilyData(response.data);

        const currentFamilies = this._families.value;
        this._families.next([...currentFamilies, family]);

        this._isLoading.set(false);
      }),
      finalize(() => this._isLoading.set(false)),
    );
  }

  leaveFamily(slug: string): Observable<ApiResponse<void>> {
    this._isLoading.set(true);

    return this.http.post<ApiResponse<void>>(
      this.apiUrlService.getUrl(`families/${slug}/leave`),
      {}
    ).pipe(
      tap(async () => {
        const currentFamilies = this._families.value;
        const filteredFamilies = currentFamilies.filter(family => family.slug !== slug);
        this._families.next(filteredFamilies);

        if (this._currentFamily.value?.slug === slug) {
          this._currentFamily.next(null);
        }

        this._isLoading.set(false);
      }),
      finalize(() => this._isLoading.set(false)),
    );
  }

  generateJoinCode(slug: string): Observable<ApiResponse<{ joinCode: string }>> {
    return this.http.post<ApiResponse<{ joinCode: string }>>(
      this.apiUrlService.getUrl(`families/${slug}/generate-code`),
      {}
    ).pipe(
      tap(async response => {
        const currentFamily = this._currentFamily.value;
        if (currentFamily?.slug === slug) {
          this._currentFamily.next({
            ...currentFamily,
            joinCode: response.data.joinCode
          });
        }
      }),
    );
  }

  inviteFamilyMember(slug: string, email: string, role: FamilyRoleEnum): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      this.apiUrlService.getUrl(`families/${slug}/invite`),
      { email, role }
    ).pipe(
      tap(async () => {
      }),
    );
  }

  removeFamilyMember(slug: string, memberId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(
      this.apiUrlService.getUrl(`families/${slug}/members/${memberId}`)
    ).pipe(
      tap(async () => {
      }),
    );
  }

  getCurrentFamily(): Family | null {
    return this._currentFamily.value;
  }

  getFamilies(): Family[] {
    return this._families.value;
  }

  hasPermission(family: Family, permission: string): boolean {
    if (!family.currentUserRole) return false;

    const userPermissions = getFamilyRolePermissions(family.currentUserRole);
    return userPermissions.includes('all') || userPermissions.includes(permission);
  }

  canManageFamily(family: Family): boolean {
    if (!family.currentUserRole) return false;
    return family.currentUserRole === FamilyRoleEnum.OWNER ||
      family.currentUserRole === FamilyRoleEnum.MODERATOR;
  }

  canManageMembers(family: Family): boolean {
    return this.hasPermission(family, 'manage_members');
  }

  canInviteMembers(family: Family): boolean {
    return this.canManageMembers(family);
  }

  isOwner(family: Family): boolean {
    return family.currentUserRole === FamilyRoleEnum.OWNER;
  }

  getUserRole(family: Family): FamilyRoleEnum | null {
    return family.currentUserRole || null;
  }

  private normalizeFamilyData(family: any): Family {
    const normalized = {
      ...family,
      currentUserRole: family.currentUserRole ? parseInt(family.currentUserRole) as FamilyRoleEnum : undefined,
      memberCount: family.memberCount || 0
    };
    return normalized;
  }

  async showLoading(message: string = 'Please wait...'): Promise<HTMLIonLoadingElement> {
    const loading = await this.loadingController.create({
      message,
      spinner: 'crescent'
    });
    await loading.present();
    return loading;
  }
}
