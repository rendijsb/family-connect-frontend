import {computed, inject, Injectable, signal} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {RoleEnum, User} from "../../../models/users/user.models";
import {Router} from "@angular/router";
import {catchError, EMPTY, Observable, switchMap, tap, throwError} from "rxjs";
import {ApiUrlService} from "../api.service";
import {StorageService} from "../storage.service";
import {ToastController, LoadingController, AlertController} from '@ionic/angular';

interface AuthResponse {
  success: boolean;
  message?: string;
  data: {
    user: User;
    token: string;
    tokenType: string;
  };
  error?: string;
}

interface ErrorResponse {
  success: boolean;
  message: string;
  errors?: { [key: string]: string[] };
  error?: string;
}

interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string;
  agreeToTerms: boolean;
  subscribeToNewsletter?: boolean;
}

interface LoginPayload {
  email: string;
  password: string;
  remember?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly tokenKey = 'auth_token';
  private readonly userKey = 'user_data';
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrlService = inject(ApiUrlService);
  private readonly storage = inject(StorageService);
  private readonly toastController = inject(ToastController);
  private readonly loadingController = inject(LoadingController);
  private readonly alertController = inject(AlertController);

  private readonly _currentUser = signal<User | null>(null);
  private readonly _token = signal<string | null>(null);
  private readonly _isInitialized = signal<boolean>(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly authToken = this._token.asReadonly();
  readonly isInitialized = this._isInitialized.asReadonly();

  readonly isAdmin = computed(() => this._currentUser()?.role?.id === 1);
  readonly isModerator = computed(() => this._currentUser()?.role?.id === 2);
  readonly isFamilyOwner = computed(() => this._currentUser()?.role?.id === 3);
  readonly isFamilyMember = computed(() => this._currentUser()?.role?.id === 4);
  readonly isClient = computed(() => this._currentUser()?.role?.id === 5);
  readonly isAuthenticated = computed(() => !!this._token() && !!this._currentUser());

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    try {
      const token = await this.storage.getItem(this.tokenKey);
      const userDataString = await this.storage.getItem(this.userKey);

      if (token && userDataString) {
        const userData = JSON.parse(userDataString);
        this._currentUser.set(userData);
        this._token.set(token);

        this.verifyTokenValidity().subscribe({
          error: () => {
            this.clearAuthData();
          }
        });
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      await this.clearAuthData();
    } finally {
      this._isInitialized.set(true);
    }
  }

  private verifyTokenValidity(): Observable<User> {
    return this.http.get<{ success: boolean, data: User }>(
      this.apiUrlService.getUrl('auth/me')
    ).pipe(
      tap(response => {
        this._currentUser.set(response.data);
        this.saveUserToStorage(response.data);
      }),
      switchMap(response => [response.data]),
      catchError((error) => {
        this.clearAuthData();
        return throwError(() => error);
      })
    );
  }

  user(): User | null {
    try {
      if (typeof this._currentUser === 'function') {
        return this._currentUser();
      } else {
        console.error('_currentUser is not a signal function:', typeof this._currentUser);
        return null;
      }
    } catch (error) {
      console.error('Error accessing current user:', error);
      return null;
    }
  }

  getCurrentUser(): User | null {
    try {
      return this._currentUser();
    } catch (error) {
      return null;
    }
  }

  getToken(): string | null {
    try {
      return this._token();
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  isAuthInitialized(): boolean {
    try {
      return this._isInitialized();
    } catch (error) {
      console.error('Error checking initialization:', error);
      return false;
    }
  }

  get currentUserValue(): User | null {
    return this.user();
  }

  register(userData: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      this.apiUrlService.getUrl('auth/register'),
      {
        name: `${userData.firstName} ${userData.lastName}`.trim(),
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        password: userData.password,
        password_confirmation: userData.password_confirmation,
        phone: userData.phone,
        agreeToTerms: userData.agreeToTerms,
        subscribeToNewsletter: userData.subscribeToNewsletter || false
      }
    ).pipe(
      tap(async (response) => {
        await this.handleAuthSuccess(response.data.user, response.data.token);
      }),
    );
  }

  login(credentials: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      this.apiUrlService.getUrl('auth/login'),
      {
        email: credentials.email,
        password: credentials.password,
        remember: credentials.remember || false
      }
    ).pipe(
      tap(async (response) => {
        await this.handleAuthSuccess(response.data.user, response.data.token);
      }),
    );
  }

  logout(): Observable<any> {
    return this.http.post(this.apiUrlService.getUrl('auth/logout'), {}).pipe(
      tap(async () => {
        await this.clearAuthData();
        this._currentUser.set(null);
        this._token.set(null);
        await this.router.navigate(['/login']);
      }),
      catchError(async (error) => {
        await this.clearAuthData();
        this._currentUser.set(null);
        this._token.set(null);
        await this.router.navigate(['/login']);
        return EMPTY;
      })
    );
  }

  forgotPassword(email: string): Observable<{ success: boolean, message: string }> {
    return this.http.post<{ success: boolean, message: string }>(
      this.apiUrlService.getUrl('auth/forgot-password'),
      {email}
    ).pipe();
  }

  resetPassword(resetData: {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
  }): Observable<{ success: boolean, message: string }> {
    return this.http.post<{ success: boolean, message: string }>(
      this.apiUrlService.getUrl('auth/reset-password'),
      resetData
    ).pipe();
  }

  refreshUser(): Observable<User> {
    return this.http.get<{ success: boolean, data: User }>(
      this.apiUrlService.getUrl('user')
    ).pipe(
      tap(response => {
        this._currentUser.set(response.data);
        this.saveUserToStorage(response.data);
      }),
      switchMap(response => [response.data]),
    );
  }

  waitForInitialization(): Observable<boolean> {
    return new Observable(subscriber => {
      const checkInitialization = () => {
        if (this.isAuthInitialized()) {
          subscriber.next(true);
          subscriber.complete();
        } else {
          setTimeout(checkInitialization, 10);
        }
      };
      checkInitialization();
    });
  }

  canManageFamily(): boolean {
    const user = this.user();
    return user ? <boolean>user.canManageFamily : false;
  }

  hasRole(role: RoleEnum): boolean {
    const user = this.user();
    return user?.role?.name === role;
  }

  hasAnyRole(roles: RoleEnum[]): boolean {
    const user = this.user();
    return user ? roles.includes(user.role?.name as RoleEnum) : false;
  }

  private async handleAuthSuccess(user: User, token: string): Promise<void> {
    await this.setUserData(user, token);
    this._currentUser.set(user);
    this._token.set(token);
  }

  private async setUserData(user: User, token: string): Promise<void> {
    await this.storage.setItem(this.tokenKey, token);
    await this.saveUserToStorage(user);
  }

  private async saveUserToStorage(user: User): Promise<void> {
    await this.storage.setItem(this.userKey, JSON.stringify(user));
  }

  private async clearAuthData(): Promise<void> {
    await this.storage.removeItem(this.tokenKey);
    await this.storage.removeItem(this.userKey);
  }
}
