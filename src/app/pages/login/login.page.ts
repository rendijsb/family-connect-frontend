import {Component, inject, signal, OnInit, OnDestroy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators} from '@angular/forms';
import {
  IonContent, IonButton, IonInput, IonItem, IonLabel, IonCheckbox,
  IonCard, IonCardContent, IonIcon, IonText
} from '@ionic/angular/standalone';
import {Router, RouterLink} from '@angular/router';
import {addIcons} from 'ionicons';
import {
  mailOutline, lockClosedOutline, eyeOutline, eyeOffOutline,
  logoApple, logoGoogle, logoFacebook, personOutline, reloadOutline
} from 'ionicons/icons';
import {AuthService} from '../../core/services/auth/auth.service';
import {catchError, EMPTY, finalize, tap, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {ValidationErrorDirective} from '../../shared/directives/validation-error.directive';
import {ToastService} from '../../shared/services/toast.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink,
    IonContent, IonButton, IonInput, IonItem, IonLabel, IonCheckbox,
    IonCard, IonCardContent, IonIcon, IonText, ValidationErrorDirective
  ]
})
export class LoginPage implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();

  loginForm!: FormGroup;

  readonly showPassword = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly isSubmitted = signal<boolean>(false);

  constructor() {
    this.addIcons();
    this.initializeForm();
  }

  ngOnInit() {
    this.handleExistingAuthentication();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private addIcons() {
    addIcons({
      mailOutline, lockClosedOutline, eyeOutline, eyeOffOutline,
      logoApple, logoGoogle, logoFacebook, personOutline, reloadOutline
    });
  }

  private initializeForm() {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });
  }

  private handleExistingAuthentication() {
    if (this.authService.isAuthenticated()) {
      this.redirectUser();
    }
  }

  togglePasswordVisibility() {
    this.showPassword.set(!this.showPassword());
  }

  async onLogin() {
    this.isSubmitted.set(true);

    if (!this.loginForm.valid) {
      await this.toastService.showToast('Please fill in all required fields correctly.', 'danger');
      return;
    }

    this.isLoading.set(true);

    const payload = {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password,
      remember: this.loginForm.value.rememberMe
    };

    this.authService.login(payload)
      .pipe(
        tap(async () => {
          await this.toastService.showToast('Login successful! Welcome back.', 'success');
          this.redirectUser();
        }),
        catchError(async (error) => {
          if (error.status === 422 && error.error?.errors) {
            await this.toastService.showToast('Please check your credentials.', 'danger');
          } else if (error.status === 401) {
            await this.toastService.showToast('Invalid email or password. Please try again.', 'danger');
          } else {
            await this.toastService.showToast('An error occurred during login. Please try again.', 'danger');
          }

          return EMPTY;
        }),
        finalize(() => {
          this.isLoading.set(false);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  async onSocialLogin(provider: string) {
    // TODO: Implement social login
    await this.toastService.showToast(`${provider} login will be available soon!`, 'warning');
  }

  private redirectUser() {
    this.router.navigate(['/tabs/home']);
  }
}
