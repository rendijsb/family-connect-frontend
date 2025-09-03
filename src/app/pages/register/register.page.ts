import {Component, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';
import {
  IonContent, IonButton, IonInput, IonItem, IonLabel, IonCheckbox,
  IonCard, IonCardContent, IonIcon, IonText, IonGrid, IonRow, IonCol,
  Platform
} from '@ionic/angular/standalone';
import {Router, RouterLink} from '@angular/router';
import {addIcons} from 'ionicons';
import {
  mailOutline, lockClosedOutline, eyeOutline, eyeOffOutline,
  personOutline, phonePortraitOutline, checkmarkOutline,
  logoApple, logoGoogle, logoFacebook, arrowBackOutline,
  alertCircleOutline, reloadOutline
} from 'ionicons/icons';
import {AuthService} from '../../core/services/auth/auth.service';
import {catchError, EMPTY, finalize, tap} from 'rxjs';
import {Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {Capacitor} from '@capacitor/core';
import {Keyboard} from '@capacitor/keyboard';
import {Haptics, ImpactStyle} from '@capacitor/haptics';
import {ValidationErrorDirective} from '../../shared/directives/validation-error.directive';
import {ToastService} from '../../shared/services/toast.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink,
    IonContent, IonButton, IonInput, IonItem, IonLabel, IonCheckbox,
    IonCard, IonCardContent, IonIcon, IonText, IonGrid, IonRow, IonCol,
    ValidationErrorDirective
  ]
})
export class RegisterPage implements OnInit, OnDestroy {
  @ViewChild('registerCard', {read: ElementRef}) registerCard!: ElementRef;

  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly platform = inject(Platform);
  private readonly destroy$ = new Subject<void>();

  registerForm!: FormGroup;

  readonly showPassword = signal<boolean>(false);
  readonly showConfirmPassword = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly currentStep = signal<number>(1);
  readonly totalSteps = signal<number>(2);
  readonly keyboardHeight = signal<number>(0);
  readonly isSubmitted = signal<boolean>(false);

  // Simplified validation signals
  readonly step1Valid = signal<boolean>(false);
  readonly step2Valid = signal<boolean>(false);

  constructor() {
    this.addIcons();
    this.initializeForm();
    this.setupKeyboardHandling();
  }

