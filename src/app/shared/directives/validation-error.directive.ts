import {
  Directive,
  ElementRef,
  inject,
  input,
  effect,
  Renderer2,
  OnInit,
  DestroyRef,
  signal,
  computed
} from '@angular/core';
import { NgControl } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Directive({
  selector: '[appValidationError]',
  standalone: true
})
export class ValidationErrorDirective implements OnInit {
  appValidationError = input<boolean>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly renderer = inject(Renderer2);
  private readonly el = inject(ElementRef);
  private readonly ngControl = inject(NgControl);

  private errorElement: HTMLDivElement | null = null;
  private readonly controlErrors = signal<Record<string, any> | null>(null);

  private readonly errorMessages = computed(() => {
    const errors = this.controlErrors();
    if (!errors) return [];
    return this.getErrorMessages(errors);
  });

  ngOnInit() {
    this.ngControl.control?.valueChanges?.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      if (this.appValidationError()) {
        this.updateErrors();
      }
    });

    this.ngControl.control?.statusChanges?.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      if (this.appValidationError()) {
        this.updateErrors();
      }
    });
  }

  constructor() {
    effect(() => {
      if (this.appValidationError()) {
        this.ngControl.control?.markAsTouched();
        this.updateErrors();
      } else {
        this.removeErrors();
      }
    });
  }

  private updateErrors(): void {
    this.controlErrors.set(this.ngControl.control?.errors || null);

    if (this.errorMessages().length > 0) {
      this.showErrors(this.errorMessages());
      this.addErrorStyling();
    } else {
      this.removeErrors();
      this.removeErrorStyling();
    }
  }

  private showErrors(messages: string[]): void {
    this.removeErrors();

    if (messages.length > 0) {
      this.errorElement = this.renderer.createElement('div');
      this.renderer.addClass(this.errorElement, 'validation-error');

      // Mobile-optimized styles
      this.renderer.setStyle(this.errorElement, 'margin-top', '4px');
      this.renderer.setStyle(this.errorElement, 'padding-left', '14px');
      this.renderer.setStyle(this.errorElement, 'animation', 'fadeIn 0.2s ease-in-out');

      messages.forEach(message => {
        const messageElement = this.renderer.createElement('p');
        this.renderer.addClass(messageElement, 'error-message');
        this.renderer.setStyle(messageElement, 'font-size', '12px');
        this.renderer.setStyle(messageElement, 'color', '#ef4444');
        this.renderer.setStyle(messageElement, 'line-height', '1.3');
        this.renderer.setStyle(messageElement, 'margin', '0');
        this.renderer.setStyle(messageElement, 'margin-bottom', '2px');
        this.renderer.setProperty(messageElement, 'textContent', message);
        this.renderer.appendChild(this.errorElement, messageElement);
      });

      // Find the best insertion point for Ionic components
      const insertionPoint = this.findInsertionPoint();
      if (insertionPoint.parent && insertionPoint.nextSibling) {
        this.renderer.insertBefore(insertionPoint.parent, this.errorElement, insertionPoint.nextSibling);
      } else if (insertionPoint.parent) {
        this.renderer.appendChild(insertionPoint.parent, this.errorElement);
      }
    }
  }

  private removeErrors(): void {
    if (this.errorElement?.parentNode) {
      this.renderer.removeChild(this.errorElement.parentNode, this.errorElement);
      this.errorElement = null;
    }
  }

  private addErrorStyling(): void {
    // Add error styling to Ionic components
    const ionItem = this.findIonItem();
    if (ionItem) {
      this.renderer.addClass(ionItem, 'ion-invalid');
      this.renderer.setStyle(ionItem, 'border-color', '#ef4444');
      this.renderer.setStyle(ionItem, '--border-color', '#ef4444');
      this.renderer.setStyle(ionItem, '--highlight-color-focused', '#ef4444');
    }
  }

  private removeErrorStyling(): void {
    const ionItem = this.findIonItem();
    if (ionItem) {
      this.renderer.removeClass(ionItem, 'ion-invalid');
      this.renderer.removeStyle(ionItem, 'border-color');
      this.renderer.removeStyle(ionItem, '--border-color');
      this.renderer.removeStyle(ionItem, '--highlight-color-focused');
    }
  }

  private findIonItem(): HTMLElement | null {
    let current = this.el.nativeElement;

    // Traverse up to find ion-item
    while (current && current !== document.body) {
      if (current.tagName?.toLowerCase() === 'ion-item') {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  private findInsertionPoint(): { parent: HTMLElement | null; nextSibling: HTMLElement | null } {
    let current = this.el.nativeElement;

    // For Ionic components, we want to insert after ion-item
    while (current && current !== document.body) {
      if (current.tagName?.toLowerCase() === 'ion-item') {
        return {
          parent: current.parentElement,
          nextSibling: current.nextElementSibling as HTMLElement
        };
      }
      current = current.parentElement;
    }

    // Fallback: insert after the current element
    return {
      parent: this.el.nativeElement.parentElement,
      nextSibling: this.el.nativeElement.nextElementSibling as HTMLElement
    };
  }

  private getErrorMessages(errors: Record<string, any>): string[] {
    const messages: string[] = [];
    const fieldName = this.getFieldName();

    if (errors['required']) {
      messages.push(`${fieldName} is required`);
    }

    if (errors['email']) {
      messages.push('Please enter a valid email address');
    }

    if (errors['minlength']) {
      const required = errors['minlength'].requiredLength;
      messages.push(`${fieldName} must be at least ${required} characters`);
    }

    if (errors['maxlength']) {
      const required = errors['maxlength'].requiredLength;
      messages.push(`${fieldName} cannot exceed ${required} characters`);
    }

    if (errors['pattern']) {
      messages.push(this.getPatternErrorMessage(fieldName));
    }

    if (errors['min']) {
      messages.push(`${fieldName} must be at least ${errors['min'].min}`);
    }

    if (errors['max']) {
      messages.push(`${fieldName} cannot exceed ${errors['max'].max}`);
    }

    if (errors['weakPassword']) {
      messages.push('Password must contain uppercase, lowercase, number and special character');
    }

    if (errors['passwordMismatch'] || errors['confirmedValidator']) {
      messages.push('Passwords do not match');
    }

    if (errors['invalidName']) {
      messages.push('Please enter a valid name');
    }

    if (errors['invalidPhone']) {
      messages.push('Please enter a valid phone number');
    }

    if (errors['unique']) {
      messages.push(`This ${fieldName.toLowerCase()} is already taken`);
    }

    // Backend errors
    if (errors['backend']) {
      messages.push(errors['backend']);
    }

    return messages;
  }

  private getFieldName(): string {
    const controlName = this.ngControl.name?.toString() || '';

    const fieldNames: Record<string, string> = {
      firstName: 'First name',
      lastName: 'Last name',
      email: 'Email',
      phone: 'Phone number',
      password: 'Password',
      confirmPassword: 'Confirm password',
      name: 'Name',
      description: 'Description',
      joinCode: 'Join code',
      maxMembers: 'Maximum members',
      timezone: 'Timezone',
      language: 'Language',
      privacy: 'Privacy setting'
    };

    return fieldNames[controlName] || controlName.charAt(0).toUpperCase() + controlName.slice(1);
  }

  private getPatternErrorMessage(fieldName: string): string {
    const controlName = this.ngControl.name?.toString() || '';

    const patternMessages: Record<string, string> = {
      email: 'Please enter a valid email address',
      phone: 'Please enter a valid phone number',
      password: 'Password format is invalid',
      name: 'Name can only contain letters, spaces, hyphens and apostrophes',
      firstName: 'First name can only contain letters, spaces, hyphens and apostrophes',
      lastName: 'Last name can only contain letters, spaces, hyphens and apostrophes'
    };

    return patternMessages[controlName] || `${fieldName} format is invalid`;
  }
}
