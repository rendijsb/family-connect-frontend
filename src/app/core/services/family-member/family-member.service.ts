import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, finalize } from 'rxjs';
import { ApiUrlService } from '../api.service';
import { FamilyMember } from '../../../models/families/family.models';
import {
  FamilyInvitation,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  SetRelationshipRequest,
} from '../../../models/families/invitation.models';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FamilyMemberService {
  private readonly http = inject(HttpClient);
  private readonly apiUrlService = inject(ApiUrlService);

  private readonly _familyMembers = new BehaviorSubject<FamilyMember[]>([]);
  private readonly _pendingInvitations = new BehaviorSubject<
    FamilyInvitation[]
  >([]);
  private readonly _isLoading = signal<boolean>(false);

  readonly familyMembers$ = this._familyMembers.asObservable();
  readonly pendingInvitations$ = this._pendingInvitations.asObservable();
  readonly isLoading = this._isLoading.asReadonly();

  getFamilyMembers(
    familySlug: string
  ): Observable<ApiResponse<FamilyMember[]>> {
    this._isLoading.set(true);

    return this.http
      .get<ApiResponse<FamilyMember[]>>(
        this.apiUrlService.getUrl(`families/${familySlug}/members`)
      )
      .pipe(
        tap((response) => {
          this._familyMembers.next(response.data);
        }),
        finalize(() => this._isLoading.set(false))
      );
  }

  inviteMember(
    familySlug: string,
    request: InviteMemberRequest
  ): Observable<ApiResponse<void>> {
    this._isLoading.set(true);

    return this.http
      .post<ApiResponse<void>>(
        this.apiUrlService.getUrl(`families/${familySlug}/members/invite`),
        request
      )
      .pipe(finalize(() => this._isLoading.set(false)));
  }

  updateMemberRole(
    familySlug: string,
    memberId: number,
    request: UpdateMemberRoleRequest
  ): Observable<ApiResponse<FamilyMember>> {
    this._isLoading.set(true);

    return this.http
      .post<ApiResponse<FamilyMember>>(
        this.apiUrlService.getUrl(
          `families/${familySlug}/members/${memberId}/role`
        ),
        request
      )
      .pipe(
        tap((response) => {
          const currentMembers = this._familyMembers.value;
          const updatedMembers = currentMembers.map((member) =>
            member.id === memberId ? response.data : member
          );
          this._familyMembers.next(updatedMembers);
        }),
        finalize(() => this._isLoading.set(false))
      );
  }

  updateMember(
    familySlug: string,
    memberId: number,
    request: any
  ): Observable<ApiResponse<FamilyMember>> {
    this._isLoading.set(true);

    return this.http
      .put<ApiResponse<FamilyMember>>(
        this.apiUrlService.getUrl(`families/${familySlug}/members/${memberId}`),
        request
      )
      .pipe(
        tap((response) => {
          const currentMembers = this._familyMembers.value;
          const updatedMembers = currentMembers.map((member) =>
            member.id === memberId ? response.data : member
          );
          this._familyMembers.next(updatedMembers);
        }),
        finalize(() => this._isLoading.set(false))
      );
  }

  setMemberRelationship(
    familySlug: string,
    memberId: number,
    request: SetRelationshipRequest
  ): Observable<ApiResponse<void>> {
    this._isLoading.set(true);

    return this.http
      .post<ApiResponse<void>>(
        this.apiUrlService.getUrl(
          `families/${familySlug}/members/${memberId}/relationship`
        ),
        request
      )
      .pipe(finalize(() => this._isLoading.set(false)));
  }

  removeMember(
    familySlug: string,
    memberId: number
  ): Observable<ApiResponse<void>> {
    this._isLoading.set(true);

    return this.http
      .delete<ApiResponse<void>>(
        this.apiUrlService.getUrl(`families/${familySlug}/members/${memberId}`)
      )
      .pipe(
        tap(() => {
          const currentMembers = this._familyMembers.value;
          const filteredMembers = currentMembers.filter(
            (member) => member.id !== memberId
          );
          this._familyMembers.next(filteredMembers);
        }),
        finalize(() => this._isLoading.set(false))
      );
  }

  getPendingInvitations(): Observable<ApiResponse<FamilyInvitation[]>> {
    this._isLoading.set(true);

    return this.http
      .get<ApiResponse<FamilyInvitation[]>>(
        this.apiUrlService.getUrl('invitations/pending')
      )
      .pipe(
        tap((response) => {
          this._pendingInvitations.next(response.data);
        }),
        finalize(() => this._isLoading.set(false))
      );
  }

  acceptInvitation(token: string): Observable<ApiResponse<void>> {
    this._isLoading.set(true);

    return this.http
      .post<ApiResponse<void>>(
        this.apiUrlService.getUrl(`invitations/${token}/accept`),
        {}
      )
      .pipe(
        tap(() => {
          const currentInvitations = this._pendingInvitations.value;
          const filteredInvitations = currentInvitations.filter(
            (inv) => inv.token !== token
          );
          this._pendingInvitations.next(filteredInvitations);
        }),
        finalize(() => this._isLoading.set(false))
      );
  }

  declineInvitation(token: string): Observable<ApiResponse<void>> {
    this._isLoading.set(true);

    return this.http
      .post<ApiResponse<void>>(
        this.apiUrlService.getUrl(`invitations/${token}/decline`),
        {}
      )
      .pipe(
        tap(() => {
          const currentInvitations = this._pendingInvitations.value;
          const filteredInvitations = currentInvitations.filter(
            (inv) => inv.token !== token
          );
          this._pendingInvitations.next(filteredInvitations);
        }),
        finalize(() => this._isLoading.set(false))
      );
  }

  cancelInvitation(invitationId: number): Observable<ApiResponse<void>> {
    this._isLoading.set(true);

    return this.http
      .delete<ApiResponse<void>>(
        this.apiUrlService.getUrl(`invitations/${invitationId}`)
      )
      .pipe(finalize(() => this._isLoading.set(false)));
  }

  getCurrentFamilyMembers(): FamilyMember[] {
    return this._familyMembers.value;
  }

  getCurrentPendingInvitations(): FamilyInvitation[] {
    return this._pendingInvitations.value;
  }

  clearState(): void {
    this._familyMembers.next([]);
    this._pendingInvitations.next([]);
  }
}