  ngOnInit() {
    this.setupFormValidation();
    this.handleExistingAuthentication();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private addIcons() {
    addIcons({
      mailOutline, lockClosedOutline, eyeOutline, eyeOffOutline,
      personOutline, phonePortraitOutline, checkmarkOutline,
      logoApple, logoGoogle, logoFacebook, arrowBackOutline,
      alertCircleOutline, reloadOutline
    });
  }

  private initializeForm() {
    this.registerForm = this.formBuilder.group({
      firstName: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50)
      ]],
      lastName: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50)
      ]],
      email: ['', [
        Validators.required,
        Validators.email
      ]],
      phone: [''], // Made completely optional - no validators
      password: ['', [
        Validators.required,
        Validators.minLength(8)
      ]],
      confirmPassword: ['', [
        Validators.required
      ]],
      agreeToTerms: [false, [
        Validators.requiredTrue
      ]],
      subscribeToNewsletter: [false]
    }, {
      validators: [this.passwordMatchValidator]
    });
  }

  private setupFormValidation() {
    this.registerForm.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.validateStep1();
      this.validateStep2();
    });

    // Initial validation
    this.validateStep1();
    this.validateStep2();
  }

  private validateStep1() {
    const firstName = this.registerForm.get('firstName');
    const lastName = this.registerForm.get('lastName');
    const email = this.registerForm.get('email');
    const phone = this.registerForm.get('phone');

    // Required fields validation
    const firstNameValid = firstName?.valid || false;
    const lastNameValid = lastName?.valid || false;
    const emailValid = email?.valid || false;

    // Phone is always valid since it's optional
    const phoneValid = true;

    const isValid = firstNameValid && lastNameValid && emailValid && phoneValid;
    this.step1Valid.set(isValid);

    console.log('Step 1 validation:', {
      firstNameValid,
      lastNameValid,
      emailValid,
      phoneValid,
      isValid,
      firstName: firstName?.value,
      lastName: lastName?.value,
      email: email?.value,
      phone: phone?.value
    });
  }

  private validateStep2() {
    const password = this.registerForm.get('password');
    const confirmPassword = this.registerForm.get('confirmPassword');
    const agreeToTerms = this.registerForm.get('agreeToTerms');

    const passwordValid = password?.valid || false;
    const confirmPasswordValid = confirmPassword?.valid || false;
    const termsValid = agreeToTerms?.valid || false;
    const passwordsMatch = !this.registerForm.hasError('passwordMismatch');

    const isValid = passwordValid && confirmPasswordValid && termsValid && passwordsMatch;
    this.step2Valid.set(isValid);
  }

  private handleExistingAuthentication() {
    if (this.authService.isAuthenticated()) {
      this.redirectUser();
    }
  }

  private setupKeyboardHandling() {
    if (Capacitor.isNativePlatform()) {
      Keyboard.addListener('keyboardWillShow', (info) => {
        this.keyboardHeight.set(info.keyboardHeight);
        this.adjustLayoutForKeyboard(true);
      });

      Keyboard.addListener('keyboardWillHide', () => {
        this.keyboardHeight.set(0);
        this.adjustLayoutForKeyboard(false);
      });
    }
  }

  private adjustLayoutForKeyboard(keyboardVisible: boolean) {
    if (this.registerCard?.nativeElement) {
      if (keyboardVisible) {
        this.registerCard.nativeElement.style.transform = 'translateY(-50px)';
        this.registerCard.nativeElement.style.transition = 'transform 0.3s ease';
      } else {
        this.registerCard.nativeElement.style.transform = 'translateY(0)';
      }
    }
  }

  private passwordMatchValidator(form: FormGroup): ValidationErrors | null {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');

    if (password && confirmPassword && password.value && confirmPassword.value && password.value !== confirmPassword.value) {
      return {passwordMismatch: true};
    }
    return null;
  }

  togglePasswordVisibility() {
    this.showPassword.set(!this.showPassword());
    this.triggerHapticFeedback();
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.set(!this.showConfirmPassword());
    this.triggerHapticFeedback();
  }

  private async triggerHapticFeedback() {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({style: ImpactStyle.Light});
      } catch (error) {
        console.log('Haptics not available:', error);
      }
    }
  }

  async nextStep() {
    console.log('nextStep called, currentStep:', this.currentStep(), 'step1Valid:', this.step1Valid());

    if (this.currentStep() === 1) {
      // Check if required fields are filled
      const firstName = this.registerForm.get('firstName')?.value?.trim();
      const lastName = this.registerForm.get('lastName')?.value?.trim();
      const email = this.registerForm.get('email')?.value?.trim();

      if (!firstName || !lastName || !email) {
        this.markStep1FieldsAsTouched();
        await this.toastService.showToast('Please fill in your name and email address.', 'danger');
        return;
      }

      // Check email format
      const emailValid = this.registerForm.get('email')?.valid;
      if (!emailValid) {
        this.markStep1FieldsAsTouched();
        await this.toastService.showToast('Please enter a valid email address.', 'danger');
        return;
      }

      // Proceed to next step
      this.currentStep.set(2);
      this.isSubmitted.set(false);
      this.triggerHapticFeedback();
      this.scrollToTop();
    }
  }

  previousStep() {
    if (this.currentStep() > 1) {
      this.currentStep.set(this.currentStep() - 1);
      this.isSubmitted.set(false);
      this.triggerHapticFeedback();
      this.scrollToTop();
    }
  }

  private scrollToTop() {
    if (this.registerCard?.nativeElement) {
      this.registerCard.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

  private markStep1FieldsAsTouched() {
    const step1Fields = ['firstName', 'lastName', 'email'];
    step1Fields.forEach(field => {
      this.registerForm.get(field)?.markAsTouched();
    });
    this.isSubmitted.set(true);
  }

  getPasswordStrength(): { strength: string, color: string, width: string } {
    const password = this.registerForm.get('password')?.value || '';
    let score = 0;

    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[#?!@$%^&*-]/.test(password)) score++;

    switch (score) {
      case 0:
      case 1:
        return {strength: 'Weak', color: '#ef4444', width: '20%'};
      case 2:
        return {strength: 'Fair', color: '#f97316', width: '40%'};
      case 3:
        return {strength: 'Good', color: '#eab308', width: '60%'};
      case 4:
        return {strength: 'Strong', color: '#22c55e', width: '80%'};
      case 5:
        return {strength: 'Very Strong', color: '#16a34a', width: '100%'};
      default:
        return {strength: 'Weak', color: '#ef4444', width: '20%'};
    }
  }

  async onRegister() {
    this.isSubmitted.set(true);

    if (!this.registerForm.valid) {
      this.markAllFieldsAsTouched();
      await this.toastService.showToast('Please fix the errors in the form.', 'danger');
      return;
    }

    this.isLoading.set(true);

    const formValue = this.registerForm.value;
    const payload = {
      ...formValue,
      password_confirmation: formValue.confirmPassword
    };

    this.authService.register(payload)
      .pipe(
        tap(async () => {
          await this.triggerHapticFeedback();
          await this.toastService.showToast('Account created successfully! Welcome to Family Connect.', 'success');
          this.redirectUser();
        }),
        catchError(async (error) => {
          if (error.status === 422) {
            await this.toastService.showToast('Please check your input and try again.', 'danger');
          } else {
            await this.toastService.showToast('Registration failed. Please try again.', 'danger');
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

  async onSocialRegister(provider: string) {
    console.log('Social registration with:', provider);
    await this.triggerHapticFeedback();
    // TODO: Implement social registration
    await this.toastService.showToast(`${provider} registration will be available soon!`, 'warning');
  }

  private markAllFieldsAsTouched() {
    Object.keys(this.registerForm.controls).forEach(key => {
      this.registerForm.get(key)?.markAsTouched();
    });
    this.isSubmitted.set(true);
  }

  private redirectUser() {
    this.router.navigate(['/tabs/home']);
  }
}
