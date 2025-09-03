import { Component, OnInit, inject, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
  IonIcon, IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonLabel, IonCheckbox, IonModal, IonList
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  closeOutline, personAddOutline, mailOutline, shieldCheckmarkOutline,
  chatbubbleOutline, sendOutline
} from 'ionicons/icons';

import { ModalController } from '@ionic/angular';
import { FamilyRoleEnum, getFamilyRoleName } from '../../../models/families/family.models';
import { ValidationErrorDirective } from '../../directives/validation-error.directive';

export interface InviteMemberResult {
  email: string;
  role: FamilyRoleEnum;
  message?: string;
}

@Component({
  selector: 'app-invite-member-modal',
  templateUrl: './invite-member.modal.html',
  styleUrls: ['./invite-member.modal.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
    IonIcon, IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption,
    IonLabel, IonCheckbox, IonModal, IonList, ValidationErrorDirective
  ]
})
export class InviteMemberModal implements OnInit {
  @Input() familyName: string = '';
  @Input() canInviteModerators: boolean = false;

  private readonly formBuilder = inject(FormBuilder);
  private readonly modalController = inject(ModalController);

  inviteForm!: FormGroup;
  readonly isSubmitted = signal<boolean>(false);
  readonly FamilyRoleEnum = FamilyRoleEnum;

  readonly roleOptions = [
    {
      value: FamilyRoleEnum.MEMBER,
      label: getFamilyRoleName(FamilyRoleEnum.MEMBER),
      description: 'Can view and participate in family activities'
    },
    {
      value: FamilyRoleEnum.CHILD,
      label: getFamilyRoleName(FamilyRoleEnum.CHILD),
      description: 'Limited access appropriate for children'
    }
  ];

  constructor() {
    this.addIcons();
    this.initializeForm();
  }

  ngOnInit() {
    // Add moderator option if user has permission
    if (this.canInviteModerators) {
      this.roleOptions.unshift({
        value: FamilyRoleEnum.MODERATOR,
        label: getFamilyRoleName(FamilyRoleEnum.MODERATOR),
        description: 'Can manage members and family settings'
      });
    }
  }

  private addIcons() {
    addIcons({
      closeOutline, personAddOutline, mailOutline, shieldCheckmarkOutline,
      chatbubbleOutline, sendOutline
    });
  }

  private initializeForm() {
    this.inviteForm = this.formBuilder.group({
      email: ['', [
        Validators.required,
        Validators.email
      ]],
      role: [FamilyRoleEnum.MEMBER, [
        Validators.required
      ]],
      message: ['', [
        Validators.maxLength(500)
      ]]
    });
  }

  async dismiss() {
    await this.modalController.dismiss();
  }

  async onSendInvite() {
    this.isSubmitted.set(true);

    if (!this.inviteForm.valid) {
      this.markFormGroupTouched();
      return;
    }

    const result: InviteMemberResult = {
      email: this.inviteForm.value.email.trim(),
      role: this.inviteForm.value.role,
      message: this.inviteForm.value.message?.trim() || undefined
    };

    await this.modalController.dismiss(result, 'confirm');
  }

  private markFormGroupTouched() {
    Object.keys(this.inviteForm.controls).forEach(key => {
      this.inviteForm.get(key)?.markAsTouched();
    });
  }

  getFamilyRoleName(role: FamilyRoleEnum): string {
    return getFamilyRoleName(role);
  }
}
